CREATE TABLE platform_owners (account_id text PRIMARY KEY REFERENCES accounts(id));
GRANT SELECT ON platform_owners TO club_app;
ALTER TABLE platform_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_owners FORCE ROW LEVEL SECURITY;
CREATE POLICY own_platform_grant ON platform_owners FOR SELECT TO club_app USING(account_id=current_setting('app.account_id',true));
ALTER TABLE clubs ADD COLUMN emblem text NOT NULL DEFAULT 'paw' CHECK(emblem IN ('paw','dog','heart','sparkles'));
ALTER TABLE clubs ADD COLUMN avatar_tone text NOT NULL DEFAULT 'sand' CHECK(avatar_tone IN ('sand','sage','rose'));
ALTER TABLE clubs ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE clubs ADD COLUMN created_by text REFERENCES accounts(id);
ALTER TABLE clubs ADD COLUMN initial_manager_id text REFERENCES accounts(id);
ALTER TABLE clubs ADD CONSTRAINT club_palette CHECK(colour IN ('#235448','#2e526a','#633c56','#753f32','#39463f'));
ALTER TABLE clubs ADD CONSTRAINT club_text_bounds CHECK(length(name) BETWEEN 1 AND 80 AND length(tagline) BETWEEN 1 AND 160 AND length(location) BETWEEN 1 AND 120);
UPDATE clubs SET avatar_tone='sage',emblem='sparkles' WHERE id='coast';
GRANT INSERT ON clubs, memberships TO club_app;
GRANT UPDATE(name,tagline,colour,location,emblem,avatar_tone,version) ON clubs TO club_app;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs FORCE ROW LEVEL SECURITY;
CREATE POLICY brand_read ON clubs FOR SELECT TO club_app USING(true);
CREATE POLICY platform_create_club ON clubs FOR INSERT TO club_app WITH CHECK(
 created_by=current_setting('app.account_id',true) AND initial_manager_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM platform_owners)
);
CREATE POLICY brand_update ON clubs FOR UPDATE TO club_app USING(
 id=current_setting('app.club_id',true) AND (EXISTS(SELECT 1 FROM platform_owners) OR EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=clubs.id AND m.role='manager'))
) WITH CHECK (
 id=current_setting('app.club_id',true) AND (EXISTS(SELECT 1 FROM platform_owners) OR EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=clubs.id AND m.role='manager'))
);
CREATE POLICY initial_manager_insert ON memberships FOR INSERT TO club_app WITH CHECK(
 role='manager' AND EXISTS(SELECT 1 FROM platform_owners) AND EXISTS(
 SELECT 1 FROM clubs c WHERE c.id=memberships.club_id AND c.created_by=current_setting('app.account_id',true) AND c.initial_manager_id=memberships.account_id)
);
CREATE TABLE club_config_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, club_id text NOT NULL REFERENCES clubs(id), actor_id text NOT NULL REFERENCES accounts(id), action text NOT NULL CHECK(action IN ('club.created','branding.updated')), changes jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT,SELECT ON club_config_events TO club_app;
GRANT USAGE ON SEQUENCE club_config_events_id_seq TO club_app;
ALTER TABLE club_config_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_config_events FORCE ROW LEVEL SECURITY;
CREATE POLICY config_audit_read ON club_config_events FOR SELECT TO club_app USING(
 EXISTS(SELECT 1 FROM platform_owners) OR (club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=club_config_events.club_id AND m.role='manager'))
);
CREATE POLICY config_audit_insert ON club_config_events FOR INSERT TO club_app WITH CHECK(
 actor_id=current_setting('app.account_id',true) AND club_id=current_setting('app.club_id',true) AND (EXISTS(SELECT 1 FROM platform_owners) OR EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=club_config_events.club_id AND m.role='manager'))
);
