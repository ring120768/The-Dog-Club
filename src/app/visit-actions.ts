"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { OnboardingError } from "@/lib/onboarding";
import { arriveForBooking, correctVisit, progressVisit } from "@/lib/visits";
import type { VisitStatus } from "@/lib/visit-contract";

export type VisitActionState = { error?: string };

function errorState(error: unknown): VisitActionState {
  return {
    error:
      error instanceof OnboardingError
        ? error.message
        : error instanceof z.ZodError
          ? error.issues[0].message
          : "Unable to update this visit. Please try again.",
  };
}

function refresh(slug: string) {
  revalidatePath(`/club/${slug}/operations`);
  revalidatePath(`/club/${slug}/bookings`);
}

export async function arriveAction(
  club: string,
  slug: string,
  booking: string,
  _state: VisitActionState,
): Promise<VisitActionState> {
  const actor = await requireAccount();
  try {
    await arriveForBooking(await database(), actor.id, club, booking);
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(`/club/${slug}/operations?visit=arrived`);
}

export async function progressVisitAction(
  club: string,
  slug: string,
  visit: string,
  target: VisitStatus,
  _state: VisitActionState,
  form: FormData,
): Promise<VisitActionState> {
  const actor = await requireAccount();
  try {
    await progressVisit(await database(), actor.id, club, visit, target, {
      collector_name: String(form.get("collector_name") ?? ""),
      collector_verified: String(form.get("collector_verified") ?? ""),
    });
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(`/club/${slug}/operations?visit=${target}`);
}

export async function correctVisitAction(
  club: string,
  slug: string,
  visit: string,
  _state: VisitActionState,
  form: FormData,
): Promise<VisitActionState> {
  const actor = await requireAccount();
  try {
    await correctVisit(await database(), actor.id, club, visit, {
      status: form.get("status"),
      reason: form.get("reason"),
    });
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(`/club/${slug}/operations?visit=corrected`);
}
