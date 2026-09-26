"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { OnboardingError } from "@/lib/onboarding";
import {
  activateDemoMembership,
  changeGroomingCredits,
  createMembershipPlan,
  scheduleMembershipCancellation,
  setMembershipState,
} from "@/lib/memberships";

export type MembershipActionState = { error?: string; success?: string };

function errorState(error: unknown): MembershipActionState {
  return {
    error:
      error instanceof OnboardingError
        ? error.message
        : error instanceof z.ZodError
          ? error.issues[0].message
          : "Unable to update this membership. Please try again.",
  };
}

function refresh(slug: string) {
  revalidatePath(`/club/${slug}/memberships`);
}

export async function createPlanAction(
  club: string,
  slug: string,
  _state: MembershipActionState,
  form: FormData,
): Promise<MembershipActionState> {
  const actor = await requireAccount();
  try {
    await createMembershipPlan(
      await database(),
      actor.id,
      club,
      Object.fromEntries(form),
    );
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  return { success: "Membership plan created." };
}

export async function activateMembershipAction(
  club: string,
  slug: string,
  _state: MembershipActionState,
  form: FormData,
): Promise<MembershipActionState> {
  const actor = await requireAccount();
  try {
    await activateDemoMembership(
      await database(),
      actor.id,
      club,
      Object.fromEntries(form),
    );
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(`/club/${slug}/memberships?membership=activated`);
}

export async function cancelMembershipAction(
  club: string,
  slug: string,
  subscription: string,
  _state: MembershipActionState,
): Promise<MembershipActionState> {
  const actor = await requireAccount();
  try {
    await scheduleMembershipCancellation(
      await database(),
      actor.id,
      club,
      subscription,
    );
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(`/club/${slug}/memberships?membership=cancelled`);
}

export async function membershipStateAction(
  club: string,
  slug: string,
  subscription: string,
  _state: MembershipActionState,
  form: FormData,
): Promise<MembershipActionState> {
  const actor = await requireAccount();
  try {
    await setMembershipState(
      await database(),
      actor.id,
      club,
      subscription,
      Object.fromEntries(form),
    );
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(`/club/${slug}/memberships?membership=state`);
}

export async function groomingCreditAction(
  club: string,
  slug: string,
  subscription: string,
  idempotencyKey: string,
  _state: MembershipActionState,
  form: FormData,
): Promise<MembershipActionState> {
  const actor = await requireAccount();
  try {
    await changeGroomingCredits(
      await database(),
      actor.id,
      club,
      subscription,
      {
        ...Object.fromEntries(form),
        idempotency_key: idempotencyKey,
      },
    );
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(`/club/${slug}/memberships?membership=credits`);
}
