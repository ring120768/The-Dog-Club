import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import {
  initialise,
  scoped,
  verifyPassword,
  hashPassword,
} from "../src/lib/database";
import { clubsFor, dogsFor, saveDog, publicDog } from "../src/lib/dogs";
let db: PGlite;
const bertie = "00000000-0000-4000-8000-000000000001";
const otis = "00000000-0000-4000-8000-000000000003";
const input = {
  name: "Scout",
  breed: "Terrier",
  bio: "A fictional dog",
  avatar: "sage",
  audience: "private",
};
before(async () => {
  db = await initialise(await PGlite.create());
});
after(async () => {
  await db.close();
});
test("known accounts see only their assigned club", async () => {
  assert.deepEqual(
    (await clubsFor(db, "alice")).map((c) => c.id),
    ["willow"],
  );
  assert.deepEqual(await clubsFor(db, "unknown"), []);
});
test("hostile tenant substitution returns no dogs, including public dogs", async () => {
  assert.deepEqual(await dogsFor(db, "coast-member", "willow"), []);
  assert.deepEqual(await dogsFor(db, "alice", "coast"), []);
});
test("cross-club insert is rejected by RLS even if service membership check is skipped", async () => {
  await assert.rejects(saveDog(db, "alice", "coast", undefined, input));
});
test("cross-club update cannot mutate another operator's dog", async () => {
  await assert.rejects(saveDog(db, "alice", "willow", otis, input));
  assert.equal((await dogsFor(db, "coast-member", "coast"))[0].name, "Otis");
});
test("members cannot alter another household's dog", async () => {
  await assert.rejects(saveDog(db, "bea", "willow", bertie, input));
});
test("managers cannot change a member's publication consent", async () => {
  await assert.rejects(saveDog(db, "manager", "willow", bertie, input));
});
test("private dogs are owner/manager-only; public projection revokes immediately", async () => {
  const id = await saveDog(db, "alice", "willow", undefined, input);
  assert.ok((await dogsFor(db, "alice", "willow")).some((d) => d.id === id));
  assert.ok(!(await dogsFor(db, "bea", "willow")).some((d) => d.id === id));
  assert.ok((await dogsFor(db, "manager", "willow")).some((d) => d.id === id));
  assert.equal(await publicDog(db, "willow", id), null);
  await saveDog(db, "alice", "willow", id, { ...input, audience: "public" });
  const published = await publicDog(db, "willow", id);
  assert.deepEqual(Object.keys(published!).sort(), [
    "avatar",
    "bio",
    "breed",
    "name",
    "photo_id",
  ]);
  assert.equal(await publicDog(db, "coast", id), null);
  await saveDog(db, "alice", "willow", id, input);
  assert.equal(await publicDog(db, "willow", id), null);
});
test("social visibility never grants care record access", async () => {
  const read = (account: string, publicOnly = false) =>
    scoped(
      db,
      account,
      "willow",
      publicOnly,
      async (tx) => (await tx.query("SELECT * FROM care_notes")).rows,
    );
  assert.equal((await read("alice")).length, 1);
  assert.equal((await read("manager")).length, 1);
  assert.equal((await read("bea")).length, 0);
  assert.equal((await read("", true)).length, 0);
});
test("restricted role cannot read credentials or sessions", async () => {
  await assert.rejects(
    scoped(db, "alice", "willow", false, (tx) =>
      tx.query("SELECT * FROM accounts"),
    ),
  );
  await assert.rejects(
    scoped(db, "alice", "willow", false, (tx) =>
      tx.query("SELECT * FROM sessions"),
    ),
  );
});
test("malformed values fail validation", async () => {
  await assert.rejects(
    saveDog(db, "alice", "willow", undefined, { ...input, name: "  " }),
  );
  await assert.rejects(
    saveDog(db, "alice", "willow", undefined, { ...input, audience: "all" }),
  );
});
test("password verification rejects incorrect credentials", () => {
  const hash = hashPassword("correct horse");
  assert.equal(verifyPassword("correct horse", hash), true);
  assert.equal(verifyPassword("wrong", hash), false);
});
