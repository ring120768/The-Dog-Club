import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, scoped, type Db } from "../src/lib/database";
import { saveDog } from "../src/lib/dogs";
import { reviewApplication, submitApplication } from "../src/lib/applications";
import {
  activeServices,
  availabilityFor,
  bookingsFor,
  cancelBooking,
  closeResource,
  createBookingSetup,
  reserveBooking,
} from "../src/lib/bookings";

let db: Db;
let service: string;
let resource: string;
let shift: string;
let beaDog: string;
const club = "willow";
const day = "2099-10-05";

async function approve(dog: string, owner: string) {
  await submitApplication(db, owner, club, dog, {
    emergency_contact: "Test human 07700 900000",
    handling_notes: "None known",
    version: 0,
    intent: "submit",
  });
  await reviewApplication(db, "manager", club, dog, {
    status: "approved",
    reason: "Approved for test grooming",
    version: 1,
  });
}

before(async () => {
  db = await initialise(await PGlite.create());
  const setup = await createBookingSetup(db, "manager", club, {
    service_name: "Full groom",
    resource_name: "Station one",
    duration_minutes: 60,
    cleanup_minutes: 15,
    price_pounds: "65.00",
    cancellation_terms: "Cancel at least 24 hours before the appointment.",
    date: day,
    starts_at: "09:00",
    ends_at: "17:00",
    break_starts_at: "12:00",
    break_ends_at: "12:30",
  });
  service = setup.serviceId;
  resource = setup.resourceId;
  shift = setup.shiftId;
  await approve("00000000-0000-4000-8000-000000000001", "alice");
  beaDog = await saveDog(db, "bea", club, undefined, {
    name: "Concurrency",
    breed: "Test terrier",
    bio: "Synthetic booking test dog",
    avatar: "rose",
    audience: "private",
  });
  await approve(beaDog, "bea");
});

after(async () => db.close());

test("availability respects the shift, break and clean-up buffer", async () => {
  const result = await availabilityFor(
    db,
    "alice",
    club,
    "00000000-0000-4000-8000-000000000001",
    service,
    day,
  );
  assert.equal(result.service.price_pence, 6500);
  assert.ok(result.slots.some((slot) => slot.local_time === "12:30"));
  assert.ok(!result.slots.some((slot) => slot.local_time === "11:00"));
  assert.ok(!result.slots.some((slot) => slot.local_time === "11:15"));
});

test("confirmed booking snapshots price and blocks staff and station conflicts", async () => {
  const slots = await availabilityFor(
    db,
    "alice",
    club,
    "00000000-0000-4000-8000-000000000001",
    service,
    day,
  );
  const start = slots.slots.find(
    (slot) => slot.local_time === "12:30",
  )!.starts_at;
  const booking = await reserveBooking(db, "alice", club, {
    dog_id: "00000000-0000-4000-8000-000000000001",
    service_id: service,
    starts_at: start,
    accepted_terms: "yes",
  });
  const mine = await bookingsFor(db, "alice", club);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].id, booking);
  assert.equal(mine[0].price_pence_snapshot, 6500);
  assert.equal(mine[0].amount_due_pence_snapshot, 6500);
  assert.equal(mine[0].grooming_credits_applied, 0);
  assert.equal(mine[0].membership_subscription_id, null);
  assert.match(mine[0].cancellation_terms_snapshot, /24 hours/);
  const afterBooking = await availabilityFor(
    db,
    "bea",
    club,
    beaDog,
    service,
    day,
  );
  assert.ok(!afterBooking.slots.some((slot) => slot.local_time === "13:00"));
  assert.ok(afterBooking.slots.some((slot) => slot.local_time === "13:45"));
});

test("concurrent requests confirm the shared slot only once", async () => {
  const slots = await availabilityFor(
    db,
    "alice",
    club,
    "00000000-0000-4000-8000-000000000001",
    service,
    day,
  );
  const start = slots.slots.find(
    (slot) => slot.local_time === "13:45",
  )!.starts_at;
  const attempts = await Promise.allSettled([
    reserveBooking(db, "alice", club, {
      dog_id: "00000000-0000-4000-8000-000000000001",
      service_id: service,
      starts_at: start,
      accepted_terms: "yes",
    }),
    reserveBooking(db, "bea", club, {
      dog_id: beaDog,
      service_id: service,
      starts_at: start,
      accepted_terms: "yes",
    }),
  ]);
  assert.equal(
    attempts.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    (
      await db.query(
        "SELECT id FROM grooming_bookings WHERE club_id=$1 AND starts_at=$2 AND status='confirmed'",
        [club, start],
      )
    ).rows.length,
    1,
  );
});

test("cancellation releases the slot and retains an audit event", async () => {
  const booking = (await bookingsFor(db, "alice", club)).find(
    (item) => item.status === "confirmed",
  )!;
  await cancelBooking(db, "alice", club, booking.id, "Plans changed");
  const slots = await availabilityFor(
    db,
    "alice",
    club,
    "00000000-0000-4000-8000-000000000001",
    service,
    day,
  );
  assert.ok(slots.slots.some((slot) => slot.local_time === "12:30"));
  assert.equal(
    (
      await db.query(
        "SELECT id FROM booking_events WHERE booking_id=$1 ORDER BY id",
        [booking.id],
      )
    ).rows.length,
    2,
  );
});

test("eligibility, household and tenant boundaries are enforced", async () => {
  const unapproved = await saveDog(db, "alice", club, undefined, {
    name: "Not approved",
    breed: "Test dog",
    bio: "Synthetic",
    avatar: "sand",
    audience: "private",
  });
  await assert.rejects(
    availabilityFor(db, "alice", club, unapproved, service, day),
  );
  assert.deepEqual(await bookingsFor(db, "coast-member", club), []);
  assert.deepEqual(await bookingsFor(db, "bea", club), []);
  await assert.rejects(
    reserveBooking(db, "bea", club, {
      dog_id: "00000000-0000-4000-8000-000000000001",
      service_id: service,
      starts_at: "2099-10-05T14:00:00.000Z",
      accepted_terms: "yes",
    }),
  );
  await assert.rejects(
    scoped(db, "alice", club, false, (tx) =>
      tx.query("UPDATE grooming_bookings SET status='cancelled'"),
    ),
  );
});

test("station closure and unpublished shift remove availability", async () => {
  await closeResource(db, "manager", club, {
    resource_id: resource,
    date: day,
    starts_at: "15:00",
    ends_at: "16:00",
    reason: "Planned maintenance",
  });
  const closed = await availabilityFor(db, "bea", club, beaDog, service, day);
  assert.ok(!closed.slots.some((slot) => slot.local_time === "15:00"));
  await db.query("UPDATE published_shifts SET status='cancelled' WHERE id=$1", [
    shift,
  ]);
  assert.deepEqual(
    (await availabilityFor(db, "bea", club, beaDog, service, day)).slots,
    [],
  );
});

test("only a club manager can configure services and resources", async () => {
  assert.equal((await activeServices(db, "alice", club)).length, 1);
  await assert.rejects(
    createBookingSetup(db, "alice", club, {
      service_name: "Unauthorised",
      resource_name: "Wrong station",
      duration_minutes: 60,
      cleanup_minutes: 15,
      price_pounds: "20.00",
      cancellation_terms: "Test terms",
      date: day,
      starts_at: "09:00",
      ends_at: "17:00",
      break_starts_at: "",
      break_ends_at: "",
    }),
  );
});
