"""End-to-end tests for ingestion + safe query execution against a real PostgreSQL.

Set TEST_DATABASE_URL (e.g. postgresql://postgres@127.0.0.1:5544/postgres) to run these;
they are skipped otherwise. The LLM is replaced by a stub - no network access is used.
"""
import os
import uuid

import pytest
from fastapi.testclient import TestClient

TEST_DB = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL not set")

TOKEN = "test-token"
HEADERS = {"X-Internal-Token": TOKEN}

CSV = (
    "Order Date,Category,Total $,Group,Customer Name\n"
    "2024-01-05,Electronics,100.5,A,Ann\n"
    "2024-01-06,Electronics,200,A,Bob\n"
    "2024-02-01,Furniture,50,B,Cy\n"
    "2024-02-02,Furniture,75.25,B,Dee\n"
    "2024-03-03,Toys,10,A,Eve\n"
)


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", TEST_DB)
    monkeypatch.setenv("AI_SERVICE_TOKEN", TOKEN)
    import data_store
    data_store.reset_engines()
    import app as app_module
    return TestClient(app_module.app)


@pytest.fixture()
def stub_llm(monkeypatch):
    """Replace the HF client. `stub_llm.sql` is what the 'model' answers for SQL operations."""
    import llm_utils

    class Stub:
        sql = None
        calls = []

    async def fake_call(prompt, max_tokens=1000, operation="call"):
        Stub.calls.append(operation)
        if operation in ("nl_to_sql", "sql_correction") and Stub.sql is not None:
            return llm_utils.LLMResult(data=Stub.sql, path_used="huggingface_llm", llm_success=True, model="stub")
        return None  # insights / recommendations / unreachable -> rule-based fallback

    Stub.sql = None
    Stub.calls = []
    monkeypatch.setattr(llm_utils.llm, "call_llm", fake_call)
    return Stub


def ingest(client, csv=CSV, filename="sales.csv"):
    dataset_id = str(uuid.uuid4())
    r = client.post("/ingest", headers=HEADERS, data={"dataset_id": dataset_id},
                    files={"file": (filename, csv.encode(), "text/csv")})
    assert r.status_code == 200, r.text
    return dataset_id, r.json()


def test_requires_token(client):
    assert client.post("/query", json={"user_query": "x", "table_name": "ds_" + "a" * 32}).status_code == 401
    assert client.post("/query", headers={"X-Internal-Token": "wrong"},
                       json={"user_query": "x", "table_name": "ds_" + "a" * 32}).status_code == 401


def test_unconfigured_service_refuses(monkeypatch, client):
    monkeypatch.delenv("AI_SERVICE_TOKEN")
    r = client.post("/query", headers=HEADERS, json={"user_query": "x", "table_name": "ds_" + "a" * 32})
    assert r.status_code == 503


def test_ingest_sanitizes_columns_and_profiles(client):
    _, profile = ingest(client)
    names = [c["name"] for c in profile["columns"]]
    assert names == ["order_date", "category", "total", "group_", "customer_name"]
    assert profile["row_count"] == 5
    assert "order_date" in profile["date_columns"]
    assert "total" in profile["numeric_columns"]
    assert profile["table_name"].startswith("ds_")
    assert len(profile["preview_rows"]) == 5
    assert profile["basic_statistics"]["total"]["sum"] == pytest.approx(435.75)


def test_ingest_rejects_bad_input(client):
    r = client.post("/ingest", headers=HEADERS, data={"dataset_id": "not-a-uuid"},
                    files={"file": ("a.csv", b"a,b\n1,2\n", "text/csv")})
    assert r.status_code == 422
    r = client.post("/ingest", headers=HEADERS, data={"dataset_id": str(uuid.uuid4())},
                    files={"file": ("a.txt", b"a,b\n1,2\n", "text/plain")})
    assert r.status_code == 400
    r = client.post("/ingest", headers=HEADERS, data={"dataset_id": str(uuid.uuid4())},
                    files={"file": ("a.csv", b"a,b\n", "text/csv")})
    assert r.status_code == 400


def test_query_runs_real_sql_over_uploaded_data(client, stub_llm):
    ds, profile = ingest(client)
    t = profile["table_name"]
    stub_llm.sql = f"SELECT category, SUM(total) AS revenue FROM {t} GROUP BY category ORDER BY revenue DESC"
    r = client.post("/query", headers=HEADERS, json={
        "user_query": "revenue by category", "table_name": t, "table_schema_text": profile["schema_text"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["used_fallback_preview"] is False
    by_cat = {row["category"]: row["revenue"] for row in body["data"]}
    assert by_cat == {"Electronics": 300.5, "Furniture": 125.25, "Toys": 10.0}
    assert body["chart_type"] == "bar"
    assert body["sql_generation_meta"]["path_used"] == "huggingface_llm"


def test_like_percent_and_colon_literals_execute(client, stub_llm):
    _, profile = ingest(client)
    t = profile["table_name"]
    stub_llm.sql = f"SELECT customer_name FROM {t} WHERE customer_name LIKE '%e%' AND category <> ':x'"
    r = client.post("/query", headers=HEADERS, json={"user_query": "names with e", "table_name": t})
    assert r.status_code == 200, r.text
    assert sorted(row["customer_name"] for row in r.json()["data"]) == ["Dee", "Eve"]


def test_rule_fallback_when_llm_unreachable_uses_real_columns(client, stub_llm):
    _, profile = ingest(client)
    t = profile["table_name"]
    r = client.post("/query", headers=HEADERS, json={"user_query": "what is the average total", "table_name": t})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["sql_generation_meta"]["path_used"] == "rule_fallback"
    assert body["data"][0]["average_value"] == pytest.approx(87.15)


def test_destructive_sql_from_llm_is_blocked_and_data_survives(client, stub_llm):
    _, profile = ingest(client)
    t = profile["table_name"]
    stub_llm.sql = f"DROP TABLE {t}"
    r = client.post("/query", headers=HEADERS, json={"user_query": "delete everything", "table_name": t})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["used_fallback_preview"] is True
    assert any("could not be turned into a valid query" in w for w in body["warnings"])
    assert body["sql_correction_attempts"] == 2
    # table must still exist with all rows
    stub_llm.sql = f"SELECT COUNT(*) AS n FROM {t}"
    r = client.post("/query", headers=HEADERS, json={"user_query": "count", "table_name": t})
    assert r.json()["data"][0]["n"] == 5


def test_cannot_read_another_datasets_table(client, stub_llm):
    _, mine = ingest(client)
    _, other = ingest(client, csv="secret\nhunter2\n", filename="other.csv")
    stub_llm.sql = f"SELECT secret FROM {other['table_name']}"
    r = client.post("/query", headers=HEADERS, json={"user_query": "steal", "table_name": mine["table_name"]})
    assert r.status_code == 200
    body = r.json()
    assert body["used_fallback_preview"] is True
    assert all("secret" not in row for row in body["data"])
    assert "hunter2" not in r.text


def test_cannot_read_system_catalogs(client, stub_llm):
    _, profile = ingest(client)
    t = profile["table_name"]
    for evil in ["SELECT * FROM pg_catalog.pg_user",
                 "SELECT * FROM information_schema.tables",
                 f"SELECT pg_read_file('/etc/passwd') FROM {t}"]:
        stub_llm.sql = evil
        r = client.post("/query", headers=HEADERS, json={"user_query": "x", "table_name": t})
        assert r.status_code == 200
        assert r.json()["used_fallback_preview"] is True


def test_invalid_table_name_rejected(client):
    for bad in ["users", "public.users", "ds_short", "ds_" + "g" * 32, 'ds_' + 'a' * 32 + '"; DROP TABLE x;--']:
        r = client.post("/query", headers=HEADERS, json={"user_query": "x", "table_name": bad})
        assert r.status_code == 422, bad


def test_missing_table_gives_404(client, stub_llm):
    r = client.post("/query", headers=HEADERS, json={"user_query": "x", "table_name": "ds_" + "b" * 32})
    assert r.status_code == 404


def test_statement_timeout_is_enforced(client, stub_llm, monkeypatch):
    import data_store
    big = "n\n" + "\n".join(str(i) for i in range(3000)) + "\n"
    _, profile = ingest(client, csv=big, filename="big.csv")
    t = profile["table_name"]
    monkeypatch.setattr(data_store, "STATEMENT_TIMEOUT_MS", 300)
    with pytest.raises(data_store.QueryExecutionError) as ei:
        data_store.run_readonly_query(f"SELECT COUNT(*) FROM {t} a, {t} b, {t} c", t)
    assert "timeout" in str(ei.value).lower()


def test_generate_insights_from_table(client, stub_llm):
    _, profile = ingest(client)
    r = client.post("/generate-insights", headers=HEADERS, json={"table_name": profile["table_name"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["meta"]["path_used"] == "rule_fallback"
    text = " ".join(i["description"] for i in body["insights"] + body["trends"])
    assert "5 rows" in text and "total" in text


def test_delete_dataset_table(client, stub_llm):
    _, profile = ingest(client)
    t = profile["table_name"]
    assert client.delete(f"/datasets/{t}", headers=HEADERS).status_code == 200
    r = client.post("/query", headers=HEADERS, json={"user_query": "x", "table_name": t})
    assert r.status_code == 404
    assert client.delete("/datasets/users", headers=HEADERS).status_code == 422
