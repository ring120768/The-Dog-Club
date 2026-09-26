ALTER TABLE grooming_bookings DROP CONSTRAINT grooming_bookings_status_check;
ALTER TABLE grooming_bookings
  ADD COLUMN payment_hold_expires_at timestamptz,
  ADD CONSTRAINT grooming_bookings_status_check CHECK(status IN ('awaiting_payment','confirmed','cancelled')),
  ADD CONSTRAINT grooming_booking_payment_hold_check CHECK(
    (status='awaiting_payment' AND payment_hold_expires_at IS NOT NULL) OR
    (status<>'awaiting_payment' AND payment_hold_expires_at IS NULL)
  );

ALTER TABLE booking_events DROP CONSTRAINT booking_events_action_check;
ALTER TABLE booking_events
  ALTER COLUMN actor_id DROP NOT NULL,
  ADD COLUMN actor_kind text NOT NULL DEFAULT 'account' CHECK(actor_kind IN ('account','stripe','system')),
  ADD CONSTRAINT booking_events_action_check CHECK(action IN (
    'booking.confirmed','booking.cancelled','booking.rescheduled',
    'booking.payment_started','booking.payment_confirmed','booking.payment_failed','booking.payment_expired'
  ));

CREATE TABLE service_checkout_sessions (
  id uuid PRIMARY KEY, club_id text NOT NULL, account_id text NOT NULL, booking_id uuid NOT NULL,
  request_id uuid NOT NULL, provider_account_id text NOT NULL, provider_session_id text,
  checkout_url text, expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('creating','open','awaiting_payment','completed','failed','expired','late_paid')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id,account_id,request_id), UNIQUE(provider_account_id,provider_session_id), UNIQUE(club_id,booking_id),
  FOREIGN KEY(club_id,account_id) REFERENCES memberships(club_id,account_id),
  FOREIGN KEY(club_id,booking_id) REFERENCES grooming_bookings(club_id,id)
);

CREATE TABLE service_payments (
  id uuid PRIMARY KEY, club_id text NOT NULL, booking_id uuid NOT NULL, account_id text NOT NULL,
  provider_account_id text NOT NULL, provider_session_id text NOT NULL, provider_payment_intent_id text NOT NULL,
  amount_pence integer NOT NULL CHECK(amount_pence>0), amount_refunded_pence integer NOT NULL DEFAULT 0,
  currency text NOT NULL CHECK(currency ~ '^[a-z]{3}$'),
  status text NOT NULL CHECK(status IN ('captured','late_paid','partially_refunded','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id,booking_id), UNIQUE(provider_account_id,provider_session_id),
  UNIQUE(provider_account_id,provider_payment_intent_id),
  CHECK(amount_refunded_pence BETWEEN 0 AND amount_pence),
  FOREIGN KEY(club_id,account_id) REFERENCES memberships(club_id,account_id),
  FOREIGN KEY(club_id,booking_id) REFERENCES grooming_bookings(club_id,id)
);

CREATE TABLE service_payment_exceptions (
  id uuid PRIMARY KEY, club_id text NOT NULL, booking_id uuid NOT NULL, payment_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind='late_paid'), status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  detail text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
  UNIQUE(club_id,payment_id), FOREIGN KEY(club_id,booking_id) REFERENCES grooming_bookings(club_id,id),
  FOREIGN KEY(payment_id) REFERENCES service_payments(id)
);

ALTER TABLE service_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_checkout_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE service_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE service_payment_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_payment_exceptions FORCE ROW LEVEL SECURITY;

-- These provider and finance records are server-only. No club_app, anon or authenticated grants are made.
