"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { deactivateStaffMember, saveStaffMember } from "@/lib/staff";
import { OnboardingError } from "@/lib/onboarding";

export type StaffState = { error?: string; success?: string };
const result = (error: unknown): StaffState => ({
  error:
    error instanceof OnboardingError
      ? error.message
      : error instanceof z.ZodError
        ? error.issues[0].message
        : "Unable to update staff access. Please try again.",
});

export async function saveStaffAction(
  club: string,
  slug: string,
  _state: StaffState,
  form: FormData,
): Promise<StaffState> {
  const actor = await requireAccount();
  try {
    await saveStaffMember(await database(), actor.id, club, {
      account_id: form.get("account_id"),
      role: form.get("role"),
      can_manage_staff: form.get("can_manage_staff") === "yes",
      can_manage_booking_setup: form.get("can_manage_booking_setup") === "yes",
      service_ids: form.getAll("service_ids"),
    });
  } catch (error) {
    return result(error);
  }
  revalidatePath(`/club/${slug}/staff`);
  revalidatePath(`/club/${slug}/booking-setup`);
  return { success: "Staff access and qualifications saved." };
}

export async function deactivateStaffAction(
  club: string,
  slug: string,
  account: string,
  _state: StaffState,
): Promise<StaffState> {
  const actor = await requireAccount();
  try {
    await deactivateStaffMember(await database(), actor.id, club, account);
  } catch (error) {
    return result(error);
  }
  revalidatePath(`/club/${slug}/staff`);
  revalidatePath(`/club/${slug}/booking-setup`);
  return {
    success: "Staff access deactivated. Historical records were retained.",
  };
}
