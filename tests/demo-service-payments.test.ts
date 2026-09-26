import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { reviewApplication, submitApplication } from "../src/lib/applications";
import { availabilityFor, createBookingSetup } from "../src/lib/bookings";
import { initialise, type Db } from "../src/lib/database";
import {
  completeDemoServiceCheckout,
  demoServiceCheckoutFor,
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
const day = "2099-12-18";
let db: Db;
let service: string;

before(async () => {
  db = await initialise(await PGlite.create());
  await ensureDemoServicePaymentAccount(db, club, demoEnvironment);
  service = (
    await createBookingSetup(db, "manager", club, {
      service_name: "Demo spa treatment",
      resource_name: "Demo spa station",
      duration_minutes: 60,
      cleanup_minutes: 15,
      price_pounds: "72.50",
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
    reason: "Approved for demo paywall test",
    version: 1,
  });
});

after(async () => db.close());

async function startCheckout(requestId: string) {
  const slot = (await availabilityFor(db, "alice", club, dog, service, day))
    .slots[0];
  return prepareServiceCheckout(
    db,
    "alice",
    club,
    {
      request_id: requestId,
      dog_id: dog,
      service_id: service,
      starts_at: slot.starts_at,
      accepted_terms: "yes",
    },
    "http://127.0.0.1:3100",
    demoServiceGateway,
  );
}

test("local demo paywall confirms through the service-payment lifecycle", async () => {
  const checkout = await startCheckout("20000000-0000-4000-8000-000000000001");
  assert.match(
    checkout.checkoutUrl,
    /^http:\/\/127\.0\.0\.1:3100\/demo-checkout\//,
  );
  const checkoutId = checkout.checkoutUrl.split("/").at(-1)!;
  const beforePayment = await demoServiceCheckoutFor(
    db,
    checkoutId,
    demoEnvironment,
  );
  assert.equal(beforePayment?.serviceName, "Demo spa treatment");
  assert.equal(beforePayment?.dogName, "Bertie");
  assert.equal(beforePayment?.amountPence, 7250);
  assert.equal(beforePayment?.status, "open");

  assert.equal(
    await completeDemoServiceCheckout(db, checkoutId, "paid", demoEnvironment),
    "confirmed",
  );
  assert.equal(
    (await demoServiceCheckoutFor(db, checkoutId, demoEnvironment))?.status,
    "confirmed",
  );
  assert.deepEqual(
    (
      await db.query<{ status: string; amount_pence: number }>(
        "SELECT status,amount_pence FROM service_payments WHERE booking_id=$1",
        [checkout.bookingId],
      )
    ).rows[0],
    { status: "captured", amount_pence: 7250 },
  );
});

test("a declined demo payment releases its appointment hold", async () => {
  const checkout = await startCheckout("20000000-0000-4000-8000-000000000002");
  const checkoutId = checkout.checkoutUrl.split("/").at(-1)!;
  assert.equal(
    await completeDemoServiceCheckout(
      db,
      checkoutId,
      "failed",
      demoEnvironment,
    ),
    "failed",
  );
  assert.equal(
    (
      await db.query<{ status: string }>(
        "SELECT status FROM grooming_bookings WHERE id=$1",
        [checkout.bookingId],
      )
    ).rows[0].status,
    "cancelled",
  );
});

test("demo payment helpers fail closed in production", async () => {
  await assert.rejects(
    ensureDemoServicePaymentAccount(db, club, {
      DOGCLUB_LOCAL_DEMO: "1",
      NODE_ENV: "production",
    }),
    /unavailable/,
  );
});

test("demo checkout is explicit and never renders card inputs", async () => {
  const page = await readFile(
    new URL("../src/app/demo-checkout/[checkout]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /DEMONSTRATION · NO MONEY OR CARD DATA/);
  assert.match(page, /cannot charge anyone/);
  assert.doesNotMatch(page, /<input|name=["']card|autocomplete=["']cc-/i);
});
