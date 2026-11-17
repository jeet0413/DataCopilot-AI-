-- Migration 001 (additive, non-destructive; safe to run more than once)
-- Run in the Supabase SQL editor.

-- 1. Real password authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Datasets now map to a real table inside the AI service's PostgreSQL database
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS table_name TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS row_count INTEGER;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS column_count INTEGER;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS profile JSONB;

-- 3. Case-insensitive unique emails (the API lower-cases emails before storing them)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- 4. Ownership is enforced by the backend (service-role key). Enabling RLS with no policies for
--    the anon role means the public anon key can no longer read these tables directly.
--    The service-role key bypasses RLS, so the backend keeps working.
--    Uncomment once SUPABASE_SERVICE_ROLE_KEY is configured for the backend:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Optional but recommended for the AI service database role used to run generated SQL:
--    CREATE ROLE datacopilot_query LOGIN PASSWORD '<choose-a-strong-password>';
--    REVOKE ALL ON SCHEMA public FROM datacopilot_query;
--    (the AI service grants SELECT on each dataset table when QUERY_DB_ROLE=datacopilot_query)
