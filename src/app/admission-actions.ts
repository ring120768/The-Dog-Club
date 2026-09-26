"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { OnboardingError } from "@/lib/onboarding";
import {
  checkInAdmission,
  checkOutAdmission,
  configureAdmission,
  ensureAdmissionPass,
  setDogAdmissionEligibility,
} from "@/lib/admissions";

export type AdmissionActionState = { error?: string };

function errorState(error: unknown): AdmissionActionState {
  return {
    error:
      error instanceof OnboardingError
        ? error.message
        : error instanceof z.ZodError
          ? error.issues[0].message
          : "Unable to update admission. Please try again.",
  };
}

function refresh(slug: string) {
  revalidatePath(`/club/${slug}/admission`);
  revalidatePath(`/club/${slug}/operations`);
}

export async function createAdmissionPassAction(
  club: string,
  slug: string,
  _state: AdmissionActionState,
): Promise<AdmissionActionState> {
  const actor = await requireAccount();
  try {
    await ensureAdmissionPass(await database(), actor.id, club);
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(`/club/${slug}/admission?admission=pass-created`);
}

export async function configureAdmissionAction(
  club: string,
  slug: string,
  _state: AdmissionActionState,
  form: FormData,
): Promise<AdmissionActionState> {
  const actor = await requireAccount();
  try {
    await configureAdmission(
      await database(),
      actor.id,
      club,
      Object.fromEntries(form),
    );
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(`/club/${slug}/admission?admission=capacity-saved`);
}

export async function setDogAdmissionAction(
  club: string,
  slug: string,
  dog: string,
  _state: AdmissionActionState,
  form: FormData,
): Promise<AdmissionActionState> {
  const actor = await requireAccount();
  try {
    await setDogAdmissionEligibility(
      await database(),
      actor.id,
      club,
      dog,
      Object.fromEntries(form),
    );
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(`/club/${slug}/admission?admission=eligibility-saved`);
}

export async function checkInAdmissionAction(
  club: string,
  slug: string,
  code: string,
  _state: AdmissionActionState,
  form: FormData,
): Promise<AdmissionActionState> {
  const actor = await requireAccount();
  try {
    await checkInAdmission(await database(), actor.id, club, {
      code,
      human_count: form.get("human_count"),
      dog_ids: form.getAll("dog_ids"),
    });
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(`/club/${slug}/admission?admission=checked-in`);
}

export async function checkOutAdmissionAction(
  club: string,
  slug: string,
  visit: string,
  _state: AdmissionActionState,
): Promise<AdmissionActionState> {
  const actor = await requireAccount();
  try {
    await checkOutAdmission(await database(), actor.id, club, visit);
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(`/club/${slug}/admission?admission=checked-out`);
}
