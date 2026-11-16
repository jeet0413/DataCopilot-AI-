import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'ai-service'))

from llm_utils import generate_sql_from_query

async def test_llm():
    schema = """Table: test_table
Columns:
  id (integer)
  product (text)
  price (numeric)
  category (text)
  sales (integer)"""
    
    query = "Show me the total number of records"
    
    result = await generate_sql_from_query(query, schema)
    print(f"Generated SQL: {result}")

if __name__ == "__main__":
    asyncio.run(test_llm())
