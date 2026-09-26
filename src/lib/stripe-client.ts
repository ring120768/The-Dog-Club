import "server-only";
import Stripe from "stripe";
import type {
  StripeMembershipGateway,
  StripeServiceGateway,
} from "./stripe-contract";
import { verifyStripeWebhookWithClient } from "./stripe-webhook";

let client: Stripe | undefined;

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe sandbox is not configured.");
  return (client ??= new Stripe(key, {
    apiVersion: "2026-08-26.dahlia",
    typescript: true,
  }));
}

export const stripeMembershipGateway: StripeMembershipGateway = {
  async createSubscriptionCheckout(input) {
    const session = await stripeClient().checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [{ price: input.priceId, quantity: 1 }],
        client_reference_id: input.clientReferenceId,
        customer_email: input.customerEmail,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        integration_identifier: input.integrationIdentifier,
      },
      {
        stripeAccount: input.connectedAccountId,
        idempotencyKey: input.idempotencyKey,
      },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return {
      id: session.id,
      url: session.url,
      expiresAt: new Date(session.expires_at * 1000),
    };
  },
  async scheduleCancellation(input) {
    await stripeClient().subscriptions.update(
      input.subscriptionId,
      { cancel_at_period_end: true },
      { stripeAccount: input.connectedAccountId },
    );
  },
};

export const stripeServiceGateway: StripeServiceGateway = {
  async createServiceCheckout(input) {
    const session = await stripeClient().checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: input.amountPence,
              product_data: { name: input.serviceName },
            },
            quantity: 1,
          },
        ],
        client_reference_id: input.clientReferenceId,
        customer_email: input.customerEmail,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        expires_at: Math.floor(input.expiresAt.getTime() / 1000),
        payment_intent_data: {
          metadata: { dog_club_booking_id: input.bookingId },
        },
        integration_identifier: input.integrationIdentifier,
      },
      {
        stripeAccount: input.connectedAccountId,
        idempotencyKey: input.idempotencyKey,
      },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return {
      id: session.id,
      url: session.url,
      expiresAt: new Date(session.expires_at * 1000),
    };
  },
};

export async function stripeConnectedAccountSnapshot(accountId: string) {
  const account = await stripeClient().accounts.retrieve(accountId);
  return {
    external_account_id: account.id,
    status:
      account.charges_enabled && account.details_submitted
        ? ("connected" as const)
        : ("restricted" as const),
    charges_enabled: account.charges_enabled,
    details_submitted: account.details_submitted,
  };
}

export async function stripeMembershipPriceSnapshot(
  priceId: string,
  connectedAccountId: string,
) {
  const price = await stripeClient().prices.retrieve(
    priceId,
    {},
    { stripeAccount: connectedAccountId },
  );
  return {
    active: price.active,
    currency: price.currency,
    unitAmount: price.unit_amount,
    recurringInterval: price.recurring?.interval ?? null,
    recurringIntervalCount: price.recurring?.interval_count ?? null,
  };
}

export function verifyStripeWebhook(body: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    throw new Error("Stripe webhook verification is not configured.");
  return verifyStripeWebhookWithClient(stripeClient(), body, signature, secret);
}
