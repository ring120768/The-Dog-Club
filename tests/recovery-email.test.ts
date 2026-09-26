import test from "node:test";
import assert from "node:assert/strict";
import {
  recoveryEmailConfigurationStatus,
  recoveryEmailSender,
  RecoveryEmailConfigurationError,
  RecoveryEmailDeliveryError,
} from "../src/lib/recovery-email";
import { isDemoMode } from "../src/lib/runtime";

const configured = {
  RECOVERY_EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_synthetic_test_key",
  RECOVERY_EMAIL_FROM: "The Dog Club <help@dogclub.test>",
  APP_URL: "https://members.dogclub.test",
  NODE_ENV: "production",
};

test("Resend recovery email uses a stable idempotency key and fragment token", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const sender = recoveryEmailSender(configured, async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(JSON.stringify({ id: "email_123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  assert.ok(sender);
  const result = await sender.send({
    requestId: "11111111-1111-4111-8111-111111111111",
    email: "member@example.test",
    token: "a".repeat(64),
  });
  assert.deepEqual(result, { provider: "resend", messageId: "email_123" });
  assert.equal(capturedUrl, "https://api.resend.com/emails");
  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(
    headers["Idempotency-Key"],
    "password-recovery/11111111-1111-4111-8111-111111111111",
  );
  const body = JSON.parse(String(capturedInit?.body));
  assert.deepEqual(body.to, ["member@example.test"]);
  assert.match(body.text, /https:\/\/members\.dogclub\.test\/reset#a{64}/);
});

test("email delivery reports bounded failure codes without provider content", async () => {
  const sender = recoveryEmailSender(
    configured,
    async () =>
      new Response("provider detail that must not be retained", {
        status: 429,
      }),
  );
  assert.ok(sender);
  await assert.rejects(
    sender.send({
      requestId: "11111111-1111-4111-8111-111111111111",
      email: "member@example.test",
      token: "b".repeat(64),
    }),
    (error: unknown) =>
      error instanceof RecoveryEmailDeliveryError &&
      error.code === "provider_429",
  );
});

test("production email requires complete Resend settings and HTTPS links", () => {
  assert.equal(
    recoveryEmailConfigurationStatus({
      ...configured,
      RECOVERY_EMAIL_PROVIDER: undefined,
    }),
    "disabled",
  );
  assert.equal(
    recoveryEmailConfigurationStatus({
      ...configured,
      RESEND_API_KEY: undefined,
    }),
    "invalid",
  );
  assert.throws(
    () =>
      recoveryEmailSender({ ...configured, APP_URL: "http://dogclub.test" }),
    RecoveryEmailConfigurationError,
  );
});

test("demo presentation is impossible in a production runtime", () => {
  assert.equal(isDemoMode({ DOGCLUB_LOCAL_DEMO: "1", NODE_ENV: "test" }), true);
  assert.equal(
    isDemoMode({ DOGCLUB_LOCAL_DEMO: "1", NODE_ENV: "production" }),
    false,
  );
  assert.equal(
    isDemoMode({ DOGCLUB_LOCAL_DEMO: undefined, NODE_ENV: "development" }),
    false,
  );
});
