CREATE TABLE community_blocks (
  club_id text NOT NULL,
  blocker_account_id text NOT NULL,
  blocked_account_id text NOT NULL,
  display_label text NOT NULL CHECK(length(display_label) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(club_id,blocker_account_id,blocked_account_id),
  FOREIGN KEY(club_id,blocker_account_id) REFERENCES memberships(club_id,account_id),
  FOREIGN KEY(club_id,blocked_account_id) REFERENCES memberships(club_id,account_id),
  CHECK(blocker_account_id<>blocked_account_id)
);

CREATE TABLE community_reports (
  id uuid PRIMARY KEY,
  club_id text NOT NULL,
  reporter_account_id text NOT NULL,
  dog_id uuid NOT NULL,
  photo_id uuid,
  reason text NOT NULL CHECK(reason IN ('privacy','unsafe_photo','harassment','false_information','other')),
  details text NOT NULL DEFAULT '' CHECK(length(details)<=1000),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),
  outcome text CHECK(outcome IS NULL OR length(outcome) BETWEEN 1 AND 1000),
  reviewed_by text REFERENCES accounts(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(club_id,reporter_account_id) REFERENCES memberships(club_id,account_id),
  FOREIGN KEY(club_id,dog_id) REFERENCES dogs(club_id,id),
  FOREIGN KEY(photo_id) REFERENCES dog_photos(id),
  CHECK(
    (status='open' AND outcome IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
    (status<>'open' AND outcome IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE TABLE community_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id text NOT NULL REFERENCES clubs(id),
  actor_id text NOT NULL REFERENCES accounts(id),
  dog_id uuid,
  subject_account_id text REFERENCES accounts(id),
  report_id uuid REFERENCES community_reports(id),
  action text NOT NULL CHECK(action IN (
    'community.reported','community.blocked','community.unblocked',
    'community.report_resolved','community.report_dismissed',
    'community.profile_hidden','community.profile_restored'
  )),
  reason text NOT NULL DEFAULT '' CHECK(length(reason)<=1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(club_id,dog_id) REFERENCES dogs(club_id,id)
);

CREATE TABLE community_profile_hides (
  club_id text NOT NULL,
  dog_id uuid NOT NULL,
  hidden_by text NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(club_id,dog_id),
  FOREIGN KEY(club_id,dog_id) REFERENCES dogs(club_id,id),
  FOREIGN KEY(club_id,hidden_by) REFERENCES memberships(club_id,account_id)
);

ALTER TABLE community_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_blocks FORCE ROW LEVEL SECURITY;
ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_events FORCE ROW LEVEL SECURITY;
ALTER TABLE community_profile_hides ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_profile_hides FORCE ROW LEVEL SECURITY;

GRANT SELECT,INSERT,DELETE ON community_blocks TO club_app;
GRANT SELECT,INSERT,UPDATE ON community_reports TO club_app;
GRANT SELECT,INSERT ON community_events TO club_app;
GRANT USAGE ON SEQUENCE community_events_id_seq TO club_app;
GRANT SELECT,INSERT,DELETE ON community_profile_hides TO club_app;

CREATE POLICY community_block_read ON community_blocks FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND (
  blocker_account_id=current_setting('app.account_id',true) OR
  blocked_account_id=current_setting('app.account_id',true)
 )
);
CREATE POLICY community_block_insert ON community_blocks FOR INSERT TO club_app WITH CHECK(
 club_id=current_setting('app.club_id',true) AND blocker_account_id=current_setting('app.account_id',true)
);
CREATE POLICY community_block_delete ON community_blocks FOR DELETE TO club_app USING(
 club_id=current_setting('app.club_id',true) AND blocker_account_id=current_setting('app.account_id',true)
);

CREATE POLICY community_report_read ON community_reports FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND (
  reporter_account_id=current_setting('app.account_id',true) OR EXISTS(
   SELECT 1 FROM memberships m WHERE m.club_id=community_reports.club_id
   AND m.account_id=current_setting('app.account_id',true) AND m.role='manager'
  )
 )
);
CREATE POLICY community_report_insert ON community_reports FOR INSERT TO club_app WITH CHECK(
 club_id=current_setting('app.club_id',true) AND reporter_account_id=current_setting('app.account_id',true)
 AND EXISTS(SELECT 1 FROM dogs d WHERE d.club_id=community_reports.club_id AND d.id=community_reports.dog_id AND d.owner_id<>community_reports.reporter_account_id)
 AND (photo_id IS NULL OR EXISTS(SELECT 1 FROM dog_photos p WHERE p.club_id=community_reports.club_id AND p.dog_id=community_reports.dog_id AND p.id=community_reports.photo_id))
);
CREATE POLICY community_report_update ON community_reports FOR UPDATE TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(
  SELECT 1 FROM memberships m WHERE m.club_id=community_reports.club_id
  AND m.account_id=current_setting('app.account_id',true) AND m.role='manager'
 )
) WITH CHECK(
 club_id=current_setting('app.club_id',true) AND EXISTS(
  SELECT 1 FROM memberships m WHERE m.club_id=community_reports.club_id
  AND m.account_id=current_setting('app.account_id',true) AND m.role='manager'
 )
);

CREATE POLICY community_event_read ON community_events FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND (
  actor_id=current_setting('app.account_id',true) OR EXISTS(
   SELECT 1 FROM memberships m WHERE m.club_id=community_events.club_id
   AND m.account_id=current_setting('app.account_id',true) AND m.role='manager'
  )
 )
);
CREATE POLICY community_event_insert ON community_events FOR INSERT TO club_app WITH CHECK(
 club_id=current_setting('app.club_id',true) AND actor_id=current_setting('app.account_id',true)
);

CREATE POLICY community_profile_hide_read ON community_profile_hides FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND (
  current_setting('app.public',true)='true' OR EXISTS(
   SELECT 1 FROM memberships m WHERE m.club_id=community_profile_hides.club_id
   AND m.account_id=current_setting('app.account_id',true)
  )
 )
);
CREATE POLICY community_profile_hide_insert ON community_profile_hides FOR INSERT TO club_app WITH CHECK(
 club_id=current_setting('app.club_id',true) AND hidden_by=current_setting('app.account_id',true) AND EXISTS(
  SELECT 1 FROM memberships m WHERE m.club_id=community_profile_hides.club_id
  AND m.account_id=current_setting('app.account_id',true) AND m.role='manager'
 )
);
CREATE POLICY community_profile_hide_delete ON community_profile_hides FOR DELETE TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(
  SELECT 1 FROM memberships m WHERE m.club_id=community_profile_hides.club_id
  AND m.account_id=current_setting('app.account_id',true) AND m.role='manager'
 )
);

DROP POLICY dog_read ON dogs;
CREATE POLICY dog_read ON dogs FOR SELECT TO club_app USING (
 club_id=current_setting('app.club_id',true) AND (
  (current_setting('app.public',true)='true' AND audience='public' AND NOT EXISTS(
   SELECT 1 FROM community_profile_hides h WHERE h.club_id=dogs.club_id AND h.dog_id=dogs.id
  )) OR
  (current_setting('app.public',true)='false' AND EXISTS(
   SELECT 1 FROM memberships m WHERE m.club_id=dogs.club_id AND m.account_id=current_setting('app.account_id',true) AND (
    m.role='manager' OR dogs.owner_id=m.account_id OR EXISTS(
     SELECT 1 FROM household_adult_grants h WHERE h.club_id=dogs.club_id AND h.owner_account_id=dogs.owner_id
     AND h.adult_account_id=m.account_id AND h.revoked_at IS NULL AND (h.can_manage_dogs OR h.can_manage_bookings)
    ) OR (
     dogs.audience IN ('members','public') AND NOT EXISTS(
      SELECT 1 FROM community_profile_hides h WHERE h.club_id=dogs.club_id AND h.dog_id=dogs.id
     ) AND NOT EXISTS(
      SELECT 1 FROM community_blocks b WHERE b.club_id=dogs.club_id AND (
       (b.blocker_account_id=m.account_id AND b.blocked_account_id=dogs.owner_id) OR
       (b.blocker_account_id=dogs.owner_id AND b.blocked_account_id=m.account_id)
      )
     )
    )
   )
  ))
  )
 );
