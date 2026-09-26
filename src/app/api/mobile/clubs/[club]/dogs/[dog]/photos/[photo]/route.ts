import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import {
  mobileOptions,
  mobilePhoto,
  rejectDisallowedMobileOrigin,
} from "@/lib/mobile-http";
import { mobileAccount } from "@/lib/mobile-session";
import { readPhoto } from "@/lib/photos";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return mobileOptions(request);
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ club: string; dog: string; photo: string }>;
  },
) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  const db = await database();
  const account = await mobileAccount(db, request.headers.get("authorization"));
  if (!account) return mobilePhoto(request, null);
  const { club: slug, dog, photo } = await params;
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  if (!club) return mobilePhoto(request, null);
  return mobilePhoto(
    request,
    await readPhoto(db, account.id, "members", club.id, dog, photo),
  );
}
