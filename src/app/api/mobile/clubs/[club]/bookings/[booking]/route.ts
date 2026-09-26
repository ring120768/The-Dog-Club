import { cancelBooking, rescheduleBooking } from "@/lib/bookings";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import {
  mobileEmpty,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ club: string; booking: string }> },
) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  const db = await database();
  const account = await mobileAccount(db, request.headers.get("authorization"));
  if (!account)
    return mobileJson(request, { error: "Sign in required." }, { status: 401 });
  const { club: slug, booking } = await params;
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  if (!club)
    return mobileJson(
      request,
      { error: "Booking was not found." },
      { status: 404 },
    );
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return mobileJson(
      request,
      { error: "Choose an available appointment time." },
      { status: 400 },
    );
  }
  try {
    const body = input && typeof input === "object" ? input : {};
    const bookingId = await rescheduleBooking(db, account.id, club.id, {
      ...body,
      booking_id: booking,
    });
    return mobileJson(request, { bookingId });
  } catch (error) {
    if (error instanceof OnboardingError) {
      if (error.message === "Booking unavailable.")
        return mobileJson(
          request,
          { error: "Booking was not found." },
          { status: 404 },
        );
      return mobileJson(request, { error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.name === "ZodError")
      return mobileJson(
        request,
        { error: "Choose an available appointment time." },
        { status: 400 },
      );
    throw error;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ club: string; booking: string }> },
) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  const db = await database();
  const account = await mobileAccount(db, request.headers.get("authorization"));
  if (!account)
    return mobileJson(request, { error: "Sign in required." }, { status: 401 });
  const { club: slug, booking } = await params;
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  if (!club)
    return mobileJson(
      request,
      { error: "Booking was not found." },
      { status: 404 },
    );
  try {
    await cancelBooking(
      db,
      account.id,
      club.id,
      booking,
      "Cancelled by member in mobile app",
    );
    return mobileEmpty(request);
  } catch (error) {
    if (error instanceof OnboardingError) {
      if (error.message === "Booking unavailable.")
        return mobileJson(
          request,
          { error: "Booking was not found." },
          { status: 404 },
        );
      return mobileJson(request, { error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.name === "ZodError")
      return mobileJson(
        request,
        { error: "Booking was not found." },
        { status: 404 },
      );
    throw error;
  }
}
