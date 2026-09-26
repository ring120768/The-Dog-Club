const nativeOrigins = new Set(["capacitor://localhost", "http://localhost"]);

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
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  });
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
