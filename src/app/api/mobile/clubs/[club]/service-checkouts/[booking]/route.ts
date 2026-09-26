import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import {
  mobileJson,
  mobileOptions,
  rejectDisallowedMobileOrigin,
} from "@/lib/mobile-http";
import { mobileAccount } from "@/lib/mobile-session";
import { serviceCheckoutStatusFor } from "@/lib/service-payments";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return mobileOptions(request);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ club: string; booking: string }> },
) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  const db = await database();
  const account = await mobileAccount(db, request.headers.get("authorization"));
  if (!account)
    return mobileJson(request, { error: "Sign in required." }, { status: 401 });
  const { club: slug, booking } = await params;
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  if (!club)
    return mobileJson(
      request,
      { error: "Club was not found." },
      { status: 404 },
    );
  const status = await serviceCheckoutStatusFor(
    db,
    account.id,
    club.id,
    booking,
  );
  if (!status)
    return mobileJson(
      request,
      { error: "Payment status was not found." },
      { status: 404 },
    );
  return mobileJson(request, status);
}
