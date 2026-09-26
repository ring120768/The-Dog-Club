import { reviewedServerOrigin } from "./prepare-mobile-shell.mjs";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const origin = reviewedServerOrigin(required("MOBILE_APP_SERVER_URL"));
const email = required("MOBILE_STAGING_EMAIL");
const password = required("MOBILE_STAGING_PASSWORD");
const expectedClub = process.env.MOBILE_STAGING_CLUB?.trim();
let token = "";

async function request(path, options = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      `${options.method ?? "GET"} ${path} returned ${response.status}.`,
    );
  return body;
}

try {
  const session = await request("/api/mobile/session", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      platform: "web_test",
      deviceName: "Automated staging acceptance",
    }),
  });
  if (!/^[a-f0-9]{64}$/.test(session?.token ?? ""))
    throw new Error("The staging login did not return a valid session token.");
  token = session.token;
  const clubs = await request("/api/mobile/clubs");
  if (!Array.isArray(clubs?.clubs) || clubs.clubs.length === 0)
    throw new Error("The staging account has no available club memberships.");
  if (expectedClub && !clubs.clubs.some((club) => club.slug === expectedClub))
    throw new Error("The expected staging club was not returned.");
  const sessions = await request("/api/mobile/sessions");
  if (!sessions?.sessions?.some((item) => item.current))
    throw new Error("The current staging session was not listed.");
  console.log(
    `Mobile staging acceptance passed for ${clubs.clubs.length} club membership(s).`,
  );
} finally {
  if (token)
    await request("/api/mobile/session", { method: "DELETE" }).catch(() => {});
}
