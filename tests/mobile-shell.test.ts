import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("mobile hidden state wins over component display rules", async () => {
  const shell = await readFile(
    new URL("../mobile-shell/index.html", import.meta.url),
    "utf8",
  );

  assert.match(
    shell,
    /\.hidden\s*\{[^}]*display:\s*none\s*!important\s*;/s,
    "hidden mobile views and image fallbacks must not be revived by a more specific display rule",
  );
});

test("mobile club view includes membership and booking summaries", async () => {
  const [shell, script] = await Promise.all([
    readFile(new URL("../mobile-shell/index.html", import.meta.url), "utf8"),
    readFile(new URL("../mobile-shell/app.js", import.meta.url), "utf8"),
  ]);

  assert.match(shell, /id="membership-heading"/);
  assert.match(shell, /id="booking-list"/);
  assert.match(script, /\/api\/mobile\/clubs\/\$\{[^}]+\}\/home/);
  assert.match(script, /timeZone:\s*"Europe\/London"/);
});

test("mobile grooming flow preserves credits and hands card payments to Stripe", async () => {
  const [shell, script] = await Promise.all([
    readFile(new URL("../mobile-shell/index.html", import.meta.url), "utf8"),
    readFile(new URL("../mobile-shell/app.js", import.meta.url), "utf8"),
  ]);

  assert.match(shell, /id="booking-view"/);
  assert.match(shell, /id="booking-terms-accepted"[^>]*required/);
  assert.match(script, /securely with Stripe/);
  assert.match(script, /\/booking-options/);
  assert.match(script, /\/availability\?/);
  assert.match(script, /\/bookings/);
  assert.match(script, /\/service-checkouts/);
  assert.match(script, /crypto\.randomUUID\(\)/);
  assert.match(script, /Plugins\?\.Browser/);
  assert.match(script, /browserFinished/);
  assert.match(script, /held for 30 minutes/);
  assert.match(script, /paymentState === "paid"/);
  assert.match(script, /\.toFixed\(2\)} paid/);
  assert.match(shell, /id="booking-payment-refresh"/);
  assert.doesNotMatch(shell, /card number|payment details/i);
});

test("mobile upcoming bookings can be cancelled after explicit confirmation", async () => {
  const script = await readFile(
    new URL("../mobile-shell/app.js", import.meta.url),
    "utf8",
  );

  assert.match(script, /Cancel booking/);
  assert.match(script, /confirm\(/);
  assert.match(script, /method:\s*"DELETE"/);
  assert.match(script, /grooming credit has been restored/);
});

test("mobile upcoming bookings can move to a live replacement slot", async () => {
  const [shell, script] = await Promise.all([
    readFile(new URL("../mobile-shell/index.html", import.meta.url), "utf8"),
    readFile(new URL("../mobile-shell/app.js", import.meta.url), "utf8"),
  ]);

  assert.match(script, /Change time/);
  assert.match(script, /query\.set\("booking", state\.rescheduleBooking\.id\)/);
  assert.match(script, /method: rescheduling \? "PATCH" : "POST"/);
  assert.match(shell, /id="booking-reschedule-note"/);
  assert.match(
    script,
    /original price, grooming credits and cancellation terms stay unchanged/,
  );
});
