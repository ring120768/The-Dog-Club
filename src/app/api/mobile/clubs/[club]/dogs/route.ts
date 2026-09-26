import { database } from "@/lib/database";
import { clubsFor, dogsFor } from "@/lib/dogs";
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ club: string }> },
) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  const db = await database();
  const account = await mobileAccount(db, request.headers.get("authorization"));
  if (!account)
    return mobileJson(request, { error: "Sign in required." }, { status: 401 });
  const { club: slug } = await params;
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  if (!club)
    return mobileJson(
      request,
      { error: "Club was not found." },
      { status: 404 },
    );
  const dogs = (await dogsFor(db, account.id, club.id)).map((dog) => ({
    id: dog.id,
    name: dog.name,
    breed: dog.breed,
    bio: dog.bio,
    avatar: dog.avatar,
    audience: dog.audience,
    canManage: dog.can_manage,
    canBook: dog.can_book,
    hasPhoto: Boolean(dog.photo_id),
  }));
  return mobileJson(request, {
    club: { slug: club.slug, name: club.name },
    dogs,
  });
}
