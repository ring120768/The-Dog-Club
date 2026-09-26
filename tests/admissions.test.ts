import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, type Db } from "../src/lib/database";
import {
  admissionDashboard,
  admissionPassLookup,
  checkInAdmission,
  checkOutAdmission,
  configureAdmission,
  ensureAdmissionPass,
  setDogAdmissionEligibility,
} from "../src/lib/admissions";
import {
  activateDemoMembership,
  createMembershipPlan,
} from "../src/lib/memberships";

let db: Db;
let alicePass: string;
let beaPass: string;
const club = "willow";
const bertie = "00000000-0000-4000-8000-000000000001";
const mabel = "00000000-0000-4000-8000-000000000002";

const dateOffset = (days: number) => {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

before(async () => {
  db = await initialise(await PGlite.create());
  const plan = await createMembershipPlan(db, "manager", club, {
    name: "Admission test",
    monthly_price_pounds: "29.00",
    inclusions: "Club admission subject to capacity.",
    limits_text: "Staff-assisted entry.",
    additional_dog_terms: "Approved dogs only.",
    renewal_terms: "Renews monthly.",
    cancellation_terms: "Runs to period end.",
    grooming_credits_per_period: 0,
  });
  for (const account of ["alice", "bea"])
    await activateDemoMembership(db, "manager", club, {
      plan_id: plan,
      account_id: account,
      period_starts_on: dateOffset(-1),
      period_ends_on: dateOffset(30),
    });
  alicePass = (await ensureAdmissionPass(db, "alice", club)).code;
  beaPass = (await ensureAdmissionPass(db, "bea", club)).code;
});

after(async () => db.close());

test("opaque passes expose no profile or care data and remain household scoped", async () => {
  assert.match(alicePass, /^[A-F0-9]{16}$/);
  assert.doesNotMatch(alicePass, /alice|bertie|demo/i);
  const alice = await admissionDashboard(db, "alice", club);
  const bea = await admissionDashboard(db, "bea", club);
  assert.equal(alice.pass?.code, alicePass);
  assert.equal(bea.pass?.code, beaPass);
  assert.deepEqual(
    alice.eligibilities.map((item) => item.dog_id),
    [bertie],
  );
  assert.deepEqual(
    bea.eligibilities.map((item) => item.dog_id),
    [mabel],
  );
  await assert.rejects(
    admissionPassLookup(db, "alice", club, alicePass),
    /manager access/i,
  );
  const grouped = alicePass.match(/.{1,4}/g)!.join(" ");
  assert.equal(
    (await admissionPassLookup(db, "manager", club, grouped)).pass.code,
    alicePass,
  );
});

test("membership, capacity configuration and dog-specific approval are required", async () => {
  await assert.rejects(
    checkInAdmission(db, "manager", club, {
      code: alicePass,
      human_count: 1,
      dog_ids: [bertie],
    }),
    /configure venue capacity/i,
  );
  await configureAdmission(db, "manager", club, {
    human_capacity: 1,
    dog_capacity: 1,
  });
  await assert.rejects(
    checkInAdmission(db, "manager", club, {
      code: alicePass,
      human_count: 1,
      dog_ids: [bertie],
    }),
    /admission approval/i,
  );
  await setDogAdmissionEligibility(db, "manager", club, bertie, {
    status: "approved",
    reason: "Approved for the admission fixture",
  });
  const events = await db.query(
    "SELECT * FROM dog_admission_events WHERE club_id=$1 AND dog_id=$2",
    [club, bertie],
  );
  assert.equal(events.rows.length, 1);
  assert.equal(events.rows[0].to_status, "approved");
});

test("duplicate and concurrent check-ins never overcount capacity", async () => {
  await setDogAdmissionEligibility(db, "manager", club, mabel, {
    status: "approved",
    reason: "Approved for the concurrency fixture",
  });
  const attempts = await Promise.allSettled([
    checkInAdmission(db, "manager", club, {
      code: alicePass,
      human_count: 1,
      dog_ids: [bertie],
    }),
    checkInAdmission(db, "manager", club, {
      code: beaPass,
      human_count: 1,
      dog_ids: [mabel],
    }),
  ]);
  assert.equal(
    attempts.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.match(
    String(attempts.find((result) => result.status === "rejected")?.reason),
    /capacity is currently full/i,
  );
  const successful = attempts.find((result) => result.status === "fulfilled");
  assert.ok(successful && successful.status === "fulfilled");
  const admittedCode =
    (await admissionDashboard(db, "manager", club)).visits.find(
      (visit) => visit.id === successful.value.id,
    )?.account_id === "alice"
      ? alicePass
      : beaPass;
  const repeated = await checkInAdmission(db, "manager", club, {
    code: admittedCode,
    human_count: 2,
    dog_ids: [],
  });
  assert.equal(repeated.id, successful.value.id);
  const dashboard = await admissionDashboard(db, "manager", club);
  assert.equal(dashboard.occupancy.humans, 1);
  assert.equal(dashboard.occupancy.dogs, 1);
  assert.equal(
    dashboard.visits.filter((visit) => visit.status === "active").length,
    1,
  );
  await assert.rejects(
    configureAdmission(db, "manager", club, {
      human_capacity: 1,
      dog_capacity: 0,
    }),
    /lower than the current occupancy/i,
  );
});

test("checkout is idempotent, frees capacity and preserves tenant boundaries", async () => {
  const before = await admissionDashboard(db, "manager", club);
  const active = before.visits.find((visit) => visit.status === "active")!;
  await checkOutAdmission(db, "manager", club, active.id);
  await checkOutAdmission(db, "manager", club, active.id);
  const nextCode = active.account_id === "alice" ? beaPass : alicePass;
  const nextDog = active.account_id === "alice" ? mabel : bertie;
  const next = await checkInAdmission(db, "manager", club, {
    code: nextCode,
    human_count: 1,
    dog_ids: [nextDog],
  });
  assert.ok(next.id);
  const checkoutEvents = await db.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM admission_events WHERE visit_id=$1 AND action='admission.checked_out'",
    [active.id],
  );
  assert.equal(checkoutEvents.rows[0].count, 1);
  assert.equal(
    (await admissionDashboard(db, "coast-member", "coast")).visits.length,
    0,
  );
  await assert.rejects(
    checkOutAdmission(db, "coast-member", "coast", next.id),
    /manager access/i,
  );
  await assert.rejects(
    configureAdmission(db, "alice", club, {
      human_capacity: 10,
      dog_capacity: 10,
    }),
    /manager access/i,
  );
});
