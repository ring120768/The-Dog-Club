ALTER TABLE membership_plans
 ADD COLUMN stripe_price_id text CHECK(stripe_price_id IS NULL OR stripe_price_id ~ '^price_[A-Za-z0-9_]+$');
CREATE UNIQUE INDEX membership_plan_stripe_price
 ON membership_plans(club_id,stripe_price_id) WHERE stripe_price_id IS NOT NULL;

ALTER TABLE member_subscriptions DROP CONSTRAINT member_subscriptions_source_check;
ALTER TABLE member_subscriptions
 ADD CONSTRAINT member_subscriptions_source_check CHECK(source IN ('demo_manual','stripe')),
 ADD COLUMN provider_account_id text,
 ADD COLUMN provider_customer_id text,
 ADD COLUMN provider_subscription_id text,
 ADD COLUMN provider_price_id text,
 ADD COLUMN latest_paid_invoice_id text;
CREATE UNIQUE INDEX member_subscription_provider_reference
 ON member_subscriptions(provider_account_id,provider_subscription_id)
 WHERE provider_subscription_id IS NOT NULL;

ALTER TABLE benefit_ledger ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE benefit_ledger
 ADD COLUMN actor_kind text NOT NULL DEFAULT 'account' CHECK(actor_kind IN ('account','stripe'));

ALTER TABLE subscription_events DROP CONSTRAINT subscription_events_action_check;
ALTER TABLE subscription_events
 ALTER COLUMN actor_id DROP NOT NULL,
 ADD COLUMN actor_kind text NOT NULL DEFAULT 'account' CHECK(actor_kind IN ('account','stripe')),
 ADD CONSTRAINT subscription_events_action_check CHECK(action IN (
  'subscription.activated','subscription.state_changed','subscription.provider_synced','subscription.renewed'
 ));

CREATE TABLE club_payment_accounts (
 club_id text PRIMARY KEY REFERENCES clubs(id), provider text NOT NULL DEFAULT 'stripe' CHECK(provider='stripe'),
 environment text NOT NULL CHECK(environment IN ('sandbox','live')), external_account_id text NOT NULL CHECK(external_account_id ~ '^acct_[A-Za-z0-9_]+$'),
 status text NOT NULL CHECK(status IN ('connected','restricted','disconnected')), charges_enabled boolean NOT NULL DEFAULT false,
 details_submitted boolean NOT NULL DEFAULT false, configured_by text NOT NULL REFERENCES accounts(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,external_account_id)
);

CREATE TABLE membership_checkout_sessions (
 id uuid PRIMARY KEY, club_id text NOT NULL, account_id text NOT NULL, plan_id uuid NOT NULL,
 provider_account_id text NOT NULL, provider_session_id text, checkout_url text, expires_at timestamptz,
 status text NOT NULL CHECK(status IN ('creating','open','awaiting_payment','completed','failed','expired')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider_account_id,provider_session_id), FOREIGN KEY(club_id,account_id) REFERENCES memberships(club_id,account_id),
 FOREIGN KEY(club_id,plan_id) REFERENCES membership_plans(club_id,id)
);
CREATE UNIQUE INDEX one_open_membership_checkout
 ON membership_checkout_sessions(club_id,account_id)
 WHERE status IN ('creating','open','awaiting_payment');

CREATE TABLE stripe_subscription_links (
 club_id text NOT NULL, account_id text NOT NULL, plan_id uuid NOT NULL, provider_account_id text NOT NULL,
 provider_customer_id text NOT NULL, provider_subscription_id text NOT NULL, provider_price_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider_account_id,provider_subscription_id), UNIQUE(club_id,account_id),
 FOREIGN KEY(club_id,account_id) REFERENCES memberships(club_id,account_id),
 FOREIGN KEY(club_id,plan_id) REFERENCES membership_plans(club_id,id)
);

CREATE TABLE membership_invoices (
 provider_account_id text NOT NULL, provider_invoice_id text NOT NULL, club_id text NOT NULL,
 provider_subscription_id text NOT NULL, local_subscription_id uuid, status text NOT NULL CHECK(status IN ('paid','failed')),
 amount_due integer NOT NULL CHECK(amount_due>=0), amount_paid integer NOT NULL CHECK(amount_paid>=0), currency text NOT NULL CHECK(currency ~ '^[a-z]{3}$'),
 period_starts_on date NOT NULL, period_ends_on date NOT NULL, hosted_invoice_url text,
 received_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(provider_account_id,provider_invoice_id),
 FOREIGN KEY(club_id,local_subscription_id) REFERENCES member_subscriptions(club_id,id)
);

CREATE TABLE payment_webhook_events (
 provider_account_id text NOT NULL, provider_event_id text NOT NULL, event_type text NOT NULL, livemode boolean NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','processed','ignored','failed')), event_data jsonb NOT NULL,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), last_error text, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
 PRIMARY KEY(provider_account_id,provider_event_id)
);

ALTER TABLE club_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_payment_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE membership_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_checkout_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscription_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscription_links FORCE ROW LEVEL SECURITY;
ALTER TABLE membership_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events FORCE ROW LEVEL SECURITY;
-- Payment configuration and webhook records are server-only. No restricted-role grants are made here.
