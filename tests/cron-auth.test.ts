import test from "node:test";
import assert from "node:assert/strict";
import { authorisedCronRequest } from "../src/lib/cron-auth";

test("cron requests require the exact configured bearer secret", () => {
  const secret = "synthetic-cron-secret-123";
  assert.equal(authorisedCronRequest(`Bearer ${secret}`, secret), true);
  assert.equal(authorisedCronRequest(secret, secret), false);
  assert.equal(
    authorisedCronRequest("Bearer wrong-secret-value", secret),
    false,
  );
  assert.equal(authorisedCronRequest(null, secret), false);
});

test("cron authentication fails closed for missing or weak configuration", () => {
  assert.equal(authorisedCronRequest("Bearer undefined", undefined), false);
  assert.equal(authorisedCronRequest("Bearer short", "short"), false);
});
