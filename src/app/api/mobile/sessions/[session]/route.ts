import { database } from "@/lib/database";
import {
  mobileEmpty,
  mobileJson,
  mobileOptions,
  rejectDisallowedMobileOrigin,
} from "@/lib/mobile-http";
import { mobileAccount, revokeMobileSessionById } from "@/lib/mobile-session";
import { z } from "zod";

export const runtime = "nodejs";
const sessionId = z.string().uuid();

export function OPTIONS(request: Request) {
  return mobileOptions(request);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ session: string }> },
) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  const db = await database();
  const account = await mobileAccount(db, request.headers.get("authorization"));
  if (!account)
    return mobileJson(request, { error: "Sign in again." }, { status: 401 });
  const parsed = sessionId.safeParse((await context.params).session);
  if (parsed.success)
    await revokeMobileSessionById(db, account.id, parsed.data);
  return mobileEmpty(request);
}
