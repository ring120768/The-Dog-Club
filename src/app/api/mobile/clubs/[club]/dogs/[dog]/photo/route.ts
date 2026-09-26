import { database, type Db } from "@/lib/database";
import { clubsFor, dogsFor, saveDog, type Dog } from "@/lib/dogs";
import {
  mobileJson,
  mobileOptions,
  rejectDisallowedMobileOrigin,
} from "@/lib/mobile-http";
import { mobileAccount } from "@/lib/mobile-session";
import {
  MobileUploadTooLargeError,
  readBoundedBody,
} from "@/lib/mobile-upload";
import { MAX_PHOTO_BYTES } from "@/lib/photo-contract";
import { normalisePhoto, PhotoValidationError } from "@/lib/photos";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return mobileOptions(request);
}

async function editableDog(
  db: Db,
  accountId: string,
  slug: string,
  dogId: string,
) {
  const club = (await clubsFor(db, accountId)).find(
    (item) => item.slug === slug,
  );
  const dog = club
    ? (await dogsFor(db, accountId, club.id)).find((item) => item.id === dogId)
    : null;
  return club && dog?.can_manage ? { club, dog } : null;
}

function dogInput(dog: Dog) {
  return {
    name: dog.name,
    breed: dog.breed,
    bio: dog.bio,
    avatar: dog.avatar,
    audience: dog.audience,
  };
}

async function context(
  request: Request,
  params: Promise<{ club: string; dog: string }>,
) {
  const db = await database();
  const account = await mobileAccount(db, request.headers.get("authorization"));
  if (!account) return { kind: "unauthenticated" as const };
  const { club, dog } = await params;
  const target = await editableDog(db, account.id, club, dog);
  return target
    ? { kind: "ready" as const, db, account, ...target }
    : { kind: "missing" as const };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ club: string; dog: string }> },
) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  const target = await context(request, params);
  if (target.kind === "unauthenticated")
    return mobileJson(request, { error: "Sign in required." }, { status: 401 });
  if (target.kind === "missing")
    return mobileJson(
      request,
      { error: "Dog profile was not found." },
      { status: 404 },
    );
  try {
    const bytes = await readBoundedBody(request, MAX_PHOTO_BYTES);
    const photo = await normalisePhoto(bytes);
    await saveDog(
      target.db,
      target.account.id,
      target.club.id,
      target.dog.id,
      dogInput(target.dog),
      { kind: "replace", photo },
    );
  } catch (error) {
    if (
      error instanceof MobileUploadTooLargeError ||
      error instanceof PhotoValidationError
    )
      return mobileJson(
        request,
        {
          error:
            error instanceof PhotoValidationError
              ? error.message
              : "Choose a photo no larger than 5 MB.",
        },
        { status: 400 },
      );
    throw error;
  }
  return mobileJson(request, { saved: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ club: string; dog: string }> },
) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  const target = await context(request, params);
  if (target.kind === "unauthenticated")
    return mobileJson(request, { error: "Sign in required." }, { status: 401 });
  if (target.kind === "missing")
    return mobileJson(
      request,
      { error: "Dog profile was not found." },
      { status: 404 },
    );
  await saveDog(
    target.db,
    target.account.id,
    target.club.id,
    target.dog.id,
    dogInput(target.dog),
    { kind: "remove" },
  );
  return mobileJson(request, { saved: true });
}
