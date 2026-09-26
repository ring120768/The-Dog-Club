import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { reviewApplication, submitApplication } from "../src/lib/applications";
import { availabilityFor, createBookingSetup } from "../src/lib/bookings";
import { initialise, type Db } from "../src/lib/database";
import { resetDemoActivity } from "../src/lib/demo-reset";
import {
  completeDemoServiceCheckout,
  demoServiceGateway,
  ensureDemoServicePaymentAccount,
} from "../src/lib/demo-service-payments";
import { prepareServiceCheckout } from "../src/lib/service-payments";

const demoEnvironment = {
  DOGCLUB_LOCAL_DEMO: "1",
  NODE_ENV: "test",
};
const club = "willow";
const dog = "00000000-0000-4000-8000-000000000001";
let db: Db;
let service: string;

before(async () => {
  db = await initialise(await PGlite.create());
  await ensureDemoServicePaymentAccount(db, club, demoEnvironment);
  service = (
    await createBookingSetup(db, "manager", club, {
      service_name: "Resettable demo groom",
      resource_name: "Resettable demo station",
      duration_minutes: 60,
      cleanup_minutes: 15,
      price_pounds: "65.00",
      cancellation_terms: "Give 24 hours notice.",
      date: "2099-12-19",
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
    reason: "Approved for reset test",
    version: 1,
  });
});

after(async () => db.close());

test("platform owner resets transactional activity but preserves demo setup", async () => {
  const slot = (
    await availabilityFor(db, "alice", club, dog, service, "2099-12-19")
  ).slots[0];
  const checkout = await prepareServiceCheckout(
    db,
    "alice",
    club,
    {
      request_id: "30000000-0000-4000-8000-000000000001",
      dog_id: dog,
      service_id: service,
      starts_at: slot.starts_at,
      accepted_terms: "yes",
    },
    "http://127.0.0.1:3100",
    demoServiceGateway,
  );
  await completeDemoServiceCheckout(
    db,
    checkout.checkoutUrl.split("/").at(-1)!,
    "paid",
    demoEnvironment,
  );

  const result = await resetDemoActivity(
    db,
    "platform-owner",
    club,
    demoEnvironment,
  );
  assert.equal(result.bookings, 1);
  assert.equal(result.payments, 1);
  assert.ok(result.removedRecords >= 4);
  assert.equal(
    (
      await db.query("SELECT id FROM grooming_bookings WHERE club_id=$1", [
        club,
      ])
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query("SELECT id FROM grooming_services WHERE club_id=$1", [
        club,
      ])
    ).rows.length,
    1,
  );
  assert.equal(
    (await db.query("SELECT id FROM dogs WHERE club_id=$1", [club])).rows
      .length,
    2,
  );
});

test("reset rejects non-owners, production, Supabase and non-synthetic clubs", async () => {
  await assert.rejects(
    resetDemoActivity(db, "alice", club, demoEnvironment),
    /Platform access/,
  );
  await assert.rejects(
    resetDemoActivity(db, "platform-owner", club, {
      DOGCLUB_LOCAL_DEMO: "1",
      NODE_ENV: "production",
    }),
    /unavailable/,
  );
  await assert.rejects(
    resetDemoActivity(db, "platform-owner", club, {
      DOGCLUB_LOCAL_DEMO: "1",
      NODE_ENV: "test",
      DOGCLUB_DB: "supabase",
    }),
    /unavailable/,
  );
  await db.query(
    "INSERT INTO accounts(id,email,password_hash) VALUES('real-member','person@example.com','synthetic-test-hash')",
  );
  await db.query(
    "INSERT INTO memberships(club_id,account_id,role) VALUES($1,'real-member','member')",
    [club],
  );
  await assert.rejects(
    resetDemoActivity(db, "platform-owner", club, demoEnvironment),
    /only synthetic demo accounts/,
  );
});
