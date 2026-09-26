"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentAccount, requireAccount, signIn } from "@/lib/auth";
import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import {
  acceptHouseholdInvite,
  issueHouseholdInvite,
  revokeHouseholdGrant,
  revokeHouseholdInvite,
  updateHouseholdGrant,
} from "@/lib/households";
import { OnboardingError } from "@/lib/onboarding";

export type HouseholdState = {
  error?: string;
  success?: string;
  token?: string;
};

const permissions = (form: FormData) => ({
  can_manage_dogs: form.get("can_manage_dogs") === "yes",
  can_manage_bookings: form.get("can_manage_bookings") === "yes",
});

const errorState = (error: unknown): HouseholdState => ({
  error:
    error instanceof OnboardingError
      ? error.message
      : error instanceof z.ZodError
        ? error.issues[0].message
        : "Unable to update household access. Please try again.",
});

export async function issueHouseholdInviteAction(
  club: string,
  slug: string,
  _state: HouseholdState,
  form: FormData,
): Promise<HouseholdState> {
  const account = await requireAccount();
  try {
    const token = await issueHouseholdInvite(
      await database(),
      account.id,
      club,
      {
        email: String(form.get("email") ?? "")
          .trim()
          .toLowerCase(),
        ...permissions(form),
      },
    );
    revalidatePath(`/club/${slug}/household`);
    return { token };
  } catch (error) {
    return errorState(error);
  }
}

export async function acceptHouseholdInviteAction(
  _state: HouseholdState,
  form: FormData,
): Promise<HouseholdState> {
  const account = await currentAccount();
  let result: { accountId: string; slug: string };
  try {
    result = await acceptHouseholdInvite(
      await database(),
      String(form.get("token") ?? ""),
      {
        email: String(form.get("email") ?? "")
          .trim()
          .toLowerCase(),
        password: String(form.get("password") ?? ""),
      },
      account?.id,
    );
  } catch (error) {
    return errorState(error);
  }
  if (!account) {
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    if (!(await signIn(email, String(form.get("password") ?? ""))))
      return {
        success:
          "Invitation accepted. Sign in with your new account to continue.",
      };
  }
  redirect(`/club/${result.slug}/household?joined=1`);
}

export async function updateHouseholdGrantAction(
  club: string,
  slug: string,
  adult: string,
  _state: HouseholdState,
  form: FormData,
): Promise<HouseholdState> {
  const account = await requireAccount();
  try {
    await updateHouseholdGrant(
      await database(),
      account.id,
      club,
      adult,
      permissions(form),
    );
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(`/club/${slug}/household`);
  return { success: "Household permissions updated." };
}

export async function revokeHouseholdGrantAction(
  club: string,
  slug: string,
  owner: string,
  adult: string,
) {
  const account = await requireAccount();
  await revokeHouseholdGrant(await database(), account.id, club, owner, adult);
  revalidatePath(`/club/${slug}/household`);
  revalidatePath(`/club/${slug}`);
}

export async function revokeHouseholdInviteAction(
  club: string,
  slug: string,
  invite: string,
) {
  const account = await requireAccount();
  await revokeHouseholdInvite(await database(), account.id, club, invite);
  revalidatePath(`/club/${slug}/household`);
}
