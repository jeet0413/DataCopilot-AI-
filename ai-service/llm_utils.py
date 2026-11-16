"""
LLM Utilities for AI Data Analyst Copilot
Hugging Face Inference API Integration
"""
import os
import json
import aiohttp
import asyncio
from typing import Dict, Any, List, Optional, Tuple
import logging
import pandas as pd
import numpy as np
from datetime import datetime, date

logger = logging.getLogger(__name__)

# ============================================================
# Structured path metadata — returned alongside every LLM output
# so callers/app logs can definitively prove which code path ran.
# ============================================================
class LLMResult:
    """Container for LLM or fallback output + path evidence."""
    def __init__(
        self,
        data: Any,
        path_used: str,            # "huggingface_llm" | "rule_fallback"
        llm_success: bool,
        model: Optional[str] = None,
        raw_response_excerpt: Optional[str] = None,
        fallback_reason: Optional[str] = None,
    ):
        self.data = data
        self.path_used = path_used
        self.llm_success = llm_success
        self.model = model
        self.raw_response_excerpt = raw_response_excerpt
        self.fallback_reason = fallback_reason

    def as_meta(self) -> Dict[str, Any]:
        """Return a serializable metadata block for logs / responses."""
        return {
            "path_used": self.path_used,
            "llm_success": self.llm_success,
            "model": self.model,
            "raw_response_excerpt": self.raw_response_excerpt,
            "fallback_reason": self.fallback_reason,
        }

def _llm_meta_log(op: str, llm_result: Optional[LLMResult] = None, state: str = None, **extra) -> None:
    """Emit standardized development log lines (NEVER log secrets)."""
    parts = [f"[LLM] operation={op}"]
    if state:
        parts.append(f"state={state}")
    if llm_result is not None:
        parts.append(f"model={llm_result.model or 'n/a'}")
        parts.append(f"path_used={llm_result.path_used}")
        parts.append(f"llm_success={str(llm_result.llm_success).lower()}")
        if llm_result.fallback_reason:
            parts.append(f"fallback_reason={llm_result.fallback_reason}")
    for k, v in extra.items():
        parts.append(f"{k}={v}")
    logger.info(" ".join(parts))
    # Also print for stdout visibility during dev
    print("[LLM]", " ".join(parts), flush=True)

# ============================================================
# HuggingFace LLM client
# ============================================================
class HuggingFaceLLM:
    """Hugging Face LLM client for Mistral-7B-Instruct-v0.1 via router.huggingface.co"""

    ACTIVE_MODEL = os.getenv("HF_MODEL", "mistralai/Mistral-7B-Instruct-v0.1")

    def __init__(self):
        self.api_key = os.getenv("HUGGINGFACE_API_KEY")
        # Endpoint is configurable: if the default returns 404/410, set HF_API_URL to
        # https://router.huggingface.co/v1/chat/completions (OpenAI-compatible route).
        self.model_url = os.getenv("HF_API_URL") or f"https://router.huggingface.co/models/{self.ACTIVE_MODEL}"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        self.configured = bool(self.api_key) and self.api_key not in ("", None, "your_huggingface_api_key_here")

    async def call_llm(self, prompt: str, max_tokens: int = 1000, operation: str = "call") -> Optional[LLMResult]:
        """Call Hugging Face LLM and return an LLMResult (or None on total failure).

        Emits structured dev logs for every stage.
        """
        _llm_meta_log(operation, state="request_started", model=self.ACTIVE_MODEL, url=self.model_url, prompt_chars=len(prompt), max_tokens=max_tokens, api_key_configured=str(self.configured).lower())

        if not self.configured:
            logger.error(f"[LLM] operation={operation} state=aborted reason=HUGGINGFACE_API_KEY_missing_or_placeholder")
            print(f"[LLM] operation={operation} state=ABORTED — HUGGINGFACE_API_KEY not configured (found placeholder or empty)", flush=True)
            return None

        try:
            payload = {
                "model": self.ACTIVE_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": 0.1,
                "top_p": 0.9,
            }

            _llm_meta_log(operation, state="http_dispatched", model=self.ACTIVE_MODEL, payload_bytes=len(json.dumps(payload)))

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.model_url,
                    headers=self.headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=60, connect=20),
                ) as response:
                    status = response.status
                    if status == 200:
                        result = await response.json()
                        if "choices" in result and len(result["choices"]) > 0:
                            content = result["choices"][0]["message"]["content"].strip()
                            excerpt = content[:160].replace("\n", "\\n")
                            _llm_meta_log(operation, state="response_received", model=self.ACTIVE_MODEL, http_status=200, response_chars=len(content), path_used="huggingface_llm")
                            return LLMResult(
                                data=content,
                                path_used="huggingface_llm",
                                llm_success=True,
                                model=self.ACTIVE_MODEL,
                                raw_response_excerpt=excerpt,
                            )
                        else:
                            err = f"response_missing_choices_keys: got {list(result.keys())[:5]}"
                            _llm_meta_log(operation, state="llm_failed", model=self.ACTIVE_MODEL, http_status=200, error=err)
                            return None
                    else:
                        body = (await response.text())[:200]
                        print(f"[LLM] operation={operation} state=HTTP_ERROR http_status={status} body_excerpt={body!r}", flush=True)
                        _llm_meta_log(operation, state="http_error", model=self.ACTIVE_MODEL, http_status=status, error_excerpt=body[:80])
                        return None

        except Exception as e:
            err_type = type(e).__name__
            err_msg = str(e)[:120]
            print(f"[LLM] operation={operation} state=EXCEPTION type={err_type} message={err_msg!r}", flush=True)
            _llm_meta_log(operation, state="exception", model=self.ACTIVE_MODEL, error_type=err_type, error_excerpt=err_msg)
            return None

# Global LLM instance
llm = HuggingFaceLLM()

async def generate_sql_from_query(user_query: str, table_schema: str) -> Tuple[str, Dict[str, Any]]:
    """
    Generate SQL query from natural language using Hugging Face LLM with rule-based fallback.

    Returns: (sql_string, path_metadata_dict)
    """
    OPERATION = "nl_to_sql"
    # Prompt now explicitly requires using ONLY the columns listed in the schema.
    prompt = f"""You are an expert PostgreSQL data analyst.

Convert user query into a valid PostgreSQL SELECT statement.

Schema (use ONLY these columns and tables — do not invent columns):
{table_schema}

Rules:
- Return ONLY SQL — no markdown fences, no explanation.
- Return exactly ONE read-only SELECT statement. Never use INSERT/UPDATE/DELETE/DDL.
- Read ONLY from the single table named in the schema, using that exact name with no schema prefix.
- Use exact column names from the schema above. NEVER invent column names.
- Use aggregation (SUM/AVG/COUNT/MAX/MIN) when requested.
- Add LIMIT 1000 to queries that return raw rows.
- Use proper PostgreSQL syntax.
- Quote identifiers with double quotes if table/column contains hyphens/special chars.
- Query results must be reproducible.

User Query:
{user_query}"""

    llm_result = await llm.call_llm(prompt, operation=OPERATION)

    if llm_result and llm_result.llm_success and isinstance(llm_result.data, str):
        # Clean output: remove ```sql and ``` fences, trim trailing semicolon whitespace.
        sql = llm_result.data.strip()
        if sql.startswith("```sql"):
            sql = sql[6:]
        if sql.endswith("```"):
            sql = sql[:-3]
        sql = sql.strip()
        _llm_meta_log(OPERATION, llm_result, state="output_parsed", sql_length=len(sql))
        # Update excerpt to final cleaned sql
        llm_result.raw_response_excerpt = sql[:200]
        return sql, llm_result.as_meta()

    # Fallback path
    fallback_reason = "llm_unreachable" if llm_result is None else "llm_success_but_empty"
    fallback_sql = generate_fallback_sql(user_query, table_schema)
    meta = {
        "path_used": "rule_fallback",
        "llm_success": False,
        "model": HuggingFaceLLM.ACTIVE_MODEL,
        "raw_response_excerpt": None,
        "fallback_reason": fallback_reason,
    }
    print(f"[LLM] operation={OPERATION} state=FALLBACK_TRIGGERED fallback_reason={fallback_reason} fallback_sql={fallback_sql!r}", flush=True)
    _llm_meta_log(OPERATION, None, state="fallback_triggered", fallback_reason=fallback_reason, fallback_sql=fallback_sql[:120])
    return fallback_sql, meta


def _parse_schema_text(table_schema: str) -> Tuple[str, List[Tuple[str, str]]]:
    """Return (table_name, [(column, type), ...]) from the 'Table: x / - col: type' schema text."""
    table_name = "your_table"
    columns: List[Tuple[str, str]] = []
    for line in (table_schema or "").splitlines():
        line = line.strip()
        if line.startswith("Table:"):
            table_name = line.split("Table:", 1)[1].strip()
        elif line.startswith("- ") and ":" in line:
            col, _, typ = line[2:].partition(":")
            columns.append((col.strip(), typ.strip().lower()))
    return table_name, columns


def generate_fallback_sql(user_query: str, table_schema: str) -> str:
    """Schema-aware rule-based SQL, used only when the LLM is unavailable.

    Only emits SQL over columns that really exist in the schema text.
    """
    query_lower = user_query.lower()
    table_name, columns = _parse_schema_text(table_schema)
    if "-" in table_name or "." in table_name or table_name.isdigit():
        table_name = f'"{table_name}"'

    numeric_types = ("integer", "bigint", "numeric", "double", "real", "smallint", "float")
    numeric_cols = [c for c, t in columns if any(n in t for n in numeric_types)]
    # Prefer a numeric column the question actually mentions.
    mentioned = [c for c in numeric_cols if c.lower().replace("_", " ") in query_lower or c.lower() in query_lower]
    target = (mentioned or numeric_cols or [None])[0]

    def agg(func: str, alias: str) -> str:
        if target is None:
            return f"SELECT COUNT(*) AS total_records FROM {table_name}"
        return f'SELECT {func}("{target}") AS {alias} FROM {table_name}'

    if ("total" in query_lower and "count" in query_lower) or "number of records" in query_lower or "how many" in query_lower or "count" in query_lower:
        return f"SELECT COUNT(*) AS total_records FROM {table_name}"
    if "average" in query_lower or "avg" in query_lower or "mean" in query_lower:
        return agg("AVG", "average_value")
    if "maximum" in query_lower or "max" in query_lower or "highest" in query_lower:
        return agg("MAX", "maximum_value")
    if "minimum" in query_lower or "min" in query_lower or "lowest" in query_lower:
        return agg("MIN", "minimum_value")
    if "sum" in query_lower or "total" in query_lower:
        return agg("SUM", "total_sum")
    return f"SELECT * FROM {table_name} LIMIT 10"


async def fix_sql_error(sql_query: str, error_message: str, table_schema: str = None) -> Tuple[Optional[str], Dict[str, Any]]:
    """
    Fix SQL query error using Hugging Face LLM. Returns (corrected_sql_or_None, meta_dict).
    """
    OPERATION = "sql_correction"
    schema_hint = f"\n\nSchema reference (use only these columns):\n{table_schema}\n" if table_schema else ""
    prompt = f"""The following PostgreSQL query produced an error.

Broken SQL:
{sql_query}

PostgreSQL error:
{error_message}
{schema_hint}
Return ONLY the corrected SQL statement. No explanation. Use exact column names if schema provided.
Fix the specific error (e.g. wrong column name → replace with existing column from schema)."""

    llm_result = await llm.call_llm(prompt, operation=OPERATION)

    if llm_result and llm_result.llm_success and isinstance(llm_result.data, str):
        sql = llm_result.data.strip()
        if sql.startswith("```sql"):
            sql = sql[6:]
        if sql.endswith("```"):
            sql = sql[:-3]
        sql = sql.strip()
        llm_result.raw_response_excerpt = sql[:200]
        _llm_meta_log(OPERATION, llm_result, state="output_parsed", sql_length=len(sql))
        return sql, llm_result.as_meta()

    fallback_reason = "llm_unreachable" if llm_result is None else "llm_success_but_empty"
    meta = {
        "path_used": "rule_fallback",
        "llm_success": False,
        "model": HuggingFaceLLM.ACTIVE_MODEL,
        "raw_response_excerpt": None,
        "fallback_reason": fallback_reason,
    }
    print(f"[LLM] operation={OPERATION} state=FALLBACK (NO CORRECTION) fallback_reason={fallback_reason}", flush=True)
    _llm_meta_log(OPERATION, None, state="fallback_triggered", fallback_reason=fallback_reason)
    return None, meta


async def generate_insights_from_data(query_results: List[Dict], user_query: str) -> Tuple[Dict[str, List[Dict[str, Any]]], Dict[str, Any]]:
    """
    Generate insights from query results using LLM with pandas fallback.
    Returns (structured_insights_dict, meta_dict).
    """
    OPERATION = "insights"
    # Keep the prompt bounded: the LLM sees at most PROMPT_ROW_CAP rows; the rule-based
    # fallback below still computes statistics over every row it is given.
    PROMPT_ROW_CAP = 100
    prompt_rows = query_results[:PROMPT_ROW_CAP]
    data_str = json.dumps(prompt_rows, indent=2, default=str)
    if len(query_results) > PROMPT_ROW_CAP:
        data_str += f"\n(showing first {PROMPT_ROW_CAP} of {len(query_results)} rows)"

    prompt = f"""You are a data analyst.

Analyze the following query result and generate data-backed insights.
IMPORTANT: Do NOT invent facts. Only describe patterns that are actually visible in the data below.

User Query:
{user_query}

Data (query result rows):
{data_str}

Return insights ONLY as JSON in this EXACT format — no markdown:
{{
  "insights": [
    {{"type": "dataset_overview", "description": "Concrete, data-backed statement about the rows/columns returned"}},
    {{"type": "data_quality", "description": "Observation about nulls / types / completeness if visible"}}
  ],
  "trends": [
    {{"type": "statistical_trend", "description": "Concrete numeric trend derived from the actual data"}}
  ],
  "anomalies": [
    {{"type": "outlier", "description": "Specific outlier value only if visible in data"}}
  ]
}}
"""

    llm_result = await llm.call_llm(prompt, max_tokens=900, operation=OPERATION)

    if llm_result and llm_result.llm_success:
        try:
            insights_data = json.loads(llm_result.data)
            if isinstance(insights_data, dict):
                # Validate / default shape
                for k in ("insights", "trends", "anomalies"):
                    if k not in insights_data or not isinstance(insights_data[k], list):
                        insights_data[k] = []
                _llm_meta_log(OPERATION, llm_result, state="json_parsed", insights_count=len(insights_data["insights"]), trends_count=len(insights_data["trends"]), anomalies_count=len(insights_data["anomalies"]))
                return insights_data, llm_result.as_meta()
        except json.JSONDecodeError as jde:
            print(f"[LLM] operation={OPERATION} state=JSONDecodeError message={str(jde)[:100]!r}", flush=True)

    fallback_reason = "llm_unreachable" if llm_result is None else ("json_invalid" if llm_result.llm_success else "llm_failed")
    fallback_data = generate_fallback_insights_structured(query_results, user_query)
    meta = {
        "path_used": "rule_fallback",
        "llm_success": False,
        "model": HuggingFaceLLM.ACTIVE_MODEL,
        "raw_response_excerpt": None,
        "fallback_reason": fallback_reason,
    }
    print(f"[LLM] operation={OPERATION} state=FALLBACK_TRIGGERED fallback_reason={fallback_reason}", flush=True)
    _llm_meta_log(OPERATION, None, state="fallback_triggered", fallback_reason=fallback_reason, insights_count=len(fallback_data["insights"]))
    return fallback_data, meta


def generate_fallback_insights_structured(query_results: List[Dict], user_query: str) -> Dict[str, List[Dict[str, Any]]]:
    """Generate structured insights using rule-based approach.

    Uses ONLY data-backed assertions from the actual query_results rows.
    No invented claims — only stats computable from query_results directly.
    """
    if not query_results:
        return {
            "insights": [{"type": "dataset_overview", "description": "No data returned by the query"}],
            "trends": [],
            "anomalies": []
        }

    row_count = len(query_results)
    columns = list(query_results[0].keys())
    col_count = len(columns)

    insights = []
    trends = []
    anomalies = []

    insights.append({
        "type": "dataset_overview",
        "description": f"Query returned {row_count} rows with {col_count} columns: {', '.join(columns)}"
    })

    # Numeric column stats
    numeric_cols = []
    for col in columns:
        num_values = [row.get(col) for row in query_results if isinstance(row.get(col), (int, float)) and not isinstance(row.get(col), bool)]
        if num_values and len(num_values) >= 1:
            numeric_cols.append((col, num_values))

    if numeric_cols:
        col_names = [c for c, _ in numeric_cols]
        trends.append({
            "type": "numeric_trend",
            "description": f"Numeric columns detected: {', '.join(col_names)}"
        })
        for col, values in numeric_cols:
            avg_val = sum(values) / len(values)
            max_val = max(values)
            min_val = min(values)
            total = sum(values) if all(isinstance(v, (int, float)) for v in values) else None
            parts = [f"avg={avg_val:.2f}", f"min={min_val}", f"max={max_val}"]
            if total is not None and len(values) >= 2:
                parts.append(f"sum={total}")
            trends.append({
                "type": "statistical_trend",
                "description": f"{col}: {'; '.join(parts)} across {len(values)} values"
            })

    # Categorical column: number of unique values
    for col in columns:
        values = [row.get(col) for row in query_results if row.get(col) is not None]
        if values and not any(isinstance(v, (int, float)) and not isinstance(v, bool) for v in values) and 1 < len(set(str(v) for v in values)) <= min(15, len(values)):
            unique_vals = sorted(set(str(v) for v in values))
            insights.append({
                "type": "categorical_overview",
                "description": f"Column '{col}' contains categorical values: {', '.join(unique_vals)}"
            })

    # Missing values per column (shallow count across rows: look for None)
    missing_per_col = {col: sum(1 for r in query_results if r.get(col) is None) for col in columns}
    missing_cols = [f"{c}({n})" for c, n in missing_per_col.items() if n > 0]
    if missing_cols:
        insights.append({
            "type": "data_quality",
            "description": f"Missing (null) values detected across rows: {', '.join(missing_cols)}"
        })
    else:
        insights.append({
            "type": "data_quality",
            "description": f"No nulls detected across returned rows for columns: {', '.join(columns)}"
        })

    # Simple outlier detection: any numeric value > mean + 2*std gets flagged
    for col, values in numeric_cols:
        if len(values) >= 4:
            mean = sum(values) / len(values)
            var = sum((v - mean) ** 2 for v in values) / len(values)
            std = var ** 0.5
            if std > 0:
                outs = [v for v in values if abs(v - mean) > 2 * std]
                if outs:
                    anomalies.append({
                        "type": "statistical_outlier",
                        "description": f"Column '{col}': {len(outs)} outlier value(s) >2 std from mean ({mean:.2f} ± {std:.2f}): {', '.join(str(v) for v in outs[:5])}"
                    })

    return {
        "insights": insights,
        "trends": trends,
        "anomalies": anomalies
    }


async def generate_recommendations_from_insights(insights: Dict[str, List[Dict[str, Any]]]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Generate structured business recommendations from insights.
    Returns: (structured_recommendations_dict, meta_dict)
    """
    OPERATION = "recommendations"
    all_text = extract_insights_text(insights)

    prompt = f"""You are a business analyst.

Generate actionable business recommendations based ONLY on the insights below.
Do not invent facts. Categorize recommendations appropriately.

Insights data:
{json.dumps(insights, indent=2, default=str)}

Return ONLY a JSON object in this EXACT format — no markdown fences, no explanation:
{{
  "recommendations": [
    {{"category": "Data Visualization", "icon": "chart", "items": ["Concrete, specific action 1", "Concrete, specific action 2"]}},
    {{"category": "Trend Analysis",       "icon": "trend", "items": ["Concrete, specific action 3"]}}
  ],
  "action_items": [
    "Immediate action item #1",
    "Immediate action item #2"
  ]
}}

Rules:
- 3-6 total items across all categories
- Use icons from: chart, trend, alert, shield, target (map each category to one)
- Include 2-3 specific, non-vague action_items
- Each recommendation item must be a single concrete string tied to the provided insights."""

    llm_result = await llm.call_llm(prompt, max_tokens=900, operation=OPERATION)

    if llm_result and llm_result.llm_success:
        # Try strict JSON, then fallback extraction of {first..last}
        parsed = None
        response_text = llm_result.data
        try:
            parsed = json.loads(response_text)
        except json.JSONDecodeError:
            cleaned = response_text.strip()
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    parsed = json.loads(cleaned[start:end+1])
                except Exception:
                    parsed = None

        if isinstance(parsed, dict) and "recommendations" in parsed:
            normalized = _normalize_recommendations(parsed)
            if normalized["recommendations"]:
                _llm_meta_log(OPERATION, llm_result, state="json_parsed_and_normalized",
                              categories_count=len(normalized["recommendations"]),
                              action_items_count=len(normalized["action_items"]))
                return normalized, llm_result.as_meta()

    fallback_reason = "llm_unreachable" if llm_result is None else ("json_invalid" if llm_result.llm_success else "llm_failed")
    fallback = generate_fallback_recommendations_structured(insights, all_text)
    meta = {
        "path_used": "rule_fallback",
        "llm_success": False,
        "model": HuggingFaceLLM.ACTIVE_MODEL,
        "raw_response_excerpt": None,
        "fallback_reason": fallback_reason,
    }
    print(f"[LLM] operation={OPERATION} state=FALLBACK_TRIGGERED fallback_reason={fallback_reason}", flush=True)
    _llm_meta_log(OPERATION, None, state="fallback_triggered", fallback_reason=fallback_reason)
    return fallback, meta


def extract_insights_text(insights: Dict[str, List[Dict[str, Any]]]) -> str:
    """Extract all description text from an insights dict for keyword matching."""
    parts = []
    for key in ("insights", "trends", "anomalies"):
        for item in insights.get(key, []) or []:
            desc = item.get("description") if isinstance(item, dict) else str(item)
            if desc:
                parts.append(desc)
    return " ".join(parts).lower()


def _normalize_recommendations(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and normalize LLM/raw recommendations output to standard schema."""
    normalized = {"recommendations": [], "action_items": []}

    # Process recommendations
    raw_recs = raw.get("recommendations", [])
    if isinstance(raw_recs, list):
        for rec in raw_recs:
            if isinstance(rec, dict):
                category = str(rec.get("category") or "General").strip() or "General"
                icon = str(rec.get("icon") or "target").strip()
                items = rec.get("items") or rec.get("recommendations") or []
                if isinstance(items, str):
                    items = [items]
                clean_items = [str(i).strip() for i in items if isinstance(i, str) and i and i.strip()]
                if clean_items:
                    normalized["recommendations"].append({
                        "category": category,
                        "icon": icon,
                        "items": clean_items
                    })
            elif isinstance(rec, str) and rec.strip():
                # Flat string: bucket into a General category
                normalized["recommendations"].append({
                    "category": "General",
                    "icon": "target",
                    "items": [rec.strip()]
                })

    # Process action items
    raw_actions = raw.get("action_items") or raw.get("actionItems") or []
    if isinstance(raw_actions, str):
        raw_actions = [raw_actions]
    normalized["action_items"] = [
        str(a).strip() for a in raw_actions
        if isinstance(a, str) and a and a.strip()
    ]

    return normalized


def flatten_recommendations(structured: Dict[str, Any]) -> List[str]:
    """Flatten structured recommendations output into a simple ordered list of strings.

    Used by /query endpoint's QueryResponse which feeds the Query.jsx flat renderer.
    """
    if not structured:
        return []
    flat = []
    for category in structured.get("recommendations", []) or []:
        items = category.get("items", []) if isinstance(category, dict) else []
        for item in items:
            flat.append(f"[{category.get('category', 'General')}] {item}" if isinstance(category, dict) else str(item))
    for action in structured.get("action_items", []) or []:
        flat.append(f"⚡ ACTION: {action}")
    # De-dupe while preserving order, cap at 8
    seen = set()
    deduped = []
    for line in flat:
        if line not in seen:
            seen.add(line)
            deduped.append(line)
    return deduped[:8]


def generate_fallback_recommendations_structured(insights: Dict[str, List[Dict[str, Any]]], insights_text: str = None) -> Dict[str, Any]:
    """Generate structured recommendations using rule-based approach.

    Accepts the full insights dict {insights:[], trends:[], anomalies:[]}.
    Returns the standard structured schema:
        {"recommendations": [{category, icon, items}], "action_items": [...]}.
    """
    if insights_text is None:
        insights_text = extract_insights_text(insights)

    categories = []  # list of {category, icon, items}

    # Data visualization + reporting bucket
    viz_items = []
    if "records" in insights_text or "data" in insights_text:
        viz_items.append("Implement data visualization dashboards to communicate key metrics at a glance")
        viz_items.append("Configure automated weekly or monthly summary reports for stakeholders")

    # Trend analysis + KPI bucket
    trend_items = []
    if "numeric" in insights_text or "average" in insights_text or "price" in insights_text or "quantity" in insights_text:
        trend_items.append("Track numeric metrics over time (weekly/monthly) to identify growth or decline patterns")
        trend_items.append("Establish KPIs based on average performance and set threshold-based alerts for deviations")
    if "sales" in insights_text or "revenue" in insights_text:
        trend_items.append("Break down sales/revenue by product category, region, and segment to identify highest performers")
    if "customer" in insights_text or "churn" in insights_text or "user" in insights_text:
        trend_items.append("Segment customers by cohort and track retention/churn KPIs monthly")

    # Investigation + anomaly bucket
    inv_items = []
    if "outliers" in insights_text or "range" in insights_text or "anomal" in insights_text:
        inv_items.append("Investigate outliers and anomalous data points to determine root causes")
        inv_items.append("Configure automated alerts when key metrics fall outside expected ranges")
    if len(insights.get("anomalies", []) or []) > 0:
        inv_items.append("Prioritize follow-up on detected anomalies — schedule a dedicated review this week")

    # Build category list
    if viz_items:
        categories.append({"category": "Data Visualization & Reporting", "icon": "chart", "items": viz_items[:2]})
    if trend_items:
        categories.append({"category": "Trend Analysis & KPI Tracking", "icon": "trend", "items": trend_items[:3]})
    if inv_items:
        categories.append({"category": "Anomaly Investigation", "icon": "alert", "items": inv_items[:2]})

    # Always include general category
    categories.append({
        "category": "Data Quality & Coverage",
        "icon": "shield",
        "items": [
            "Run regular data quality checks (nulls, duplicates, schema drift) before performing analysis",
            "Expand data collection breadth where gaps exist — more dimensions enable richer segmentation"
        ]
    })

    # Action items: cross-cutting immediate actions
    action_items = [
        "Schedule a 30-minute review this week with stakeholders to validate these recommendations",
        "Prioritize 1-2 recommendations to implement immediately and measure impact after 2 weeks"
    ]
    if inv_items:
        action_items.insert(0, "Schedule anomaly deep-dive within 48 hours — anomalous signals often indicate real issues")

    return {
        "recommendations": categories,
        "action_items": action_items
    }


def generate_fallback_recommendations(insights: Dict[str, List[Dict[str, Any]]]) -> List[str]:
    """Backward-compatible flat fallback (kept for any legacy callers).
    Delegates to structured generator then flattens.
    NOTE: Callers should prefer generate_fallback_recommendations_structured() directly.
    """
    structured = generate_fallback_recommendations_structured(insights)
    return flatten_recommendations(structured)

def detect_chart_type(df) -> Dict[str, Any]:
    """
    Automatically detect chart type based on data structure.

    Deterministic pandas logic. Returns chart config with:
        chart_type ∈ {kpi, line, bar, pie, scatter, table}
    """
    try:
        if df is None or len(df) == 0:
            return {"chart_type": "table", "title": "No rows returned"}

        n_rows, n_cols = df.shape

        # KPI detection: single row + at least one numeric (often single-agg SELECT SUM(...))
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        datetime_cols = df.select_dtypes(include=['datetime', 'datetime64']).columns.tolist()

        if n_rows == 1 and len(numeric_cols) >= 1 and len(categorical_cols) == 0 and len(datetime_cols) == 0:
            target = numeric_cols[0]
            value = df[target].iloc[0]
            return {
                "chart_type": "kpi",
                "metric": target,
                "value": value if isinstance(value, (int, float)) else float(value) if value is not None and value != "" else 0,
                "title": f"{str(target).title()}"
            }

        # Rule-based chart selection
        if len(datetime_cols) >= 1 and len(numeric_cols) >= 1:
            return {
                "chart_type": "line",
                "x_axis": datetime_cols[0],
                "y_axis": numeric_cols[0],
                "title": f"{numeric_cols[0].title()} Over {datetime_cols[0].title()}"
            }
        if len(categorical_cols) >= 1 and len(numeric_cols) >= 1:
            return {
                "chart_type": "bar",
                "x_axis": categorical_cols[0],
                "y_axis": numeric_cols[0],
                "title": f"{numeric_cols[0].title()} by {categorical_cols[0].title()}"
            }
        if len(categorical_cols) >= 1:
            unique_count = df[categorical_cols[0]].nunique()
            if 1 < unique_count <= 10:
                return {
                    "chart_type": "pie",
                    "x_axis": categorical_cols[0],
                    "y_axis": "count",
                    "title": f"Distribution of {categorical_cols[0].title()}"
                }
        if len(numeric_cols) >= 2:
            return {
                "chart_type": "scatter",
                "x_axis": numeric_cols[0],
                "y_axis": numeric_cols[1],
                "title": f"{numeric_cols[1].title()} vs {numeric_cols[0].title()}"
            }

        return {"chart_type": "table", "title": "Query Results"}
    except Exception as e:
        logger.error(f"Error detecting chart type: {str(e)}")
        return {"chart_type": "table", "title": "Query Results"}


# ============================================================
# Dataset processing (/process-data endpoint) — deterministic pandas
# ============================================================
def _map_dtype_to_pg(dtype) -> str:
    """Map pandas dtype to a PostgreSQL / schema-report column type label."""
    name = str(dtype).lower()
    if "int" in name:
        return "integer"
    if "float" in name or "double" in name or "decimal" in name:
        return "numeric"
    if "bool" in name:
        return "boolean"
    if "datetime" in name or "date" in name or "time" in name:
        return "date"
    return "text"


_RESERVED_WORDS = {
    "all", "analyse", "analyze", "and", "any", "array", "as", "asc", "both", "case", "cast", "check",
    "collate", "column", "constraint", "create", "current_date", "current_time", "current_timestamp",
    "default", "desc", "distinct", "do", "else", "end", "except", "fetch", "for", "foreign", "from",
    "grant", "group", "having", "in", "initially", "intersect", "into", "leading", "limit", "localtime",
    "localtimestamp", "not", "null", "offset", "on", "only", "or", "order", "placing", "primary",
    "references", "returning", "select", "session_user", "some", "symmetric", "table", "then", "to",
    "trailing", "union", "unique", "user", "using", "variadic", "when", "where", "window", "with",
}


def sanitize_column_names(columns) -> Tuple[List[str], Dict[str, str]]:
    """Turn arbitrary CSV headers into safe, unique, snake_case SQL identifiers.

    Returns (new_names, {new_name: original_header}).
    """
    import re

    new_names: List[str] = []
    mapping: Dict[str, str] = {}
    seen: Dict[str, int] = {}
    for idx, original in enumerate(columns):
        name = re.sub(r"[^0-9a-zA-Z]+", "_", str(original).strip()).strip("_").lower()
        if not name:
            name = f"column_{idx + 1}"
        if name[0].isdigit():
            name = f"col_{name}"
        if name in _RESERVED_WORDS:
            name = f"{name}_"
        name = name[:60]
        base = name
        n = seen.get(base, 0)
        while name in mapping:
            n += 1
            name = f"{base[:55]}_{n}"
        seen[base] = n
        mapping[name] = str(original)
        new_names.append(name)
    return new_names, mapping


def _maybe_parse_dates(df: pd.DataFrame) -> pd.DataFrame:
    """Convert text columns that are mostly dates into datetime columns."""
    import warnings

    for col in df.columns:
        series = df[col]
        if not (pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)):
            continue
        non_null = series.dropna().astype(str)
        if non_null.empty:
            continue
        sample = non_null.head(50)
        # Cheap guard: every sampled value must contain a digit and a date-ish separator.
        if not sample.str.contains(r"\d").all() or not sample.str.contains(r"[-/:.]|\s").all():
            continue
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                parsed = pd.to_datetime(series, errors="coerce")
            if parsed.notna().sum() >= max(1, int(0.7 * len(non_null))):
                df[col] = parsed
        except Exception:  # noqa: BLE001
            continue
    return df


def load_csv_dataframe(file_bytes_or_path) -> Tuple[pd.DataFrame, Dict[str, str]]:
    """Read CSV bytes/path into a DataFrame with sanitized column names.

    Returns (df, {sanitized_name: original_header}).
    """
    import io

    def _read(source):
        return pd.read_csv(source, skipinitialspace=True)

    if isinstance(file_bytes_or_path, (bytes, bytearray)):
        try:
            df = _read(io.BytesIO(file_bytes_or_path))
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(file_bytes_or_path), skipinitialspace=True, encoding="latin-1")
    else:
        df = _read(str(file_bytes_or_path))

    if df.shape[1] == 0:
        raise pd.errors.EmptyDataError("CSV has no columns")
    new_names, mapping = sanitize_column_names(list(df.columns))
    df.columns = new_names
    df = _maybe_parse_dates(df)
    return df, mapping


def profile_dataframe(df: pd.DataFrame, filename: str, table_name: str, column_map: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Deterministic pandas profile of a DataFrame (no LLM involved)."""
    column_map = column_map or {}
    row_count = int(len(df))
    column_count = int(df.shape[1])
    col_names = list(df.columns)

    columns_meta = []
    numeric_columns = []
    categorical_columns = []
    date_columns = []
    missing_value_counts = {}
    unique_value_counts = {}
    sample_values_map = {}
    basic_statistics = {}

    for col in col_names:
        series = df[col]
        dtype_pg = _map_dtype_to_pg(series.dtype)
        is_numeric = pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series)
        is_datetime = pd.api.types.is_datetime64_any_dtype(series)
        missing_count = int(series.isna().sum())
        missing_ratio = missing_count / row_count if row_count > 0 else 0.0

        sample_values = []
        for v in series.dropna().head(min(5, row_count)).tolist():
            if isinstance(v, (pd.Timestamp, datetime, date)):
                sample_values.append(v.isoformat() if hasattr(v, "isoformat") else str(v))
            elif isinstance(v, (np.integer,)):
                sample_values.append(int(v))
            elif isinstance(v, (np.floating,)):
                sample_values.append(float(v))
            elif isinstance(v, float) and np.isnan(v):
                continue
            else:
                sample_values.append(str(v) if not isinstance(v, (int, float, bool, str)) else v)

        unique_count = int(series.dropna().nunique())
        unique_value_counts[col] = unique_count
        missing_value_counts[col] = missing_count
        sample_values_map[col] = sample_values

        columns_meta.append({
            "name": col,
            "original_name": column_map.get(col, col),
            "type_pg": dtype_pg,
            "dtype_pandas": str(series.dtype),
            "nullable": missing_count > 0,
            "missing_count": missing_count,
            "missing_ratio": round(missing_ratio, 4),
            "unique_count": unique_count,
            "sample_values": sample_values,
        })

        if is_datetime:
            date_columns.append(col)
        elif is_numeric:
            numeric_columns.append(col)
            clean = series.dropna()
            if len(clean) > 0:
                basic_statistics[col] = {
                    "count": int(clean.count()),
                    "mean": round(float(clean.mean()), 4),
                    "min": round(float(clean.min()), 4),
                    "max": round(float(clean.max()), 4),
                    "std": round(float(clean.std()) if len(clean) > 1 else 0.0, 4),
                    "median": round(float(clean.median()), 4),
                    "sum": round(float(clean.sum()), 4),
                }
        else:
            categorical_columns.append(col)

    # NL->SQL-ready schema text: physical table + sanitized columns the table really has.
    schema_lines = [f"Table: {table_name}", "Columns:"]
    for c in columns_meta:
        schema_lines.append(f"- {c['name']}: {c['type_pg']}")
    schema_text = "\n".join(schema_lines) + "\n"

    preview_df = df.head(5).copy()
    for col in preview_df.columns:
        if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
            preview_df[col] = preview_df[col].dt.strftime("%Y-%m-%d %H:%M:%S")
    preview_rows = json.loads(preview_df.to_json(orient="records", date_format="iso"))

    return {
        "filename": filename,
        "table_name": table_name,
        "row_count": row_count,
        "column_count": column_count,
        "columns": columns_meta,
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "date_columns": date_columns,
        "missing_value_counts": missing_value_counts,
        "unique_value_counts": unique_value_counts,
        "sample_values": sample_values_map,
        "basic_statistics": basic_statistics,
        "preview_rows": preview_rows,
        "schema_text": schema_text,
    }


def process_uploaded_csv(file_bytes_or_path, filename: str = "upload.csv", table_name: str = None) -> Dict[str, Any]:
    """Read a CSV with pandas and return its profile (no database writes).

    Kept for backwards compatibility; /ingest uses load_csv_dataframe + profile_dataframe
    so the same DataFrame that was profiled is what gets stored.
    """
    df, mapping = load_csv_dataframe(file_bytes_or_path)
    if not table_name:
        base = os.path.splitext(os.path.basename(filename))[0].lower()
        table_name = "".join(c if c.isalnum() or c == "_" else "_" for c in base) or "uploaded_data"
    return profile_dataframe(df, filename, table_name, mapping)
