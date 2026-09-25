import { applyPhotoChange, type PhotoChange } from "./photos";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scoped, type Db, type Queryable } from "./database";
export type Club = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  colour: string;
  location: string;
  emblem: "paw" | "dog" | "heart" | "sparkles";
  avatar_tone: "sand" | "sage" | "rose";
  version: number;
};
export type Dog = {
  id: string;
  club_id: string;
  owner_id: string;
  photo_id: string | null;
  name: string;
  breed: string;
  bio: string;
  avatar: "sand" | "sage" | "rose";
  audience: "private" | "members" | "public";
};
export const dogInput = z.object({
  name: z.string().trim().min(1, "Give your dog a name.").max(60),
  breed: z.string().trim().max(80),
  bio: z.string().trim().max(400),
  avatar: z.enum(["sand", "sage", "rose"]),
  audience: z.enum(["private", "members", "public"]),
});
export async function clubsFor(db: Db, account: string) {
  return scoped(
    db,
    account,
    "",
    false,
    async (tx) =>
      (
        await tx.query<Club & { role: string }>(
          "SELECT c.*, m.role FROM clubs c JOIN memberships m ON c.id=m.club_id ORDER BY c.name",
        )
      ).rows,
  );
}
export async function dogsFor(db: Db, account: string, club: string) {
  return scoped(
    db,
    account,
    club,
    false,
    async (tx) =>
      (
        await tx.query<Dog>(
          "SELECT d.*, p.id AS photo_id FROM dogs d LEFT JOIN dog_photos p ON p.club_id=d.club_id AND p.dog_id=d.id ORDER BY d.name",
        )
      ).rows,
  );
}
export async function saveDog(
  db: Db,
  account: string,
  club: string,
  id: string | undefined,
  input: unknown,
  photoChange: PhotoChange = { kind: "keep" },
) {
  const data = dogInput.parse(input);
  const dogId = id ? z.uuid().parse(id) : randomUUID();
  return scoped(db, account, club, false, async (tx) => {
    const values = [
      data.name,
      data.breed,
      data.bio,
      data.avatar,
      data.audience,
      club,
      account,
      dogId,
    ];
    const result = id
      ? await tx.query(
          "UPDATE dogs SET name=$1,breed=$2,bio=$3,avatar=$4,audience=$5 WHERE club_id=$6 AND owner_id=$7 AND id=$8 RETURNING id",
          values,
        )
      : await tx.query(
          "INSERT INTO dogs(name,breed,bio,avatar,audience,club_id,owner_id,id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
          values,
        );
    if (result.rows.length !== 1)
      throw new Error(
        "This profile is unavailable or you do not have permission to edit it.",
      );
    await tx.query(
      "INSERT INTO audit_events(club_id,actor_id,dog_id,action) VALUES($1,$2,$3,$4)",
      [club, account, dogId, id ? "profile.updated" : "profile.created"],
    );
    await applyPhotoChange(tx, club, account, dogId, photoChange);
    return dogId;
  });
}
export async function publicDog(db: Db, club: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return scoped(
    db,
    "",
    club,
    true,
    async (tx) =>
      (
        await tx.query<
          Pick<Dog, "name" | "breed" | "bio" | "avatar" | "photo_id">
        >(
          "SELECT d.name,d.breed,d.bio,d.avatar,p.id AS photo_id FROM dogs d LEFT JOIN dog_photos p ON p.club_id=d.club_id AND p.dog_id=d.id WHERE d.id=$1",
          [id],
        )
      ).rows[0] ?? null,
  );
}
