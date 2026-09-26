import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, type Db } from "../src/lib/database";
import {
  availabilityFor,
  createBookingSetup,
  reserveBooking,
} from "../src/lib/bookings";
import {
  activateDemoMembership,
  createMembershipPlan,
} from "../src/lib/memberships";
import { reviewApplication, submitApplication } from "../src/lib/applications";
import { mobileMemberHomeFor } from "../src/lib/mobile-home";

let db: Db;
const club = "willow";
const dog = "00000000-0000-4000-8000-000000000001";
const day = "2099-11-05";

before(async () => {
  db = await initialise(await PGlite.create());
  const plan = await createMembershipPlan(db, "manager", club, {
    name: "Mobile care",
    monthly_price_pounds: "49.00",
    inclusions: "Club access and two grooming credits.",
    limits_text: "Bookings are subject to availability.",
    additional_dog_terms: "Additional dogs require approval.",
    renewal_terms: "Renews monthly.",
    cancellation_terms: "Ends at the period boundary.",
    grooming_credits_per_period: 2,
  });
  await activateDemoMembership(db, "manager", club, {
    plan_id: plan,
    account_id: "alice",
    period_starts_on: "2099-10-01",
    period_ends_on: "2099-12-01",
  });
  const setup = await createBookingSetup(db, "manager", club, {
    service_name: "Mobile groom",
    resource_name: "Mobile station",
    duration_minutes: 60,
    cleanup_minutes: 15,
    price_pounds: "65.00",
    cancellation_terms: "Give 24 hours notice.",
    date: day,
    starts_at: "09:00",
    ends_at: "12:00",
  });
  await submitApplication(db, "alice", club, dog, {
    emergency_contact: "Test human 07700 900000",
    handling_notes: "None known",
    version: 0,
    intent: "submit",
  });
  await reviewApplication(db, "manager", club, dog, {
    status: "approved",
    reason: "Approved for mobile home test",
    version: 1,
  });
  const availability = await availabilityFor(
    db,
    "alice",
    club,
    dog,
    setup.serviceId,
    day,
  );
  await reserveBooking(db, "alice", club, {
    dog_id: dog,
    service_id: setup.serviceId,
    starts_at: availability.slots[0].starts_at,
    accepted_terms: "yes",
    use_membership_credit: "yes",
  });
});

after(async () => db.close());

test("mobile member home exposes only the actor's commercial summary", async () => {
  const home = await mobileMemberHomeFor(db, "alice", club);
  assert.deepEqual(
    {
      plan: home.membership?.planName,
      state: home.membership?.state,
      credits: home.membership?.remainingGroomingCredits,
      available: home.membership?.benefitsAvailable,
    },
    { plan: "Mobile care", state: "active", credits: 1, available: true },
  );
  assert.deepEqual(
    home.upcomingBookings.map((booking) => ({
      dog: booking.dogName,
      service: booking.serviceName,
      credits: booking.groomingCreditsApplied,
      due: booking.amountDuePence,
      payment: booking.paymentState,
    })),
    [
      {
        dog: "Bertie",
        service: "Mobile groom",
        credits: 1,
        due: 0,
        payment: "membership_credit",
      },
    ],
  );

  assert.deepEqual(await mobileMemberHomeFor(db, "bea", club), {
    membership: null,
    upcomingBookings: [],
  });
  assert.deepEqual(await mobileMemberHomeFor(db, "manager", club), {
    membership: null,
    upcomingBookings: [],
  });
});
