"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount, currentAccount, signIn } from "@/lib/auth";
import { database } from "@/lib/database";
import {
  issueInvite,
  acceptInvite,
  revokeInvite,
  OnboardingError,
} from "@/lib/onboarding";
import { submitApplication, reviewApplication } from "@/lib/applications";
export type OnboardingState = {
  error?: string;
  token?: string;
  success?: string;
};
function errorState(error: unknown): OnboardingState {
  return {
    error:
      error instanceof OnboardingError
        ? error.message
        : error instanceof z.ZodError
          ? error.issues[0].message
          : "Unable to complete this request. Please try again.",
  };
}
export async function inviteAction(
  kind: "operator" | "member" | "staff",
  club: string | null,
  _state: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const a = await requireAccount();
  try {
    const input =
      kind === "staff"
        ? {
            managerEmail: form.get("managerEmail"),
            role: form.get("role"),
            can_manage_staff: form.get("can_manage_staff") === "yes",
            can_manage_booking_setup:
              form.get("can_manage_booking_setup") === "yes",
            service_ids: form.getAll("service_ids"),
          }
        : Object.fromEntries(form);
    const token = await issueInvite(
      await database(),
      a.id,
      kind,
      kind === "operator"
        ? { ...input, colour: "#235448", emblem: "paw", avatar_tone: "sand" }
        : input,
      club,
    );
    revalidatePath("/platform/invitations");
    revalidatePath("/club/[slug]/invitations", "page");
    revalidatePath("/club/[slug]/staff", "page");
    return { token };
  } catch (e) {
    return errorState(e);
  }
}
export async function acceptAction(
  _state: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const a = await currentAccount();
  let slug: string;
  try {
    const result = await acceptInvite(
      await database(),
      String(form.get("token") ?? ""),
      Object.fromEntries(form),
      a?.id,
    );
    slug = result.slug;
  } catch (e) {
    return errorState(e);
  }
  if (!a) {
    const email = String(form.get("email")).trim().toLowerCase();
    if (!(await signIn(email, String(form.get("password")))))
      return {
        success:
          "Invitation accepted. Sign in with your new account to continue.",
      };
  }
  redirect(`/club/${slug}`);
}
export async function revokeAction(id: string) {
  const a = await requireAccount();
  await revokeInvite(await database(), a.id, id);
  revalidatePath("/platform/invitations");
  revalidatePath("/club/[slug]/invitations", "page");
  revalidatePath("/club/[slug]/staff", "page");
}
export async function applicationAction(
  club: string,
  dog: string,
  review: boolean,
  _state: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const a = await requireAccount();
  try {
    if (review)
      await reviewApplication(
        await database(),
        a.id,
        club,
        dog,
        Object.fromEntries(form),
      );
    else
      await submitApplication(
        await database(),
        a.id,
        club,
        dog,
        Object.fromEntries(form),
      );
  } catch (e) {
    return errorState(e);
  }
  revalidatePath("/club/[slug]", "layout");
  return { success: review ? "Decision recorded." : "Application saved." };
}
