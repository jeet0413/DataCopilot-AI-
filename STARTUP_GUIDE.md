# Startup Guide

See `README.md` for the architecture and quick setup. This guide covers the details.

## 1. Database
1. Supabase SQL editor: run `backend/complete-schema.sql`, then `backend/migrations/001_passwords_and_dataset_tables.sql`.
2. The AI service needs a PostgreSQL connection string (`DATABASE_URL`). With Supabase use the direct or pooler connection string.
3. Optional hardening: create a read-only role, set `QUERY_DATABASE_URL` to it and `QUERY_DB_ROLE` to its name.
   The service grants it SELECT on each new dataset table.

## 2. Environment
Generate the shared secrets, e.g. `python -c "import secrets;print(secrets.token_urlsafe(48))"`.

| Variable | Where | Notes |
|---|---|---|
| `JWT_SECRET` | backend | required in production |
| `AI_SERVICE_TOKEN` | backend + ai-service | must match |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | backend | required in production |
| `AI_SERVICE_URL` | backend | default `http://localhost:8001` |
| `DATABASE_URL` | ai-service | required |
| `HUGGINGFACE_API_KEY`, `HF_MODEL`, `HF_API_URL` | ai-service | optional; rule-based SQL is used without a key |
| `GOOGLE_CLIENT_ID` | backend | optional; Google login returns 501 without it |
| `REACT_APP_API_URL` | frontend | default `http://localhost:3002/api` |

## 3. Start (three terminals)
```
cd ai-service && source venv/bin/activate && uvicorn app:app --port 8001
cd backend && npm start
npm start            # repo root, frontend on :3000
```

## 4. Check it works
- `http://localhost:3002/api/health` reports the store mode and AI service status.
- Register, upload a CSV, ask a question on the Query page. The SQL that ran is shown under the results.

## Troubleshooting
- **503 from the AI service**: `AI_SERVICE_TOKEN` is not set there.
- **401 from the AI service via backend**: the tokens differ.
- **"No PostgreSQL connection configured"**: set `DATABASE_URL` for the AI service.
- **Backend refuses to start in production**: set `JWT_SECRET` and the Supabase variables.
- **Answers look generic**: no LLM key set, so the rule-based fallback is answering (a warning is returned).
