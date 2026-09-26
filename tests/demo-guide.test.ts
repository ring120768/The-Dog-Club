import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, type Db } from "../src/lib/database";
import { demoGuideFor } from "../src/lib/demo-guide";

const demoEnvironment = {
  DOGCLUB_LOCAL_DEMO: "1",
  NODE_ENV: "test",
};
let db: Db;

before(async () => {
  db = await initialise(await PGlite.create());
});

after(async () => db.close());

test("platform owner receives a bounded synthetic walkthrough projection", async () => {
  const guide = await demoGuideFor(
    db,
    "platform-owner",
    "willow",
    demoEnvironment,
  );
  assert.equal(guide.club.name, "The Willow Club");
  assert.equal(guide.state.dogs, 2);
  assert.equal(guide.state.bookings, 0);
  assert.deepEqual(
    guide.accounts.map(({ email, role }) => ({ email, role })),
    [
      { email: "manager@demo.invalid", role: "manager" },
      { email: "alice@demo.invalid", role: "member" },
      { email: "bea@demo.invalid", role: "member" },
    ],
  );
});

test("guide rejects ordinary users, production and hosted PostgreSQL", async () => {
  await assert.rejects(
    demoGuideFor(db, "alice", "willow", demoEnvironment),
    /Platform access/,
  );
  await assert.rejects(
    demoGuideFor(db, "platform-owner", "willow", {
      DOGCLUB_LOCAL_DEMO: "1",
      NODE_ENV: "production",
    }),
    /unavailable/,
  );
  await assert.rejects(
    demoGuideFor(db, "platform-owner", "willow", {
      DOGCLUB_LOCAL_DEMO: "1",
      NODE_ENV: "test",
      DOGCLUB_DB: "supabase",
    }),
    /unavailable/,
  );
  await assert.rejects(
    demoGuideFor(db, "platform-owner", "willow", {
      DOGCLUB_LOCAL_DEMO: "1",
      NODE_ENV: "test",
      DOGCLUB_DB: "postgres",
    }),
    /unavailable/,
  );
});
