ALTER TABLE booking_events
  DROP CONSTRAINT IF EXISTS booking_events_action_check;

ALTER TABLE booking_events
  ADD CONSTRAINT booking_events_action_check
  CHECK(action IN ('booking.confirmed','booking.cancelled','booking.rescheduled'));
