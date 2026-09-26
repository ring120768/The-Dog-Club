import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, type Db } from "../src/lib/database";
import { reviewApplication, submitApplication } from "../src/lib/applications";
import {
  availabilityFor,
  bookingsFor,
  cancelBooking,
  createBookingSetup,
  reserveBooking,
} from "../src/lib/bookings";
import {
  activateDemoMembership,
  createMembershipPlan,
  subscriptionsFor,
} from "../src/lib/memberships";

let db: Db;
let service: string;
let subscription: string;
const club = "willow";
const dog = "00000000-0000-4000-8000-000000000001";
const day = "2099-11-12";

before(async () => {
  db = await initialise(await PGlite.create());
  await submitApplication(db, "alice", club, dog, {
    emergency_contact: "Test human 07700 900000",
    handling_notes: "None known",
    version: 0,
    intent: "submit",
  });
  await reviewApplication(db, "manager", club, dog, {
    status: "approved",
    reason: "Approved for membership-credit testing",
    version: 1,
  });
  const plan = await createMembershipPlan(db, "manager", club, {
    name: "One groom",
    monthly_price_pounds: "39.00",
    inclusions: "One grooming credit per period.",
    limits_text: "Subject to booking availability.",
    additional_dog_terms: "One household membership.",
    renewal_terms: "Renews monthly.",
    cancellation_terms: "Runs to period end.",
    grooming_credits_per_period: 1,
  });
  subscription = await activateDemoMembership(db, "manager", club, {
    plan_id: plan,
    account_id: "alice",
    period_starts_on: "2099-11-01",
    period_ends_on: "2099-12-01",
  });
  service = (
    await createBookingSetup(db, "manager", club, {
      service_name: "Member groom",
      resource_name: "Membership station",
      duration_minutes: 60,
      cleanup_minutes: 15,
      price_pounds: "65.00",
      cancellation_terms: "Credits return when cancelled before arrival.",
      membership_credit_eligible: "yes",
      membership_credit_cost: 1,
      date: day,
      starts_at: "09:00",
      ends_at: "17:00",
      break_starts_at: "",
      break_ends_at: "",
    })
  ).serviceId;
});

after(async () => db.close());

test("booking redemption, cancellation restoration and final-credit concurrency are atomic", async () => {
  const availability = await availabilityFor(
    db,
    "alice",
    club,
    dog,
    service,
    day,
  );
  assert.equal(availability.service.membership_credit_eligible, true);
  assert.equal(availability.service.membership_credit_cost, 1);
  const at = (time: string) =>
    availability.slots.find((slot) => slot.local_time === time)!.starts_at;

  const bookingId = await reserveBooking(db, "alice", club, {
    dog_id: dog,
    service_id: service,
    starts_at: at("09:00"),
    accepted_terms: "yes",
    use_membership_credit: "yes",
  });
  const booked = (await bookingsFor(db, "alice", club)).find(
    (item) => item.id === bookingId,
  )!;
  assert.equal(booked.price_pence_snapshot, 6500);
  assert.equal(booked.amount_due_pence_snapshot, 0);
  assert.equal(booked.grooming_credits_applied, 1);
  assert.equal(booked.membership_subscription_id, subscription);
  assert.equal(
    (await subscriptionsFor(db, "alice", club)).subscriptions[0]
      .remaining_grooming_credits,
    0,
  );

  await cancelBooking(db, "alice", club, bookingId, "Need another day");
  assert.equal(
    (await subscriptionsFor(db, "alice", club)).subscriptions[0]
      .remaining_grooming_credits,
    1,
  );

  const attempts = await Promise.allSettled([
    reserveBooking(db, "alice", club, {
      dog_id: dog,
      service_id: service,
      starts_at: at("10:15"),
      accepted_terms: "yes",
      use_membership_credit: "yes",
    }),
    reserveBooking(db, "alice", club, {
      dog_id: dog,
      service_id: service,
      starts_at: at("11:30"),
      accepted_terms: "yes",
      use_membership_credit: "yes",
    }),
  ]);
  assert.equal(
    attempts.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.match(
    String(attempts.find((result) => result.status === "rejected")?.reason),
    /not enough grooming credits/i,
  );
  const membership = await subscriptionsFor(db, "alice", club);
  assert.equal(membership.subscriptions[0].remaining_grooming_credits, 0);
  assert.equal(
    membership.ledger.filter((entry) => entry.subscription_id === subscription)
      .length,
    4,
  );
});
