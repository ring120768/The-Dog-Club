CREATE TABLE club_locations (
 id uuid PRIMARY KEY, club_id text NOT NULL REFERENCES clubs(id), name text NOT NULL,
 address_label text NOT NULL DEFAULT '', timezone text NOT NULL DEFAULT 'Europe/London',
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(club_id,id), UNIQUE(club_id,name), CHECK(length(name) BETWEEN 2 AND 100),
 CHECK(length(address_label)<=200), CHECK(timezone='Europe/London')
);

INSERT INTO club_locations(id,club_id,name,address_label)
SELECT gen_random_uuid(),id,'Main venue',location FROM clubs;

ALTER TABLE grooming_resources ADD COLUMN location_id uuid;
ALTER TABLE published_shifts ADD COLUMN location_id uuid;
UPDATE grooming_resources r SET location_id=(SELECT l.id FROM club_locations l WHERE l.club_id=r.club_id ORDER BY l.created_at LIMIT 1);
UPDATE published_shifts s SET location_id=(SELECT l.id FROM club_locations l WHERE l.club_id=s.club_id ORDER BY l.created_at LIMIT 1);
ALTER TABLE grooming_resources ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE published_shifts ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE grooming_resources ADD FOREIGN KEY(club_id,location_id) REFERENCES club_locations(club_id,id);
ALTER TABLE published_shifts ADD FOREIGN KEY(club_id,location_id) REFERENCES club_locations(club_id,id);

CREATE TABLE staff_members (
 club_id text NOT NULL, account_id text NOT NULL, role text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 can_manage_staff boolean NOT NULL DEFAULT false,
 can_manage_booking_setup boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 deactivated_at timestamptz, PRIMARY KEY(club_id,account_id),
 FOREIGN KEY(club_id,account_id) REFERENCES memberships(club_id,account_id),
 CHECK(role IN ('manager','groomer','reception','cafe')),
 CHECK((active AND deactivated_at IS NULL) OR (NOT active AND deactivated_at IS NOT NULL))
);

CREATE TABLE staff_access_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, club_id text NOT NULL,
 staff_account_id text NOT NULL, actor_id text NOT NULL REFERENCES accounts(id),
 action text NOT NULL CHECK(action IN ('staff.assigned','staff.updated','staff.deactivated','staff.reactivated','staff.qualifications_updated')),
 details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(club_id,staff_account_id) REFERENCES memberships(club_id,account_id)
);

ALTER TABLE club_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_locations FORCE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members FORCE ROW LEVEL SECURITY;
ALTER TABLE staff_access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_access_events FORCE ROW LEVEL SECURITY;

GRANT SELECT ON club_locations,staff_members TO club_app;
CREATE POLICY location_read ON club_locations FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND active AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=club_locations.club_id));
CREATE POLICY own_staff_access ON staff_members FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND account_id=current_setting('app.account_id',true));
-- Staff administration and audit writes remain server-side with explicit manager checks.
