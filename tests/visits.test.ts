import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, type Db } from "../src/lib/database";
import { submitApplication, reviewApplication } from "../src/lib/applications";
import {
  createBookingSetup,
  availabilityFor,
  reserveBooking,
  cancelBooking,
} from "../src/lib/bookings";
import {
  arriveForBooking,
  correctVisit,
  progressVisit,
  visitsFor,
} from "../src/lib/visits";

let db: Db;
let booking: string;
let visit: string;
const club = "willow";
const dog = "00000000-0000-4000-8000-000000000001";
const day = "2099-11-05";

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
    reason: "Approved for visit test",
    version: 1,
  });
  const setup = await createBookingSetup(db, "manager", club, {
    service_name: "Visit test groom",
    resource_name: "Visit test station",
    duration_minutes: 60,
    cleanup_minutes: 15,
    price_pounds: "55.00",
    cancellation_terms: "Test cancellation terms",
    date: day,
    starts_at: "09:00",
    ends_at: "17:00",
    break_starts_at: "",
    break_ends_at: "",
  });
  const start = (
    await availabilityFor(db, "alice", club, dog, setup.serviceId, day)
  ).slots[0].starts_at;
  booking = await reserveBooking(db, "alice", club, {
    dog_id: dog,
    service_id: setup.serviceId,
    starts_at: start,
    accepted_terms: "yes",
  });
});

after(async () => db.close());

test("arrival is duplicate-safe and audited once", async () => {
  const first = await arriveForBooking(db, "manager", club, booking);
  const repeated = await arriveForBooking(db, "manager", club, booking);
  visit = first.id;
  assert.equal(repeated.id, first.id);
  assert.equal(
    Number(
      (
        await db.query(
          "SELECT count(*) FROM visit_events WHERE visit_id=$1 AND action='visit.arrived'",
          [visit],
        )
      ).rows[0].count,
    ),
    1,
  );
  await assert.rejects(
    cancelBooking(db, "alice", club, booking, "Trying after arrival"),
    /visit has started/i,
  );
});

test("handover requires an authorised collection adult", async () => {
  await assert.rejects(
    progressVisit(db, "manager", club, visit, "handed_over", {
      collector_name: "",
    }),
  );
  const handedOver = await progressVisit(
    db,
    "manager",
    club,
    visit,
    "handed_over",
    { collector_name: "Alex Taylor" },
  );
  assert.equal(handedOver.authorised_collector_name, "Alex Taylor");
});

test("ready creates one manual-contact item and remains idempotent", async () => {
  await progressVisit(db, "manager", club, visit, "in_progress", {});
  await progressVisit(db, "manager", club, visit, "ready", {});
  await progressVisit(db, "manager", club, visit, "ready", {});
  const notices = await db.query(
    "SELECT * FROM notification_outbox WHERE visit_id=$1",
    [visit],
  );
  assert.equal(notices.rows.length, 1);
  assert.equal(notices.rows[0].delivery_status, "manual_required");
});

test("correction requires a reason and preserves the audit trail", async () => {
  await assert.rejects(
    correctVisit(db, "manager", club, visit, {
      status: "in_progress",
      reason: "",
    }),
  );
  await correctVisit(db, "manager", club, visit, {
    status: "in_progress",
    reason: "Marked ready too early",
  });
  const data = await visitsFor(db, "manager", club);
  assert.equal(data.visits[0].status, "in_progress");
  assert.equal(data.events.at(-1)?.action, "visit.corrected");
  assert.equal(data.events.at(-1)?.reason, "Marked ready too early");
});

test("collection requires explicit verification of the authorised adult", async () => {
  await progressVisit(db, "manager", club, visit, "ready", {});
  await assert.rejects(
    progressVisit(db, "manager", club, visit, "collected", {}),
  );
  const collected = await progressVisit(
    db,
    "manager",
    club,
    visit,
    "collected",
    { collector_verified: "yes" },
  );
  assert.equal(collected.status, "collected");
  assert.equal(collected.collection_verified, true);
});

test("household and tenant boundaries protect visit reads and writes", async () => {
  assert.equal((await visitsFor(db, "alice", club)).visits.length, 1);
  assert.equal((await visitsFor(db, "bea", club)).visits.length, 0);
  assert.equal((await visitsFor(db, "coast-member", "coast")).visits.length, 0);
  await assert.rejects(arriveForBooking(db, "alice", club, booking));
  await assert.rejects(
    correctVisit(db, "coast-member", "coast", visit, {
      status: "ready",
      reason: "Cross tenant attempt",
    }),
  );
});
