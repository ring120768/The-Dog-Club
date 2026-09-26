import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scoped, type Db, type Queryable } from "./database";
import { OnboardingError } from "./onboarding";
import {
  subscriptionStates,
  type SubscriptionState,
} from "./membership-contract";

export type MembershipPlan = {
  id: string;
  club_id: string;
  name: string;
  monthly_price_pence: number;
  inclusions: string;
  limits_text: string;
  additional_dog_terms: string;
  renewal_terms: string;
  cancellation_terms: string;
  grooming_credits_per_period: number;
  payment_issue_benefits: boolean;
  active: boolean;
};

export type MemberSubscription = {
  id: string;
  club_id: string;
  plan_id: string;
  account_id: string;
  state: SubscriptionState;
  source: "demo_manual";
  period_starts_on: string;
  period_ends_on: string;
  cancellation_effective_on: string | null;
  version: number;
  plan_name: string;
  monthly_price_pence: number;
  grooming_credits_per_period: number;
  payment_issue_benefits: boolean;
  remaining_grooming_credits: number;
};

export type BenefitEntry = {
  id: string;
  subscription_id: string;
  delta: number;
  entry_type: "allocation" | "redemption" | "restoration" | "adjustment";
  reason: string;
  idempotency_key: string;
  created_at: string;
};

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function requireManager(tx: Queryable, actor: string, club: string) {
  const allowed = await tx.query(
    "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2 AND role='manager'",
    [club, actor],
  );
  if (!allowed.rows.length)
    throw new OnboardingError("Manager access required.");
}

export async function createMembershipPlan(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({
      name: z.string().trim().min(2).max(100),
      monthly_price_pounds: z.string().regex(/^\d{1,5}(\.\d{1,2})?$/),
      inclusions: z.string().trim().min(1).max(2000),
      limits_text: z.string().trim().min(1).max(1000),
      additional_dog_terms: z.string().trim().min(1).max(1000),
      renewal_terms: z.string().trim().min(1).max(1000),
      cancellation_terms: z.string().trim().min(1).max(1000),
      grooming_credits_per_period: z.coerce.number().int().min(0).max(100),
      payment_issue_benefits: z.string().optional(),
    })
    .parse(input);
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const id = randomUUID();
    await tx.query(
      `INSERT INTO membership_plans(id,club_id,name,monthly_price_pence,inclusions,limits_text,additional_dog_terms,renewal_terms,cancellation_terms,grooming_credits_per_period,payment_issue_benefits)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id,
        club,
        data.name,
        Math.round(Number(data.monthly_price_pounds) * 100),
        data.inclusions,
        data.limits_text,
        data.additional_dog_terms,
        data.renewal_terms,
        data.cancellation_terms,
        data.grooming_credits_per_period,
        data.payment_issue_benefits === "yes",
      ],
    );
    return id;
  });
}

export async function plansFor(db: Db, actor: string, club: string) {
  return scoped(
    db,
    actor,
    club,
    false,
    async (tx) =>
      (
        await tx.query<MembershipPlan>(
          "SELECT * FROM membership_plans WHERE active ORDER BY monthly_price_pence,name",
        )
      ).rows,
  );
}

export async function membershipAccountsFor(
  db: Db,
  actor: string,
  club: string,
) {
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    return (
      await tx.query<{ id: string; email: string; role: string }>(
        `SELECT a.id,a.email,m.role FROM memberships m JOIN accounts a ON a.id=m.account_id
         WHERE m.club_id=$1 ORDER BY a.email`,
        [club],
      )
    ).rows;
  });
}

export async function activateDemoMembership(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({
      plan_id: z.uuid(),
      account_id: z.string().min(1).max(200),
      period_starts_on: dateInput,
      period_ends_on: dateInput,
    })
    .parse(input);
  if (data.period_ends_on <= data.period_starts_on)
    throw new OnboardingError("The period end must follow its start.");
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const plan = (
      await tx.query<MembershipPlan>(
        "SELECT * FROM membership_plans WHERE club_id=$1 AND id=$2 AND active FOR UPDATE",
        [club, data.plan_id],
      )
    ).rows[0];
    if (!plan) throw new OnboardingError("Membership plan unavailable.");
    const account = await tx.query(
      "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2",
      [club, data.account_id],
    );
    if (!account.rows.length)
      throw new OnboardingError("Club account unavailable.");
    const existing = await tx.query(
      "SELECT 1 FROM member_subscriptions WHERE club_id=$1 AND account_id=$2 AND state<>'ended' FOR UPDATE",
      [club, data.account_id],
    );
    if (existing.rows.length)
      throw new OnboardingError(
        "This account already has a current membership.",
      );
    const id = randomUUID();
    await tx.query(
      `INSERT INTO member_subscriptions(id,club_id,plan_id,account_id,state,period_starts_on,period_ends_on)
       VALUES($1,$2,$3,$4,'active',$5,$6)`,
      [
        id,
        club,
        plan.id,
        data.account_id,
        data.period_starts_on,
        data.period_ends_on,
      ],
    );
    if (plan.grooming_credits_per_period > 0)
      await tx.query(
        `INSERT INTO benefit_ledger(id,club_id,subscription_id,benefit_code,delta,entry_type,reason,actor_id,idempotency_key)
         VALUES($1,$2,$3,'grooming_credit',$4,'allocation','Opening period allocation',$5,$6)`,
        [
          randomUUID(),
          club,
          id,
          plan.grooming_credits_per_period,
          actor,
          `activation:${id}`,
        ],
      );
    await tx.query(
      "INSERT INTO subscription_events(club_id,subscription_id,actor_id,action,to_state) VALUES($1,$2,$3,'subscription.activated','active')",
      [club, id, actor],
    );
    return id;
  });
}

export async function subscriptionsFor(db: Db, actor: string, club: string) {
  return scoped(db, actor, club, false, async (tx) => {
    const subscriptions = await tx.query<MemberSubscription>(
      `SELECT s.*,p.name AS plan_name,p.monthly_price_pence,p.grooming_credits_per_period,p.payment_issue_benefits,
       COALESCE((SELECT sum(l.delta) FROM benefit_ledger l WHERE l.club_id=s.club_id AND l.subscription_id=s.id AND l.benefit_code='grooming_credit'),0)::int AS remaining_grooming_credits
       FROM member_subscriptions s JOIN membership_plans p ON p.club_id=s.club_id AND p.id=s.plan_id
       ORDER BY s.created_at DESC`,
    );
    const ledger = await tx.query<BenefitEntry>(
      "SELECT id,subscription_id,delta,entry_type,reason,idempotency_key,created_at FROM benefit_ledger ORDER BY created_at,id",
    );
    return { subscriptions: subscriptions.rows, ledger: ledger.rows };
  });
}

async function lockedSubscription(
  tx: Queryable,
  club: string,
  subscription: string,
) {
  return (
    await tx.query<MemberSubscription>(
      `SELECT s.*,p.payment_issue_benefits,p.name AS plan_name,p.monthly_price_pence,p.grooming_credits_per_period,
       0::int AS remaining_grooming_credits
       FROM member_subscriptions s JOIN membership_plans p ON p.club_id=s.club_id AND p.id=s.plan_id
       WHERE s.club_id=$1 AND s.id=$2 FOR UPDATE OF s`,
      [club, subscription],
    )
  ).rows[0];
}

export async function scheduleMembershipCancellation(
  db: Db,
  actor: string,
  club: string,
  subscription: string,
) {
  z.uuid().parse(subscription);
  await db.transaction(async (tx) => {
    const current = await lockedSubscription(tx, club, subscription);
    if (!current) throw new OnboardingError("Membership unavailable.");
    const manager = await tx.query(
      "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2 AND role='manager'",
      [club, actor],
    );
    if (current.account_id !== actor && !manager.rows.length)
      throw new OnboardingError("Membership unavailable.");
    if (!["active", "payment_issue"].includes(current.state))
      throw new OnboardingError("This membership cannot be cancelled again.");
    await tx.query(
      `UPDATE member_subscriptions SET state='cancellation_scheduled',cancellation_effective_on=period_ends_on,
       updated_at=now(),version=version+1 WHERE club_id=$1 AND id=$2`,
      [club, subscription],
    );
    await tx.query(
      `INSERT INTO subscription_events(club_id,subscription_id,actor_id,action,from_state,to_state,reason)
       VALUES($1,$2,$3,'subscription.state_changed',$4,'cancellation_scheduled','Cancellation scheduled for period end')`,
      [club, subscription, actor, current.state],
    );
  });
}

export async function setMembershipState(
  db: Db,
  actor: string,
  club: string,
  subscription: string,
  input: unknown,
) {
  z.uuid().parse(subscription);
  const data = z
    .object({
      state: z.enum(subscriptionStates).exclude(["cancellation_scheduled"]),
      reason: z.string().trim().min(3).max(500),
    })
    .parse(input);
  await db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const current = await lockedSubscription(tx, club, subscription);
    if (!current) throw new OnboardingError("Membership unavailable.");
    if (current.state === data.state)
      throw new OnboardingError("Choose a different membership state.");
    await tx.query(
      `UPDATE member_subscriptions SET state=$1,ended_at=CASE WHEN $1='ended' THEN now() ELSE NULL END,
       cancellation_effective_on=CASE WHEN $1='active' THEN NULL ELSE cancellation_effective_on END,
       updated_at=now(),version=version+1 WHERE club_id=$2 AND id=$3`,
      [data.state, club, subscription],
    );
    await tx.query(
      `INSERT INTO subscription_events(club_id,subscription_id,actor_id,action,from_state,to_state,reason)
       VALUES($1,$2,$3,'subscription.state_changed',$4,$5,$6)`,
      [club, subscription, actor, current.state, data.state, data.reason],
    );
  });
}

function canUseBenefits(subscription: MemberSubscription) {
  return (
    subscription.state === "active" ||
    subscription.state === "cancellation_scheduled" ||
    (subscription.state === "payment_issue" &&
      subscription.payment_issue_benefits)
  );
}

export async function changeGroomingCredits(
  db: Db,
  actor: string,
  club: string,
  subscription: string,
  input: unknown,
) {
  z.uuid().parse(subscription);
  const data = z
    .object({
      delta: z.coerce.number().int().min(-100).max(100).refine(Boolean),
      entry_type: z.enum(["redemption", "restoration", "adjustment"]),
      reason: z.string().trim().min(3).max(500),
      idempotency_key: z.string().min(8).max(200),
    })
    .parse(input);
  if (data.entry_type === "redemption" && data.delta >= 0)
    throw new OnboardingError("A redemption must reduce the balance.");
  if (data.entry_type === "restoration" && data.delta <= 0)
    throw new OnboardingError("A restoration must increase the balance.");
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const current = await lockedSubscription(tx, club, subscription);
    if (!current) throw new OnboardingError("Membership unavailable.");
    const replay = await tx.query<BenefitEntry>(
      "SELECT * FROM benefit_ledger WHERE club_id=$1 AND subscription_id=$2 AND idempotency_key=$3",
      [club, subscription, data.idempotency_key],
    );
    if (replay.rows[0]) return replay.rows[0];
    if (!canUseBenefits(current))
      throw new OnboardingError(
        "Benefits are unavailable in this membership state.",
      );
    const balance = Number(
      (
        await tx.query<{ balance: number }>(
          "SELECT COALESCE(sum(delta),0)::int AS balance FROM benefit_ledger WHERE club_id=$1 AND subscription_id=$2 AND benefit_code='grooming_credit'",
          [club, subscription],
        )
      ).rows[0].balance,
    );
    if (balance + data.delta < 0)
      throw new OnboardingError("Not enough grooming credits remain.");
    const entry = await tx.query<BenefitEntry>(
      `INSERT INTO benefit_ledger(id,club_id,subscription_id,benefit_code,delta,entry_type,reason,actor_id,idempotency_key)
       VALUES($1,$2,$3,'grooming_credit',$4,$5,$6,$7,$8) RETURNING *`,
      [
        randomUUID(),
        club,
        subscription,
        data.delta,
        data.entry_type,
        data.reason,
        actor,
        data.idempotency_key,
      ],
    );
    return entry.rows[0];
  });
}
