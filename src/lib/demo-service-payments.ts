import { z } from "zod";
import type { Db } from "./database";
import { isDemoMode, type RuntimeEnvironment } from "./runtime";
import { applyServiceCheckoutEvent } from "./service-payments";
import type { StripeServiceGateway } from "./stripe-contract";

const checkoutId = z.uuid();
const demoOutcome = z.enum(["paid", "failed"]);

function requireDemo(environment: RuntimeEnvironment) {
  if (!isDemoMode(environment))
    throw new Error("Demo Checkout is unavailable.");
}

export const demoServiceGateway: StripeServiceGateway = {
  async createServiceCheckout(input) {
    const origin = new URL(input.successUrl).origin;
    const compactId = input.clientReferenceId.replaceAll("-", "");
    return {
      id: `cs_demo_${compactId}`,
      url: `${origin}/demo-checkout/${input.clientReferenceId}`,
      expiresAt: input.expiresAt,
    };
  },
};

export async function ensureDemoServicePaymentAccount(
  db: Db,
  club: string,
  environment: RuntimeEnvironment = process.env,
) {
  requireDemo(environment);
  await db.query(
    `INSERT INTO club_payment_accounts(
       club_id,environment,external_account_id,status,charges_enabled,details_submitted,configured_by
     ) VALUES($1,'sandbox',$2,'connected',true,true,'platform-owner')
     ON CONFLICT(club_id) DO UPDATE SET
       environment='sandbox',external_account_id=excluded.external_account_id,
       status='connected',charges_enabled=true,details_submitted=true,
       configured_by='platform-owner',updated_at=now()`,
    [club, `acct_demo_${club.replaceAll(/[^A-Za-z0-9_]/g, "_")}`],
  );
}

export type DemoServiceCheckout = {
  id: string;
  bookingId: string;
  clubName: string;
  dogName: string;
  serviceName: string;
  startsAt: Date;
  amountPence: number;
  expiresAt: Date;
  status: "open" | "confirmed" | "failed" | "expired" | "late_paid";
};

export async function demoServiceCheckoutFor(
  db: Db,
  id: string,
  environment: RuntimeEnvironment = process.env,
): Promise<DemoServiceCheckout | null> {
  requireDemo(environment);
  const parsed = checkoutId.safeParse(id);
  if (!parsed.success) return null;
  const item = (
    await db.query<{
      id: string;
      booking_id: string;
      checkout_status: string;
      booking_status: string;
      club_name: string;
      dog_name: string;
      service_name: string;
      starts_at: string;
      amount_pence: number;
      expires_at: string;
    }>(
      `SELECT c.id,c.booking_id,c.status AS checkout_status,b.status AS booking_status,
       club.name AS club_name,d.name AS dog_name,s.name AS service_name,b.starts_at,
       b.amount_due_pence_snapshot AS amount_pence,c.expires_at
       FROM service_checkout_sessions c
       JOIN grooming_bookings b ON b.club_id=c.club_id AND b.id=c.booking_id
       JOIN clubs club ON club.id=c.club_id
       JOIN dogs d ON d.club_id=b.club_id AND d.id=b.dog_id
       JOIN grooming_services s ON s.club_id=b.club_id AND s.id=b.service_id
       WHERE c.id=$1 AND c.provider_account_id LIKE 'acct_demo_%'`,
      [parsed.data],
    )
  ).rows[0];
  if (!item) return null;
  const expiresAt = new Date(item.expires_at);
  const expired =
    ["creating", "open", "awaiting_payment"].includes(item.checkout_status) &&
    expiresAt.getTime() <= Date.now();
  const status: DemoServiceCheckout["status"] = expired
    ? "expired"
    : item.checkout_status === "completed" ||
        item.booking_status === "confirmed"
      ? "confirmed"
      : item.checkout_status === "late_paid"
        ? "late_paid"
        : ["failed", "expired"].includes(item.checkout_status)
          ? (item.checkout_status as "failed" | "expired")
          : "open";
  return {
    id: item.id,
    bookingId: item.booking_id,
    clubName: item.club_name,
    dogName: item.dog_name,
    serviceName: item.service_name,
    startsAt: new Date(item.starts_at),
    amountPence: item.amount_pence,
    expiresAt,
    status,
  };
}

export async function completeDemoServiceCheckout(
  db: Db,
  id: string,
  outcome: "paid" | "failed",
  environment: RuntimeEnvironment = process.env,
) {
  requireDemo(environment);
  const parsedOutcome = demoOutcome.parse(outcome);
  const checkout = await demoServiceCheckoutFor(db, id, environment);
  if (!checkout) throw new Error("Demo Checkout was not found.");
  if (checkout.status !== "open") return checkout.status;
  if (checkout.expiresAt.getTime() <= Date.now()) return "expired";
  const provider = (
    await db.query<{
      provider_account_id: string;
      provider_session_id: string;
    }>(
      `SELECT provider_account_id,provider_session_id FROM service_checkout_sessions
       WHERE id=$1 AND provider_account_id LIKE 'acct_demo_%'`,
      [checkout.id],
    )
  ).rows[0];
  if (!provider?.provider_session_id)
    throw new Error("Demo Checkout is not ready.");
  await db.transaction(async (tx) => {
    if (parsedOutcome === "failed") {
      await applyServiceCheckoutEvent(tx, provider.provider_account_id, {
        kind: "checkout.failed",
        sessionId: provider.provider_session_id,
      });
      return;
    }
    await applyServiceCheckoutEvent(tx, provider.provider_account_id, {
      kind: "checkout.completed",
      sessionId: provider.provider_session_id,
      paymentStatus: "paid",
      customerId: null,
      subscriptionId: null,
      amountTotal: checkout.amountPence,
      currency: "gbp",
      paymentIntentId: `pi_demo_${checkout.id.replaceAll("-", "")}`,
      clientReferenceId: checkout.id,
    });
  });
  return (
    (await demoServiceCheckoutFor(db, id, environment))?.status ?? "failed"
  );
}
