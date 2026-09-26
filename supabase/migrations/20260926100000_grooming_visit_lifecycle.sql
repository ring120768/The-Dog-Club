CREATE TABLE grooming_visits (
 id uuid PRIMARY KEY, club_id text NOT NULL, booking_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'arrived' CHECK(status IN ('arrived','handed_over','in_progress','ready','collected')),
 authorised_collector_name text NOT NULL DEFAULT '' CHECK(length(authorised_collector_name)<=100),
 collection_verified boolean NOT NULL DEFAULT false,
 arrived_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), collected_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), UNIQUE(club_id,id), UNIQUE(club_id,booking_id),
 FOREIGN KEY(club_id,booking_id) REFERENCES grooming_bookings(club_id,id)
);

CREATE TABLE visit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, club_id text NOT NULL, visit_id uuid NOT NULL,
 actor_id text NOT NULL REFERENCES accounts(id), action text NOT NULL CHECK(action IN ('visit.arrived','visit.progressed','visit.corrected')),
 from_status text, to_status text NOT NULL CHECK(to_status IN ('arrived','handed_over','in_progress','ready','collected')),
 reason text NOT NULL DEFAULT '' CHECK(length(reason)<=500), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(club_id,visit_id) REFERENCES grooming_visits(club_id,id)
);

CREATE TABLE notification_outbox (
 id uuid PRIMARY KEY, club_id text NOT NULL, visit_id uuid NOT NULL, recipient_account_id text NOT NULL REFERENCES accounts(id),
 kind text NOT NULL CHECK(kind='groom_ready'), delivery_status text NOT NULL DEFAULT 'manual_required' CHECK(delivery_status='manual_required'),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(club_id,visit_id,kind),
 FOREIGN KEY(club_id,visit_id) REFERENCES grooming_visits(club_id,id)
);

ALTER TABLE grooming_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE grooming_visits FORCE ROW LEVEL SECURITY;
ALTER TABLE visit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox FORCE ROW LEVEL SECURITY;

GRANT SELECT ON grooming_visits,visit_events,notification_outbox TO club_app;
CREATE POLICY visit_read ON grooming_visits FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND current_setting('app.public',true)='false' AND EXISTS(
  SELECT 1 FROM grooming_bookings b JOIN dogs d ON d.club_id=b.club_id AND d.id=b.dog_id
  JOIN memberships m ON m.club_id=b.club_id AND m.account_id=current_setting('app.account_id',true)
  WHERE b.club_id=grooming_visits.club_id AND b.id=grooming_visits.booking_id AND (m.role='manager' OR d.owner_id=m.account_id)));
CREATE POLICY visit_event_read ON visit_events FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND current_setting('app.public',true)='false' AND EXISTS(
  SELECT 1 FROM grooming_visits v WHERE v.club_id=visit_events.club_id AND v.id=visit_events.visit_id));
CREATE POLICY notification_outbox_read ON notification_outbox FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND current_setting('app.public',true)='false' AND (
  recipient_account_id=current_setting('app.account_id',true) OR EXISTS(
   SELECT 1 FROM memberships m WHERE m.club_id=notification_outbox.club_id
   AND m.account_id=current_setting('app.account_id',true) AND m.role='manager')));
-- Lifecycle writes and the private notification outbox stay behind server-side manager checks and row locks.
