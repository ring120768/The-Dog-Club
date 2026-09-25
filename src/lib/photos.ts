import sharp from "sharp";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scoped } from "./database";
import { MAX_PHOTO_BYTES, type PhotoScope } from "./photo-contract";

export class PhotoValidationError extends Error {}
export type NormalisedPhoto = {
  content: Buffer;
  width: number;
  height: number;
};
export type PhotoChange =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "replace"; photo: NormalisedPhoto };
const MAX_PIXELS = 20_000_000;

export async function normalisePhoto(
  bytes: Uint8Array,
): Promise<NormalisedPhoto> {
  if (!bytes.byteLength || bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new PhotoValidationError("Choose a photo no larger than 5 MB.");
  }
  // PNG loaders may expose only the first APNG frame. Detect its animation-control
  // chunk explicitly so an animated PNG cannot silently become a still upload.
  const input = Buffer.from(bytes);
  if (
    input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    for (let offset = 8; offset + 12 <= input.length;) {
      const length = input.readUInt32BE(offset);
      if (offset + length + 12 > input.length) break;
      if (input.toString("ascii", offset + 4, offset + 8) === "acTL") {
        throw new PhotoValidationError(
          "Choose a still photo rather than an animation.",
        );
      }
      offset += length + 12;
    }
  }
  try {
    const pipeline = sharp(bytes, {
      limitInputPixels: MAX_PIXELS,
      failOn: "warning",
      animated: true,
    });
    const metadata = await pipeline.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format)
    ) {
      throw new PhotoValidationError(
        "Choose a JPEG, PNG or WebP photo. HEIC and SVG files are not supported yet.",
      );
    }
    if ((metadata.pages ?? 1) !== 1) {
      throw new PhotoValidationError(
        "Choose a still photo rather than an animation.",
      );
    }
    // No keepMetadata/withMetadata: source EXIF, GPS, XMP and filename are never persisted.
    const { data, info } = await pipeline
      .autoOrient()
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > 1572864)
      throw new PhotoValidationError(
        "This photo is too complex to save. Please choose a smaller image.",
      );
    return { content: data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof PhotoValidationError) throw error;
    throw new PhotoValidationError(
      "We couldn’t read that photo. Use a valid JPEG, PNG or WebP under 5 MB and 20 megapixels.",
    );
  }
}

export async function photoChangeFromForm(
  form: FormData,
): Promise<PhotoChange> {
  const file = form.get("photo");
  const remove = form.get("removePhoto") === "on";
  if (file !== null && !(file instanceof File))
    throw new PhotoValidationError("Please choose a photo file.");
  if (file instanceof File && file.size > 0) {
    if (remove)
      throw new PhotoValidationError(
        "Choose a replacement photo or remove the current one, not both.",
      );
    if (file.size > MAX_PHOTO_BYTES)
      throw new PhotoValidationError("Choose a photo no larger than 5 MB.");
    return {
      kind: "replace",
      photo: await normalisePhoto(new Uint8Array(await file.arrayBuffer())),
    };
  }
  return { kind: remove ? "remove" : "keep" };
}

export async function applyPhotoChange(
  tx: Transaction,
  club: string,
  account: string,
  dogId: string,
  change: PhotoChange,
) {
  if (change.kind === "keep") return;
  // Executed in the same transaction as the authorised dog write; RLS independently checks ownership.
  await tx.query("DELETE FROM dog_photos WHERE club_id=$1 AND dog_id=$2", [
    club,
    dogId,
  ]);
  if (change.kind === "replace") {
    await tx.query(
      "INSERT INTO dog_photos(id,club_id,dog_id,content,width,height) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        club,
        dogId,
        change.photo.content,
        change.photo.width,
        change.photo.height,
      ],
    );
  }
  await tx.query(
    "INSERT INTO audit_events(club_id,actor_id,dog_id,action) VALUES($1,$2,$3,$4)",
    [
      club,
      account,
      dogId,
      change.kind === "remove" ? "photo.removed" : "photo.replaced",
    ],
  );
}

export async function readPhoto(
  db: PGlite,
  account: string | null,
  scope: PhotoScope,
  club: string,
  dogId: string,
  photoId: string,
) {
  if (
    !z.uuid().safeParse(dogId).success ||
    !z.uuid().safeParse(photoId).success
  )
    return null;
  if (scope === "members" && !account) return null;
  return scoped(
    db,
    scope === "public" ? "" : account!,
    club,
    scope === "public",
    async (tx) => {
      const row = (
        await tx.query<{ content: Uint8Array }>(
          "SELECT content FROM dog_photos WHERE club_id=$1 AND dog_id=$2 AND id=$3",
          [club, dogId, photoId],
        )
      ).rows[0];
      return row?.content ?? null;
    },
  );
}

export function photoResponse(content: Uint8Array | null): Response {
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    Vary: "Cookie",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Robots-Tag": "noindex",
  };
  if (!content)
    return new Response("Photo unavailable", { status: 404, headers });
  return new Response(new Uint8Array(content), {
    headers: {
      ...headers,
      "Content-Type": "image/webp",
      "Content-Disposition": 'inline; filename="dog-profile.webp"',
    },
  });
}
