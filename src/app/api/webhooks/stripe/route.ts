import { database } from "@/lib/database";
import { verifyStripeWebhook } from "@/lib/stripe-client";
import { recordStripeWebhookEvent } from "@/lib/stripe-memberships";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature)
    return Response.json({ error: "Missing signature." }, { status: 400 });
  const body = await request.text();
  let event;
  try {
    event = verifyStripeWebhook(body, signature);
  } catch (error) {
    const configurationError =
      error instanceof Error && /not configured|not set/i.test(error.message);
    return Response.json(
      {
        error: configurationError
          ? "Stripe webhook is not configured."
          : "Invalid Stripe webhook.",
      },
      { status: configurationError ? 503 : 400 },
    );
  }
  try {
    const result = await recordStripeWebhookEvent(await database(), event);
    return Response.json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    const rejectedEvent =
      error instanceof Error &&
      /unknown Stripe connected account|event rejected/i.test(error.message);
    return Response.json(
      {
        error: rejectedEvent
          ? "Stripe event does not match this environment."
          : "Stripe webhook processing failed.",
      },
      { status: rejectedEvent ? 400 : 500 },
    );
  }
}
