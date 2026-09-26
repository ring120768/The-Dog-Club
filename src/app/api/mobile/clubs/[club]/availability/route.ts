import { availabilityFor } from "@/lib/bookings";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import {
  mobileJson,
  mobileOptions,
  rejectDisallowedMobileOrigin,
} from "@/lib/mobile-http";
import { mobileAccount } from "@/lib/mobile-session";
import { OnboardingError } from "@/lib/onboarding";

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
  const url = new URL(request.url);
  try {
    const availability = await availabilityFor(
      db,
      account.id,
      club.id,
      url.searchParams.get("dog") ?? "",
      url.searchParams.get("service") ?? "",
      url.searchParams.get("date") ?? "",
    );
    return mobileJson(request, availability);
  } catch (error) {
    if (error instanceof OnboardingError)
      return mobileJson(request, { error: error.message }, { status: 400 });
    if (error instanceof Error && error.name === "ZodError")
      return mobileJson(
        request,
        { error: "Choose a dog, service and valid date." },
        { status: 400 },
      );
    throw error;
  }
}
