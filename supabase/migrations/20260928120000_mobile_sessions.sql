CREATE TABLE mobile_sessions (
  token_hash text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ios','android','web_test')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX mobile_sessions_account_idx ON mobile_sessions(account_id);
CREATE INDEX mobile_sessions_expiry_idx ON mobile_sessions(expires_at) WHERE revoked_at IS NULL;

-- Mobile bearer sessions are resolved only by trusted server routes. The tenant role has no grant
-- and forced RLS ensures a future broad grant cannot accidentally expose the token ledger.
ALTER TABLE mobile_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_sessions FORCE ROW LEVEL SECURITY;
