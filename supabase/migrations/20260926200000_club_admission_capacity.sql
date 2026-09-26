CREATE TABLE admission_settings (
 club_id text PRIMARY KEY REFERENCES clubs(id),
 human_capacity integer NOT NULL CHECK(human_capacity BETWEEN 1 AND 1000),
 dog_capacity integer NOT NULL CHECK(dog_capacity BETWEEN 0 AND 1000),
 updated_by text NOT NULL REFERENCES accounts(id), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admission_passes (
 id uuid PRIMARY KEY, club_id text NOT NULL, account_id text NOT NULL, code text NOT NULL UNIQUE CHECK(code ~ '^[A-F0-9]{16}$'),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(club_id,id), UNIQUE(club_id,account_id),
 FOREIGN KEY(club_id,account_id) REFERENCES memberships(club_id,account_id)
);

CREATE TABLE dog_admission_eligibilities (
 club_id text NOT NULL, dog_id uuid NOT NULL, status text NOT NULL CHECK(status IN ('approved','suspended')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 500), reviewed_by text NOT NULL REFERENCES accounts(id),
 reviewed_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0), PRIMARY KEY(club_id,dog_id),
 FOREIGN KEY(club_id,dog_id) REFERENCES dogs(club_id,id)
);

CREATE TABLE dog_admission_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, club_id text NOT NULL, dog_id uuid NOT NULL,
 actor_id text NOT NULL REFERENCES accounts(id), from_status text CHECK(from_status IN ('approved','suspended')),
 to_status text NOT NULL CHECK(to_status IN ('approved','suspended')), reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 500),
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(club_id,dog_id) REFERENCES dogs(club_id,id)
);

CREATE TABLE admission_visits (
 id uuid PRIMARY KEY, club_id text NOT NULL, account_id text NOT NULL, pass_id uuid NOT NULL,
 human_count integer NOT NULL CHECK(human_count BETWEEN 1 AND 20), status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','checked_out')),
 checked_in_by text NOT NULL REFERENCES accounts(id), checked_in_at timestamptz NOT NULL DEFAULT now(),
 checked_out_by text REFERENCES accounts(id), checked_out_at timestamptz, UNIQUE(club_id,id),
 FOREIGN KEY(club_id,account_id) REFERENCES memberships(club_id,account_id),
 FOREIGN KEY(club_id,pass_id) REFERENCES admission_passes(club_id,id),
 CHECK((status='active' AND checked_out_by IS NULL AND checked_out_at IS NULL) OR (status='checked_out' AND checked_out_by IS NOT NULL AND checked_out_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_active_admission_per_account ON admission_visits(club_id,account_id) WHERE status='active';

CREATE TABLE admission_visit_dogs (
 club_id text NOT NULL, visit_id uuid NOT NULL, dog_id uuid NOT NULL, PRIMARY KEY(club_id,visit_id,dog_id),
 FOREIGN KEY(club_id,visit_id) REFERENCES admission_visits(club_id,id), FOREIGN KEY(club_id,dog_id) REFERENCES dogs(club_id,id)
);

CREATE TABLE admission_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, club_id text NOT NULL, visit_id uuid NOT NULL,
 actor_id text NOT NULL REFERENCES accounts(id), action text NOT NULL CHECK(action IN ('admission.checked_in','admission.checked_out')),
 human_count integer NOT NULL CHECK(human_count BETWEEN 1 AND 20), dog_count integer NOT NULL CHECK(dog_count BETWEEN 0 AND 20),
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(club_id,visit_id) REFERENCES admission_visits(club_id,id)
);

ALTER TABLE admission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE admission_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_passes FORCE ROW LEVEL SECURITY;
ALTER TABLE dog_admission_eligibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE dog_admission_eligibilities FORCE ROW LEVEL SECURITY;
ALTER TABLE dog_admission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dog_admission_events FORCE ROW LEVEL SECURITY;
ALTER TABLE admission_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_visits FORCE ROW LEVEL SECURITY;
ALTER TABLE admission_visit_dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_visit_dogs FORCE ROW LEVEL SECURITY;
ALTER TABLE admission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_events FORCE ROW LEVEL SECURITY;

GRANT SELECT ON admission_settings,admission_passes,dog_admission_eligibilities,dog_admission_events,admission_visits,admission_visit_dogs,admission_events TO club_app;
CREATE POLICY admission_settings_read ON admission_settings FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=admission_settings.club_id));
CREATE POLICY admission_pass_read ON admission_passes FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=admission_passes.club_id AND m.account_id=current_setting('app.account_id',true) AND (m.role='manager' OR admission_passes.account_id=m.account_id)));
CREATE POLICY dog_admission_read ON dog_admission_eligibilities FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=dog_admission_eligibilities.club_id AND m.account_id=current_setting('app.account_id',true) AND (m.role='manager' OR EXISTS(SELECT 1 FROM dogs d WHERE d.club_id=dog_admission_eligibilities.club_id AND d.id=dog_admission_eligibilities.dog_id AND d.owner_id=m.account_id))));
CREATE POLICY dog_admission_event_read ON dog_admission_events FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=dog_admission_events.club_id AND m.account_id=current_setting('app.account_id',true) AND (m.role='manager' OR EXISTS(SELECT 1 FROM dogs d WHERE d.club_id=dog_admission_events.club_id AND d.id=dog_admission_events.dog_id AND d.owner_id=m.account_id))));
CREATE POLICY admission_visit_read ON admission_visits FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=admission_visits.club_id AND m.account_id=current_setting('app.account_id',true) AND (m.role='manager' OR admission_visits.account_id=m.account_id)));
CREATE POLICY admission_visit_dog_read ON admission_visit_dogs FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM admission_visits v WHERE v.club_id=admission_visit_dogs.club_id AND v.id=admission_visit_dogs.visit_id));
CREATE POLICY admission_event_read ON admission_events FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM admission_visits v WHERE v.club_id=admission_events.club_id AND v.id=admission_events.visit_id));
-- Admission writes stay behind server-side manager/member checks and transactional capacity locks.
