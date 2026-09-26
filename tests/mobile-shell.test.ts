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
