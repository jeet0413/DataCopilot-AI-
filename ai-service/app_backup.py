from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
import json
import os
from dotenv import load_dotenv
import requests
from sqlalchemy import create_engine, text
import logging
import time
from llm_utils import (
    generate_sql_from_query, 
    fix_sql_error, 
    generate_insights_from_data, 
    generate_recommendations_from_insights,
    detect_chart_type
)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="AI Data Analyst Service", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection - Try SQLAlchemy but fallback to mock data
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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Supabase configuration for REST API
SUPABASE_URL = os.getenv("SUPABASE_URL", "").replace("postgresql://", "https://").split("@")[0] + ".supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Helper functions for Supabase REST API
def get_supabase_data(table_name: str, filters: Dict = None):
    """Fetch data from Supabase using REST API"""
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table_name}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}"
        }
        
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Supabase API error: {response.status_code}")
            return None
    except Exception as e:
        print(f"Error fetching from Supabase: {e}")
        return None

def get_mock_data(table_name: str):
    """Return mock data for demonstration"""
    if table_name == "datasets":
        return [
            {"id": "mock-1", "name": "Sample Sales Data", "file_name": "sales.csv", "rows": 1000, "columns": 5},
            {"id": "mock-2", "name": "Customer Data", "file_name": "customers.csv", "rows": 500, "columns": 4}
        ]
    elif table_name == "66367cec-9204-4405-90ce-ef5150209ccd":  # Mock table data
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

# Pydantic models
class ColumnInfo(BaseModel):
    name: str
    type: str
    null_count: int
    unique_count: int
    sample_values: List[Any]

class DatasetAnalysis(BaseModel):
    file_name: str
    total_rows: int
    total_columns: int
    columns: List[ColumnInfo]
    basic_stats: Dict[str, Any]
    missing_value_summary: Dict[str, Any]
    data_types: Dict[str, str]

class QueryRequest(BaseModel):
    user_query: str
    table_name: str
    user_id: Optional[str] = None

class QueryResponse(BaseModel):
    sql_query: str
    data: List[Dict[str, Any]]
    chart: Optional[Dict[str, Any]] = None
    insights: Optional[str] = None
    recommendations: Optional[List[str]] = None
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
def analyze_column(df: pd.DataFrame, column_name: str) -> ColumnInfo:
    """Analyze a single column"""
    column = df[column_name]
    
    # Determine data type
    if pd.api.types.is_numeric_dtype(column):
        col_type = "numeric"
    elif pd.api.types.is_datetime64_any_dtype(column):
        col_type = "datetime"
    elif pd.api.types.is_bool_dtype(column):
        col_type = "boolean"
    else:
        col_type = "text"
    
    # Get sample values (non-null)
    sample_values = column.dropna().head(5).tolist()
    
    return ColumnInfo(
        name=column_name,
        type=col_type,
        null_count=column.isnull().sum(),
        unique_count=column.nunique(),
        sample_values=sample_values
    )

def generate_basic_stats(df: pd.DataFrame) -> Dict[str, Any]:
    """Generate basic statistics for the dataset"""
    stats = {}
    
    # Numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        stats["numeric_summary"] = df[numeric_cols].describe().to_dict()
    
    # Text columns
    text_cols = df.select_dtypes(include=['object']).columns
    if len(text_cols) > 0:
        stats["text_summary"] = {}
        for col in text_cols:
            stats["text_summary"][col] = {
                "avg_length": df[col].astype(str).str.len().mean(),
                "max_length": df[col].astype(str).str.len().max(),
                "most_common": df[col].value_counts().head(3).to_dict()
            }
    
    return stats

def generate_sql_from_query(user_query: str, table_name: str, schema_info: Dict = None) -> str:
    """Generate SQL from natural language query"""
    # This is a simplified version - in production, you'd use OpenAI or Hugging Face
    query_lower = user_query.lower()
    
    # Basic pattern matching for common queries
    if "count" in query_lower and "rows" in query_lower:
        return f"SELECT COUNT(*) as total_rows FROM {table_name};"
    elif "average" in query_lower or "mean" in query_lower:
        # Try to find numeric columns
        if schema_info and "numeric_columns" in schema_info:
            col = schema_info["numeric_columns"][0]
            return f"SELECT AVG({col}) as average_{col} FROM {table_name};"
        return f"SELECT * FROM {table_name} LIMIT 10;"
    elif "maximum" in query_lower or "max" in query_lower:
        if schema_info and "numeric_columns" in schema_info:
            col = schema_info["numeric_columns"][0]
            return f"SELECT MAX({col}) as max_{col} FROM {table_name};"
        return f"SELECT * FROM {table_name} LIMIT 10;"
    elif "minimum" in query_lower or "min" in query_lower:
        if schema_info and "numeric_columns" in schema_info:
            col = schema_info["numeric_columns"][0]
            return f"SELECT MIN({col}) as min_{col} FROM {table_name};"
        return f"SELECT * FROM {table_name} LIMIT 10;"
    elif "recent" in query_lower or "latest" in query_lower:
        # Try to find date columns
        if schema_info and "date_columns" in schema_info:
            col = schema_info["date_columns"][0]
            return f"SELECT * FROM {table_name} ORDER BY {col} DESC LIMIT 10;"
        return f"SELECT * FROM {table_name} ORDER BY id DESC LIMIT 10;"
    else:
        # Default: return first 10 rows
        return f"SELECT * FROM {table_name} LIMIT 10;"

def generate_insights(df: pd.DataFrame, query_results: List[Dict] = None) -> Dict[str, Any]:
    """Generate insights from dataset and query results"""
    insights = []
    trends = []
    anomalies = []
    
    # Basic dataset insights
    insights.append({
        "type": "dataset_overview",
        "description": f"Dataset contains {len(df)} rows and {len(df.columns)} columns",
        "confidence": 1.0
    })
    
    # Data quality insights
    missing_data_cols = df.columns[df.isnull().sum() > 0].tolist()
    if missing_data_cols:
        insights.append({
            "type": "data_quality",
            "description": f"Missing data found in {len(missing_data_cols)} columns: {', '.join(missing_data_cols[:3])}",
            "confidence": 0.9
        })
    
    # Numeric column insights
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        for col in numeric_cols[:3]:  # Limit to first 3 numeric columns
            col_data = df[col].dropna()
            if len(col_data) > 0:
                mean_val = col_data.mean()
                std_val = col_data.std()
                
                # Check for outliers
                outliers = col_data[(col_data < mean_val - 3*std_val) | (col_data > mean_val + 3*std_val)]
                if len(outliers) > 0:
                    anomalies.append({
                        "type": "outliers",
                        "column": col,
                        "count": len(outliers),
                        "description": f"Found {len(outliers)} outliers in {col}",
                        "confidence": 0.8
                    })
                
                # Trend detection (simplified)
                if len(col_data) > 10:
                    correlation = np.corrcoef(range(len(col_data)), col_data)[0, 1]
                    if abs(correlation) > 0.5:
                        trends.append({
                            "type": "trend",
                            "column": col,
                            "direction": "increasing" if correlation > 0 else "decreasing",
                            "strength": abs(correlation),
                            "description": f"{col} shows a {'strong' if abs(correlation) > 0.7 else 'moderate'} {'increasing' if correlation > 0 else 'decreasing'} trend",
                            "confidence": abs(correlation)
                        })
    
    # Categorical insights
    text_cols = df.select_dtypes(include=['object']).columns
    if len(text_cols) > 0:
        for col in text_cols[:2]:  # Limit to first 2 text columns
            value_counts = df[col].value_counts()
            if len(value_counts) > 1:
                top_value = value_counts.index[0]
                top_percentage = (value_counts.iloc[0] / len(df)) * 100
                
                insights.append({
                    "type": "distribution",
                    "column": col,
                    "top_value": top_value,
                    "top_percentage": top_percentage,
                    "description": f"In {col}, '{top_value}' represents {top_percentage:.1f}% of all values",
                    "confidence": 0.9
                })
    
    return {
        "insights": insights,
        "trends": trends,
        "anomalies": anomalies
    }

def generate_recommendations(insights: List[Dict], business_context: str = None) -> List[str]:
    """Generate business recommendations based on insights"""
    recommendations = []
    
    # Analyze insights to generate recommendations
    for insight in insights:
        if insight["type"] == "data_quality":
            recommendations.append(f"🔧 Data Quality: Consider implementing data validation for columns with missing values")
        
        elif insight["type"] == "distribution":
            col = insight["column"]
            if insight["top_percentage"] > 80:
                recommendations.append(f"📊 Distribution: {col} is heavily skewed - consider data balancing strategies")
        
        elif insight["type"] == "dataset_overview":
            if "rows" in insight["description"]:
                row_count = int(insight["description"].split("contains")[1].split("rows")[0].strip())
                if row_count < 100:
                    recommendations.append("📈 Data Volume: Consider collecting more data for better insights")
                elif row_count > 10000:
                    recommendations.append("⚡ Performance: Consider data sampling for faster analysis")
    
    # Add general business recommendations
    recommendations.extend([
        "🎯 Strategy: Focus on key performance indicators that drive business value",
        "📱 Automation: Set up automated alerts for data anomalies",
        "🔍 Analysis: Regular monitoring of trends and patterns"
    ])
    
    return recommendations[:5]  # Return top 5 recommendations

# API Endpoints
@app.get("/")
async def root():
    return {"message": "AI Data Analyst Service is running"}

@app.post("/process-data", response_model=DatasetAnalysis)
async def process_csv_data(file: UploadFile = File(...)):
    """Process uploaded CSV file and return analysis"""
    try:
        # Read CSV file
        contents = await file.read()
        df = pd.read_csv(pd.io.common.StringIO(contents.decode('utf-8')))
        
        # Analyze columns
        columns = []
        for col in df.columns:
            columns.append(analyze_column(df, col))
        
        # Generate basic statistics
        basic_stats = generate_basic_stats(df)
        
        # Missing value summary
        missing_summary = df.isnull().sum().to_dict()
        missing_summary = {k: v for k, v in missing_summary.items() if v > 0}
        
        # Data types
        data_types = df.dtypes.astype(str).to_dict()
        
        return DatasetAnalysis(
            file_name=file.filename,
            total_rows=len(df),
            total_columns=len(df.columns),
            columns=columns,
            basic_stats=basic_stats,
            missing_value_summary=missing_summary,
            data_types=data_types
        )
        
    except Exception as e:
        logger.error(f"Error processing CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {str(e)}")

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
                    logger.info(f"Generated insights: {insights[:100]}...")
                    
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
                                insights="SQL execution failed, showing data preview.",
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
                                insights="Unable to execute query. Please check your database connection.",
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
            insights=f"Error occurred: {str(e)}",
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
