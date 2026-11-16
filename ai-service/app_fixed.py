"""
AI Data Analyst Copilot Service
Natural Language to SQL conversion with insights generation
"""

import os
import logging
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException
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
    detect_chart_type
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="AI Data Analyst Service", version="1.0.0")

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
    engine = create_engine(DATABASE_URL)
    # Test connection
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("✅ Database connected successfully")
except Exception as e:
    print(f"⚠️ Database connection failed: {e}")
    print("🔄 Using mock data for demonstration")
    use_mock_db = True

# Request/Response Models
class QueryRequest(BaseModel):
    user_query: str
    table_name: str
    user_id: Optional[str] = None

class ColumnInfo(BaseModel):
    name: str
    type: str
    null_count: int
    unique_count: int
    sample_values: List[Any]

class DatasetAnalysis(BaseModel):
    file_name: str
    table_name: str
    schema_info: Dict[str, Any]

class QueryResponse(BaseModel):
    sql_query: str
    data: List[Dict[str, Any]]
    chart: Optional[Dict[str, Any]] = None
    insights: Dict[str, List[Dict[str, Any]]]
    recommendations: List[str]
    execution_time: float
    row_count: int

class InsightRequest(BaseModel):
    table_name: str
    user_id: Optional[str] = None
    query_results: Optional[List[Dict]] = None

class InsightResponse(BaseModel):
    insights: List[Dict[str, Any]]
    trends: List[Dict[str, Any]] = []
    anomalies: List[Dict[str, Any]] = []

class RecommendationRequest(BaseModel):
    insights: Dict[str, List[Dict[str, Any]]]
    business_context: Optional[str] = "general business analysis"

class RecommendationResponse(BaseModel):
    recommendations: List[str]

# Helper functions
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
    return []

def execute_sql_query(sql: str, table_name: str = None):
    """Execute SQL query with fallback to mock data"""
    if use_mock_db:
        # Return mock data based on query
        if "SELECT" in sql.upper():
            return get_mock_data(table_name or "66367cec-9204-4405-90ce-ef5150209ccd")
        return []
    
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            rows = result.fetchall()
            columns = result.keys()
            return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        print(f"SQL execution error: {e}")
        return get_mock_data(table_name or "66367cec-9204-4405-90ce-ef5150209ccd")

# API Endpoints
@app.post("/query", response_model=QueryResponse)
async def process_natural_language_query(request: QueryRequest):
    """Convert natural language to SQL using LLM and execute with auto-error fixing"""
    try:
        logger.info(f"Processing query: {request.user_query} for table: {request.table_name}")
        
        # Get table schema information (mock or real)
        if use_mock_db:
            # Use mock schema for demonstration
            schema_info = f"""Table: {request.table_name}
Columns:
  id (integer)
  product (text)
  price (numeric)
  category (text)
  sales (integer)"""
        else:
            # Get real schema from database
            schema_query = f"""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '{request.table_name}'
            ORDER BY ordinal_position;
            """
            
            with engine.connect() as conn:
                schema_result = conn.execute(text(schema_query)).fetchall()
                
                # Build schema info string for LLM
                schema_columns = []
                numeric_cols = []
                for row in schema_result:
                    schema_columns.append(f"  {row[0]} ({row[1]})")
                    if 'numeric' in row[1] or 'int' in row[1] or 'decimal' in row[1]:
                        numeric_cols.append(row[0])
                
                schema_info = f"Table: {request.table_name}\nColumns:\n" + "\n".join(schema_columns)
        
        # Step 1: Generate SQL using LLM
        sql_query = await generate_sql_from_query(request.user_query, schema_info)
        
        logger.info(f"Generated SQL: {sql_query}")
        
        if not sql_query:
            # Fallback to basic query
            sql_query = f"SELECT * FROM {request.table_name} LIMIT 10;"
            logger.info("Using fallback SQL query")
        
        # Step 2: Execute SQL with error handling
        max_retries = 2
        current_sql = sql_query
        results = []
        execution_time = 0
        
        for attempt in range(max_retries):
            try:
                start_time = time.time()
                results = execute_sql_query(current_sql, request.table_name)
                execution_time = time.time() - start_time
                logger.info(f"Query executed successfully, returned {len(results)} rows")
                
                # Step 3: Create DataFrame for chart detection
                if results:
                    df = pd.DataFrame(results)
                    chart_config = detect_chart_type(df)
                else:
                    chart_config = {"chart_type": "table", "title": "No Data"}
                
                # Step 4: Generate insights using LLM
                insights = await generate_insights_from_data(results, request.user_query)
                logger.info(f"Generated insights: {str(insights)[:100]}...")
                
                # Step 5: Generate recommendations using LLM
                recommendations = await generate_recommendations_from_insights(insights)
                logger.info(f"Generated {len(recommendations)} recommendations")
                
                response = QueryResponse(
                    sql_query=current_sql,
                    data=results,
                    chart=chart_config,
                    insights=insights,
                    recommendations=recommendations,
                    execution_time=execution_time,
                    row_count=len(results)
                )
                
                logger.info("Query response created successfully")
                return response
                
            except Exception as sql_error:
                logger.error(f"SQL execution error (attempt {attempt + 1}): {str(sql_error)}")
                
                if attempt < max_retries - 1:
                    # Step 2: Fix SQL using LLM
                    fixed_sql = await fix_sql_error(current_sql, str(sql_error))
                    if fixed_sql:
                        current_sql = fixed_sql
                    else:
                        # If LLM fails, try simple query
                        current_sql = f"SELECT * FROM {request.table_name} LIMIT 10;"
                else:
                    # Final attempt failed, use fallback
                    current_sql = f"SELECT * FROM {request.table_name} LIMIT 10;"
                    try:
                        start_time = time.time()
                        results = execute_sql_query(current_sql, request.table_name)
                        execution_time = time.time() - start_time
                        
                        # Return fallback response
                        return QueryResponse(
                            sql_query=current_sql,
                            data=results,
                            chart={"chart_type": "table", "title": "Data Preview"},
                            insights={
                                "insights": [{"type": "dataset_overview", "description": "SQL execution failed, showing data preview."}],
                                "trends": [],
                                "anomalies": []
                            },
                            recommendations=["Please check your query syntax."],
                            execution_time=execution_time,
                            row_count=len(results)
                        )
                    except Exception as final_error:
                        logger.error(f"Final fallback failed: {str(final_error)}")
                        # Return minimal response
                        return QueryResponse(
                            sql_query="SELECT * FROM table LIMIT 10;",
                            data=[],
                            chart={"chart_type": "table", "title": "No Data"},
                            insights={
                                "insights": [{"type": "dataset_overview", "description": "Unable to execute query. Please check your database connection."}],
                                "trends": [],
                                "anomalies": []
                            },
                            recommendations=["Verify database configuration and try again."],
                            execution_time=0.1,
                            row_count=0
                        )
        
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        # Return minimal response to avoid validation errors
        return QueryResponse(
            sql_query="SELECT * FROM table LIMIT 10;",
            data=[],
            chart={"chart_type": "table", "title": "Error"},
            insights={
                "insights": [{"type": "dataset_overview", "description": f"Error occurred: {str(e)}"}],
                "trends": [],
                "anomalies": []
            },
            recommendations=["Please try again or contact support."],
            execution_time=0.1,
            row_count=0
        )

@app.post("/generate-insights", response_model=InsightResponse)
async def generate_dataset_insights(request: InsightRequest):
    """Generate insights from dataset"""
    try:
        # Load dataset (mock or real)
        if use_mock_db:
            data = get_mock_data(request.table_name)
        else:
            data = execute_sql_query(f"SELECT * FROM {request.table_name} LIMIT 1000", request.table_name)
        
        if not data:
            return InsightResponse(
                insights=[{"type": "dataset_overview", "description": "No data available for analysis"}],
                trends=[],
                anomalies=[]
            )
        
        # Generate insights using LLM
        insights_data = await generate_insights_from_data(data, "Generate insights about this dataset")
        
        return InsightResponse(
            insights=insights_data.get("insights", []),
            trends=insights_data.get("trends", []),
            anomalies=insights_data.get("anomalies", [])
        )
        
    except Exception as e:
        logger.error(f"Error generating insights: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating insights: {str(e)}")

@app.post("/recommendations", response_model=RecommendationResponse)
async def generate_business_recommendations(request: RecommendationRequest):
    """Generate business recommendations based on insights"""
    try:
        recommendations = await generate_recommendations_from_insights(request.insights)
        
        return RecommendationResponse(recommendations=recommendations)
        
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")

@app.get("/")
async def root():
    return {"message": "AI Data Analyst Service is running", "status": "healthy"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected" if not use_mock_db else "mock"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AI_SERVICE_PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
