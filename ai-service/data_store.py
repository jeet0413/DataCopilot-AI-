"""
Dataset storage + safe query execution for the AI service.

Uploaded CSV files are loaded into PostgreSQL as one table per dataset inside a
dedicated schema (`user_data`), named `ds_<32 hex>` after the dataset id. The
backend decides which dataset a user may query; this module only ever touches
tables with that exact naming pattern.

Two database URLs are supported:
  DATABASE_URL        read/write role  - used for ingestion and table drops
  QUERY_DATABASE_URL  read-only role   - used to execute generated SQL (optional,
                      strongly recommended; falls back to DATABASE_URL)
For backwards compatibility SUPABASE_URL is used when it holds a postgres:// URL.
"""
import datetime as dt
import decimal
import logging
import math
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from sql_safety import DATA_SCHEMA, is_valid_table_name, validate_select_sql

logger = logging.getLogger(__name__)

MAX_RESULT_ROWS = int(os.getenv("MAX_RESULT_ROWS", "1000"))
STATEMENT_TIMEOUT_MS = int(os.getenv("QUERY_TIMEOUT_MS", "10000"))


class DatabaseNotConfigured(RuntimeError):
    pass


class QueryExecutionError(RuntimeError):
    """A validated query failed inside the database (bad column, type error, timeout...)."""


def _pick_url(*names: str) -> Optional[str]:
    for name in names:
        value = os.getenv(name, "")
        if value.startswith(("postgresql://", "postgres://", "postgresql+psycopg2://")):
            # Pin the psycopg2 driver (the one in requirements.txt) regardless of SQLAlchemy's default.
            return value.replace("postgres://", "postgresql://", 1).replace("postgresql://", "postgresql+psycopg2://", 1)
    return None


_engines: Dict[str, Engine] = {}


def _engine_for(kind: str) -> Engine:
    if kind in _engines:
        return _engines[kind]
    if kind == "query":
        url = _pick_url("QUERY_DATABASE_URL", "DATABASE_URL", "SUPABASE_URL")
    else:
        url = _pick_url("DATABASE_URL", "SUPABASE_URL")
    if not url:
        raise DatabaseNotConfigured(
            "No PostgreSQL connection configured. Set DATABASE_URL (postgresql://...) for the AI service."
        )
    _engines[kind] = create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 5})
    return _engines[kind]


def reset_engines() -> None:
    """Dispose cached engines (used by tests)."""
    for eng in _engines.values():
        eng.dispose()
    _engines.clear()


def database_status() -> str:
    """'connected' | 'unavailable' | 'not_configured' without raising."""
    try:
        eng = _engine_for("write")
    except DatabaseNotConfigured:
        return "not_configured"
    try:
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        return "connected"
    except Exception as e:  # noqa: BLE001
        logger.warning("database health check failed: %s", type(e).__name__)
        return "unavailable"


def table_name_for_dataset(dataset_id: str) -> str:
    """Deterministic physical table name for a dataset UUID."""
    try:
        return f"ds_{uuid.UUID(str(dataset_id)).hex}"
    except (ValueError, AttributeError) as e:
        raise ValueError("dataset_id must be a UUID") from e


def ingest_dataframe(df: pd.DataFrame, table_name: str) -> int:
    """Create (or replace) the dataset's table from a DataFrame. Returns rows written."""
    if not is_valid_table_name(table_name):
        raise ValueError("invalid dataset table name")
    eng = _engine_for("write")
    with eng.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{DATA_SCHEMA}"'))
    df.to_sql(
        table_name,
        eng,
        schema=DATA_SCHEMA,
        if_exists="replace",
        index=False,
        chunksize=1000,
        method="multi",
    )
    # Grant read access to an optional read-only role (documented in STARTUP_GUIDE).
    ro_role = os.getenv("QUERY_DB_ROLE")
    if ro_role and ro_role.replace("_", "").isalnum():
        with eng.begin() as conn:
            conn.execute(text(f'GRANT USAGE ON SCHEMA "{DATA_SCHEMA}" TO "{ro_role}"'))
            conn.execute(text(f'GRANT SELECT ON "{DATA_SCHEMA}"."{table_name}" TO "{ro_role}"'))
    return int(len(df))


def describe_table(table_name: str) -> Optional[str]:
    """Build 'Table: x / - col: type' schema text from the database, or None if the table is missing."""
    if not is_valid_table_name(table_name):
        raise ValueError("invalid dataset table name")
    eng = _engine_for("write")
    q = text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema = :s AND table_name = :t ORDER BY ordinal_position"
    )
    with eng.connect() as conn:
        rows = conn.execute(q, {"s": DATA_SCHEMA, "t": table_name}).fetchall()
    if not rows:
        return None
    lines = [f"Table: {table_name}", "Columns:"] + [f"- {r[0]}: {r[1]}" for r in rows]
    return "\n".join(lines) + "\n"


def drop_dataset_table(table_name: str) -> bool:
    if not is_valid_table_name(table_name):
        raise ValueError("invalid dataset table name")
    eng = _engine_for("write")
    with eng.begin() as conn:
        conn.execute(text(f'DROP TABLE IF EXISTS "{DATA_SCHEMA}"."{table_name}"'))
    return True


def _json_safe(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, decimal.Decimal):
        f = float(value)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(value, float):
        return None if math.isnan(value) or math.isinf(value) else value
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, dt.timedelta):
        return value.total_seconds()
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value).hex()
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def run_readonly_query(sql: str, table_name: str, max_rows: int = MAX_RESULT_ROWS) -> Tuple[List[Dict[str, Any]], bool, str]:
    """Validate and execute `sql` against a single dataset table.

    Returns (rows, truncated, executed_sql). Raises:
      UnsafeSQLError      - rejected by the validator (never reaches the database)
      QueryExecutionError - database rejected/failed the validated statement
    """
    safe_sql = validate_select_sql(sql, table_name)
    eng = _engine_for("query")
    try:
        with eng.connect() as conn:
            with conn.begin():
                conn.exec_driver_sql("SET TRANSACTION READ ONLY")
                conn.exec_driver_sql(f"SET LOCAL statement_timeout = {int(STATEMENT_TIMEOUT_MS)}")
                conn.exec_driver_sql(f'SET LOCAL search_path = "{DATA_SCHEMA}"')
                # Use the raw DBAPI cursor so the validated SQL is sent verbatim: SQLAlchemy/psycopg2
                # parameter processing would otherwise mangle literals such as LIKE '%x%' or ':foo'.
                cur = conn.connection.cursor()
                try:
                    cur.execute(safe_sql)
                    columns = [d[0] for d in cur.description]
                    fetched = cur.fetchmany(max_rows + 1)
                finally:
                    cur.close()
    except Exception as e:  # noqa: BLE001
        orig = getattr(e, "orig", e)
        message = str(orig).strip().splitlines()[0] if str(orig).strip() else type(e).__name__
        raise QueryExecutionError(message[:300]) from e

    truncated = len(fetched) > max_rows
    rows = [
        {col: _json_safe(val) for col, val in zip(columns, row)}
        for row in fetched[:max_rows]
    ]
    return rows, truncated, safe_sql
