import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, type Db } from "../src/lib/database";
import { issueInvite, acceptInvite } from "../src/lib/onboarding";
import { createBookingSetup } from "../src/lib/bookings";
import { clubsFor } from "../src/lib/dogs";
import { operatorReadinessForPlatform } from "../src/lib/operator-readiness";

let db: Db;
const password = "SyntheticPassword-Only26";

const operators = [
  {
    name: "Park Paws",
    slug: "park-paws-proof",
    location: "Richmond, London",
    tagline: "Room to roam together.",
    colour: "#753f32",
    emblem: "dog",
    avatar_tone: "rose",
    managerEmail: "park-manager@test.invalid",
    service: "Park pamper",
    station: "Garden salon",
    price: "58.00",
  },
  {
    name: "Harbour Hounds",
    slug: "harbour-hounds-proof",
    location: "Hove, Sussex",
    tagline: "Sea air and smart coats.",
    colour: "#2e526a",
    emblem: "sparkles",
    avatar_tone: "sage",
    managerEmail: "harbour-manager@test.invalid",
    service: "Coastal tidy",
    station: "Blue room",
    price: "64.00",
  },
] as const;

before(async () => {
  db = await initialise(await PGlite.create());
});

after(async () => db.close());

test("two differently branded operators become demo-ready through the same onboarding and setup flow", async () => {
  const created: Array<{ club: string; manager: string }> = [];

  for (const operator of operators) {
    const token = await issueInvite(db, "platform-owner", "operator", operator);
    const accepted = await acceptInvite(db, token, {
      email: operator.managerEmail,
      password,
    });
    const club = (await clubsFor(db, accepted.accountId))[0];
    assert.equal(club.name, operator.name);
    assert.equal(club.colour, operator.colour);
    assert.equal(club.emblem, operator.emblem);

    const initial = (
      await operatorReadinessForPlatform(db, "platform-owner", [club.id])
    )[0];
    assert.equal(initial.complete, 2);
    assert.equal(initial.ready, false);

    await createBookingSetup(db, accepted.accountId, club.id, {
      service_name: operator.service,
      resource_name: operator.station,
      duration_minutes: 60,
      cleanup_minutes: 15,
      price_pounds: operator.price,
      membership_credit_eligible: "no",
      membership_credit_cost: 1,
      cancellation_terms: "Cancel at least 24 hours before the appointment.",
      date: "2099-12-01",
      starts_at: "09:00",
      ends_at: "17:00",
      break_starts_at: "12:30",
      break_ends_at: "13:00",
      staff_id: accepted.accountId,
    });
    created.push({ club: club.id, manager: accepted.accountId });
  }

  const readiness = await operatorReadinessForPlatform(
    db,
    "platform-owner",
    created.map((item) => item.club),
  );
  assert.equal(readiness.length, 2);
  assert.ok(readiness.every((item) => item.ready && item.complete === 5));

  const catalogue = await db.query<{
    club_id: string;
    service_name: string;
    resource_name: string;
  }>(
    `SELECT s.club_id,s.name AS service_name,r.name AS resource_name
     FROM grooming_services s JOIN grooming_resources r ON r.club_id=s.club_id
     WHERE s.club_id=ANY($1::text[]) ORDER BY s.club_id`,
    [created.map((item) => item.club)],
  );
  assert.deepEqual(
    new Set(catalogue.rows.map((item) => item.service_name)),
    new Set(operators.map((item) => item.service)),
  );
  assert.deepEqual(
    new Set(catalogue.rows.map((item) => item.resource_name)),
    new Set(operators.map((item) => item.station)),
  );
});

test("readiness rejects tenant users and exposes configuration counts only", async () => {
  await assert.rejects(
    operatorReadinessForPlatform(db, "alice"),
    /Platform access is required/,
  );
  const [summary] = await operatorReadinessForPlatform(db, "platform-owner", [
    "willow",
  ]);
  assert.deepEqual(Object.keys(summary).sort(), [
    "checks",
    "club_id",
    "complete",
    "counts",
    "ready",
    "total",
  ]);
});
