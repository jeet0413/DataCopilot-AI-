# DataCopilot AI — Audit, Roadmap & Development Tracker

Branch: `claude/audit-security-data-pipeline` (uncommitted working tree).

## 1. Product vision (reconstructed)
Users sign up, upload a CSV, the system understands the dataset, answers natural-language
questions by generating **safe** SQL, runs it, and returns tables, charts and insights.

## 2. Audit findings (what was wrong)
| Area | Finding | Severity |
|---|---|---|
| Auth | Login accepted any password / fell back to mock users; hard-coded JWT secret; no rate limit | Critical |
| AuthZ | Datasets and downloads not owner-scoped; static `/uploads` exposed files | Critical |
| AI service | Browser could call it directly; raw LLM SQL executed with no validation | Critical |
| Data | Uploads were never loaded into a queryable table; AI returned mock data | High |
| Frontend | Fake dashboard stats, canned chat replies, fake upload preview, hard-coded URLs, contract mismatch with backend | High |
| Ops | No tests, no .env docs, silent fallbacks hiding failures | Medium |

## 3. Tracker
| Feature | Requirement | Status | Work completed | Remaining | Tests |
|---|---|---|---|---|---|
| Auth | Real register/login/JWT | Done | scrypt hashing, no-default-secret JWT, uniform 401, rate limit | Password reset, email verify | e2e pass |
| Google login | OAuth | Partial | Server-side token verification, 501 unless `GOOGLE_CLIENT_ID` | Needs real client id | Not tested |
| Authorization | Owner-only data | Done | Owner-scoped list/get/delete/download; static route removed | RLS policies (optional) | e2e pass (cross-user 404) |
| Upload | Reliable + validated | Done | Type/size/empty/header checks, rollback on failure, real error messages | Excel/JSON formats | e2e pass |
| Dataset understanding | Schema + profile | Done | Column sanitising, date detection, profile + preview | Smarter type inference | pytest pass |
| NL→SQL | LLM + fallback | Partial | Schema-aware prompt, rule-based fallback, 2 self-corrections | HF endpoint/model not verified live | LLM stubbed only |
| Safe SQL | Only safe reads | Done | sqlglot allowlist, READ ONLY txn, timeout, row cap, optional RO role | Per-user quotas | 27 unit tests pass |
| Insights | Real | Partial | Generated from real result rows | Quality depends on live LLM | Stubbed |
| Charts | From real results | Partial | Chart detection server-side, existing Recharts views | Dashboard saving/pinning | Build only |
| Frontend integration | Match API | Done | api.js, Query, Insights, ChatBox, Upload, Dashboard, DatasetCard | Browser walkthrough | Build compiles; UI **not** exercised |
| Docs/CI | Setup + CI | Partial | `.env.example` files, this doc | README/STARTUP_GUIDE rewrite, CI | — |

## 4. Verified vs. not verified
- Verified: AI service 42 pytest tests (real Postgres 16); backend 5 e2e tests (real Express + real FastAPI + real Postgres, in-memory user store); frontend `CI=true react-scripts build` compiles.
- **Not verified:** real Supabase, live Hugging Face calls, Google login, any browser/UI interaction.

## 5. Known bugs / risks
- HF endpoint (`HF_API_URL`) may be outdated; configurable, falls back to rules.
- In-memory store loses data on restart (dev only; refused in production).
- Legacy mock/fallback services and stale report files were removed (see git history).

## 6. Architectural decisions
1. Backend is the only AI-service client (shared `X-Internal-Token`); browser sends only `dataset_id`.
2. One Postgres table per dataset (`user_data.ds_<uuidhex>`), name derived server-side.
3. LLM SQL is untrusted: parse → allowlist → read-only txn → timeout → row cap.
4. No silent fallbacks: memory store is explicit and dev-only.

## 7. Dependencies & setup
- Run `backend/migrations/001_passwords_and_dataset_tables.sql` in Supabase.
- Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `AI_SERVICE_TOKEN`, `AI_SERVICE_URL`.
- AI service: `DATABASE_URL` (Postgres), same `AI_SERVICE_TOKEN`, `HUGGINGFACE_API_KEY` (optional), optional `QUERY_DATABASE_URL`/`QUERY_DB_ROLE`.
- Tests: `ai-service`: `TEST_DATABASE_URL=... pytest`; backend: `TEST_PYTHON=... TEST_DATABASE_URL=... npm test`.

## 8. Decisions needed from the owner (blockers)
1. Provide/approve use of the Supabase service-role key and run the migration.
2. A Postgres `DATABASE_URL` for the AI service (Supabase direct connection works).
3. Approve deleting legacy/mock files listed above.
4. Choose LLM provider/model and supply a key.

## 9. Roadmap
P1 live-environment verification (Supabase, LLM) → P2 browser walkthrough + fix UI bugs → P3 dashboards (save/pin charts) → P4 CI + docs rewrite → P5 password reset, more file formats, quotas.
