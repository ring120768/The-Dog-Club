import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, type Db } from "../src/lib/database";
import { createMembershipPlan, subscriptionsFor } from "../src/lib/memberships";
import {
  configureStripeSandboxAccount,
  prepareMembershipCheckout,
  recordStripeWebhookEvent,
  requestStripeCancellation,
  setPlanStripePrice,
  stripePriceLinkContext,
  validateMembershipPrice,
} from "../src/lib/stripe-memberships";
import type {
  StripeEventEnvelope,
  StripeMembershipGateway,
} from "../src/lib/stripe-contract";

let db: Db;
let plan: string;
let checkoutCalls = 0;
const cancellationCalls: {
  connectedAccountId: string;
  subscriptionId: string;
}[] = [];
const club = "willow";
const connectedAccount = "acct_sandbox_willow";
const gateway: StripeMembershipGateway = {
  async createSubscriptionCheckout(input) {
    checkoutCalls += 1;
    assert.equal(input.connectedAccountId, connectedAccount);
    assert.equal(input.priceId, "price_care_monthly");
    assert.equal(input.customerEmail, "alice@demo.invalid");
    assert.match(input.integrationIdentifier, /^dogclub_membership_[a-z]{8}$/);
    assert.match(
      input.successUrl,
      /\/club\/willow\/memberships\?checkout=returned$/,
    );
    return {
      id: "cs_test_membership",
      url: "https://checkout.stripe.test/cs_test_membership",
      expiresAt: new Date("2099-10-01T12:00:00Z"),
    };
  },
  async scheduleCancellation(input) {
    cancellationCalls.push(input);
  },
};

const envelope = (
  id: string,
  sourceType: string,
  data: StripeEventEnvelope["data"],
): StripeEventEnvelope => ({
  id,
  connectedAccountId: connectedAccount,
  livemode: false,
  sourceType,
  data,
});

before(async () => {
  db = await initialise(await PGlite.create());
  plan = await createMembershipPlan(db, "manager", club, {
    name: "Stripe care",
    monthly_price_pounds: "39.00",
    inclusions: "Club access and two grooming credits per paid period.",
    limits_text: "Bookings remain subject to availability.",
    additional_dog_terms: "Each dog needs an approved care record.",
    renewal_terms: "Renews monthly through Stripe Billing.",
    cancellation_terms: "Cancellation takes effect at the paid period end.",
    grooming_credits_per_period: 2,
  });
});

after(async () => db.close());

test("only the platform owner configures the verified sandbox account and managers map Prices", async () => {
  await assert.rejects(
    configureStripeSandboxAccount(db, "manager", club, {
      external_account_id: connectedAccount,
      status: "connected",
      charges_enabled: true,
      details_submitted: true,
    }),
    /platform access/i,
  );
  await configureStripeSandboxAccount(db, "platform-owner", club, {
    external_account_id: connectedAccount,
    status: "connected",
    charges_enabled: true,
    details_submitted: true,
  });
  const priceContext = await stripePriceLinkContext(db, "manager", club, plan);
  assert.deepEqual(priceContext, {
    monthly_price_pence: 3900,
    external_account_id: connectedAccount,
  });
  validateMembershipPrice(priceContext.monthly_price_pence, {
    active: true,
    currency: "gbp",
    unitAmount: 3900,
    recurringInterval: "month",
    recurringIntervalCount: 1,
  });
  assert.throws(
    () =>
      validateMembershipPrice(priceContext.monthly_price_pence, {
        active: true,
        currency: "usd",
        unitAmount: 3900,
        recurringInterval: "month",
        recurringIntervalCount: 1,
      }),
    /monthly GBP Price/i,
  );
  await assert.rejects(
    setPlanStripePrice(db, "alice", club, plan, "price_care_monthly"),
    /manager access/i,
  );
  await setPlanStripePrice(db, "manager", club, plan, "price_care_monthly");
});

test("checkout uses trusted tenant configuration and reuses an open attempt", async () => {
  await assert.rejects(
    prepareMembershipCheckout(
      db,
      "coast-member",
      club,
      plan,
      "https://demo.dogclub.test",
      gateway,
    ),
    /club membership required/i,
  );
  const retryInputs: Parameters<
    StripeMembershipGateway["createSubscriptionCheckout"]
  >[0][] = [];
  const retryGateway: StripeMembershipGateway = {
    ...gateway,
    async createSubscriptionCheckout(input) {
      retryInputs.push(input);
      if (retryInputs.length === 1)
        throw new Error("Connection closed after request upload.");
      return gateway.createSubscriptionCheckout(input);
    },
  };
  await assert.rejects(
    prepareMembershipCheckout(
      db,
      "alice",
      club,
      plan,
      "https://demo.dogclub.test",
      retryGateway,
    ),
    /connection closed/i,
  );
  const first = await prepareMembershipCheckout(
    db,
    "alice",
    club,
    plan,
    "https://demo.dogclub.test",
    retryGateway,
  );
  const replay = await prepareMembershipCheckout(
    db,
    "alice",
    club,
    plan,
    "https://demo.dogclub.test",
    gateway,
  );
  assert.equal(first, "https://checkout.stripe.test/cs_test_membership");
  assert.equal(replay, first);
  assert.equal(checkoutCalls, 1);
  assert.equal(retryInputs.length, 2);
  assert.equal(retryInputs[0].idempotencyKey, retryInputs[1].idempotencyKey);
  assert.equal(
    retryInputs[0].integrationIdentifier,
    retryInputs[1].integrationIdentifier,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS count FROM membership_checkout_sessions",
      )
    ).rows[0].count,
    1,
  );
});

test("out-of-order signed events wait, then one paid invoice activates one allowance", async () => {
  await recordStripeWebhookEvent(
    db,
    envelope("evt_invoice_first", "invoice.paid", {
      kind: "invoice.paid",
      invoiceId: "in_period_one",
      subscriptionId: "sub_membership_one",
      amountDue: 3900,
      amountPaid: 3900,
      currency: "gbp",
      periodStartsOn: "2099-10-01",
      periodEndsOn: "2099-11-01",
      hostedInvoiceUrl: "https://invoice.stripe.test/in_period_one",
    }),
  );
  assert.equal(
    (
      await db.query<{ status: string }>(
        "SELECT status FROM payment_webhook_events WHERE provider_event_id='evt_invoice_first'",
      )
    ).rows[0].status,
    "pending",
  );
  await recordStripeWebhookEvent(
    db,
    envelope("evt_checkout", "checkout.session.completed", {
      kind: "checkout.completed",
      sessionId: "cs_test_membership",
      paymentStatus: "paid",
      customerId: "cus_member_one",
      subscriptionId: "sub_membership_one",
    }),
  );
  const membership = (await subscriptionsFor(db, "alice", club))
    .subscriptions[0];
  assert.equal(membership.source, "stripe");
  assert.equal(membership.state, "active");
  assert.equal(membership.remaining_grooming_credits, 2);
  assert.equal(membership.latest_paid_invoice_id, "in_period_one");
  const duplicate = await recordStripeWebhookEvent(
    db,
    envelope("evt_invoice_first", "invoice.paid", {
      kind: "invoice.paid",
      invoiceId: "in_period_one",
      subscriptionId: "sub_membership_one",
      amountDue: 3900,
      amountPaid: 3900,
      currency: "gbp",
      periodStartsOn: "2099-10-01",
      periodEndsOn: "2099-11-01",
      hostedInvoiceUrl: null,
    }),
  );
  assert.equal(duplicate.duplicate, true);
  await recordStripeWebhookEvent(
    db,
    envelope("evt_invoice_duplicate_delivery", "invoice.paid", {
      kind: "invoice.paid",
      invoiceId: "in_period_one",
      subscriptionId: "sub_membership_one",
      amountDue: 3900,
      amountPaid: 3900,
      currency: "gbp",
      periodStartsOn: "2099-10-01",
      periodEndsOn: "2099-11-01",
      hostedInvoiceUrl: null,
    }),
  );
  assert.equal(
    (await subscriptionsFor(db, "alice", club)).subscriptions[0]
      .remaining_grooming_credits,
    2,
  );
});

test("failed invoice and later recovery remain distinct and allocate renewal once", async () => {
  const failed = {
    kind: "invoice.payment_failed" as const,
    invoiceId: "in_period_two",
    subscriptionId: "sub_membership_one",
    amountDue: 3900,
    amountPaid: 0,
    currency: "gbp",
    periodStartsOn: "2099-11-01",
    periodEndsOn: "2099-12-01",
    hostedInvoiceUrl: "https://invoice.stripe.test/in_period_two",
  };
  await recordStripeWebhookEvent(
    db,
    envelope("evt_invoice_failed", "invoice.payment_failed", failed),
  );
  assert.equal(
    (await subscriptionsFor(db, "alice", club)).subscriptions[0].state,
    "payment_issue",
  );
  await recordStripeWebhookEvent(
    db,
    envelope("evt_invoice_recovered", "invoice.paid", {
      ...failed,
      kind: "invoice.paid",
      amountPaid: 3900,
    }),
  );
  const recovered = (await subscriptionsFor(db, "alice", club))
    .subscriptions[0];
  assert.equal(recovered.state, "active");
  assert.equal(recovered.remaining_grooming_credits, 4);
  assert.equal(recovered.latest_paid_invoice_id, "in_period_two");
});

test("Stripe cancellation waits for its webhook before changing access", async () => {
  const current = (await subscriptionsFor(db, "alice", club)).subscriptions[0];
  await requestStripeCancellation(db, "alice", club, current.id, gateway);
  assert.deepEqual(cancellationCalls, [
    {
      connectedAccountId: connectedAccount,
      subscriptionId: "sub_membership_one",
    },
  ]);
  assert.equal(
    (await subscriptionsFor(db, "alice", club)).subscriptions[0].state,
    "active",
  );
  await assert.rejects(
    recordStripeWebhookEvent(
      db,
      envelope("evt_cancel_scheduled", "customer.subscription.updated", {
        kind: "subscription.updated",
        subscriptionId: "sub_membership_one",
        customerId: "cus_someone_else",
        status: "active",
        cancelAtPeriodEnd: true,
        periodStartsOn: "2099-11-01",
        periodEndsOn: "2099-12-01",
      }),
    ),
    /customer does not match/i,
  );
  assert.equal(
    (await subscriptionsFor(db, "alice", club)).subscriptions[0].state,
    "active",
  );
  await recordStripeWebhookEvent(
    db,
    envelope("evt_cancel_scheduled_valid", "customer.subscription.updated", {
      kind: "subscription.updated",
      subscriptionId: "sub_membership_one",
      customerId: "cus_member_one",
      status: "active",
      cancelAtPeriodEnd: true,
      periodStartsOn: "2099-11-01",
      periodEndsOn: "2099-12-01",
    }),
  );
  const scheduled = (await subscriptionsFor(db, "alice", club))
    .subscriptions[0];
  assert.equal(scheduled.state, "cancellation_scheduled");
  assert.equal(
    new Date(scheduled.cancellation_effective_on!).toISOString().slice(0, 10),
    "2099-12-01",
  );
});

test("deletion ends access and live events cannot enter a sandbox account", async () => {
  await assert.rejects(
    recordStripeWebhookEvent(db, {
      ...envelope("evt_live_rejected", "customer.subscription.deleted", {
        kind: "subscription.deleted",
        subscriptionId: "sub_membership_one",
        customerId: "cus_member_one",
        status: "canceled",
        cancelAtPeriodEnd: false,
        periodStartsOn: "2099-11-01",
        periodEndsOn: "2099-12-01",
      }),
      livemode: true,
    }),
    /live Stripe event rejected/i,
  );
  await recordStripeWebhookEvent(
    db,
    envelope("evt_subscription_deleted", "customer.subscription.deleted", {
      kind: "subscription.deleted",
      subscriptionId: "sub_membership_one",
      customerId: "cus_member_one",
      status: "canceled",
      cancelAtPeriodEnd: false,
      periodStartsOn: "2099-11-01",
      periodEndsOn: "2099-12-01",
    }),
  );
  assert.equal(
    (await subscriptionsFor(db, "alice", club)).subscriptions[0].state,
    "ended",
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS count FROM payment_webhook_events WHERE provider_event_id='evt_live_rejected'",
      )
    ).rows[0].count,
    0,
  );
});
