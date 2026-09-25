CREATE TABLE grooming_services (
 id uuid PRIMARY KEY, club_id text NOT NULL REFERENCES clubs(id), name text NOT NULL,
 duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 15 AND 480 AND duration_minutes%15=0),
 cleanup_minutes integer NOT NULL CHECK(cleanup_minutes BETWEEN 0 AND 120 AND cleanup_minutes%15=0),
 price_pence integer NOT NULL CHECK(price_pence>=0), cancellation_terms text NOT NULL CHECK(length(cancellation_terms) BETWEEN 1 AND 1000),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(club_id,id), UNIQUE(club_id,name)
);
CREATE TABLE grooming_resources (
 id uuid PRIMARY KEY, club_id text NOT NULL REFERENCES clubs(id), name text NOT NULL,
 kind text NOT NULL DEFAULT 'grooming-station' CHECK(kind='grooming-station'), active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(club_id,id), UNIQUE(club_id,name)
);
CREATE TABLE staff_service_qualifications (
 club_id text NOT NULL, account_id text NOT NULL, service_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(club_id,account_id,service_id), FOREIGN KEY(club_id,account_id) REFERENCES memberships(club_id,account_id),
 FOREIGN KEY(club_id,service_id) REFERENCES grooming_services(club_id,id)
);
CREATE TABLE published_shifts (
 id uuid PRIMARY KEY, club_id text NOT NULL, staff_id text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'published' CHECK(status IN ('published','cancelled')), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at), UNIQUE(club_id,id), FOREIGN KEY(club_id,staff_id) REFERENCES memberships(club_id,account_id)
);
CREATE TABLE shift_breaks (
 id uuid PRIMARY KEY, club_id text NOT NULL, shift_id uuid NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 CHECK(ends_at>starts_at), FOREIGN KEY(club_id,shift_id) REFERENCES published_shifts(club_id,id)
);
CREATE TABLE resource_closures (
 id uuid PRIMARY KEY, club_id text NOT NULL, resource_id uuid NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at), FOREIGN KEY(club_id,resource_id) REFERENCES grooming_resources(club_id,id)
);
CREATE TABLE grooming_bookings (
 id uuid PRIMARY KEY, club_id text NOT NULL, dog_id uuid NOT NULL, service_id uuid NOT NULL, resource_id uuid NOT NULL,
 staff_id text NOT NULL, starts_at timestamptz NOT NULL, service_ends_at timestamptz NOT NULL, busy_ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled')),
 price_pence_snapshot integer NOT NULL CHECK(price_pence_snapshot>=0), cancellation_terms_snapshot text NOT NULL,
 created_by text NOT NULL REFERENCES accounts(id), cancelled_by text REFERENCES accounts(id), cancellation_reason text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), cancelled_at timestamptz, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK(starts_at<service_ends_at AND service_ends_at<=busy_ends_at), UNIQUE(club_id,id),
 FOREIGN KEY(club_id,dog_id) REFERENCES dogs(club_id,id), FOREIGN KEY(club_id,service_id) REFERENCES grooming_services(club_id,id),
 FOREIGN KEY(club_id,resource_id) REFERENCES grooming_resources(club_id,id), FOREIGN KEY(club_id,staff_id) REFERENCES memberships(club_id,account_id)
);
CREATE TABLE booking_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, club_id text NOT NULL, booking_id uuid NOT NULL,
 actor_id text NOT NULL REFERENCES accounts(id), action text NOT NULL CHECK(action IN ('booking.confirmed','booking.cancelled')),
 reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(club_id,booking_id) REFERENCES grooming_bookings(club_id,id)
);

ALTER TABLE grooming_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE grooming_services FORCE ROW LEVEL SECURITY;
ALTER TABLE grooming_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE grooming_resources FORCE ROW LEVEL SECURITY;
ALTER TABLE staff_service_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_service_qualifications FORCE ROW LEVEL SECURITY;
ALTER TABLE published_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_shifts FORCE ROW LEVEL SECURITY;
ALTER TABLE shift_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_breaks FORCE ROW LEVEL SECURITY;
ALTER TABLE resource_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_closures FORCE ROW LEVEL SECURITY;
ALTER TABLE grooming_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE grooming_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events FORCE ROW LEVEL SECURITY;

GRANT SELECT ON grooming_services,grooming_resources,grooming_bookings,booking_events TO club_app;
CREATE POLICY service_read ON grooming_services FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=grooming_services.club_id));
CREATE POLICY resource_read ON grooming_resources FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=grooming_resources.club_id));
CREATE POLICY booking_read ON grooming_bookings FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND current_setting('app.public',true)='false' AND EXISTS(
 SELECT 1 FROM memberships m WHERE m.club_id=grooming_bookings.club_id AND (m.role='manager' OR EXISTS(
  SELECT 1 FROM dogs d WHERE d.club_id=grooming_bookings.club_id AND d.id=grooming_bookings.dog_id AND d.owner_id=m.account_id))));
CREATE POLICY booking_event_read ON booking_events FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND current_setting('app.public',true)='false' AND EXISTS(
 SELECT 1 FROM grooming_bookings b WHERE b.club_id=booking_events.club_id AND b.id=booking_events.booking_id));
-- Booking/configuration writes stay behind server-side operations with explicit actor checks and transaction locks.
