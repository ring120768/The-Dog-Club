CREATE TABLE operator_export_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 club_id text NOT NULL REFERENCES clubs(id),
 actor_id text NOT NULL REFERENCES accounts(id),
 action text NOT NULL CHECK(action IN ('export.created','restore.completed')),
 archive_sha256 text NOT NULL CHECK(archive_sha256 ~ '^[a-f0-9]{64}$'),
 record_count integer NOT NULL CHECK(record_count>=0),
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE operator_export_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_export_events FORCE ROW LEVEL SECURITY;
-- Export and restore history is platform-only. No club_app grant is made.
