import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Db } from "../src/lib/database";
import { scoped } from "../src/lib/database";
import { clubsFor, dogsFor } from "../src/lib/dogs";
import {
  createMobileSession,
  mobileAccount,
  revokeMobileSession,
} from "../src/lib/mobile-session";
import { testDatabase } from "./db";
import { mobileCorsHeaders } from "../src/lib/mobile-http";

let db: Db;

before(async () => {
  db = await testDatabase();
});

after(async () => {
  await db.close();
});

test("mobile sign-in stores only a token hash and resolves the account", async () => {
  const session = await createMobileSession(db, {
    email: " ALICE@DEMO.INVALID ",
    password: "PawsTogether!26",
    platform: "ios",
  });
  assert.ok(session);
  assert.match(session.token, /^[a-f0-9]{64}$/);
  assert.equal(session.expiresInSeconds, 28_800);

  const stored = (
    await db.query<{ token_hash: string; platform: string }>(
      "SELECT token_hash,platform FROM mobile_sessions WHERE account_id='alice'",
    )
  ).rows.at(-1)!;
  assert.equal(
    stored.token_hash,
    createHash("sha256").update(session.token).digest("hex"),
  );
  assert.notEqual(stored.token_hash, session.token);
  assert.equal(stored.platform, "ios");
  assert.deepEqual(await mobileAccount(db, `Bearer ${session.token}`), {
    id: "alice",
    email: "alice@demo.invalid",
  });
});

test("invalid credentials and malformed payloads have the same empty result", async () => {
  assert.equal(
    await createMobileSession(db, {
      email: "alice@demo.invalid",
      password: "wrong",
      platform: "android",
    }),
    null,
  );
  assert.equal(
    await createMobileSession(db, {
      email: "nobody@demo.invalid",
      password: "wrong",
      platform: "android",
    }),
    null,
  );
  assert.equal(await createMobileSession(db, { email: "invalid" }), null);
});

test("a mobile account keeps the existing club and dog isolation boundary", async () => {
  const session = await createMobileSession(db, {
    email: "alice@demo.invalid",
    password: "PawsTogether!26",
    platform: "web_test",
  });
  assert.ok(session);
  const account = await mobileAccount(db, `Bearer ${session.token}`);
  assert.ok(account);
  assert.deepEqual(
    (await clubsFor(db, account.id)).map((club) => club.id),
    ["willow"],
  );
  assert.deepEqual(await dogsFor(db, account.id, "coast"), []);
  assert.ok(
    (await dogsFor(db, account.id, "willow")).some(
      (dog) => dog.name === "Bertie" && dog.can_manage,
    ),
  );
});

test("revoked and expired mobile sessions stop resolving immediately", async () => {
  const revoked = await createMobileSession(db, {
    email: "bea@demo.invalid",
    password: "PawsTogether!26",
    platform: "android",
  });
  assert.ok(revoked);
  assert.equal(await revokeMobileSession(db, `Bearer ${revoked.token}`), true);
  assert.equal(await mobileAccount(db, `Bearer ${revoked.token}`), null);

  const expired = await createMobileSession(db, {
    email: "coast@demo.invalid",
    password: "PawsTogether!26",
    platform: "ios",
  });
  assert.ok(expired);
  await db.query(
    "UPDATE mobile_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
    [createHash("sha256").update(expired.token).digest("hex")],
  );
  assert.equal(await mobileAccount(db, `Bearer ${expired.token}`), null);
});

test("the restricted tenant role cannot inspect mobile sessions", async () => {
  await assert.rejects(
    scoped(db, "alice", "willow", false, (tx) =>
      tx.query("SELECT * FROM mobile_sessions"),
    ),
  );
});

test("mobile CORS allows only native or explicitly configured origins", () => {
  assert.equal(
    mobileCorsHeaders(
      new Request("https://example.test", {
        headers: { origin: "capacitor://localhost" },
      }),
    )?.get("Access-Control-Allow-Origin"),
    "capacitor://localhost",
  );
  assert.equal(
    mobileCorsHeaders(
      new Request("https://example.test", {
        headers: { origin: "https://hostile.example" },
      }),
    ),
    null,
  );
});
