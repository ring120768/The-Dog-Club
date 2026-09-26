import { database } from "@/lib/database";
import {
  demoServiceGateway,
  ensureDemoServicePaymentAccount,
} from "@/lib/demo-service-payments";
import { clubsFor } from "@/lib/dogs";
import {
  mobileJson,
  mobileOptions,
  mobileRequestOrigin,
  rejectDisallowedMobileOrigin,
} from "@/lib/mobile-http";
import { mobileAccount } from "@/lib/mobile-session";
import { OnboardingError } from "@/lib/onboarding";
import { isDemoMode } from "@/lib/runtime";
import { prepareServiceCheckout } from "@/lib/service-payments";
import { stripeServiceGateway } from "@/lib/stripe-client";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return mobileOptions(request);
}

export async function POST(
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
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return mobileJson(
      request,
      { error: "Check the booking details and try again." },
      { status: 400 },
    );
  }
  try {
    const demo = isDemoMode();
    if (demo) await ensureDemoServicePaymentAccount(db, club.id);
    const checkout = await prepareServiceCheckout(
      db,
      account.id,
      club.id,
      input,
      demo ? mobileRequestOrigin(request) : (process.env.APP_URL ?? ""),
      demo ? demoServiceGateway : stripeServiceGateway,
    );
    return mobileJson(request, checkout, { status: 201 });
  } catch (error) {
    if (error instanceof OnboardingError)
      return mobileJson(request, { error: error.message }, { status: 400 });
    if (error instanceof Error && error.name === "ZodError")
      return mobileJson(
        request,
        { error: "Check the booking details and accept the terms." },
        { status: 400 },
      );
    throw error;
  }
}
