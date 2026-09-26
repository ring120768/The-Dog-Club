import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, scoped, type Db } from "../src/lib/database";
import { verifyPassword } from "../src/lib/passwords";
import {
  completePasswordRecovery,
  dismissPasswordRecovery,
  issuePasswordRecoveryLink,
  recoveryRequestsForPlatform,
  requestPasswordRecovery,
} from "../src/lib/recovery";

let db: Db;

before(async () => {
  db = await initialise(await PGlite.create());
});

after(async () => db.close());

test("public recovery requests do not reveal accounts and are rate limited", async () => {
  await requestPasswordRecovery(db, "missing@test.invalid");
  assert.equal(
    (
      await db.query(
        "SELECT id FROM password_recovery_requests WHERE account_id='missing'",
      )
    ).rows.length,
    0,
  );

  await Promise.all(
    Array.from({ length: 5 }, () =>
      requestPasswordRecovery(db, "ALICE@DEMO.INVALID"),
    ),
  );
  const requests = await recoveryRequestsForPlatform(db, "platform-owner");
  assert.equal(
    requests.filter((request) => request.email === "alice@demo.invalid").length,
    3,
  );
});

test("only a platform owner can inspect, issue or dismiss recovery work", async () => {
  const request = (
    await recoveryRequestsForPlatform(db, "platform-owner")
  ).find((item) => item.email === "alice@demo.invalid")!;
  await assert.rejects(recoveryRequestsForPlatform(db, "manager"));
  await assert.rejects(issuePasswordRecoveryLink(db, "manager", request.id));
  await assert.rejects(dismissPasswordRecovery(db, "manager", request.id));

  await requestPasswordRecovery(db, "bea@demo.invalid");
  const bea = (await recoveryRequestsForPlatform(db, "platform-owner")).find(
    (item) => item.email === "bea@demo.invalid",
  )!;
  await dismissPasswordRecovery(db, "platform-owner", bea.id);
  await assert.rejects(issuePasswordRecoveryLink(db, "platform-owner", bea.id));
});

test("recovery tokens are hashed, single-use and invalidate every session", async () => {
  const request = (
    await recoveryRequestsForPlatform(db, "platform-owner")
  ).find((item) => item.email === "alice@demo.invalid")!;
  const token = await issuePasswordRecoveryLink(
    db,
    "platform-owner",
    request.id,
  );
  const stored = (
    await db.query<{ token_hash: string }>(
      "SELECT token_hash FROM password_recovery_requests WHERE id=$1",
      [request.id],
    )
  ).rows[0].token_hash;
  assert.notEqual(stored, token);

  await db.query(
    "INSERT INTO sessions(token_hash,account_id,expires_at) VALUES('recovery-test-one','alice',now()+interval '1 hour'),('recovery-test-two','alice',now()+interval '1 hour')",
  );
  const newPassword = "A-New-Synthetic-Password-26";
  assert.equal(await completePasswordRecovery(db, token, newPassword), "alice");
  assert.equal(
    (await db.query("SELECT token_hash FROM sessions WHERE account_id='alice'"))
      .rows.length,
    0,
  );
  const hash = (
    await db.query<{ password_hash: string }>(
      "SELECT password_hash FROM accounts WHERE id='alice'",
    )
  ).rows[0].password_hash;
  assert.equal(verifyPassword(newPassword, hash), true);
  assert.equal(verifyPassword("PawsTogether!26", hash), false);
  await assert.rejects(completePasswordRecovery(db, token, newPassword));
});

test("new links expire older links and expired requests cannot reset", async () => {
  await requestPasswordRecovery(db, "coast@demo.invalid");
  const first = (await recoveryRequestsForPlatform(db, "platform-owner")).find(
    (item) => item.email === "coast@demo.invalid",
  )!;
  const oldToken = await issuePasswordRecoveryLink(
    db,
    "platform-owner",
    first.id,
  );
  await requestPasswordRecovery(db, "coast@demo.invalid");
  const newest = (await recoveryRequestsForPlatform(db, "platform-owner")).find(
    (item) => item.email === "coast@demo.invalid" && item.id !== first.id,
  )!;
  const newestToken = await issuePasswordRecoveryLink(
    db,
    "platform-owner",
    newest.id,
  );
  await assert.rejects(
    completePasswordRecovery(db, oldToken, "Another-Synthetic-Password-26"),
  );
  await db.query(
    "UPDATE password_recovery_requests SET expires_at=now()-interval '1 second' WHERE id=$1",
    [newest.id],
  );
  await assert.rejects(
    completePasswordRecovery(db, newestToken, "Another-Synthetic-Password-26"),
  );
});

test("recovery metadata is unavailable to the restricted club role", async () => {
  await assert.rejects(
    scoped(db, "alice", "willow", false, (tx) =>
      tx.query("SELECT * FROM password_recovery_requests"),
    ),
  );
  await assert.rejects(
    scoped(db, "manager", "willow", false, (tx) =>
      tx.query("SELECT * FROM password_recovery_events"),
    ),
  );
});
