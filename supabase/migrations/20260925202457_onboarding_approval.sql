CREATE TABLE onboarding_invites (
 id uuid PRIMARY KEY, token_hash text UNIQUE NOT NULL, email text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('operator','member')), club_id text REFERENCES clubs(id),
 branding jsonb, created_by text NOT NULL REFERENCES accounts(id),
 expires_at timestamptz NOT NULL, accepted_at timestamptz, revoked_at timestamptz,
 CHECK((kind='member' AND club_id IS NOT NULL AND branding IS NULL) OR (kind='operator' AND club_id IS NULL AND branding IS NOT NULL))
);
-- Invitation acceptance needs account creation before an application role exists.
-- Only server-owned transactions may access invite tokens; there are no client-role grants.
ALTER TABLE onboarding_invites ENABLE ROW LEVEL SECURITY;
CREATE TABLE dog_applications (
 club_id text NOT NULL, dog_id uuid NOT NULL, activity text NOT NULL DEFAULT 'grooming' CHECK(activity='grooming'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','needs-information','approved','expired','suspended')),
 emergency_contact text NOT NULL DEFAULT '' CHECK(length(emergency_contact)<=200),
 handling_notes text NOT NULL DEFAULT '' CHECK(length(handling_notes)<=2000),
 reason text NOT NULL DEFAULT '' CHECK(length(reason)<=1000), reviewer_id text REFERENCES accounts(id), reviewed_at timestamptz,
 version integer NOT NULL DEFAULT 1, submitted_at timestamptz,
 PRIMARY KEY(club_id,dog_id,activity), FOREIGN KEY(club_id,dog_id) REFERENCES dogs(club_id,id)
);
CREATE TABLE application_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, club_id text NOT NULL, dog_id uuid NOT NULL,
 actor_id text NOT NULL REFERENCES accounts(id), action text NOT NULL, reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(club_id,dog_id) REFERENCES dogs(club_id,id)
);
ALTER TABLE dog_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE dog_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_events FORCE ROW LEVEL SECURITY;
GRANT SELECT ON dog_applications,application_events TO club_app;
CREATE POLICY application_read ON dog_applications FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND current_setting('app.public',true)='false' AND EXISTS(
 SELECT 1 FROM memberships m WHERE m.club_id=dog_applications.club_id AND (
  EXISTS(SELECT 1 FROM dogs d WHERE d.club_id=dog_applications.club_id AND d.id=dog_applications.dog_id AND d.owner_id=m.account_id)
  OR (m.role='manager' AND dog_applications.status<>'draft'))));
CREATE POLICY application_history_read ON application_events FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND current_setting('app.public',true)='false' AND EXISTS(
 SELECT 1 FROM memberships m WHERE m.club_id=application_events.club_id AND (
  EXISTS(SELECT 1 FROM dogs d WHERE d.club_id=application_events.club_id AND d.id=application_events.dog_id AND d.owner_id=m.account_id)
  OR (m.role='manager' AND EXISTS(SELECT 1 FROM dog_applications a WHERE a.club_id=application_events.club_id AND a.dog_id=application_events.dog_id AND a.status<>'draft')))));
-- Writes use narrowly scoped server operations with row locks, actor checks and audit in one transaction.
