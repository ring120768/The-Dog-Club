import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import {
  mobileJson,
  mobileOptions,
  rejectDisallowedMobileOrigin,
} from "@/lib/mobile-http";
import { mobileAccount } from "@/lib/mobile-session";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return mobileOptions(request);
}

export async function GET(request: Request) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  const db = await database();
  const account = await mobileAccount(db, request.headers.get("authorization"));
  if (!account)
    return mobileJson(request, { error: "Sign in required." }, { status: 401 });
  const clubs = (await clubsFor(db, account.id)).map((club) => ({
    id: club.id,
    slug: club.slug,
    name: club.name,
    tagline: club.tagline,
    colour: club.colour,
    location: club.location,
    emblem: club.emblem,
    avatarTone: club.avatar_tone,
    role: club.role,
  }));
  return mobileJson(request, { account: { email: account.email }, clubs });
}
