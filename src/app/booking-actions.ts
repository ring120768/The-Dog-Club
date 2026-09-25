"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import {
  cancelBooking,
  closeResource,
  createBookingSetup,
  reserveBooking,
} from "@/lib/bookings";
import { OnboardingError } from "@/lib/onboarding";

export type BookingState = { error?: string; success?: string };

function errorState(error: unknown): BookingState {
  return {
    error:
      error instanceof OnboardingError
        ? error.message
        : error instanceof z.ZodError
          ? error.issues[0].message
          : "Unable to complete this request. Please try again.",
  };
}

export async function setupBookingAction(
  club: string,
  slug: string,
  _state: BookingState,
  form: FormData,
): Promise<BookingState> {
  const actor = await requireAccount();
  try {
    await createBookingSetup(
      await database(),
      actor.id,
      club,
      Object.fromEntries(form),
    );
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(`/club/${slug}/booking-setup`);
  revalidatePath(`/club/${slug}/bookings`);
  return { success: "Service, station and published shift created." };
}

export async function closeResourceAction(
  club: string,
  slug: string,
  _state: BookingState,
  form: FormData,
): Promise<BookingState> {
  const actor = await requireAccount();
  try {
    await closeResource(
      await database(),
      actor.id,
      club,
      Object.fromEntries(form),
    );
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(`/club/${slug}/booking-setup`);
  revalidatePath(`/club/${slug}/bookings`);
  return { success: "Station closure recorded." };
}

export async function reserveBookingAction(
  club: string,
  slug: string,
  dog: string,
  service: string,
  startsAt: string,
  _state: BookingState,
  form: FormData,
): Promise<BookingState> {
  const actor = await requireAccount();
  try {
    await reserveBooking(await database(), actor.id, club, {
      dog_id: dog,
      service_id: service,
      starts_at: startsAt,
      accepted_terms: form.get("accepted_terms"),
    });
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(`/club/${slug}/bookings`);
  revalidatePath(`/club/${slug}/operations`);
  redirect(`/club/${slug}/bookings?booked=1`);
}

export async function cancelBookingAction(
  club: string,
  slug: string,
  booking: string,
  _state: BookingState,
  form: FormData,
): Promise<BookingState> {
  const actor = await requireAccount();
  try {
    await cancelBooking(
      await database(),
      actor.id,
      club,
      booking,
      String(form.get("reason") ?? ""),
    );
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(`/club/${slug}/bookings`);
  revalidatePath(`/club/${slug}/operations`);
  redirect(`/club/${slug}/bookings?cancelled=1`);
}
