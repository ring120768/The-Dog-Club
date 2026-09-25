CREATE ROLE club_app NOLOGIN;
CREATE TABLE clubs (id text PRIMARY KEY, slug text UNIQUE NOT NULL, name text NOT NULL, tagline text NOT NULL, colour text NOT NULL CHECK (colour ~ '^#[0-9a-fA-F]{6}$'), location text NOT NULL);
CREATE TABLE accounts (id text PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL);
CREATE TABLE memberships (club_id text REFERENCES clubs(id), account_id text REFERENCES accounts(id), role text NOT NULL CHECK(role IN ('member','manager')), PRIMARY KEY(club_id,account_id));
CREATE TABLE sessions (token_hash text PRIMARY KEY, account_id text REFERENCES accounts(id), expires_at timestamptz NOT NULL);
CREATE TABLE login_attempts (email text PRIMARY KEY, attempts int NOT NULL, window_start timestamptz NOT NULL);
CREATE TABLE dogs (id uuid PRIMARY KEY, club_id text NOT NULL REFERENCES clubs(id), owner_id text NOT NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 60), breed text NOT NULL CHECK(length(breed)<=80), bio text NOT NULL CHECK(length(bio)<=400), avatar text NOT NULL CHECK(avatar IN ('sand','sage','rose')), audience text NOT NULL DEFAULT 'private' CHECK(audience IN ('private','members','public')), UNIQUE(club_id,id), FOREIGN KEY(club_id,owner_id) REFERENCES memberships(club_id,account_id));
CREATE TABLE care_notes (club_id text NOT NULL, dog_id uuid NOT NULL, notes text NOT NULL, PRIMARY KEY(club_id,dog_id), FOREIGN KEY(club_id,dog_id) REFERENCES dogs(club_id,id));
CREATE TABLE audit_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, club_id text NOT NULL, actor_id text NOT NULL, dog_id uuid NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT USAGE ON SCHEMA public TO club_app;
GRANT SELECT ON clubs, memberships TO club_app;
GRANT SELECT, INSERT, UPDATE ON dogs TO club_app;
GRANT SELECT ON care_notes TO club_app;
GRANT INSERT ON audit_events TO club_app;
GRANT USAGE ON SEQUENCE audit_events_id_seq TO club_app;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY own_memberships ON memberships FOR SELECT TO club_app USING(account_id=current_setting('app.account_id',true));
ALTER TABLE dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dogs FORCE ROW LEVEL SECURITY;
CREATE POLICY dog_read ON dogs FOR SELECT TO club_app USING (
 club_id=current_setting('app.club_id',true) AND (
  (current_setting('app.public',true)='true' AND audience='public') OR
  (current_setting('app.public',true)='false' AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=dogs.club_id AND (m.role='manager' OR dogs.owner_id=m.account_id OR dogs.audience IN ('members','public'))))
 ));
CREATE POLICY dog_insert ON dogs FOR INSERT TO club_app WITH CHECK (
 club_id=current_setting('app.club_id',true) AND owner_id=current_setting('app.account_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=dogs.club_id));
CREATE POLICY dog_update ON dogs FOR UPDATE TO club_app USING (
 club_id=current_setting('app.club_id',true) AND owner_id=current_setting('app.account_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=dogs.club_id)) WITH CHECK (
 club_id=current_setting('app.club_id',true) AND owner_id=current_setting('app.account_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=dogs.club_id));
ALTER TABLE care_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY care_read ON care_notes FOR SELECT TO club_app USING (club_id=current_setting('app.club_id',true) AND current_setting('app.public',true)='false' AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=care_notes.club_id AND (m.role='manager' OR EXISTS(SELECT 1 FROM dogs d WHERE d.id=care_notes.dog_id AND d.club_id=care_notes.club_id AND d.owner_id=m.account_id))));
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_insert ON audit_events FOR INSERT TO club_app WITH CHECK(club_id=current_setting('app.club_id',true) AND actor_id=current_setting('app.account_id',true));
