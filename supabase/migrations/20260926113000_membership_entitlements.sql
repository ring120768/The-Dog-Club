CREATE TABLE membership_plans (
 id uuid PRIMARY KEY, club_id text NOT NULL REFERENCES clubs(id), name text NOT NULL,
 monthly_price_pence integer NOT NULL CHECK(monthly_price_pence>=0), inclusions text NOT NULL CHECK(length(inclusions) BETWEEN 1 AND 2000),
 limits_text text NOT NULL CHECK(length(limits_text) BETWEEN 1 AND 1000), additional_dog_terms text NOT NULL CHECK(length(additional_dog_terms) BETWEEN 1 AND 1000),
 renewal_terms text NOT NULL CHECK(length(renewal_terms) BETWEEN 1 AND 1000), cancellation_terms text NOT NULL CHECK(length(cancellation_terms) BETWEEN 1 AND 1000),
 grooming_credits_per_period integer NOT NULL DEFAULT 0 CHECK(grooming_credits_per_period BETWEEN 0 AND 100),
 payment_issue_benefits boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(club_id,id), UNIQUE(club_id,name)
);

CREATE TABLE member_subscriptions (
 id uuid PRIMARY KEY, club_id text NOT NULL, plan_id uuid NOT NULL, account_id text NOT NULL,
 state text NOT NULL CHECK(state IN ('active','payment_issue','cancellation_scheduled','ended')),
 source text NOT NULL DEFAULT 'demo_manual' CHECK(source='demo_manual'), period_starts_on date NOT NULL, period_ends_on date NOT NULL,
 cancellation_effective_on date, ended_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), CHECK(period_ends_on>period_starts_on), UNIQUE(club_id,id),
 FOREIGN KEY(club_id,plan_id) REFERENCES membership_plans(club_id,id), FOREIGN KEY(club_id,account_id) REFERENCES memberships(club_id,account_id)
);
CREATE UNIQUE INDEX one_current_subscription_per_account ON member_subscriptions(club_id,account_id) WHERE state<>'ended';

CREATE TABLE benefit_ledger (
 id uuid PRIMARY KEY, club_id text NOT NULL, subscription_id uuid NOT NULL,
 benefit_code text NOT NULL CHECK(benefit_code='grooming_credit'), delta integer NOT NULL CHECK(delta<>0),
 entry_type text NOT NULL CHECK(entry_type IN ('allocation','redemption','restoration','adjustment')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500), actor_id text NOT NULL REFERENCES accounts(id),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 200), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(club_id,id), UNIQUE(club_id,subscription_id,idempotency_key), FOREIGN KEY(club_id,subscription_id) REFERENCES member_subscriptions(club_id,id)
);

CREATE TABLE subscription_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, club_id text NOT NULL, subscription_id uuid NOT NULL,
 actor_id text NOT NULL REFERENCES accounts(id), action text NOT NULL CHECK(action IN ('subscription.activated','subscription.state_changed')),
 from_state text, to_state text NOT NULL CHECK(to_state IN ('active','payment_issue','cancellation_scheduled','ended')),
 reason text NOT NULL DEFAULT '' CHECK(length(reason)<=500), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(club_id,subscription_id) REFERENCES member_subscriptions(club_id,id)
);

ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE member_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE benefit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events FORCE ROW LEVEL SECURITY;

GRANT SELECT ON membership_plans,member_subscriptions,benefit_ledger,subscription_events TO club_app;
CREATE POLICY membership_plan_read ON membership_plans FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=membership_plans.club_id));
CREATE POLICY member_subscription_read ON member_subscriptions FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND current_setting('app.public',true)='false' AND EXISTS(
  SELECT 1 FROM memberships m WHERE m.club_id=member_subscriptions.club_id AND m.account_id=current_setting('app.account_id',true)
  AND (m.role='manager' OR member_subscriptions.account_id=m.account_id)));
CREATE POLICY benefit_ledger_read ON benefit_ledger FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(
  SELECT 1 FROM member_subscriptions s WHERE s.club_id=benefit_ledger.club_id AND s.id=benefit_ledger.subscription_id));
CREATE POLICY subscription_event_read ON subscription_events FOR SELECT TO club_app USING(
 club_id=current_setting('app.club_id',true) AND EXISTS(
  SELECT 1 FROM member_subscriptions s WHERE s.club_id=subscription_events.club_id AND s.id=subscription_events.subscription_id));
-- Writes stay behind server-side actor checks, subscription locks and idempotency keys. No payment provider is connected here.
