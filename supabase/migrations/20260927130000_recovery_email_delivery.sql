ALTER TABLE password_recovery_requests
 ADD COLUMN delivery_status text NOT NULL DEFAULT 'manual_required'
  CHECK(delivery_status IN ('manual_required','pending','provider_accepted','failed')),
 ADD COLUMN delivery_provider text,
 ADD COLUMN delivery_message_id text,
 ADD COLUMN delivery_attempted_at timestamptz,
 ADD COLUMN delivery_error_code text;

CREATE UNIQUE INDEX password_recovery_provider_message
 ON password_recovery_requests(delivery_provider,delivery_message_id)
 WHERE delivery_message_id IS NOT NULL;

ALTER TABLE password_recovery_events
 DROP CONSTRAINT password_recovery_events_action_check,
 ADD CONSTRAINT password_recovery_events_action_check CHECK(action IN (
  'recovery.requested','recovery.link_issued','recovery.delivery_queued',
  'recovery.delivery_accepted','recovery.delivery_failed',
  'recovery.completed','recovery.dismissed'
 ));
