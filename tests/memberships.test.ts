import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, type Db } from "../src/lib/database";
import {
  activateDemoMembership,
  changeGroomingCredits,
  createMembershipPlan,
  plansFor,
  scheduleMembershipCancellation,
  setMembershipState,
  subscriptionsFor,
} from "../src/lib/memberships";

let db: Db;
let plan: string;
let subscription: string;
const club = "willow";

const date = (days: number) => {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

before(async () => {
  db = await initialise(await PGlite.create());
  plan = await createMembershipPlan(db, "manager", club, {
    name: "Care membership",
    monthly_price_pounds: "39.00",
    inclusions: "Club access and two grooming credits per period.",
    limits_text: "Bookings remain subject to availability.",
    additional_dog_terms:
      "Additional dogs need their own approved care record.",
    renewal_terms: "Renews monthly once billing is connected.",
    cancellation_terms: "Cancellation takes effect at the period end.",
    grooming_credits_per_period: 2,
  });
  subscription = await activateDemoMembership(db, "manager", club, {
    plan_id: plan,
    account_id: "alice",
    period_starts_on: date(-1),
    period_ends_on: date(29),
  });
});

after(async () => db.close());

test("plan terms and opening allowance are visible to the member", async () => {
  const plans = await plansFor(db, "alice", club);
  assert.equal(plans[0].monthly_price_pence, 3900);
  assert.match(plans[0].inclusions, /two grooming credits/i);
  assert.match(plans[0].limits_text, /availability/i);
  const mine = await subscriptionsFor(db, "alice", club);
  assert.equal(mine.subscriptions.length, 1);
  assert.equal(mine.subscriptions[0].state, "active");
  assert.equal(mine.subscriptions[0].remaining_grooming_credits, 2);
  assert.equal(mine.ledger.length, 1);
  assert.equal(mine.ledger[0].entry_type, "allocation");
});

test("concurrent redemption cannot spend the final credit twice", async () => {
  await changeGroomingCredits(db, "manager", club, subscription, {
    delta: -1,
    entry_type: "redemption",
    reason: "First synthetic groom",
    idempotency_key: "redeem-first",
  });
  const attempts = await Promise.allSettled([
    changeGroomingCredits(db, "manager", club, subscription, {
      delta: -1,
      entry_type: "redemption",
      reason: "Concurrent attempt A",
      idempotency_key: "redeem-race-a",
    }),
    changeGroomingCredits(db, "manager", club, subscription, {
      delta: -1,
      entry_type: "redemption",
      reason: "Concurrent attempt B",
      idempotency_key: "redeem-race-b",
    }),
  ]);
  assert.equal(
    attempts.filter((attempt) => attempt.status === "fulfilled").length,
    1,
  );
  assert.equal(
    (await subscriptionsFor(db, "alice", club)).subscriptions[0]
      .remaining_grooming_credits,
    0,
  );
});

test("replayed idempotency key returns the original debit", async () => {
  const ledger = (await subscriptionsFor(db, "manager", club)).ledger;
  const race = ledger.find((entry) =>
    entry.idempotency_key.startsWith("redeem-race"),
  )!;
  const replay = await changeGroomingCredits(
    db,
    "manager",
    club,
    subscription,
    {
      delta: -1,
      entry_type: "redemption",
      reason: "Concurrent attempt replay",
      idempotency_key: race.idempotency_key,
    },
  );
  assert.equal(replay.id, race.id);
  assert.equal(
    (await subscriptionsFor(db, "manager", club)).ledger.filter(
      (entry) => entry.idempotency_key === race.idempotency_key,
    ).length,
    1,
  );
});

test("restoration is audited and payment issue follows the configured rule", async () => {
  await changeGroomingCredits(db, "manager", club, subscription, {
    delta: 1,
    entry_type: "restoration",
    reason: "Cancelled groom restored",
    idempotency_key: "restore-cancelled-groom",
  });
  assert.equal(
    (await subscriptionsFor(db, "alice", club)).subscriptions[0]
      .remaining_grooming_credits,
    1,
  );
  await setMembershipState(db, "manager", club, subscription, {
    state: "payment_issue",
    reason: "Synthetic payment issue",
  });
  await assert.rejects(
    changeGroomingCredits(db, "manager", club, subscription, {
      delta: -1,
      entry_type: "redemption",
      reason: "Should be blocked",
      idempotency_key: "blocked-payment-issue",
    }),
    /benefits are unavailable/i,
  );
  await setMembershipState(db, "manager", club, subscription, {
    state: "active",
    reason: "Synthetic payment issue resolved",
  });
});

test("cancellation remains usable to period end, while ended blocks benefits", async () => {
  await scheduleMembershipCancellation(db, "alice", club, subscription);
  const scheduled = (await subscriptionsFor(db, "alice", club))
    .subscriptions[0];
  assert.equal(scheduled.state, "cancellation_scheduled");
  assert.equal(
    String(scheduled.cancellation_effective_on),
    String(scheduled.period_ends_on),
  );
  await changeGroomingCredits(db, "manager", club, subscription, {
    delta: -1,
    entry_type: "redemption",
    reason: "Final-period groom",
    idempotency_key: "final-period-groom",
  });
  await setMembershipState(db, "manager", club, subscription, {
    state: "ended",
    reason: "Period completed",
  });
  await assert.rejects(
    changeGroomingCredits(db, "manager", club, subscription, {
      delta: 1,
      entry_type: "adjustment",
      reason: "Blocked after end",
      idempotency_key: "blocked-after-end",
    }),
    /benefits are unavailable/i,
  );
});

test("household, tenant and manager boundaries are enforced", async () => {
  assert.equal(
    (await subscriptionsFor(db, "bea", club)).subscriptions.length,
    0,
  );
  assert.equal(
    (await subscriptionsFor(db, "coast-member", "coast")).subscriptions.length,
    0,
  );
  await assert.rejects(
    createMembershipPlan(db, "alice", club, {
      name: "Unauthorised plan",
      monthly_price_pounds: "1.00",
      inclusions: "None",
      limits_text: "None",
      additional_dog_terms: "None",
      renewal_terms: "None",
      cancellation_terms: "None",
      grooming_credits_per_period: 0,
    }),
  );
  await assert.rejects(
    setMembershipState(db, "coast-member", "coast", subscription, {
      state: "active",
      reason: "Cross tenant attempt",
    }),
  );
});
