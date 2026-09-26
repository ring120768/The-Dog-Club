ALTER TABLE clubs ADD COLUMN operator_state text NOT NULL DEFAULT 'onboarding'
  CHECK(operator_state IN ('onboarding','trial','active','restricted','closed'));

-- Existing synthetic and previously onboarded clubs remain accessible after the upgrade.
-- Newly created operators keep the onboarding default until the platform owner advances them.
UPDATE clubs SET operator_state='trial';

CREATE TABLE operator_lifecycle_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 club_id text NOT NULL REFERENCES clubs(id),
 actor_id text NOT NULL REFERENCES accounts(id),
 from_state text NOT NULL CHECK(from_state IN ('onboarding','trial','active','restricted','closed')),
 to_state text NOT NULL CHECK(to_state IN ('onboarding','trial','active','restricted','closed')),
 reason text NOT NULL,
 readiness_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE operator_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_lifecycle_events FORCE ROW LEVEL SECURITY;
-- Platform lifecycle history is server-only. No club_app grant is made.
