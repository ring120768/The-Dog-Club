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
  subscriptionsFor,
} from "@/lib/memberships";
import {
  prepareMembershipCheckout,
  requestStripeCancellation,
  setPlanStripePrice,
  stripePriceLinkContext,
  validateMembershipPrice,
} from "@/lib/stripe-memberships";
import {
  stripeMembershipGateway,
  stripeMembershipPriceSnapshot,
} from "@/lib/stripe-client";

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
  let stripeManaged = false;
  try {
    const db = await database();
    const current = (
      await subscriptionsFor(db, actor.id, club)
    ).subscriptions.find((item) => item.id === subscription);
    if (!current) throw new OnboardingError("Membership unavailable.");
    stripeManaged = current.source === "stripe";
    if (stripeManaged)
      await requestStripeCancellation(
        db,
        actor.id,
        club,
        subscription,
        stripeMembershipGateway,
      );
    else await scheduleMembershipCancellation(db, actor.id, club, subscription);
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  redirect(
    `/club/${slug}/memberships?membership=${stripeManaged ? "cancellation-requested" : "cancelled"}`,
  );
}

export async function setStripePriceAction(
  club: string,
  slug: string,
  plan: string,
  _state: MembershipActionState,
  form: FormData,
): Promise<MembershipActionState> {
  const actor = await requireAccount();
  try {
    const priceId = String(form.get("stripe_price_id") ?? "");
    const context = await stripePriceLinkContext(
      await database(),
      actor.id,
      club,
      plan,
    );
    const price = await stripeMembershipPriceSnapshot(
      priceId,
      context.external_account_id,
    );
    validateMembershipPrice(context.monthly_price_pence, price);
    await setPlanStripePrice(await database(), actor.id, club, plan, priceId);
  } catch (error) {
    return errorState(error);
  }
  refresh(slug);
  return { success: "Stripe sandbox Price linked." };
}

export async function startMembershipCheckoutAction(
  club: string,
  plan: string,
  _state: MembershipActionState,
): Promise<MembershipActionState> {
  const actor = await requireAccount();
  let checkoutUrl: string;
  try {
    checkoutUrl = await prepareMembershipCheckout(
      await database(),
      actor.id,
      club,
      plan,
      process.env.APP_URL ?? "",
      stripeMembershipGateway,
    );
  } catch (error) {
    return errorState(error);
  }
  redirect(checkoutUrl);
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
