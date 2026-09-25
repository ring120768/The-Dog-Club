import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import sharp from "sharp";
import { initialise, scoped } from "../src/lib/database";
import { migrate } from "../src/lib/migrations";
import { dogsFor, saveDog } from "../src/lib/dogs";
import {
  normalisePhoto,
  readPhoto,
  photoChangeFromForm,
  photoResponse,
  type NormalisedPhoto,
} from "../src/lib/photos";
import { MAX_PHOTO_BYTES } from "../src/lib/photo-contract";
let db: PGlite;
let photo: NormalisedPhoto;
const input = {
  name: "Photo test dog",
  breed: "Terrier",
  bio: "Synthetic test fixture",
  avatar: "sand",
  audience: "private",
};
before(async () => {
  db = await initialise(await PGlite.create());
  photo = await normalisePhoto(
    await sharp({
      create: { width: 48, height: 32, channels: 3, background: "#235448" },
    })
      .png()
      .toBuffer(),
  );
});
after(async () => {
  await db.close();
});
async function newDog(audience = "private") {
  const id = await saveDog(
    db,
    "alice",
    "willow",
    undefined,
    { ...input, audience },
    { kind: "replace", photo },
  );
  const dog = (await dogsFor(db, "alice", "willow")).find((d) => d.id === id)!;
  return { id, photoId: dog.photo_id! };
}

test("normalisation rotates, bounds dimensions and removes identifying metadata", async () => {
  const source = await sharp({
    create: { width: 1600, height: 800, channels: 3, background: "#235448" },
  })
    .withMetadata({ orientation: 6 })
    .withExif({ IFD0: { Artist: "Synthetic private owner" } })
    .jpeg()
    .toBuffer();
  const before = await sharp(source).metadata();
  assert.ok(before.exif);
  const result = await normalisePhoto(source);
  const metadata = await sharp(result.content).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 600);
  assert.equal(metadata.height, 1200);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);
  assert.equal(metadata.icc, undefined);
  assert.equal(metadata.orientation, undefined);
});
test("rejects empty, oversized, invalid and unsupported bytes", async () => {
  for (const bytes of [
    new Uint8Array(),
    new Uint8Array(MAX_PHOTO_BYTES + 1),
    Buffer.from("not an image"),
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    ),
  ])
    await assert.rejects(normalisePhoto(bytes));
});
test("rejects compressed images over the decoded pixel limit", async () => {
  const large = await sharp({
    create: { width: 5000, height: 5000, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  assert.ok(large.length < MAX_PHOTO_BYTES);
  await assert.rejects(normalisePhoto(large));
});
test("rejects animated WebP", async () => {
  const animated = await sharp(
    Buffer.concat([Buffer.alloc(2 * 2 * 3, 60), Buffer.alloc(2 * 2 * 3, 200)]),
    {
      raw: { width: 2, height: 4, channels: 3, pageHeight: 2 },
    },
  )
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  await assert.rejects(normalisePhoto(animated));
});
test("validates bytes rather than trusting declared MIME type or filename", async () => {
  const form = new FormData();
  form.set(
    "photo",
    new File([new Uint8Array(photo.content)], "wrong-extension.txt", {
      type: "text/plain",
    }),
  );
  assert.equal((await photoChangeFromForm(form)).kind, "replace");
  form.set(
    "photo",
    new File(["not a photo"], "dog.jpg", { type: "image/jpeg" }),
  );
  await assert.rejects(photoChangeFromForm(form));
});
test("form distinguishes keep, remove and replace and rejects conflicting intent", async () => {
  const form = new FormData();
  assert.deepEqual(await photoChangeFromForm(form), { kind: "keep" });
  form.set("removePhoto", "on");
  assert.deepEqual(await photoChangeFromForm(form), { kind: "remove" });
  form.set("photo", new File([new Uint8Array(photo.content)], "dog.webp"));
  await assert.rejects(photoChangeFromForm(form));
  form.delete("removePhoto");
  form.set("photo", "a forged string");
  await assert.rejects(photoChangeFromForm(form));
});
test("private photos are readable by owner and club manager only", async () => {
  const { id, photoId } = await newDog();
  assert.ok(await readPhoto(db, "alice", "members", "willow", id, photoId));
  assert.ok(await readPhoto(db, "manager", "members", "willow", id, photoId));
  for (const account of ["bea", "coast-member", null])
    assert.equal(
      await readPhoto(db, account, "members", "willow", id, photoId),
      null,
    );
  assert.equal(
    await readPhoto(db, "alice", "public", "willow", id, photoId),
    null,
  );
});
test("member photos stay within the club and cannot be fetched anonymously", async () => {
  const { id, photoId } = await newDog("members");
  assert.ok(await readPhoto(db, "bea", "members", "willow", id, photoId));
  assert.equal(
    await readPhoto(db, "coast-member", "members", "willow", id, photoId),
    null,
  );
  assert.equal(
    await readPhoto(db, null, "public", "willow", id, photoId),
    null,
  );
});
test("public paths ignore visitor identity, then immediately revoke on audience change", async () => {
  const { id, photoId } = await newDog("public");
  assert.ok(await readPhoto(db, null, "public", "willow", id, photoId));
  assert.ok(
    await readPhoto(db, "coast-member", "public", "willow", id, photoId),
  );
  await saveDog(db, "alice", "willow", id, { ...input, audience: "members" });
  assert.equal(
    await readPhoto(db, null, "public", "willow", id, photoId),
    null,
  );
  assert.ok(await readPhoto(db, "bea", "members", "willow", id, photoId));
  await saveDog(db, "alice", "willow", id, input);
  assert.equal(
    await readPhoto(db, "bea", "members", "willow", id, photoId),
    null,
  );
  assert.ok(await readPhoto(db, "alice", "members", "willow", id, photoId));
});
test("tenant, dog and photo IDs cannot be substituted to obtain bytes", async () => {
  const { id, photoId } = await newDog("public");
  const second = await newDog("public");
  assert.equal(await readPhoto(db, null, "public", "coast", id, photoId), null);
  assert.equal(
    await readPhoto(db, null, "public", "willow", second.id, photoId),
    null,
  );
  assert.equal(
    await readPhoto(db, null, "public", "willow", id, second.photoId),
    null,
  );
  assert.equal(
    await readPhoto(db, null, "public", "willow", "../bad", photoId),
    null,
  );
});
test("replace invalidates old URLs, keep retains photo and removal clears access", async () => {
  const { id, photoId } = await newDog("public");
  await saveDog(
    db,
    "alice",
    "willow",
    id,
    { ...input, audience: "public" },
    { kind: "replace", photo },
  );
  const replacement = (await dogsFor(db, "alice", "willow")).find(
    (d) => d.id === id,
  )!.photo_id!;
  assert.notEqual(replacement, photoId);
  assert.equal(
    await readPhoto(db, null, "public", "willow", id, photoId),
    null,
  );
  assert.ok(await readPhoto(db, null, "public", "willow", id, replacement));
  await saveDog(db, "alice", "willow", id, { ...input, audience: "public" });
  assert.equal(
    (await dogsFor(db, "alice", "willow")).find((d) => d.id === id)!.photo_id,
    replacement,
  );
  await saveDog(
    db,
    "alice",
    "willow",
    id,
    { ...input, audience: "public" },
    { kind: "remove" },
  );
  assert.equal(
    (await dogsFor(db, "alice", "willow")).find((d) => d.id === id)!.photo_id,
    null,
  );
  assert.equal(
    await readPhoto(db, null, "public", "willow", id, replacement),
    null,
  );
});
test("another member or manager cannot change photos even through raw SQL", async () => {
  const { id, photoId } = await newDog("members");
  for (const account of ["bea", "manager", "coast-member"]) {
    const result = await scoped(db, account, "willow", false, (tx) =>
      tx.query("DELETE FROM dog_photos WHERE dog_id=$1", [id]),
    );
    assert.equal(result.affectedRows, 0);
    await assert.rejects(
      scoped(db, account, "willow", false, (tx) =>
        tx.query("INSERT INTO dog_photos VALUES($1,$2,$3,$4,$5,$6)", [
          randomUUID(),
          "willow",
          id,
          photo.content,
          photo.width,
          photo.height,
        ]),
      ),
    );
  }
  assert.ok(await readPhoto(db, "alice", "members", "willow", id, photoId));
});
test("failed photo save rolls back profile, visibility, prior photo and audit writes", async () => {
  const { id, photoId } = await newDog();
  const before = await db.query<{ count: string }>(
    "SELECT count(*) FROM audit_events WHERE dog_id=$1",
    [id],
  );
  await assert.rejects(
    saveDog(
      db,
      "alice",
      "willow",
      id,
      { ...input, name: "Must roll back", audience: "public" },
      { kind: "replace", photo: { ...photo, width: 0 } },
    ),
  );
  const dog = (await dogsFor(db, "alice", "willow")).find((d) => d.id === id)!;
  assert.equal(dog.name, input.name);
  assert.equal(dog.audience, "private");
  assert.equal(dog.photo_id, photoId);
  assert.ok(await readPhoto(db, "alice", "members", "willow", id, photoId));
  assert.deepEqual(
    (await db.query("SELECT count(*) FROM audit_events WHERE dog_id=$1", [id]))
      .rows,
    before.rows,
  );
});
test("removing club membership immediately revokes private photo access", async () => {
  const { id, photoId } = await newDog("members");
  await db.query("DELETE FROM memberships WHERE account_id='manager'");
  assert.equal(
    await readPhoto(db, "manager", "members", "willow", id, photoId),
    null,
  );
  await db.query(
    "INSERT INTO memberships VALUES('willow','manager','manager')",
  );
});
test("image responses never permit caching and denial returns no image data", async () => {
  for (const response of [photoResponse(photo.content), photoResponse(null)]) {
    assert.match(response.headers.get("cache-control")!, /no-store/);
    assert.equal(response.headers.get("vary"), "Cookie");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  }
  assert.equal(photoResponse(null).status, 404);
  assert.equal(
    photoResponse(photo.content).headers.get("content-type"),
    "image/webp",
  );
  assert.equal(
    (await photoResponse(photo.content).arrayBuffer()).byteLength,
    photo.content.length,
  );
});
test("migration upgrades the old schema without losing records and runs once", async () => {
  const old = await PGlite.create();
  try {
    await old.exec(await readFile("src/lib/schema.sql", "utf8"));
    await old.exec(
      "INSERT INTO clubs VALUES('legacy','legacy','Existing Club','Existing tagline','#235448','London')",
    );
    await migrate(old);
    await migrate(old);
    assert.equal(
      (
        await old.query<{ name: string }>(
          "SELECT name FROM clubs WHERE id='legacy'",
        )
      ).rows[0].name,
      "Existing Club",
    );
    assert.equal(
      (await old.query("SELECT * FROM schema_migrations")).rows.length,
      2,
    );
  } finally {
    await old.close();
  }
});

test("rejects APNG animation-control chunks even when the decoder exposes one frame", async () => {
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const chunk = Buffer.alloc(20);
  chunk.writeUInt32BE(8, 0);
  chunk.write("acTL", 4);
  chunk.writeUInt32BE(2, 8);
  chunk.writeUInt32BE(0, 12);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 16)), 16);
  const animated = Buffer.concat([
    png.subarray(0, 33),
    chunk,
    png.subarray(33),
  ]);
  await assert.rejects(normalisePhoto(animated), /still photo/);
});
