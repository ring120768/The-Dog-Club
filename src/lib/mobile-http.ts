const nativeOrigins = new Set([
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
]);

function configuredOrigins() {
  return new Set(
    (process.env.MOBILE_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function mobileCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return new Headers({ Vary: "Origin" });
  if (!nativeOrigins.has(origin) && !configuredOrigins().has(origin))
    return null;
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  });
}

export function mobileRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host") ?? requestUrl.host)
    .split(",")[0]
    .trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = (
    forwardedProtocol ?? requestUrl.protocol.replace(/:$/, "")
  )
    .split(",")[0]
    .trim();
  return `${protocol}://${host}`;
}

export function rejectDisallowedMobileOrigin(request: Request) {
  return mobileCorsHeaders(request)
    ? null
    : new Response("Origin is not allowed.", { status: 403 });
}

export function mobileJson(
  request: Request,
  body: unknown,
  init: ResponseInit = {},
) {
  const cors = mobileCorsHeaders(request);
  if (!cors) return new Response("Origin is not allowed.", { status: 403 });
  const headers = new Headers(init.headers);
  cors.forEach((value, key) => headers.set(key, value));
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(body, { ...init, headers });
}

export function mobileOptions(request: Request) {
  const headers = mobileCorsHeaders(request);
  return headers
    ? new Response(null, { status: 204, headers })
    : new Response("Origin is not allowed.", { status: 403 });
}

export function mobileEmpty(request: Request, status = 204) {
  const headers = mobileCorsHeaders(request);
  return headers
    ? new Response(null, { status, headers })
    : new Response("Origin is not allowed.", { status: 403 });
}

export function mobilePhoto(
  request: Request,
  content: Uint8Array | null,
): Response {
  const headers = mobileCorsHeaders(request);
  if (!headers) return new Response("Origin is not allowed.", { status: 403 });
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  headers.set("X-Robots-Tag", "noindex");
  if (!content)
    return new Response("Photo unavailable", { status: 404, headers });
  headers.set("Content-Type", "image/webp");
  headers.set("Content-Disposition", 'inline; filename="dog-profile.webp"');
  return new Response(new Uint8Array(content), { headers });
}
