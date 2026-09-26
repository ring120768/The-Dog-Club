import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "../src/lib/database";
import { testDatabase } from "./db";
import { dogsFor, publicDog } from "../src/lib/dogs";
import {
  blockCommunityProfile,
  blockedCommunityAccounts,
  moderationQueue,
  reportCommunityProfile,
  restoreCommunityProfile,
  reviewCommunityReport,
  searchCommunityDogs,
  unblockCommunityAccount,
} from "../src/lib/community";

const bertie = "00000000-0000-4000-8000-000000000001";
const mabel = "00000000-0000-4000-8000-000000000002";
const otis = "00000000-0000-4000-8000-000000000003";
let db: Db;

before(async () => {
  db = await testDatabase();
});
after(async () => db.close());

test("community dog search is trimmed, case insensitive and name only", () => {
  const dogs = [
    { name: "Mabel", bio: "Golden retriever" },
    { name: "Bertie", bio: "Mabel's friend" },
  ];
  assert.deepEqual(searchCommunityDogs(dogs, "  MAB  "), [dogs[0]]);
  assert.deepEqual(searchCommunityDogs(dogs, "retriever"), []);
  assert.equal(searchCommunityDogs(dogs, "").length, 2);
});

test("a block removes both households from member discovery but not an anonymous public link", async () => {
  assert.ok((await dogsFor(db, "alice", "willow")).some((d) => d.id === mabel));
  assert.ok((await dogsFor(db, "bea", "willow")).some((d) => d.id === bertie));
  await blockCommunityProfile(db, "alice", "willow", mabel);
  assert.ok(
    !(await dogsFor(db, "alice", "willow")).some((d) => d.id === mabel),
  );
  assert.ok(!(await dogsFor(db, "bea", "willow")).some((d) => d.id === bertie));
  assert.equal((await publicDog(db, "willow", mabel))?.name, "Mabel");
  assert.deepEqual(
    (await blockedCommunityAccounts(db, "alice", "willow")).map(
      (b) => b.display_label,
    ),
    ["Mabel’s human"],
  );
  await unblockCommunityAccount(db, "alice", "willow", "bea");
  assert.ok((await dogsFor(db, "alice", "willow")).some((d) => d.id === mabel));
});

test("reports are tenant scoped and only managers can review them", async () => {
  const report = await reportCommunityProfile(db, "alice", "willow", {
    dogId: mabel,
    target: "profile",
    reason: "privacy",
    details: "Synthetic privacy review",
  });
  assert.ok(
    (await moderationQueue(db, "manager", "willow")).some(
      (r) => r.id === report,
    ),
  );
  await assert.rejects(moderationQueue(db, "alice", "willow"), /Manager/);
  await assert.rejects(
    reviewCommunityReport(db, "alice", "willow", {
      reportId: report,
      decision: "hide",
      outcome: "Member cannot moderate",
    }),
    /Manager/,
  );
  await assert.rejects(
    reportCommunityProfile(db, "alice", "willow", {
      dogId: otis,
      target: "profile",
      reason: "other",
      details: "Cross-tenant attempt",
    }),
  );
});

test("manager hiding revokes member, public and photo projection while retaining owner review access", async () => {
  const report = await reportCommunityProfile(db, "alice", "willow", {
    dogId: mabel,
    target: "profile",
    reason: "false_information",
    details: "Synthetic moderation case",
  });
  await reviewCommunityReport(db, "manager", "willow", {
    reportId: report,
    decision: "hide",
    outcome: "Hidden pending an owner correction",
  });
  assert.ok(
    !(await dogsFor(db, "alice", "willow")).some((d) => d.id === mabel),
  );
  assert.equal(await publicDog(db, "willow", mabel), null);
  assert.ok((await dogsFor(db, "bea", "willow")).some((d) => d.id === mabel));
  assert.ok(
    (await dogsFor(db, "manager", "willow")).some((d) => d.id === mabel),
  );
  await restoreCommunityProfile(
    db,
    "manager",
    "willow",
    mabel,
    "Owner confirmed the correction",
  );
  assert.equal((await publicDog(db, "willow", mabel))?.name, "Mabel");
});
