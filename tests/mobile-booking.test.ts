import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { reviewApplication, submitApplication } from "../src/lib/applications";
import {
  availabilityFor,
  cancelBooking,
  createBookingSetup,
  reserveBooking,
} from "../src/lib/bookings";
import { initialise, type Db } from "../src/lib/database";
import {
  acceptHouseholdInvite,
  issueHouseholdInvite,
} from "../src/lib/households";
import {
  activateDemoMembership,
  createMembershipPlan,
} from "../src/lib/memberships";
import { mobileBookingOptionsFor } from "../src/lib/mobile-booking";
import { mobileMemberHomeFor } from "../src/lib/mobile-home";

let db: Db;
let service: string;
const club = "willow";
const dog = "00000000-0000-4000-8000-000000000001";
const day = "2099-12-08";

before(async () => {
  db = await initialise(await PGlite.create());
  const plan = await createMembershipPlan(db, "manager", club, {
    name: "Mobile booking plan",
    monthly_price_pounds: "49.00",
    inclusions: "Two grooming credits.",
    limits_text: "Bookings are subject to availability.",
    additional_dog_terms: "Additional dogs require approval.",
    renewal_terms: "Renews monthly.",
    cancellation_terms: "Ends at the period boundary.",
    grooming_credits_per_period: 2,
  });
  await activateDemoMembership(db, "manager", club, {
    plan_id: plan,
    account_id: "alice",
    period_starts_on: "2099-12-01",
    period_ends_on: "2100-01-01",
  });
  service = (
    await createBookingSetup(db, "manager", club, {
      service_name: "Mobile wash and groom",
      resource_name: "Mobile booking station",
      duration_minutes: 60,
      cleanup_minutes: 15,
      price_pounds: "65.00",
      cancellation_terms: "Give 24 hours notice.",
      date: day,
      starts_at: "09:00",
      ends_at: "12:00",
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
    reason: "Approved for mobile booking test",
    version: 1,
  });
  const invite = await issueHouseholdInvite(db, "alice", club, {
    email: "bea@demo.invalid",
    can_manage_dogs: false,
    can_manage_bookings: true,
  });
  await acceptHouseholdInvite(db, invite, { email: "bea@demo.invalid" }, "bea");
});

after(async () => db.close());

test("mobile booking choices stay within the signed-in household", async () => {
  const alice = await mobileBookingOptionsFor(db, "alice", club);
  assert.deepEqual(alice.dogs, [
    { id: dog, name: "Bertie", canUseMembershipCredits: true },
  ]);
  assert.equal(alice.services[0].id, service);
  assert.equal(alice.services[0].pricePence, 6500);
  assert.equal(alice.services[0].cancellationTerms, "Give 24 hours notice.");
  assert.deepEqual(alice.membership, {
    remainingGroomingCredits: 2,
    benefitsAvailable: true,
  });

  const householdAdult = await mobileBookingOptionsFor(db, "bea", club);
  assert.deepEqual(householdAdult.dogs, [
    { id: dog, name: "Bertie", canUseMembershipCredits: false },
  ]);
  assert.equal(householdAdult.membership, null);

  const manager = await mobileBookingOptionsFor(db, "manager", club);
  assert.deepEqual(manager.dogs, []);
  assert.equal(manager.membership, null);
  await assert.rejects(
    mobileBookingOptionsFor(db, "coast-member", club),
    /Club unavailable/,
  );
});

test("a mobile choice can be confirmed with an eligible membership credit", async () => {
  const availability = await availabilityFor(
    db,
    "alice",
    club,
    dog,
    service,
    day,
  );
  assert.ok(availability.slots.length > 0);
  await reserveBooking(db, "alice", club, {
    dog_id: dog,
    service_id: service,
    starts_at: availability.slots[0].starts_at,
    accepted_terms: "yes",
    use_membership_credit: "yes",
  });
  assert.equal(
    (await mobileBookingOptionsFor(db, "alice", club)).membership
      ?.remainingGroomingCredits,
    1,
  );
});

test("mobile cancellation removes the booking and restores its credit", async () => {
  const home = await mobileMemberHomeFor(db, "alice", club);
  assert.equal(home.upcomingBookings.length, 1);
  await cancelBooking(
    db,
    "alice",
    club,
    home.upcomingBookings[0].id,
    "Cancelled by member in mobile app",
  );
  assert.deepEqual(
    (await mobileMemberHomeFor(db, "alice", club)).upcomingBookings,
    [],
  );
  assert.equal(
    (await mobileBookingOptionsFor(db, "alice", club)).membership
      ?.remainingGroomingCredits,
    2,
  );
});
