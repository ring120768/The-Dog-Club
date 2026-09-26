import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function reviewedServerOrigin(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("MOBILE_APP_SERVER_URL must be a valid URL.");
  }
  if (url.protocol !== "https:")
    throw new Error("MOBILE_APP_SERVER_URL must use HTTPS.");
  if (url.username || url.password || url.search || url.hash)
    throw new Error(
      "MOBILE_APP_SERVER_URL must be an HTTPS origin without credentials, query text or a fragment.",
    );
  if (url.pathname !== "/")
    throw new Error("MOBILE_APP_SERVER_URL must not contain a path.");
  return url.origin;
}

export async function prepareMobileShell({
  outputDirectory = join(root, "mobile-build"),
  serverUrl = process.env.MOBILE_APP_SERVER_URL,
} = {}) {
  const reviewedOrigin = reviewedServerOrigin(serverUrl);
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await cp(join(root, "mobile-shell"), outputDirectory, { recursive: true });
  await cp(
    join(root, "public/brand/demo-dog.jpg"),
    join(outputDirectory, "demo-dog.jpg"),
  );
  const configuration = JSON.stringify({
    serverUrl: reviewedOrigin,
    locked: Boolean(reviewedOrigin),
  }).replaceAll("<", "\\u003c");
  await writeFile(
    join(outputDirectory, "runtime-config.js"),
    `window.DOG_CLUB_CONFIG = Object.freeze(${configuration});\n`,
  );
  const index = await readFile(join(outputDirectory, "index.html"), "utf8");
  if (!index.includes('<script src="runtime-config.js"></script>'))
    throw new Error("The mobile shell does not load runtime-config.js.");
  return { outputDirectory, serverUrl: reviewedOrigin };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const outputFlag = process.argv.indexOf("--output");
  const outputDirectory =
    outputFlag >= 0 ? resolve(process.argv[outputFlag + 1]) : undefined;
  const result = await prepareMobileShell({ outputDirectory });
  console.log(
    result.serverUrl
      ? `Prepared native assets for ${result.serverUrl}.`
      : "Prepared native development assets with editable local server setup.",
  );
}
