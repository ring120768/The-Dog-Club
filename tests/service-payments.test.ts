import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { reviewApplication, submitApplication } from "../src/lib/applications";
import { availabilityFor, createBookingSetup } from "../src/lib/bookings";
import { initialise, type Db } from "../src/lib/database";
import {
  expireServicePaymentHolds,
  prepareServiceCheckout,
  serviceCheckoutStatusFor,
} from "../src/lib/service-payments";
import type {
  StripeEventEnvelope,
  StripeServiceCheckoutInput,
  StripeServiceGateway,
} from "../src/lib/stripe-contract";
import {
  configureStripeSandboxAccount,
  recordStripeWebhookEvent,
} from "../src/lib/stripe-memberships";

let db: Db;
let service: string;
const calls: StripeServiceCheckoutInput[] = [];
const club = "willow";
const dog = "00000000-0000-4000-8000-000000000001";
const connectedAccount = "acct_service_willow";
const day = "2099-12-15";
const sessions = [
  "cs_service_one",
  "cs_service_two",
  "cs_service_three",
  "cs_service_four",
];

const gateway: StripeServiceGateway = {
  async createServiceCheckout(input) {
    calls.push(input);
    return {
      id: sessions[calls.length - 1],
      url: `https://checkout.stripe.test/${sessions[calls.length - 1]}`,
      expiresAt: input.expiresAt,
    };
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

async function paidEvent(
  eventId: string,
  sessionId: string,
  checkoutId: string,
  paymentIntentId: string,
) {
  await recordStripeWebhookEvent(
    db,
    envelope(eventId, "checkout.session.completed", {
      kind: "checkout.completed",
      sessionId,
      paymentStatus: "paid",
      customerId: "cus_service_member",
      subscriptionId: null,
      amountTotal: 6500,
      currency: "gbp",
      paymentIntentId,
      clientReferenceId: checkoutId,
    }),
  );
}

before(async () => {
  db = await initialise(await PGlite.create());
  await configureStripeSandboxAccount(db, "platform-owner", club, {
    external_account_id: connectedAccount,
    status: "connected",
    charges_enabled: true,
    details_submitted: true,
  });
  service = (
    await createBookingSetup(db, "manager", club, {
      service_name: "Paid mobile groom",
      resource_name: "Paid booking station",
      duration_minutes: 60,
      cleanup_minutes: 15,
      price_pounds: "65.00",
      cancellation_terms: "Give 24 hours notice.",
      date: day,
      starts_at: "09:00",
      ends_at: "15:00",
    })
  ).serviceId;
  await submitApplication(db, "alice", club, dog, {
    emergency_contact: "Synthetic contact 07700 900000",
    handling_notes: "None known",
    version: 0,
    intent: "submit",
  });
  await reviewApplication(db, "manager", club, dog, {
    status: "approved",
    reason: "Approved for service payment test",
    version: 1,
  });
});

after(async () => db.close());

test("service checkout holds capacity and safely reuses the request", async () => {
  const slot = (await availabilityFor(db, "alice", club, dog, service, day))
    .slots[0];
  const request = {
    request_id: "10000000-0000-4000-8000-000000000001",
    dog_id: dog,
    service_id: service,
    starts_at: slot.starts_at,
    accepted_terms: "yes",
  };
  const first = await prepareServiceCheckout(
    db,
    "alice",
    club,
    request,
    "https://demo.dogclub.test",
    gateway,
  );
  const retry = await prepareServiceCheckout(
    db,
    "alice",
    club,
    request,
    "https://demo.dogclub.test",
    gateway,
  );
  assert.equal(retry.bookingId, first.bookingId);
  assert.equal(retry.checkoutUrl, first.checkoutUrl);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].amountPence, 6500);
  assert.equal(calls[0].connectedAccountId, connectedAccount);
  assert.match(calls[0].integrationIdentifier, /^dogclub_service_[a-z]{8}$/);
  assert.match(calls[0].successUrl, /payment=returned$/);
  assert.equal(
    (
      await db.query<{ status: string }>(
        "SELECT status FROM grooming_bookings WHERE id=$1",
        [first.bookingId],
      )
    ).rows[0].status,
    "awaiting_payment",
  );
  const afterHold = await availabilityFor(db, "alice", club, dog, service, day);
  assert.ok(
    !afterHold.slots.some(
      (candidate) =>
        new Date(candidate.starts_at).getTime() ===
        new Date(slot.starts_at).getTime(),
    ),
  );
  await assert.rejects(
    prepareServiceCheckout(
      db,
      "coast-member",
      club,
      { ...request, request_id: "10000000-0000-4000-8000-000000000099" },
      "https://demo.dogclub.test",
      gateway,
    ),
    /Club membership required/,
  );
  const checkout = (
    await db.query<{ id: string }>(
      "SELECT id FROM service_checkout_sessions WHERE booking_id=$1",
      [first.bookingId],
    )
  ).rows[0];
  assert.deepEqual(
    await serviceCheckoutStatusFor(db, "alice", club, first.bookingId),
    {
      bookingId: first.bookingId,
      status: "awaiting_payment",
      expiresAt: first.expiresAt,
    },
  );
  assert.equal(
    await serviceCheckoutStatusFor(db, "coast-member", club, first.bookingId),
    null,
  );
  await paidEvent(
    "evt_service_paid_one",
    sessions[0],
    checkout.id,
    "pi_service_one",
  );
  assert.equal(
    (
      await db.query<{ status: string }>(
        "SELECT status FROM grooming_bookings WHERE id=$1",
        [first.bookingId],
      )
    ).rows[0].status,
    "confirmed",
  );
  assert.equal(
    (await serviceCheckoutStatusFor(db, "alice", club, first.bookingId))
      ?.status,
    "confirmed",
  );
  assert.deepEqual(
    (
      await db.query<{ status: string; amount_pence: number }>(
        "SELECT status,amount_pence FROM service_payments WHERE booking_id=$1",
        [first.bookingId],
      )
    ).rows[0],
    { status: "captured", amount_pence: 6500 },
  );
});

test("failed payment releases the held slot", async () => {
  const slot = (await availabilityFor(db, "alice", club, dog, service, day))
    .slots[0];
  const attempt = await prepareServiceCheckout(
    db,
    "alice",
    club,
    {
      request_id: "10000000-0000-4000-8000-000000000002",
      dog_id: dog,
      service_id: service,
      starts_at: slot.starts_at,
      accepted_terms: "yes",
    },
    "https://demo.dogclub.test",
    gateway,
  );
  await recordStripeWebhookEvent(
    db,
    envelope("evt_service_failed", "checkout.session.async_payment_failed", {
      kind: "checkout.failed",
      sessionId: sessions[1],
    }),
  );
  assert.equal(
    (
      await db.query<{ status: string }>(
        "SELECT status FROM grooming_bookings WHERE id=$1",
        [attempt.bookingId],
      )
    ).rows[0].status,
    "cancelled",
  );
  const available = await availabilityFor(db, "alice", club, dog, service, day);
  assert.ok(
    available.slots.some(
      (candidate) =>
        new Date(candidate.starts_at).getTime() ===
        new Date(slot.starts_at).getTime(),
    ),
  );
});

test("late payment is isolated for manual reconciliation", async () => {
  const slot = (await availabilityFor(db, "alice", club, dog, service, day))
    .slots[0];
  const attempt = await prepareServiceCheckout(
    db,
    "alice",
    club,
    {
      request_id: "10000000-0000-4000-8000-000000000003",
      dog_id: dog,
      service_id: service,
      starts_at: slot.starts_at,
      accepted_terms: "yes",
    },
    "https://demo.dogclub.test",
    gateway,
  );
  const checkout = (
    await db.query<{ id: string; expires_at: string }>(
      "SELECT id,expires_at FROM service_checkout_sessions WHERE booking_id=$1",
      [attempt.bookingId],
    )
  ).rows[0];
  assert.equal(
    await expireServicePaymentHolds(
      db,
      new Date(new Date(checkout.expires_at).getTime() + 1),
    ),
    1,
  );
  assert.equal(
    (await serviceCheckoutStatusFor(db, "alice", club, attempt.bookingId))
      ?.status,
    "expired",
  );
  await paidEvent(
    "evt_service_late_paid",
    sessions[2],
    checkout.id,
    "pi_service_late",
  );
  assert.equal(
    (
      await db.query<{ status: string }>(
        "SELECT status FROM service_payments WHERE booking_id=$1",
        [attempt.bookingId],
      )
    ).rows[0].status,
    "late_paid",
  );
  assert.equal(
    (await serviceCheckoutStatusFor(db, "alice", club, attempt.bookingId))
      ?.status,
    "late_paid",
  );
  assert.equal(
    (
      await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM service_payment_exceptions WHERE booking_id=$1 AND status='open'",
        [attempt.bookingId],
      )
    ).rows[0].count,
    1,
  );
});

test("mismatched Stripe amount cannot confirm the held booking", async () => {
  const slot = (await availabilityFor(db, "alice", club, dog, service, day))
    .slots[0];
  const attempt = await prepareServiceCheckout(
    db,
    "alice",
    club,
    {
      request_id: "10000000-0000-4000-8000-000000000004",
      dog_id: dog,
      service_id: service,
      starts_at: slot.starts_at,
      accepted_terms: "yes",
    },
    "https://demo.dogclub.test",
    gateway,
  );
  const checkout = (
    await db.query<{ id: string }>(
      "SELECT id FROM service_checkout_sessions WHERE booking_id=$1",
      [attempt.bookingId],
    )
  ).rows[0];
  await assert.rejects(
    recordStripeWebhookEvent(
      db,
      envelope("evt_service_wrong_amount", "checkout.session.completed", {
        kind: "checkout.completed",
        sessionId: sessions[3],
        paymentStatus: "paid",
        customerId: "cus_service_member",
        subscriptionId: null,
        amountTotal: 1,
        currency: "gbp",
        paymentIntentId: "pi_service_wrong_amount",
        clientReferenceId: checkout.id,
      }),
    ),
    /does not match the booking/,
  );
  assert.equal(
    (
      await db.query<{ status: string }>(
        "SELECT status FROM grooming_bookings WHERE id=$1",
        [attempt.bookingId],
      )
    ).rows[0].status,
    "awaiting_payment",
  );
});
