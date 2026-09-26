import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { initialise, scoped, type Db } from "../src/lib/database";
import {
  acceptHouseholdInvite,
  householdDashboard,
  issueHouseholdInvite,
  revokeHouseholdGrant,
  revokeHouseholdInvite,
  updateHouseholdGrant,
} from "../src/lib/households";
import {
  applicationsFor,
  reviewApplication,
  submitApplication,
} from "../src/lib/applications";
import { dogsFor, saveDog } from "../src/lib/dogs";
import {
  availabilityFor,
  bookingsFor,
  cancelBooking,
  createBookingSetup,
  reserveBooking,
} from "../src/lib/bookings";

let db: Db;
const bertie = "00000000-0000-4000-8000-000000000001";
const bookingDate = "2030-10-01";

before(async () => {
  db = await initialise(await PGlite.create());
});

after(async () => db.close());

test("household invitation tokens are hashed and existing accounts must authenticate", async () => {
  const token = await issueHouseholdInvite(db, "alice", "willow", {
    email: "bea@demo.invalid",
    can_manage_dogs: true,
    can_manage_bookings: false,
  });
  const stored = (
    await db.query<{ token_hash: string }>(
      "SELECT token_hash FROM household_invites WHERE owner_account_id='alice' ORDER BY created_at DESC LIMIT 1",
    )
  ).rows[0].token_hash;
  assert.equal(stored, createHash("sha256").update(token).digest("hex"));
  assert.notEqual(stored, token);
  await assert.rejects(
    acceptHouseholdInvite(db, token, { email: "bea@demo.invalid" }),
  );
  await assert.rejects(
    acceptHouseholdInvite(db, token, { email: "alice@demo.invalid" }, "alice"),
  );
  await acceptHouseholdInvite(db, token, { email: "bea@demo.invalid" }, "bea");
  await assert.rejects(
    acceptHouseholdInvite(db, token, { email: "bea@demo.invalid" }, "bea"),
  );
});

test("pending invitation revocation is owner-only and audited", async () => {
  const token = await issueHouseholdInvite(db, "alice", "willow", {
    email: "pending-household@demo.invalid",
    can_manage_dogs: false,
    can_manage_bookings: true,
  });
  const invite = (
    await db.query<{ id: string }>(
      "SELECT id FROM household_invites WHERE token_hash=$1",
      [createHash("sha256").update(token).digest("hex")],
    )
  ).rows[0];
  await assert.rejects(revokeHouseholdInvite(db, "bea", "willow", invite.id));
  await revokeHouseholdInvite(db, "alice", "willow", invite.id);
  assert.equal(
    (
      await db.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM household_events
         WHERE club_id='willow' AND owner_account_id='alice'
         AND action='household.invite_revoked' AND details->>'inviteId'=$1`,
        [invite.id],
      )
    ).rows[0].count,
    1,
  );
  await assert.rejects(
    acceptHouseholdInvite(db, token, {
      email: "pending-household@demo.invalid",
      password: "Household-Test-26",
    }),
  );
});

test("dog-care and booking permissions stay separate and revoke immediately", async () => {
  let beaDogs = await dogsFor(db, "bea", "willow");
  assert.equal(beaDogs.find((dog) => dog.id === bertie)?.can_manage, true);
  assert.equal(beaDogs.find((dog) => dog.id === bertie)?.can_book, false);

  await saveDog(db, "bea", "willow", bertie, {
    name: "Bertie",
    breed: "Cocker spaniel",
    bio: "Chief crumb inspector, shared safely with the household.",
    avatar: "sand",
    audience: "members",
  });
  await submitApplication(db, "bea", "willow", bertie, {
    emergency_contact: "Synthetic household contact 07700 900000",
    handling_notes: "None known",
    version: 0,
    intent: "submit",
  });
  const application = (await applicationsFor(db, "manager", "willow")).find(
    (item) => item.dog_id === bertie,
  )!;
  await reviewApplication(db, "manager", "willow", bertie, {
    status: "approved",
    reason: "Synthetic household permission test",
    version: application.version,
  });
  await assert.rejects(
    availabilityFor(db, "bea", "willow", bertie, randomUUID(), bookingDate),
  );

  await updateHouseholdGrant(db, "alice", "willow", "bea", {
    can_manage_dogs: false,
    can_manage_bookings: true,
  });
  beaDogs = await dogsFor(db, "bea", "willow");
  assert.equal(beaDogs.find((dog) => dog.id === bertie)?.can_manage, false);
  assert.equal(beaDogs.find((dog) => dog.id === bertie)?.can_book, true);
  assert.equal(
    (await applicationsFor(db, "bea", "willow")).some(
      (item) => item.dog_id === bertie,
    ),
    false,
  );
  await assert.rejects(
    saveDog(db, "bea", "willow", bertie, {
      name: "No change",
      breed: "Cocker spaniel",
      bio: "Should not save",
      avatar: "sand",
      audience: "members",
    }),
  );

  const setup = await createBookingSetup(db, "manager", "willow", {
    service_name: "Household test groom",
    resource_name: "Household test station",
    duration_minutes: 60,
    cleanup_minutes: 15,
    price_pounds: "45.00",
    membership_credit_eligible: "yes",
    membership_credit_cost: 1,
    cancellation_terms: "Synthetic test terms",
    date: bookingDate,
    starts_at: "09:00",
    ends_at: "12:00",
    break_starts_at: "",
    break_ends_at: "",
  });
  const availability = await availabilityFor(
    db,
    "bea",
    "willow",
    bertie,
    setup.serviceId,
    bookingDate,
  );
  assert.ok(availability.slots.length > 0);
  await assert.rejects(
    reserveBooking(db, "bea", "willow", {
      dog_id: bertie,
      service_id: setup.serviceId,
      starts_at: availability.slots[0].starts_at,
      accepted_terms: "yes",
      use_membership_credit: "yes",
    }),
    /primary account/,
  );
  const booking = await reserveBooking(db, "bea", "willow", {
    dog_id: bertie,
    service_id: setup.serviceId,
    starts_at: availability.slots[0].starts_at,
    accepted_terms: "yes",
  });
  assert.equal(
    (await bookingsFor(db, "bea", "willow")).some(
      (item) => item.id === booking,
    ),
    true,
  );
  await cancelBooking(db, "bea", "willow", booking, "Household test");

  await revokeHouseholdGrant(db, "alice", "willow", "alice", "bea");
  beaDogs = await dogsFor(db, "bea", "willow");
  assert.equal(beaDogs.find((dog) => dog.id === bertie)?.can_book, false);
  assert.equal(
    (await bookingsFor(db, "bea", "willow")).some(
      (item) => item.id === booking,
    ),
    false,
  );
  await assert.rejects(
    availabilityFor(db, "bea", "willow", bertie, setup.serviceId, bookingDate),
  );
  assert.equal(
    (await householdDashboard(db, "bea", "willow")).grants.length,
    0,
  );
});

test("new adults receive member access without wider club or tenant authority", async () => {
  const token = await issueHouseholdInvite(db, "alice", "willow", {
    email: "household-adult@test.invalid",
    can_manage_dogs: true,
    can_manage_bookings: true,
  });
  const joined = await acceptHouseholdInvite(db, token, {
    email: "household-adult@test.invalid",
    password: "Synthetic-Household-Password-26",
  });
  const membership = (
    await db.query<{ role: string }>(
      "SELECT role FROM memberships WHERE club_id='willow' AND account_id=$1",
      [joined.accountId],
    )
  ).rows[0];
  assert.equal(membership.role, "member");
  await assert.rejects(
    issueHouseholdInvite(db, joined.accountId, "coast", {
      email: "cross-tenant@test.invalid",
      can_manage_dogs: true,
      can_manage_bookings: false,
    }),
  );
  assert.equal((await dogsFor(db, joined.accountId, "coast")).length, 0);
});

test("restricted users cannot write grants directly or inspect another household", async () => {
  await assert.rejects(
    scoped(db, "bea", "willow", false, (tx) =>
      tx.query(
        `UPDATE household_adult_grants SET can_manage_dogs=true
         WHERE club_id='willow' AND adult_account_id='bea'`,
      ),
    ),
  );
  await assert.rejects(
    updateHouseholdGrant(db, "manager", "willow", "bea", {
      can_manage_dogs: true,
      can_manage_bookings: true,
    }),
  );
  const managerRows = await scoped(db, "manager", "willow", false, (tx) =>
    tx.query("SELECT * FROM household_adult_grants"),
  );
  assert.equal(managerRows.rows.length, 0);
});
