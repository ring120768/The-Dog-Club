import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

test("webhook verification rejects tampering before normalisation", async () => {
  process.env.STRIPE_SECRET_KEY = "local_signature_only";
  process.env.STRIPE_WEBHOOK_SECRET = "local_webhook_signature_only";
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-08-26.dahlia",
  });
  const payload = JSON.stringify({
    id: "evt_signature_test",
    object: "event",
    account: "acct_signature_test",
    api_version: "2026-08-26.dahlia",
    created: 4_095_619_200,
    data: {
      object: { id: "obj_signature_test", object: "test_helpers.test_clock" },
    },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: "test_helpers.test_clock.created",
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    timestamp: Math.floor(Date.now() / 1000),
  });
  const { verifyStripeWebhookWithClient } =
    await import("../src/lib/stripe-webhook");
  const verified = verifyStripeWebhookWithClient(
    stripe,
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET,
  );
  assert.equal(verified.id, "evt_signature_test");
  assert.equal(verified.connectedAccountId, "acct_signature_test");
  assert.deepEqual(verified.data, {
    kind: "ignored",
    sourceType: "test_helpers.test_clock.created",
  });
  assert.throws(
    () =>
      verifyStripeWebhookWithClient(
        stripe,
        `${payload} `,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      ),
    /signature/i,
  );
});
