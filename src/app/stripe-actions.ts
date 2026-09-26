"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import { OnboardingError } from "@/lib/onboarding";
import { configureStripeSandboxAccount } from "@/lib/stripe-memberships";
import { stripeConnectedAccountSnapshot } from "@/lib/stripe-client";

export type StripeActionState = { error?: string; success?: string };

export async function configureStripeAccountAction(
  club: string,
  slug: string,
  _state: StripeActionState,
  form: FormData,
): Promise<StripeActionState> {
  const actor = await requireAccount();
  try {
    const accountId = z
      .string()
      .regex(/^acct_[A-Za-z0-9_]+$/)
      .parse(form.get("stripe_account_id"));
    const snapshot = await stripeConnectedAccountSnapshot(accountId);
    await configureStripeSandboxAccount(
      await database(),
      actor.id,
      club,
      snapshot,
    );
  } catch (error) {
    return {
      error:
        error instanceof OnboardingError
          ? error.message
          : error instanceof z.ZodError
            ? "Enter a valid Stripe connected-account ID."
            : "Stripe sandbox account could not be verified.",
    };
  }
  revalidatePath(`/platform/${slug}`);
  revalidatePath(`/club/${slug}/memberships`);
  return { success: "Stripe sandbox account verified and saved." };
}
