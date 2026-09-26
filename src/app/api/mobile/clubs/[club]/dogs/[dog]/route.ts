import { database } from "@/lib/database";
import { clubsFor, dogsFor, saveDog } from "@/lib/dogs";
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
  { params }: { params: Promise<{ club: string; dog: string }> },
) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  const db = await database();
  const account = await mobileAccount(db, request.headers.get("authorization"));
  if (!account)
    return mobileJson(request, { error: "Sign in required." }, { status: 401 });
  const { club: slug, dog: dogId } = await params;
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  if (!club)
    return mobileJson(
      request,
      { error: "Dog profile was not found." },
      { status: 404 },
    );
  const dog = (await dogsFor(db, account.id, club.id)).find(
    (item) => item.id === dogId,
  );
  if (!dog)
    return mobileJson(
      request,
      { error: "Dog profile was not found." },
      { status: 404 },
    );
  return mobileJson(request, {
    dog: {
      id: dog.id,
      name: dog.name,
      breed: dog.breed,
      bio: dog.bio,
      avatar: dog.avatar,
      audience: dog.audience,
      canManage: dog.can_manage,
      canBook: dog.can_book,
      photoUrl: dog.photo_id
        ? `/api/mobile/clubs/${encodeURIComponent(club.slug)}/dogs/${encodeURIComponent(dog.id)}/photos/${encodeURIComponent(dog.photo_id)}`
        : null,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ club: string; dog: string }> },
) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  const db = await database();
  const account = await mobileAccount(db, request.headers.get("authorization"));
  if (!account)
    return mobileJson(request, { error: "Sign in required." }, { status: 401 });
  const { club: slug, dog: dogId } = await params;
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  const dog = club
    ? (await dogsFor(db, account.id, club.id)).find((item) => item.id === dogId)
    : null;
  if (!club || !dog?.can_manage)
    return mobileJson(
      request,
      { error: "Dog profile was not found." },
      { status: 404 },
    );
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return mobileJson(
      request,
      { error: "Check the profile details and try again." },
      { status: 400 },
    );
  }
  try {
    await saveDog(db, account.id, club.id, dog.id, input);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError")
      return mobileJson(
        request,
        { error: "Check the profile details and try again." },
        { status: 400 },
      );
    if (
      error instanceof Error &&
      (error.message.includes("permission") ||
        error.message.includes("lifecycle"))
    )
      return mobileJson(
        request,
        { error: "Dog profile was not found." },
        { status: 404 },
      );
    throw error;
  }
  return mobileJson(request, { saved: true });
}
