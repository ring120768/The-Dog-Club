import { database } from "@/lib/database";
import { clubsFor } from "@/lib/dogs";
import { mobileBookingOptionsFor } from "@/lib/mobile-booking";
import {
  mobileJson,
  mobileOptions,
  rejectDisallowedMobileOrigin,
} from "@/lib/mobile-http";
import { mobileAccount } from "@/lib/mobile-session";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return mobileOptions(request);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ club: string }> },
) {
  const forbidden = rejectDisallowedMobileOrigin(request);
  if (forbidden) return forbidden;
  const db = await database();
  const account = await mobileAccount(db, request.headers.get("authorization"));
  if (!account)
    return mobileJson(request, { error: "Sign in required." }, { status: 401 });
  const { club: slug } = await params;
  const club = (await clubsFor(db, account.id)).find(
    (item) => item.slug === slug,
  );
  if (!club)
    return mobileJson(
      request,
      { error: "Club was not found." },
      { status: 404 },
    );
  return mobileJson(
    request,
    await mobileBookingOptionsFor(db, account.id, club.id),
  );
}
