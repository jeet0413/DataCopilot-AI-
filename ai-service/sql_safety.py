"""
SQL safety layer for AI-generated queries.

Every SQL string produced by the LLM (or by the rule-based fallback) must pass
`validate_select_sql` before it is executed. The validator parses the statement
with sqlglot (PostgreSQL dialect) and enforces an allowlist:

  * exactly one statement, and it must be a SELECT (optionally with CTEs / UNION)
  * the only relation it may read is the dataset's own table (plus its own CTEs)
  * no SELECT ... INTO, row locking, table functions, LATERAL, UNNEST
  * no system / admin / file functions (pg_*, lo_*, dblink, set_config, ...)

Validation is defence in depth: the executor additionally runs the statement in
a READ ONLY transaction with a statement timeout and a row cap, and should use a
database role that can only read the dataset schema.
"""
import re
from typing import Optional

import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError

DATA_SCHEMA = "user_data"
TABLE_NAME_RE = re.compile(r"^ds_[0-9a-f]{32}$")

MAX_SQL_CHARS = 8000

# Function names (lower-case) that must never appear, in addition to any name
# starting with one of the prefixes below.
_FORBIDDEN_FUNCTIONS = {
    "current_version", "current_catalog", "set_config", "current_setting", "version", "current_database", "current_schema",
    "current_schemas", "current_user", "session_user", "user", "inet_server_addr",
    "inet_server_port", "dblink", "dblink_exec", "query_to_xml", "table_to_xml",
    "database_to_xml", "schema_to_xml", "xpath", "txid_current", "pg_sleep",
    "generate_series",  # unbounded row generation; use real data instead
}
_FORBIDDEN_PREFIXES = ("pg_", "lo_", "txid_", "dblink", "has_")


class UnsafeSQLError(ValueError):
    """Raised when a SQL statement is rejected by the safety validator."""


def is_valid_table_name(name: Optional[str]) -> bool:
    return bool(name) and bool(TABLE_NAME_RE.match(name))


def _function_names(node: exp.Expression) -> set:
    """All names a function node may be known by: sqlglot's canonical name and the SQL it renders as."""
    names = set()
    if isinstance(node, exp.Anonymous):
        names.add(str(node.name or "").lower())
    elif hasattr(node, "sql_name"):
        names.add(node.sql_name().lower())
    match = re.match(r"\s*([a-z_][a-z0-9_]*)", node.sql(dialect="postgres").lower())
    if match:
        names.add(match.group(1))
    return {n for n in names if n}


def validate_select_sql(sql: str, allowed_table: str) -> str:
    """Validate `sql` and return it normalised (single statement, no trailing ';').

    `allowed_table` is the physical table name (ds_<32 hex>) that the query may read.
    Raises UnsafeSQLError with a short, user-safe reason on any violation.
    """
    if not is_valid_table_name(allowed_table):
        raise UnsafeSQLError("invalid dataset table name")
    if not sql or not sql.strip():
        raise UnsafeSQLError("empty SQL")
    if len(sql) > MAX_SQL_CHARS:
        raise UnsafeSQLError("SQL is too long")

    cleaned = sql.strip()
    # LLMs often wrap output in markdown fences.
    cleaned = re.sub(r"^```(?:sql)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()
    cleaned = cleaned.rstrip(";").strip()

    if "\x00" in cleaned:
        raise UnsafeSQLError("invalid characters in SQL")

    try:
        statements = sqlglot.parse(cleaned, read="postgres")
    except SqlglotError as e:
        raise UnsafeSQLError(f"SQL could not be parsed: {str(e)[:160]}") from e

    statements = [s for s in statements if s is not None]
    if len(statements) != 1:
        raise UnsafeSQLError("exactly one SQL statement is allowed")
    tree = statements[0]

    if not isinstance(tree, (exp.Select, exp.Union, exp.Subquery)):
        raise UnsafeSQLError("only SELECT statements are allowed")

    # Disallow any non-read node anywhere in the tree.
    banned_nodes = (
        exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Create, exp.Alter,
        exp.Command, exp.Merge, exp.Copy, exp.Set, exp.Use, exp.Lock,
        exp.Into, exp.Lateral, exp.Unnest,
    )
    for node in tree.walk():
        if isinstance(node, banned_nodes):
            raise UnsafeSQLError(f"{type(node).__name__.upper()} is not allowed")

    # CTE names are allowed as relations.
    cte_names = {cte.alias_or_name.lower() for cte in tree.find_all(exp.CTE)}

    for table in tree.find_all(exp.Table):
        if not isinstance(table.this, exp.Identifier):
            raise UnsafeSQLError("table functions are not allowed")
        name = (table.name or "").lower()
        db = (table.args.get("db").name.lower() if table.args.get("db") else "")
        catalog = table.args.get("catalog")
        if catalog:
            raise UnsafeSQLError("cross-database references are not allowed")
        if name in cte_names and not db:
            continue
        if name != allowed_table.lower():
            raise UnsafeSQLError("query may only read the selected dataset")
        if db and db != DATA_SCHEMA:
            raise UnsafeSQLError("schema-qualified references are not allowed")

    # Anonymous functions (unknown to sqlglot) are the usual vector for system calls, but
    # sqlglot also maps some (version(), current_database()) to dedicated node types.
    for func in tree.find_all(exp.Func):
        for fname in _function_names(func):
            if fname in _FORBIDDEN_FUNCTIONS or fname.startswith(_FORBIDDEN_PREFIXES):
                raise UnsafeSQLError(f"function '{fname}' is not allowed")

    # Re-emit from the parsed tree so what we execute is exactly what we validated.
    return tree.sql(dialect="postgres")
