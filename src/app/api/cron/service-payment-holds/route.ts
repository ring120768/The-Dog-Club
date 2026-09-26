import { authorisedCronRequest } from "@/lib/cron-auth";
import { database } from "@/lib/database";
import { reconcileExpiredServicePaymentHolds } from "@/lib/service-payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const response = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

export async function GET(request: Request) {
  if (!authorisedCronRequest(request.headers.get("authorization")))
    return response({ error: "Unauthorised." }, 401);
  const result = await reconcileExpiredServicePaymentHolds(await database());
  return response({ ok: true, ...result });
}
