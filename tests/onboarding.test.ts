import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, scoped, type Db } from "../src/lib/database";
import {
  issueInvite,
  acceptInvite,
  listInvites,
  revokeInvite,
} from "../src/lib/onboarding";
import {
  submitApplication,
  reviewApplication,
  applicationsFor,
} from "../src/lib/applications";
import { clubsFor, saveDog, publicDog } from "../src/lib/dogs";
let db: Db;
const password = "SyntheticPassword-Only26";
const brand = {
  name: "Test Club",
  slug: "test-club",
  location: "Test town",
  tagline: "A test pack",
  colour: "#235448",
  emblem: "paw",
  avatar_tone: "sand",
  managerEmail: "operator@test.invalid",
};
let operator: string, member: string, club: string, dog: string;
before(async () => {
  db = await initialise(await PGlite.create());
});
after(async () => db.close());
test("new operator and member join, dog is submitted, manager approves, owner sees decision", async () => {
  const token = await issueInvite(db, "platform-owner", "operator", brand);
  const joined = await acceptInvite(db, token, {
    email: brand.managerEmail,
    password,
  });
  operator = joined.accountId;
  const clubs = await clubsFor(db, operator);
  assert.equal(clubs.length, 1);
  assert.equal(clubs[0].role, "manager");
  club = clubs[0].id;
  assert.deepEqual(await clubsFor(db, "platform-owner"), []);
  const m = await issueInvite(
    db,
    operator,
    "member",
    { managerEmail: "member@test.invalid" },
    club,
  );
  member = (
    await acceptInvite(db, m, { email: "member@test.invalid", password })
  ).accountId;
  assert.equal((await clubsFor(db, member))[0].role, "member");
  dog = await saveDog(db, member, club, undefined, {
    name: "Pilot",
    breed: "Terrier",
    bio: "Hello",
    avatar: "sand",
    audience: "public",
  });
  await submitApplication(db, member, club, dog, {
    emergency_contact: "Test human 07700 900000",
    handling_notes: "None known",
    version: 0,
    intent: "draft",
  });
  assert.equal((await applicationsFor(db, member, club))[0].status, "draft");
  assert.deepEqual(await applicationsFor(db, operator, club), []);
  await submitApplication(db, member, club, dog, {
    emergency_contact: "Test human 07700 900000",
    handling_notes: "None known",
    version: 1,
    intent: "submit",
  });
  const a = (await applicationsFor(db, operator, club))[0];
  assert.equal(a.status, "pending");
  await reviewApplication(db, operator, club, dog, {
    status: "approved",
    reason: "Reviewed for grooming only",
    version: a.version,
  });
  const approved = (await applicationsFor(db, member, club))[0];
  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewer_id, operator);
  assert.ok(approved.reviewed_at);
  assert.equal((await publicDog(db, club, dog))?.name, "Pilot");
  assert.ok(
    !Object.keys((await publicDog(db, club, dog))!).includes(
      "emergency_contact",
    ),
  );
  await assert.rejects(
    acceptInvite(db, token, { email: brand.managerEmail, password }, operator),
  );
});
test("only platform owners invite operators and only own-club managers invite members", async () => {
  await assert.rejects(
    issueInvite(db, "alice", "operator", { ...brand, slug: "wrong" }),
  );
  await assert.rejects(
    issueInvite(
      db,
      member,
      "member",
      { managerEmail: "other@test.invalid" },
      club,
    ),
  );
  await assert.rejects(
    issueInvite(
      db,
      "manager",
      "member",
      { managerEmail: "other@test.invalid" },
      club,
    ),
  );
  await assert.rejects(
    issueInvite(
      db,
      "platform-owner",
      "member",
      { managerEmail: "other@test.invalid" },
      club,
    ),
  );
});
test("token hashes only; revoked and expired invitations cannot create accounts", async () => {
  const token = await issueInvite(
    db,
    operator,
    "member",
    { managerEmail: "revoked@test.invalid" },
    club,
  );
  const rows = await listInvites(db, operator, "member", club);
  const i = rows.find((i) => i.email === "revoked@test.invalid")!;
  assert.notEqual(
    (
      await db.query<{ token_hash: string }>(
        "SELECT token_hash FROM onboarding_invites WHERE id=$1",
        [i.id],
      )
    ).rows[0].token_hash,
    token,
  );
  await revokeInvite(db, operator, i.id);
  await assert.rejects(
    acceptInvite(db, token, { email: "revoked@test.invalid", password }),
  );
  const expired = await issueInvite(
    db,
    operator,
    "member",
    { managerEmail: "expired@test.invalid" },
    club,
  );
  await db.query(
    "UPDATE onboarding_invites SET expires_at=now()-interval '1 second' WHERE email=$1",
    ["expired@test.invalid"],
  );
  await assert.rejects(
    acceptInvite(db, expired, { email: "expired@test.invalid", password }),
  );
  assert.equal(
    (
      await db.query(
        "SELECT id FROM accounts WHERE email IN ('revoked@test.invalid','expired@test.invalid')",
      )
    ).rows.length,
    0,
  );
});
test("existing accounts require authentication and accepting cannot overwrite passwords or escalate roles", async () => {
  const before = (
    await db.query<{ password_hash: string }>(
      "SELECT password_hash FROM accounts WHERE id='alice'",
    )
  ).rows[0].password_hash;
  const token = await issueInvite(
    db,
    operator,
    "member",
    { managerEmail: "alice@demo.invalid" },
    club,
  );
  await assert.rejects(
    acceptInvite(db, token, { email: "alice@demo.invalid", password }),
  );
  await assert.rejects(
    acceptInvite(db, token, { email: "alice@demo.invalid" }, "bea"),
  );
  await acceptInvite(db, token, { email: "alice@demo.invalid" }, "alice");
  assert.equal(
    (
      await db.query<{ password_hash: string }>(
        "SELECT password_hash FROM accounts WHERE id='alice'",
      )
    ).rows[0].password_hash,
    before,
  );
  assert.equal(
    (await clubsFor(db, "alice")).find((c) => c.id === club)?.role,
    "member",
  );
});
test("wrong email, issuer access removal and duplicate club roll back acceptance", async () => {
  const token = await issueInvite(
    db,
    operator,
    "member",
    { managerEmail: "intended@test.invalid" },
    club,
  );
  await assert.rejects(
    acceptInvite(db, token, { email: "wrong@test.invalid", password }),
  );
  const dup = await issueInvite(db, "platform-owner", "operator", {
    ...brand,
    managerEmail: "duplicate@test.invalid",
  });
  await assert.rejects(
    acceptInvite(db, dup, { email: "duplicate@test.invalid", password }),
  );
  assert.equal(
    (
      await db.query(
        "SELECT id FROM accounts WHERE email='duplicate@test.invalid'",
      )
    ).rows.length,
    0,
  );
  await db.query(
    "UPDATE memberships SET role='member' WHERE account_id=$1 AND club_id=$2",
    [operator, club],
  );
  await assert.rejects(
    acceptInvite(db, token, { email: "intended@test.invalid", password }),
  );
  await db.query(
    "UPDATE memberships SET role='manager' WHERE account_id=$1 AND club_id=$2",
    [operator, club],
  );
});
test("member and cross-club managers cannot decide or read care applications", async () => {
  await assert.rejects(
    reviewApplication(db, member, club, dog, {
      status: "suspended",
      reason: "Wrong actor",
      version: 2,
    }),
  );
  await assert.rejects(
    reviewApplication(db, "manager", club, dog, {
      status: "suspended",
      reason: "Wrong club",
      version: 2,
    }),
  );
  assert.deepEqual(await applicationsFor(db, "alice", club), []);
  assert.deepEqual(await applicationsFor(db, "manager", club), []);
  assert.deepEqual(await applicationsFor(db, "platform-owner", club), []);
  assert.deepEqual(
    await scoped(
      db,
      "",
      club,
      true,
      async (tx) => (await tx.query("SELECT * FROM dog_applications")).rows,
    ),
    [],
  );
  await assert.rejects(
    scoped(db, member, club, false, (tx) =>
      tx.query("UPDATE dog_applications SET status='approved'"),
    ),
  );
  await assert.rejects(
    scoped(db, member, club, false, (tx) =>
      tx.query("SELECT * FROM onboarding_invites"),
    ),
  );
});
test("stale decisions fail; suspension, information request and resubmission preserve audit", async () => {
  await assert.rejects(
    reviewApplication(db, operator, club, dog, {
      status: "suspended",
      reason: "Stale",
      version: 1,
    }),
  );
  await reviewApplication(db, operator, club, dog, {
    status: "suspended",
    reason: "Needs assessment",
    version: 3,
  });
  await assert.rejects(
    submitApplication(db, member, club, dog, {
      emergency_contact: "Test 07700",
      handling_notes: "None known",
      version: 4,
      intent: "submit",
    }),
  );
  await reviewApplication(db, operator, club, dog, {
    status: "needs-information",
    reason: "Please clarify",
    version: 4,
  });
  await submitApplication(db, member, club, dog, {
    emergency_contact: "Test 07700",
    handling_notes: "Clarified",
    version: 5,
    intent: "submit",
  });
  assert.equal((await applicationsFor(db, member, club))[0].status, "pending");
  assert.equal(
    (await db.query("SELECT * FROM application_events WHERE dog_id=$1", [dog]))
      .rows.length,
    6,
  );
});
test("simultaneous invitation claims create one account and one grant", async () => {
  const token = await issueInvite(
    db,
    operator,
    "member",
    { managerEmail: "race@test.invalid" },
    club,
  );
  const results = await Promise.allSettled([
    acceptInvite(db, token, { email: "race@test.invalid", password }),
    acceptInvite(db, token, { email: "race@test.invalid", password }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await db.query("SELECT id FROM accounts WHERE email='race@test.invalid'"))
      .rows.length,
    1,
  );
});
