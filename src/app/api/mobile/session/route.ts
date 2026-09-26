import { database } from "@/lib/database";
import {
  mobileEmpty,
  mobileJson,
  mobileOptions,
  rejectDisallowedMobileOrigin,
} from "@/lib/mobile-http";
import { createMobileSession, revokeMobileSession } from "@/lib/mobile-session";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return mobileOptions(request);
}

export async function POST(request: Request) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return mobileJson(
      request,
      { error: "Email or password is incorrect." },
      { status: 401 },
    );
  }
  const session = await createMobileSession(await database(), input);
  return session
    ? mobileJson(request, session)
    : mobileJson(
        request,
        { error: "Email or password is incorrect." },
        { status: 401 },
      );
}

export async function DELETE(request: Request) {
  const response = mobileEmpty(request);
  if (response.status === 403) return response;
  await revokeMobileSession(
    await database(),
    request.headers.get("authorization"),
  );
  return response;
}
