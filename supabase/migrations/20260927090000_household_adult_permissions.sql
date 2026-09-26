CREATE TABLE household_invites (
 id uuid PRIMARY KEY,
 token_hash text UNIQUE NOT NULL CHECK(length(token_hash)=64),
 club_id text NOT NULL REFERENCES clubs(id),
 owner_account_id text NOT NULL REFERENCES accounts(id),
 email text NOT NULL,
 can_manage_dogs boolean NOT NULL,
 can_manage_bookings boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 accepted_at timestamptz,
 revoked_at timestamptz,
 CHECK(can_manage_dogs OR can_manage_bookings),
 FOREIGN KEY(club_id,owner_account_id) REFERENCES memberships(club_id,account_id)
);

CREATE TABLE household_adult_grants (
 club_id text NOT NULL REFERENCES clubs(id),
 owner_account_id text NOT NULL REFERENCES accounts(id),
 adult_account_id text NOT NULL REFERENCES accounts(id),
 can_manage_dogs boolean NOT NULL,
 can_manage_bookings boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 PRIMARY KEY(club_id,owner_account_id,adult_account_id),
 FOREIGN KEY(club_id,owner_account_id) REFERENCES memberships(club_id,account_id),
 FOREIGN KEY(club_id,adult_account_id) REFERENCES memberships(club_id,account_id),
 CHECK(owner_account_id<>adult_account_id),
 CHECK(can_manage_dogs OR can_manage_bookings)
);
CREATE UNIQUE INDEX one_active_household_per_adult
 ON household_adult_grants(club_id,adult_account_id) WHERE revoked_at IS NULL;

CREATE TABLE household_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 club_id text NOT NULL REFERENCES clubs(id),
 owner_account_id text NOT NULL REFERENCES accounts(id),
 adult_account_id text REFERENCES accounts(id),
 actor_id text NOT NULL REFERENCES accounts(id),
 action text NOT NULL CHECK(action IN ('household.invited','household.invite_revoked','household.joined','household.access_changed','household.left','household.revoked')),
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invites FORCE ROW LEVEL SECURITY;
ALTER TABLE household_adult_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_adult_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE household_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_events FORCE ROW LEVEL SECURITY;

GRANT SELECT ON household_adult_grants,household_events TO club_app;
CREATE POLICY household_grant_read ON household_adult_grants FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND
 (owner_account_id=current_setting('app.account_id',true) OR adult_account_id=current_setting('app.account_id',true))
);
CREATE POLICY household_event_read ON household_events FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND
 (owner_account_id=current_setting('app.account_id',true) OR adult_account_id=current_setting('app.account_id',true))
);

DROP POLICY dog_read ON dogs;
CREATE POLICY dog_read ON dogs FOR SELECT TO club_app USING (
 club_id=current_setting('app.club_id',true) AND (
  (current_setting('app.public',true)='true' AND audience='public') OR
  (current_setting('app.public',true)='false' AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=dogs.club_id AND (
   m.role='manager' OR dogs.owner_id=m.account_id OR dogs.audience IN ('members','public') OR EXISTS(
    SELECT 1 FROM household_adult_grants h WHERE h.club_id=dogs.club_id AND h.owner_account_id=dogs.owner_id
    AND h.adult_account_id=m.account_id AND h.revoked_at IS NULL AND (h.can_manage_dogs OR h.can_manage_bookings)
   )
  )))
 ));
DROP POLICY dog_update ON dogs;
CREATE POLICY dog_update ON dogs FOR UPDATE TO club_app USING (
 club_id=current_setting('app.club_id',true) AND (owner_id=current_setting('app.account_id',true) OR EXISTS(
  SELECT 1 FROM household_adult_grants h WHERE h.club_id=dogs.club_id AND h.owner_account_id=dogs.owner_id
  AND h.adult_account_id=current_setting('app.account_id',true) AND h.revoked_at IS NULL AND h.can_manage_dogs
 ))) WITH CHECK (
 club_id=current_setting('app.club_id',true) AND (owner_id=current_setting('app.account_id',true) OR EXISTS(
  SELECT 1 FROM household_adult_grants h WHERE h.club_id=dogs.club_id AND h.owner_account_id=dogs.owner_id
  AND h.adult_account_id=current_setting('app.account_id',true) AND h.revoked_at IS NULL AND h.can_manage_dogs
 )));

DROP POLICY photo_read ON dog_photos;
CREATE POLICY photo_read ON dog_photos FOR SELECT TO club_app USING (
 club_id=current_setting('app.club_id',true) AND EXISTS(
  SELECT 1 FROM dogs d WHERE d.club_id=dog_photos.club_id AND d.id=dog_photos.dog_id
 ));
DROP POLICY photo_insert ON dog_photos;
CREATE POLICY photo_insert ON dog_photos FOR INSERT TO club_app WITH CHECK (
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM dogs d WHERE d.club_id=dog_photos.club_id AND d.id=dog_photos.dog_id AND (
  d.owner_id=current_setting('app.account_id',true) OR EXISTS(SELECT 1 FROM household_adult_grants h WHERE h.club_id=d.club_id AND h.owner_account_id=d.owner_id
   AND h.adult_account_id=current_setting('app.account_id',true) AND h.revoked_at IS NULL AND h.can_manage_dogs)))
);
DROP POLICY photo_delete ON dog_photos;
CREATE POLICY photo_delete ON dog_photos FOR DELETE TO club_app USING (
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM dogs d WHERE d.club_id=dog_photos.club_id AND d.id=dog_photos.dog_id AND (
  d.owner_id=current_setting('app.account_id',true) OR EXISTS(SELECT 1 FROM household_adult_grants h WHERE h.club_id=d.club_id AND h.owner_account_id=d.owner_id
   AND h.adult_account_id=current_setting('app.account_id',true) AND h.revoked_at IS NULL AND h.can_manage_dogs)))
);

DROP POLICY care_read ON care_notes;
CREATE POLICY care_read ON care_notes FOR SELECT TO club_app USING (
 club_id=current_setting('app.club_id',true) AND current_setting('app.public',true)='false' AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=care_notes.club_id AND (
  m.role='manager' OR EXISTS(SELECT 1 FROM dogs d WHERE d.id=care_notes.dog_id AND d.club_id=care_notes.club_id AND (
   d.owner_id=m.account_id OR EXISTS(SELECT 1 FROM household_adult_grants h WHERE h.club_id=d.club_id AND h.owner_account_id=d.owner_id
    AND h.adult_account_id=m.account_id AND h.revoked_at IS NULL AND h.can_manage_dogs)))
 )));

DROP POLICY application_read ON dog_applications;
CREATE POLICY application_read ON dog_applications FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=dog_applications.club_id AND (
  EXISTS(SELECT 1 FROM dogs d WHERE d.club_id=dog_applications.club_id AND d.id=dog_applications.dog_id AND (d.owner_id=m.account_id OR EXISTS(
   SELECT 1 FROM household_adult_grants h WHERE h.club_id=d.club_id AND h.owner_account_id=d.owner_id
   AND h.adult_account_id=m.account_id AND h.revoked_at IS NULL AND h.can_manage_dogs))) OR
  (m.role='manager' AND dog_applications.status<>'draft')
 )));
DROP POLICY application_history_read ON application_events;
CREATE POLICY application_history_read ON application_events FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=application_events.club_id AND (
  EXISTS(SELECT 1 FROM dogs d WHERE d.club_id=application_events.club_id AND d.id=application_events.dog_id AND (d.owner_id=m.account_id OR EXISTS(
   SELECT 1 FROM household_adult_grants h WHERE h.club_id=d.club_id AND h.owner_account_id=d.owner_id
   AND h.adult_account_id=m.account_id AND h.revoked_at IS NULL AND h.can_manage_dogs))) OR m.role='manager'
 )));

DROP POLICY booking_read ON grooming_bookings;
CREATE POLICY booking_read ON grooming_bookings FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=grooming_bookings.club_id AND (
  m.role='manager' OR EXISTS(SELECT 1 FROM dogs d WHERE d.club_id=grooming_bookings.club_id AND d.id=grooming_bookings.dog_id AND (
   d.owner_id=m.account_id OR EXISTS(SELECT 1 FROM household_adult_grants h WHERE h.club_id=d.club_id AND h.owner_account_id=d.owner_id
    AND h.adult_account_id=m.account_id AND h.revoked_at IS NULL AND h.can_manage_bookings)))
 )));
DROP POLICY booking_event_read ON booking_events;
CREATE POLICY booking_event_read ON booking_events FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(
  SELECT 1 FROM grooming_bookings b WHERE b.club_id=booking_events.club_id AND b.id=booking_events.booking_id
 ));
DROP POLICY visit_read ON grooming_visits;
CREATE POLICY visit_read ON grooming_visits FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(
  SELECT 1 FROM grooming_bookings b WHERE b.club_id=grooming_visits.club_id AND b.id=grooming_visits.booking_id
 ));
DROP POLICY visit_event_read ON visit_events;
CREATE POLICY visit_event_read ON visit_events FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(
  SELECT 1 FROM grooming_visits v WHERE v.club_id=visit_events.club_id AND v.id=visit_events.visit_id
 ));
DROP POLICY notification_outbox_read ON notification_outbox;
CREATE POLICY notification_outbox_read ON notification_outbox FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(
  SELECT 1 FROM grooming_visits v WHERE v.club_id=notification_outbox.club_id AND v.id=notification_outbox.visit_id
 ));
