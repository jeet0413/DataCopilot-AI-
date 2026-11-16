"""
AI Data Analyst Copilot Service
Natural Language to SQL conversion with insights generation
"""

import os
import logging
from typing import Dict, Any, List, Optional, Union
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import create_engine, text
import pandas as pd
import time
import json
from dotenv import load_dotenv

# Import LLM utilities
from llm_utils import (
    generate_sql_from_query,
    fix_sql_error,
    generate_insights_from_data,
    generate_recommendations_from_insights,
    detect_chart_type,
    flatten_recommendations,
    generate_fallback_recommendations_structured,
    extract_insights_text,
    process_uploaded_csv,
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="AI Data Analyst Service", version="1.2.0")

# CORS middleware
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
DATABASE_URL = os.getenv("SUPABASE_URL", "postgresql://postgres:password@localhost:5432/postgres")
engine = None
use_mock_db = False

try:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"connect_timeout": 5})
    # Test connection
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("✅ Database connected successfully")
except Exception as e:
    print(f"⚠️ Database connection failed: {e}")
    print("🔄 Using mock data for demonstration")
    use_mock_db = True

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
    user_query: str
    table_name: str
    user_id: Optional[str] = None
    table_schema_text: Optional[str] = None  # If set → use this schema instead of probing DB/mock (direct output from /process-data)

class QueryResponse(BaseModel):
    sql_query: str
    data: List[Dict[str, Any]]
    chart: Optional[Dict[str, Any]] = None
    insights: Dict[str, List[Dict[str, Any]]]
    recommendations: List[str]
    execution_time: float
    row_count: int
    # Evidence / provenance
    sql_generation_meta: Dict[str, Any]
    sql_correction_attempts: int = 0
    sql_correction_meta: List[Dict[str, Any]] = []
    insights_meta: Dict[str, Any]
    recommendations_meta: Dict[str, Any]
    chart_type: str  # Redundant convenience for frontend
    schema_used: str

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
    # Accept flexible shapes via Union — the endpoint handler will normalize into standard form:
    #   Standard: {"insights": [...], "trends": [...], "anomalies": [...]}  (dict wrapper)
    #   Legacy A: raw list of insight dicts [{"type":..., "description":...}, ...]
    #   Legacy B: single insights list without trends/anomalies wrapper from frontend's old code
    insights: Union[
        Dict[str, List[Dict[str, Any]]],
        List[Dict[str, Any]],
        Dict[str, Any]
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
    schema_text: str  # Direct input to NL→SQL prompt

# ============================================================
# Helper functions
# ============================================================
def get_mock_data(table_name: str):
    """Return mock data for demonstration"""
    if table_name == "datasets":
        return [
            {"id": "mock-1", "name": "Sample Sales Data", "file_name": "sales.csv", "rows": 1000, "columns": 5},
            {"id": "mock-2", "name": "Customer Data", "file_name": "customers.csv", "rows": 500, "columns": 4}
        ]
    elif table_name == "66367cec-9204-4405-90ce-ef5150209ccd":
        return [
            {"id": 1, "product": "Laptop", "price": 999.99, "category": "Electronics", "sales": 45},
            {"id": 2, "product": "Mouse", "price": 29.99, "category": "Electronics", "sales": 120},
            {"id": 3, "product": "Keyboard", "price": 79.99, "category": "Electronics", "sales": 85},
            {"id": 4, "product": "Monitor", "price": 299.99, "category": "Electronics", "sales": 60},
            {"id": 5, "product": "Desk Chair", "price": 199.99, "category": "Furniture", "sales": 30}
        ]
    elif table_name == "test-data" or table_name == "test_data":
        return [
            {"name": "John Doe", "email": "john@example.com", "age": 25},
            {"name": "Jane Smith", "email": "jane@example.com", "age": 30},
            {"name": "Bob Johnson", "email": "bob@example.com", "age": 35}
        ]
    elif table_name == "random_test_data":
        return [
            {"product": "Laptop", "category": "Electronics", "price": 999.99, "quantity": 50, "discount": 10},
            {"product": "Mouse", "category": "Electronics", "price": 29.99, "quantity": 200, "discount": 5},
            {"product": "Keyboard", "category": "Electronics", "price": 79.99, "quantity": 100, "discount": 15},
            {"product": "Monitor", "category": "Electronics", "price": 299.99, "quantity": 75, "discount": 8},
            {"product": "Desk Chair", "category": "Furniture", "price": 199.99, "quantity": 40, "discount": 20},
            {"product": "Coffee Table", "category": "Furniture", "price": 149.99, "quantity": 25, "discount": 10},
            {"product": "Bookshelf", "category": "Furniture", "price": 89.99, "quantity": 30, "discount": 12},
            {"product": "Lamp", "category": "Furniture", "price": 49.99, "quantity": 60, "discount": 8}
        ]
    return []


def _build_mock_schema_text(table_name: str, rows: List[Dict[str, Any]] = None) -> str:
    """Given mock data rows (or fallback to default), build a schema_text compatible with NL→SQL prompt."""
    if not rows:
        rows = get_mock_data(table_name) or []
    if not rows:
        return f"Table: {table_name}\nColumns:\n"
    cols = list(rows[0].keys())
    lines = [f"Table: {table_name}", "Columns:"]
    for c in cols:
        sample_val = next((r.get(c) for r in rows if r.get(c) is not None), None)
        if isinstance(sample_val, bool):
            t = "boolean"
        elif isinstance(sample_val, int):
            t = "integer"
        elif isinstance(sample_val, float):
            t = "numeric"
        else:
            t = "text"
        lines.append(f"- {c}: {t}")
    return "\n".join(lines) + "\n"


def get_table_schema_text(table_name: str, rows_hint: List[Dict[str, Any]] = None, explicit_schema_text: str = None) -> str:
    """Resolve a usable NL→SQL schema string. Priority: explicit → DB probe → mock dtype inference."""
    if explicit_schema_text:
        return explicit_schema_text
    if not use_mock_db and engine is not None:
        try:
            q = text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = :t ORDER BY ordinal_position")
            with engine.connect() as conn:
                schema_result = conn.execute(q, {"t": table_name}).fetchall()
            if schema_result:
                lines = [f"Table: {table_name}", "Columns:"]
                for row in schema_result:
                    lines.append(f"- {row[0]}: {row[1]}")
                return "\n".join(lines) + "\n"
        except Exception as e:
            logger.warning(f"information_schema lookup failed: {e}")
    return _build_mock_schema_text(table_name, rows_hint)


def execute_sql_query(sql: str, table_name: str = None):
    """Execute SQL query with fallback to mock data.

    Raises exception on real-DB errors so the retry/correction loop can capture them.
    Only returns mock silently in use_mock_db=True mode (Supabase unreachable).
    """
    if use_mock_db:
        if "SELECT" in sql.upper():
            rows = get_mock_data(table_name or "66367cec-9204-4405-90ce-ef5150209ccd")
            logger.info(f"[mock_db] returning {len(rows)} rows for table={table_name}")
            return rows
        return []
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        rows = result.fetchall()
        columns = result.keys()
        return [dict(zip(columns, row)) for row in rows]


# ============================================================
# API Endpoints
# ============================================================
@app.post("/query", response_model=QueryResponse)
async def process_natural_language_query(request: QueryRequest):
    """Convert natural language to SQL using Hugging Face with auto-error fixing."""
    start_total = time.time()
    try:
        logger.info(f"Processing query: {request.user_query} for table: {request.table_name}")

        schema_used = get_table_schema_text(request.table_name, explicit_schema_text=request.table_schema_text)
        logger.info(f"Schema ({len(schema_used.splitlines())} lines):\n{schema_used}")

        # Step 1: Generate SQL
        sql_query, sql_gen_meta = await generate_sql_from_query(request.user_query, schema_used)
        if not sql_query:
            sql_query = f"SELECT * FROM {request.table_name} LIMIT 10;"
        logger.info(f"Generated SQL: {sql_query}  (meta.path_used={sql_gen_meta.get('path_used')})")

        # Step 2: Execute SQL with retry + correction loop (max 2 correction attempts = 3 total runs)
        max_corrections = 2
        current_sql = sql_query
        correction_meta_log: List[Dict[str, Any]] = []
        correction_attempts = 0
        results = []
        execution_time = 0.0
        sql_error = None

        for attempt in range(max_corrections + 1):
            try:
                t0 = time.time()
                results = execute_sql_query(current_sql, request.table_name)
                execution_time = time.time() - t0
                logger.info(f"Query executed (attempt {attempt+1}), returned {len(results)} rows")
                sql_error = None
                break
            except Exception as e:
                sql_error = str(e)
                logger.error(f"SQL execution error (attempt {attempt + 1}): {sql_error}")
                if attempt < max_corrections:
                    corrected, c_meta = await fix_sql_error(current_sql, sql_error, schema_used)
                    correction_meta_log.append({**c_meta, "original_sql": current_sql[:200], "error": sql_error[:200], "corrected_sql": (corrected or "")[:200]})
                    correction_attempts += 1
                    if corrected:
                        logger.info(f"Corrected SQL (via {c_meta.get('path_used')}): {corrected}")
                        current_sql = corrected
                    else:
                        # LLM correction unavailable → try safe fallback
                        current_sql = f"SELECT * FROM {request.table_name} LIMIT 10;"
                else:
                    # Final attempt → fall back to mock preview
                    current_sql = f"SELECT * FROM {request.table_name} LIMIT 10;"
                    try:
                        t0 = time.time()
                        results = execute_sql_query(current_sql, request.table_name)
                        execution_time = time.time() - t0
                    except Exception as fe:
                        logger.error(f"Fallback preview SQL also failed: {fe}")
                        results = []
                        execution_time = time.time() - start_total

        # Step 3: Auto chart detection
        if results:
            df = pd.DataFrame(results)
            # Convert object columns that look like dates to datetime (for chart detection accuracy)
            for col in df.columns:
                if pd.api.types.is_object_dtype(df[col]):
                    try:
                        parsed = pd.to_datetime(df[col], errors="coerce", infer_datetime_format=True)
                        if parsed.notna().sum() >= max(1, int(0.7 * len(df))):
                            df[col] = parsed
                    except Exception:
                        pass
            chart_config = detect_chart_type(df)
        else:
            chart_config = {"chart_type": "table", "title": "No Data"}

        # Step 4: Insights (returns tuple)
        insights_data, insights_meta = await generate_insights_from_data(results, request.user_query)

        # Step 5: Recommendations (returns tuple)
        structured_recs, recs_meta = await generate_recommendations_from_insights(insights_data)
        flat_recommendations = flatten_recommendations(structured_recs)

        elapsed_total = time.time() - start_total

        # If the SQL execution path ended with a soft-fallback error, bake it into insights
        if sql_error and len(results) == 0 and not any(i.get("type") == "dataset_overview" for i in insights_data.get("insights", [])):
            insights_data.setdefault("insights", []).append({
                "type": "data_quality",
                "description": f"Query execution error (used fallback preview): {sql_error[:200]}"
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
        )

    except Exception as e:
        logger.error(f"Error processing query: {str(e)}", exc_info=True)
        error_insights = {
            "insights": [{"type": "dataset_overview", "description": f"Error occurred: {str(e)[:300]}"}],
            "trends": [],
            "anomalies": []
        }
        error_recs = flatten_recommendations(
            generate_fallback_recommendations_structured(error_insights, extract_insights_text(error_insights))
        ) or ["Please try again or contact support."]
        fallback_meta = {
            "path_used": "rule_fallback",
            "llm_success": False,
            "model": "mistralai/Mistral-7B-Instruct-v0.1",
            "fallback_reason": f"top_level_exception: {type(e).__name__}",
            "raw_response_excerpt": None
        }
        return QueryResponse(
            sql_query="SELECT * FROM table LIMIT 10;",
            data=[],
            chart={"chart_type": "table", "title": "Error"},
            insights=error_insights,
            recommendations=error_recs,
            execution_time=round(time.time() - start_total, 4),
            row_count=0,
            sql_generation_meta=fallback_meta,
            sql_correction_attempts=0,
            sql_correction_meta=[],
            insights_meta=fallback_meta,
            recommendations_meta=fallback_meta,
            chart_type="table",
            schema_used="",
        )


@app.post("/generate-insights", response_model=InsightResponse)
async def generate_dataset_insights(request: InsightRequest):
    """Generate insights from dataset (returns tuple with path metadata)."""
    try:
        if request.query_results:
            data = request.query_results
        elif use_mock_db:
            data = get_mock_data(request.table_name)
        else:
            data = execute_sql_query(f"SELECT * FROM {request.table_name} LIMIT 1000", request.table_name)

        if not data:
            empty_meta = {
                "path_used": "rule_fallback", "llm_success": False,
                "model": "mistralai/Mistral-7B-Instruct-v0.1",
                "fallback_reason": "empty_dataset"
            }
            return InsightResponse(
                insights=[{"type": "dataset_overview", "description": "No data available for analysis"}],
                trends=[], anomalies=[], meta=empty_meta
            )

        insights_data, meta = await generate_insights_from_data(data, f"Generate insights about table {request.table_name}")

        return InsightResponse(
            insights=insights_data.get("insights", []),
            trends=insights_data.get("trends", []),
            anomalies=insights_data.get("anomalies", []),
            meta=meta,
        )

    except Exception as e:
        logger.error(f"Error generating insights: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error generating insights: {str(e)}")


@app.post("/recommendations", response_model=RecommendationResponse)
async def generate_business_recommendations(request: RecommendationRequest):
    """Generate business recommendations based on insights (structured output + meta evidence)."""
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
                rec_items.append(RecommendationItem(
                    category="General", icon="target", items=[rec]
                ))

        return RecommendationResponse(
            recommendations=rec_items,
            action_items=structured.get("action_items", []) or [],
            meta=meta,
        )

    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")


@app.post("/process-data", response_model=DatasetProcessingResponse)
async def process_data(
    file: UploadFile = File(...),
    table_name: Optional[str] = Form(None),
):
    """Analyze an uploaded CSV with deterministic pandas profiling.

    The returned `schema_text` field is directly usable as the `table_schema_text`
    parameter of POST /query to restrict the NL→SQL model to real columns only.
    """
    try:
        filename = file.filename or "upload.csv"
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded.")
        if not filename.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail="Only CSV files are supported.")

        logger.info(f"Processing CSV upload: {filename} ({len(content)} bytes)")
        profile = process_uploaded_csv(content, filename=filename, table_name=table_name)
        logger.info(f"CSV profile complete: {profile['row_count']} rows x {profile['column_count']} cols; table={profile['table_name']}")

        return DatasetProcessingResponse(**profile)

    except HTTPException:
        raise
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSV file contains no data or unparseable content.")
    except Exception as e:
        logger.error(f"/process-data error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {type(e).__name__}: {str(e)[:300]}")


@app.get("/")
async def root():
    return {"message": "AI Data Analyst Service is running", "status": "healthy", "llm_model": "mistralai/Mistral-7B-Instruct-v0.1", "llm_provider": "huggingface"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected" if not use_mock_db else "mock",
        "llm_model": "mistralai/Mistral-7B-Instruct-v0.1",
        "llm_provider": "huggingface",
        "version": "1.2.0",
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AI_SERVICE_PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
