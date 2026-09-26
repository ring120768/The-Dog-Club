CREATE TABLE password_recovery_requests (
 id uuid PRIMARY KEY,
 account_id text NOT NULL REFERENCES accounts(id),
 requested_at timestamptz NOT NULL DEFAULT now(),
 handled_at timestamptz,
 handled_by text REFERENCES accounts(id),
 token_hash text UNIQUE CHECK(token_hash IS NULL OR length(token_hash)=64),
 expires_at timestamptz,
 consumed_at timestamptz,
 dismissed_at timestamptz
);

CREATE INDEX password_recovery_account_time
 ON password_recovery_requests(account_id,requested_at DESC);

CREATE TABLE password_recovery_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES password_recovery_requests(id),
 account_id text NOT NULL REFERENCES accounts(id),
 actor_id text REFERENCES accounts(id),
 action text NOT NULL CHECK(action IN ('recovery.requested','recovery.link_issued','recovery.completed','recovery.dismissed')),
 created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE password_recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_recovery_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE password_recovery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_recovery_events FORCE ROW LEVEL SECURITY;

-- Recovery contains authentication metadata and is intentionally server-only.
-- No grants or policies are given to club_app.
