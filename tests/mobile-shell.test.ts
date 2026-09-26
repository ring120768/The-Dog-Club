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
