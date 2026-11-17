"""
AI Data Analyst Copilot Service
Natural Language to SQL conversion with insights generation.

Security model
  * The Node backend is the only intended client. Every endpoint except / and /health
    requires the shared secret in the X-Internal-Token header (AI_SERVICE_TOKEN).
  * The backend decides which dataset a user may query; this service only touches
    dataset tables named ds_<32 hex> inside the `user_data` schema.
  * All generated SQL is validated (sql_safety.py) and executed read-only with a
    timeout and a row cap (data_store.py).
"""

import hmac
import logging
import os
import time
from typing import Any, Dict, List, Optional, Union

import pandas as pd
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

load_dotenv()

import data_store  # noqa: E402  (after load_dotenv so env is populated)
from llm_utils import (  # noqa: E402
    _maybe_parse_dates,
    detect_chart_type,
    extract_insights_text,
    fix_sql_error,
    flatten_recommendations,
    generate_fallback_recommendations_structured,
    generate_insights_from_data,
    generate_recommendations_from_insights,
    generate_sql_from_query,
    load_csv_dataframe,
    process_uploaded_csv,
    profile_dataframe,
)
from sql_safety import UnsafeSQLError, is_valid_table_name  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
MAX_CSV_ROWS = int(os.getenv("MAX_CSV_ROWS", "500000"))
MAX_CSV_COLUMNS = int(os.getenv("MAX_CSV_COLUMNS", "200"))
MAX_INSIGHT_INPUT_ROWS = 5000

app = FastAPI(title="AI Data Analyst Service", version="2.0.0")

# The browser never calls this service directly (the Node backend proxies it), so CORS is
# closed unless origins are listed explicitly.
_allowed_origins = [o.strip() for o in os.getenv("AI_SERVICE_ALLOWED_ORIGINS", "").split(",") if o.strip()]
if _allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


async def require_internal_token(x_internal_token: Optional[str] = Header(default=None)) -> None:
    """Shared-secret check between the Node backend and this service."""
    expected = os.getenv("AI_SERVICE_TOKEN", "")
    if not expected:
        if os.getenv("AI_SERVICE_ALLOW_UNAUTHENTICATED", "").lower() == "true":
            return  # explicit local-development opt-out
        raise HTTPException(status_code=503, detail="AI service is not configured: set AI_SERVICE_TOKEN.")
    if not x_internal_token or not hmac.compare_digest(x_internal_token.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing service token.")


# ============================================================
# Request/Response Models
# ============================================================
class MetaInfo(BaseModel):
    path_used: str
    llm_success: bool
    model: Optional[str] = None
    raw_response_excerpt: Optional[str] = None
    fallback_reason: Optional[str] = None


class QueryRequest(BaseModel):
    user_query: str = Field(..., min_length=1, max_length=1000)
    table_name: str  # physical dataset table, ds_<32 hex> (resolved by the backend, never by the client)
    user_id: Optional[str] = None  # informational / logging only
    table_schema_text: Optional[str] = None  # schema from /ingest; re-read from the database if omitted


class QueryResponse(BaseModel):
    sql_query: str
    data: List[Dict[str, Any]]
    chart: Optional[Dict[str, Any]] = None
    insights: Dict[str, List[Dict[str, Any]]]
    recommendations: List[str]
    execution_time: float
    row_count: int
    sql_generation_meta: Dict[str, Any]
    sql_correction_attempts: int = 0
    sql_correction_meta: List[Dict[str, Any]] = []
    insights_meta: Dict[str, Any]
    recommendations_meta: Dict[str, Any]
    chart_type: str
    schema_used: str
    warnings: List[str] = []
    used_fallback_preview: bool = False
    truncated: bool = False


class InsightRequest(BaseModel):
    table_name: str
    user_id: Optional[str] = None
    query_results: Optional[List[Dict]] = None


class InsightResponse(BaseModel):
    insights: List[Dict[str, Any]]
    trends: List[Dict[str, Any]] = []
    anomalies: List[Dict[str, Any]] = []
    meta: Dict[str, Any]


class RecommendationRequest(BaseModel):
    # Accepts the standard {"insights": [...], "trends": [...], "anomalies": [...]} wrapper
    # or a bare list of insight dicts (legacy frontend shape).
    insights: Union[
        Dict[str, List[Dict[str, Any]]],
        List[Dict[str, Any]],
        Dict[str, Any],
    ]
    business_context: Optional[str] = "general business analysis"


class RecommendationItem(BaseModel):
    category: str
    icon: Optional[str] = "target"
    items: List[str]


class RecommendationResponse(BaseModel):
    recommendations: List[RecommendationItem]
    action_items: List[str] = []
    meta: Dict[str, Any]


class DatasetColumnInfo(BaseModel):
    name: str
    original_name: Optional[str] = None
    type_pg: str
    dtype_pandas: str
    nullable: bool
    missing_count: int
    missing_ratio: float
    unique_count: int
    sample_values: List[Any]


class DatasetProcessingResponse(BaseModel):
    filename: str
    table_name: str
    row_count: int
    column_count: int
    columns: List[DatasetColumnInfo]
    numeric_columns: List[str]
    categorical_columns: List[str]
    date_columns: List[str]
    missing_value_counts: Dict[str, int]
    unique_value_counts: Dict[str, int]
    sample_values: Dict[str, List[Any]]
    basic_statistics: Dict[str, Dict[str, float]]
    preview_rows: List[Dict[str, Any]] = []
    schema_text: str  # direct input to the NL->SQL prompt


# ============================================================
# Helpers
# ============================================================
def _require_valid_table(table_name: str) -> None:
    if not is_valid_table_name(table_name):
        raise HTTPException(status_code=422, detail="Invalid dataset table name.")


def _db_unavailable() -> HTTPException:
    return HTTPException(status_code=503, detail="Dataset database is not configured or unreachable.")


def _read_upload_limits(content: bytes, filename: str) -> None:
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit.")
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")


def _load_and_check(content: bytes):
    df, mapping = load_csv_dataframe(content)
    if len(df) == 0:
        raise HTTPException(status_code=400, detail="CSV contains headers but no data rows.")
    if len(df) > MAX_CSV_ROWS:
        raise HTTPException(status_code=413, detail=f"CSV has more than {MAX_CSV_ROWS} rows.")
    if df.shape[1] > MAX_CSV_COLUMNS:
        raise HTTPException(status_code=413, detail=f"CSV has more than {MAX_CSV_COLUMNS} columns.")
    return df, mapping


# ============================================================
# API Endpoints
# ============================================================
@app.post("/ingest", response_model=DatasetProcessingResponse, dependencies=[Depends(require_internal_token)])
async def ingest_dataset(
    file: UploadFile = File(...),
    dataset_id: str = Form(...),
):
    """Profile a CSV and load it into PostgreSQL as the dataset's own table."""
    try:
        table_name = data_store.table_name_for_dataset(dataset_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="dataset_id must be a UUID.")

    filename = file.filename or "upload.csv"
    content = await file.read()
    _read_upload_limits(content, filename)

    try:
        df, mapping = await run_in_threadpool(_load_and_check, content)
        profile = await run_in_threadpool(profile_dataframe, df, filename, table_name, mapping)
        await run_in_threadpool(data_store.ingest_dataframe, df, table_name)
    except HTTPException:
        raise
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSV file contains no data or unparseable content.")
    except pd.errors.ParserError as e:
        raise HTTPException(status_code=400, detail=f"CSV could not be parsed: {str(e)[:200]}")
    except data_store.DatabaseNotConfigured:
        raise _db_unavailable()
    except Exception as e:  # noqa: BLE001
        logger.error("/ingest failed: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Could not store dataset: {type(e).__name__}")

    logger.info("Ingested %s -> %s (%s rows x %s cols)", filename, table_name, profile["row_count"], profile["column_count"])
    return DatasetProcessingResponse(**profile)


@app.delete("/datasets/{table_name}", dependencies=[Depends(require_internal_token)])
async def delete_dataset_table(table_name: str):
    _require_valid_table(table_name)
    try:
        await run_in_threadpool(data_store.drop_dataset_table, table_name)
    except data_store.DatabaseNotConfigured:
        raise _db_unavailable()
    except Exception as e:  # noqa: BLE001
        logger.error("drop table failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not drop dataset table.")
    return {"dropped": table_name}


@app.post("/process-data", response_model=DatasetProcessingResponse, dependencies=[Depends(require_internal_token)])
async def process_data(file: UploadFile = File(...), table_name: Optional[str] = Form(None)):
    """Profile an uploaded CSV with deterministic pandas logic (does not store anything)."""
    filename = file.filename or "upload.csv"
    content = await file.read()
    _read_upload_limits(content, filename)
    try:
        profile = await run_in_threadpool(process_uploaded_csv, content, filename, table_name)
        return DatasetProcessingResponse(**profile)
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSV file contains no data or unparseable content.")
    except Exception as e:  # noqa: BLE001
        logger.error("/process-data error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {type(e).__name__}")


@app.post("/query", response_model=QueryResponse, dependencies=[Depends(require_internal_token)])
async def process_natural_language_query(request: QueryRequest):
    """Natural language -> validated read-only SQL -> results, chart, insights, recommendations."""
    start_total = time.time()
    _require_valid_table(request.table_name)
    table = request.table_name
    logger.info("query user=%s table=%s q=%r", request.user_id, table, request.user_query[:200])

    try:
        schema_used = request.table_schema_text
        if not schema_used or f"Table: {table}" not in schema_used:
            schema_used = await run_in_threadpool(data_store.describe_table, table)
        if not schema_used:
            raise HTTPException(status_code=404, detail="Dataset table not found. Re-upload the dataset.")

        sql_query, sql_gen_meta = await generate_sql_from_query(request.user_query, schema_used)
        if not sql_query:
            sql_query = f"SELECT * FROM {table} LIMIT 10"

        max_corrections = 2
        current_sql = sql_query
        correction_meta_log: List[Dict[str, Any]] = []
        correction_attempts = 0
        results: List[Dict[str, Any]] = []
        truncated = False
        execution_time = 0.0
        sql_error: Optional[str] = None
        used_fallback_preview = False
        warnings: List[str] = []

        for attempt in range(max_corrections + 1):
            try:
                t0 = time.time()
                results, truncated, current_sql = await run_in_threadpool(
                    data_store.run_readonly_query, current_sql, table
                )
                execution_time = time.time() - t0
                sql_error = None
                break
            except data_store.DatabaseNotConfigured:
                raise _db_unavailable()
            except (UnsafeSQLError, data_store.QueryExecutionError) as e:
                sql_error = str(e)
                logger.warning("SQL attempt %s failed (%s): %s", attempt + 1, type(e).__name__, sql_error)
                if attempt < max_corrections:
                    corrected, c_meta = await fix_sql_error(current_sql, sql_error, schema_used)
                    correction_meta_log.append({
                        **c_meta,
                        "original_sql": current_sql[:200],
                        "error": sql_error[:200],
                        "corrected_sql": (corrected or "")[:200],
                    })
                    correction_attempts += 1
                    current_sql = corrected or f"SELECT * FROM {table} LIMIT 10"
                else:
                    current_sql = f"SELECT * FROM {table} LIMIT 10"

        if sql_error is not None:
            # Every generated query failed; show a clearly-labelled preview instead of a wrong answer.
            try:
                t0 = time.time()
                results, truncated, current_sql = await run_in_threadpool(
                    data_store.run_readonly_query, f"SELECT * FROM {table} LIMIT 10", table
                )
                execution_time = time.time() - t0
                used_fallback_preview = True
                warnings.append(
                    "Your question could not be turned into a valid query, so the first 10 rows are shown instead. "
                    f"Last error: {sql_error[:160]}"
                )
            except Exception as fe:  # noqa: BLE001
                logger.error("Fallback preview failed: %s", fe)
                raise HTTPException(status_code=502, detail="Query failed and dataset preview is unavailable.")

        if truncated:
            warnings.append(f"Result truncated to {data_store.MAX_RESULT_ROWS} rows.")

        if results:
            df = _maybe_parse_dates(pd.DataFrame(results))
            chart_config = detect_chart_type(df)
        else:
            chart_config = {"chart_type": "table", "title": "No Data"}

        insights_data, insights_meta = await generate_insights_from_data(results, request.user_query)
        structured_recs, recs_meta = await generate_recommendations_from_insights(insights_data)
        flat_recommendations = flatten_recommendations(structured_recs)

        if used_fallback_preview:
            insights_data.setdefault("insights", []).append({
                "type": "data_quality",
                "description": f"Query could not be executed; showing a preview instead. Reason: {(sql_error or '')[:200]}",
            })

        return QueryResponse(
            sql_query=current_sql,
            data=results,
            chart=chart_config,
            insights=insights_data,
            recommendations=flat_recommendations,
            execution_time=round(execution_time, 4),
            row_count=len(results),
            sql_generation_meta=sql_gen_meta,
            sql_correction_attempts=correction_attempts,
            sql_correction_meta=correction_meta_log,
            insights_meta=insights_meta,
            recommendations_meta=recs_meta,
            chart_type=chart_config.get("chart_type", "table"),
            schema_used=schema_used,
            warnings=warnings,
            used_fallback_preview=used_fallback_preview,
            truncated=truncated,
        )

    except HTTPException:
        raise
    except data_store.DatabaseNotConfigured:
        raise _db_unavailable()
    except Exception as e:  # noqa: BLE001
        logger.error("Error processing query: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Query processing failed.")


@app.post("/generate-insights", response_model=InsightResponse, dependencies=[Depends(require_internal_token)])
async def generate_dataset_insights(request: InsightRequest):
    """Generate insights from supplied rows, or from the dataset table (first 1000 rows)."""
    try:
        if request.query_results:
            data = request.query_results[:MAX_INSIGHT_INPUT_ROWS]
        else:
            _require_valid_table(request.table_name)
            data, _, _ = await run_in_threadpool(
                data_store.run_readonly_query, f"SELECT * FROM {request.table_name} LIMIT 1000", request.table_name
            )

        if not data:
            empty_meta = {
                "path_used": "rule_fallback",
                "llm_success": False,
                "model": None,
                "fallback_reason": "empty_dataset",
            }
            return InsightResponse(
                insights=[{"type": "dataset_overview", "description": "No data available for analysis"}],
                trends=[], anomalies=[], meta=empty_meta,
            )

        insights_data, meta = await generate_insights_from_data(data, "Generate insights about this dataset")
        return InsightResponse(
            insights=insights_data.get("insights", []),
            trends=insights_data.get("trends", []),
            anomalies=insights_data.get("anomalies", []),
            meta=meta,
        )
    except HTTPException:
        raise
    except data_store.DatabaseNotConfigured:
        raise _db_unavailable()
    except (UnsafeSQLError, data_store.QueryExecutionError) as e:
        raise HTTPException(status_code=422, detail=f"Could not read dataset: {str(e)[:200]}")
    except Exception as e:  # noqa: BLE001
        logger.error("Error generating insights: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error generating insights.")


@app.post("/recommendations", response_model=RecommendationResponse, dependencies=[Depends(require_internal_token)])
async def generate_business_recommendations(request: RecommendationRequest):
    """Generate business recommendations from insights."""
    try:
        insights_payload = request.insights
        if isinstance(insights_payload, list):
            insights_payload = {"insights": insights_payload, "trends": [], "anomalies": []}
        elif isinstance(insights_payload, dict):
            insights_payload.setdefault("insights", [])
            insights_payload.setdefault("trends", [])
            insights_payload.setdefault("anomalies", [])
        else:
            insights_payload = {"insights": [], "trends": [], "anomalies": []}

        structured, meta = await generate_recommendations_from_insights(insights_payload)

        rec_items = []
        for rec in structured.get("recommendations", []) or []:
            if isinstance(rec, dict):
                rec_items.append(RecommendationItem(
                    category=rec.get("category", "General"),
                    icon=rec.get("icon", "target"),
                    items=rec.get("items", []),
                ))
            elif isinstance(rec, str):
                rec_items.append(RecommendationItem(category="General", icon="target", items=[rec]))

        return RecommendationResponse(
            recommendations=rec_items,
            action_items=structured.get("action_items", []) or [],
            meta=meta,
        )
    except Exception as e:  # noqa: BLE001
        logger.error("Error generating recommendations: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error generating recommendations.")


@app.get("/")
async def root():
    return {"message": "AI Data Analyst Service is running", "status": "healthy"}


@app.get("/health")
async def health_check():
    from llm_utils import HuggingFaceLLM, llm

    db_status = await run_in_threadpool(data_store.database_status)
    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "llm_model": HuggingFaceLLM.ACTIVE_MODEL,
        "llm_provider": "huggingface",
        "llm_configured": llm.configured,
        "version": app.version,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_SERVICE_PORT", 8001))
    # Bind to localhost by default: only the Node backend should reach this service.
    uvicorn.run(app, host=os.getenv("AI_SERVICE_HOST", "127.0.0.1"), port=port)
