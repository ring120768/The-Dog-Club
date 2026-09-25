-- The app connects as the table owner and switches to club_app per transaction (SET LOCAL ROLE).
-- PostgreSQL 16+ no longer lets a CREATEROLE user SET ROLE to roles it created, so grant it explicitly.
GRANT club_app TO current_user;

-- Supabase exposes the public schema through its Data API as anon/authenticated. This app never
-- uses that API: remove every default grant so credentials and sessions cannot be read through it.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;

-- Defence in depth: owner-only tables get RLS with no policies, so any other role sees nothing.
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
