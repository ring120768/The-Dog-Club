import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { createBookingPaymentHold, type GroomingBooking } from "./bookings";
import type { Db, Queryable } from "./database";
import { OnboardingError } from "./onboarding";
import type {
  CheckoutEvent,
  CheckoutFailedEvent,
  StripeServiceGateway,
} from "./stripe-contract";
import type { ClubPaymentAccount } from "./stripe-memberships";

type ServiceCheckout = {
  id: string;
  club_id: string;
  account_id: string;
  booking_id: string;
  request_id: string;
  provider_account_id: string;
  provider_session_id: string | null;
  checkout_url: string | null;
  expires_at: string;
  status:
    | "creating"
    | "open"
    | "awaiting_payment"
    | "completed"
    | "failed"
    | "expired"
    | "late_paid";
};

const checkoutRequest = z.object({
  request_id: z.uuid(),
  dog_id: z.uuid(),
  service_id: z.uuid(),
  starts_at: z.coerce.date(),
  accepted_terms: z.literal("yes"),
});

const integrationSuffix = (checkoutId: string) =>
  Array.from(
    createHash("sha256").update(checkoutId).digest().subarray(0, 8),
    (value) => String.fromCharCode(97 + (value % 26)),
  ).join("");

function applicationOrigin(appUrl: string) {
  const origin = new URL(appUrl);
  const local = ["127.0.0.1", "localhost", "10.0.2.2"].includes(
    origin.hostname,
  );
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && local))
    throw new OnboardingError("The application URL must use HTTPS.");
  return origin.origin;
}

export async function prepareServiceCheckout(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
  appUrl: string,
  gateway: StripeServiceGateway,
) {
  const data = checkoutRequest.parse(input);
  const origin = applicationOrigin(appUrl);
  const prepared = await db.transaction(async (tx) => {
    const existing = (
      await tx.query<ServiceCheckout>(
        `SELECT * FROM service_checkout_sessions
         WHERE club_id=$1 AND account_id=$2 AND request_id=$3 FOR UPDATE`,
        [club, actor, data.request_id],
      )
    ).rows[0];
    if (existing) {
      if (new Date(existing.expires_at).getTime() <= Date.now())
        throw new OnboardingError("This payment hold has expired.");
      if (!["creating", "open", "awaiting_payment"].includes(existing.status))
        throw new OnboardingError("This payment attempt is already complete.");
      const booking = (
        await tx.query<{
          amount_due_pence_snapshot: number;
          service_name: string;
          email: string;
          slug: string;
        }>(
          `SELECT b.amount_due_pence_snapshot,s.name AS service_name,a.email,c.slug
           FROM grooming_bookings b JOIN grooming_services s ON s.club_id=b.club_id AND s.id=b.service_id
           JOIN accounts a ON a.id=$2 JOIN clubs c ON c.id=b.club_id
           WHERE b.club_id=$1 AND b.id=$3 AND b.status='awaiting_payment'`,
          [club, actor, existing.booking_id],
        )
      ).rows[0];
      if (!booking) throw new OnboardingError("Booking unavailable.");
      return {
        checkout: existing,
        amountPence: booking.amount_due_pence_snapshot,
        serviceName: booking.service_name,
        email: booking.email,
        slug: booking.slug,
      };
    }
    const payment = (
      await tx.query<ClubPaymentAccount>(
        `SELECT club_id,environment,external_account_id,status,charges_enabled,details_submitted
         FROM club_payment_accounts WHERE club_id=$1`,
        [club],
      )
    ).rows[0];
    if (
      !payment ||
      payment.environment !== "sandbox" ||
      payment.status !== "connected" ||
      !payment.charges_enabled ||
      !payment.details_submitted
    )
      throw new OnboardingError("Stripe sandbox checkout is not available.");
    const account = (
      await tx.query<{ email: string; slug: string }>(
        `SELECT a.email,c.slug FROM memberships m JOIN accounts a ON a.id=m.account_id
         JOIN clubs c ON c.id=m.club_id WHERE m.club_id=$1 AND m.account_id=$2`,
        [club, actor],
      )
    ).rows[0];
    if (!account) throw new OnboardingError("Club membership required.");
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    const hold = await createBookingPaymentHold(
      tx,
      actor,
      club,
      data,
      expiresAt,
    );
    const checkout: ServiceCheckout = {
      id: randomUUID(),
      club_id: club,
      account_id: actor,
      booking_id: hold.bookingId,
      request_id: data.request_id,
      provider_account_id: payment.external_account_id,
      provider_session_id: null,
      checkout_url: null,
      expires_at: expiresAt.toISOString(),
      status: "creating",
    };
    await tx.query(
      `INSERT INTO service_checkout_sessions(id,club_id,account_id,booking_id,request_id,provider_account_id,expires_at,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,'creating')`,
      [
        checkout.id,
        club,
        actor,
        hold.bookingId,
        data.request_id,
        payment.external_account_id,
        expiresAt.toISOString(),
      ],
    );
    return {
      checkout,
      amountPence: hold.amountPence,
      serviceName: hold.serviceName,
      email: account.email,
      slug: account.slug,
    };
  });
  if (prepared.checkout.checkout_url)
    return {
      bookingId: prepared.checkout.booking_id,
      checkoutUrl: prepared.checkout.checkout_url,
      expiresAt: new Date(prepared.checkout.expires_at),
    };
  const session = await gateway.createServiceCheckout({
    connectedAccountId: prepared.checkout.provider_account_id,
    customerEmail: prepared.email,
    amountPence: prepared.amountPence,
    serviceName: prepared.serviceName,
    clientReferenceId: prepared.checkout.id,
    bookingId: prepared.checkout.booking_id,
    successUrl: `${origin}/club/${prepared.slug}/bookings?payment=returned`,
    cancelUrl: `${origin}/club/${prepared.slug}/bookings?payment=cancelled`,
    expiresAt: new Date(prepared.checkout.expires_at),
    idempotencyKey: `service-checkout:${prepared.checkout.id}`,
    integrationIdentifier: `dogclub_service_${integrationSuffix(prepared.checkout.id)}`,
  });
  const effectiveExpiry = new Date(
    Math.min(
      session.expiresAt.getTime(),
      new Date(prepared.checkout.expires_at).getTime(),
    ),
  );
  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE service_checkout_sessions SET provider_session_id=$1,checkout_url=$2,expires_at=$3,status='open',updated_at=now()
       WHERE id=$4 AND status='creating'`,
      [
        session.id,
        session.url,
        effectiveExpiry.toISOString(),
        prepared.checkout.id,
      ],
    );
    await tx.query(
      "UPDATE grooming_bookings SET payment_hold_expires_at=$1 WHERE club_id=$2 AND id=$3 AND status='awaiting_payment'",
      [effectiveExpiry.toISOString(), club, prepared.checkout.booking_id],
    );
  });
  return {
    bookingId: prepared.checkout.booking_id,
    checkoutUrl: session.url,
    expiresAt: effectiveExpiry,
  };
}

export type ServiceCheckoutStatus = {
  bookingId: string;
  status: "awaiting_payment" | "confirmed" | "failed" | "expired" | "late_paid";
  expiresAt: Date;
};

export async function serviceCheckoutStatusFor(
  db: Db,
  actor: string,
  club: string,
  booking: string,
): Promise<ServiceCheckoutStatus | null> {
  if (!z.uuid().safeParse(booking).success) return null;
  // These tables deliberately have no client grants. The server query therefore
  // applies the account and club boundary explicitly instead of assuming RLS.
  const checkout = (
    await db.query<{
      booking_id: string;
      checkout_status: ServiceCheckout["status"];
      booking_status: GroomingBooking["status"];
      expires_at: string;
    }>(
      `SELECT c.booking_id,c.status AS checkout_status,b.status AS booking_status,c.expires_at
       FROM service_checkout_sessions c
       JOIN grooming_bookings b ON b.club_id=c.club_id AND b.id=c.booking_id
       JOIN memberships m ON m.club_id=c.club_id AND m.account_id=$1
       WHERE c.club_id=$2 AND c.booking_id=$3 AND c.account_id=$1`,
      [actor, club, booking],
    )
  ).rows[0];
  if (!checkout) return null;
  const expiresAt = new Date(checkout.expires_at);
  let status: ServiceCheckoutStatus["status"];
  if (
    ["creating", "open", "awaiting_payment"].includes(
      checkout.checkout_status,
    ) &&
    expiresAt.getTime() <= Date.now()
  )
    status = "expired";
  else if (
    checkout.checkout_status === "completed" ||
    checkout.booking_status === "confirmed"
  )
    status = "confirmed";
  else if (checkout.checkout_status === "late_paid") status = "late_paid";
  else if (checkout.checkout_status === "failed") status = "failed";
  else if (checkout.checkout_status === "expired") status = "expired";
  else status = "awaiting_payment";
  return { bookingId: checkout.booking_id, status, expiresAt };
}

export async function applyServiceCheckoutEvent(
  tx: Queryable,
  providerAccount: string,
  event: CheckoutEvent | CheckoutFailedEvent,
) {
  const checkout = (
    await tx.query<ServiceCheckout>(
      `SELECT * FROM service_checkout_sessions
       WHERE provider_account_id=$1 AND provider_session_id=$2 FOR UPDATE`,
      [providerAccount, event.sessionId],
    )
  ).rows[0];
  if (!checkout) return false;
  const booking = (
    await tx.query<GroomingBooking>(
      "SELECT * FROM grooming_bookings WHERE club_id=$1 AND id=$2 FOR UPDATE",
      [checkout.club_id, checkout.booking_id],
    )
  ).rows[0];
  if (!booking) throw new Error("Service checkout booking is missing.");
  if (event.kind === "checkout.failed") {
    if (booking.status === "awaiting_payment") {
      await tx.query(
        "UPDATE grooming_bookings SET status='cancelled',payment_hold_expires_at=NULL,cancellation_reason='Stripe payment failed',cancelled_at=now(),version=version+1 WHERE club_id=$1 AND id=$2",
        [checkout.club_id, checkout.booking_id],
      );
      await tx.query(
        "INSERT INTO booking_events(club_id,booking_id,actor_id,actor_kind,action,reason) VALUES($1,$2,NULL,'stripe','booking.payment_failed','Stripe Checkout reported payment failure')",
        [checkout.club_id, checkout.booking_id],
      );
    }
    await tx.query(
      "UPDATE service_checkout_sessions SET status='failed',checkout_url=NULL,updated_at=now() WHERE id=$1",
      [checkout.id],
    );
    return true;
  }
  if (event.paymentStatus === "unpaid") {
    await tx.query(
      "UPDATE service_checkout_sessions SET status='awaiting_payment',updated_at=now() WHERE id=$1",
      [checkout.id],
    );
    return true;
  }
  if (
    event.clientReferenceId !== checkout.id ||
    event.amountTotal !== booking.amount_due_pence_snapshot ||
    event.currency !== "gbp" ||
    !event.paymentIntentId
  )
    throw new Error("Stripe service payment does not match the booking.");
  const existingPayment = await tx.query(
    "SELECT 1 FROM service_payments WHERE provider_account_id=$1 AND provider_session_id=$2",
    [providerAccount, event.sessionId],
  );
  if (existingPayment.rows.length) return true;
  const expired =
    booking.status !== "awaiting_payment" ||
    !booking.payment_hold_expires_at ||
    new Date(booking.payment_hold_expires_at).getTime() <= Date.now() ||
    new Date(checkout.expires_at).getTime() <= Date.now();
  const paymentId = randomUUID();
  await tx.query(
    `INSERT INTO service_payments(id,club_id,booking_id,account_id,provider_account_id,provider_session_id,
     provider_payment_intent_id,amount_pence,currency,status)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,'gbp',$9)`,
    [
      paymentId,
      checkout.club_id,
      checkout.booking_id,
      checkout.account_id,
      providerAccount,
      event.sessionId,
      event.paymentIntentId,
      event.amountTotal,
      expired ? "late_paid" : "captured",
    ],
  );
  if (expired) {
    if (booking.status === "awaiting_payment")
      await tx.query(
        "UPDATE grooming_bookings SET status='cancelled',payment_hold_expires_at=NULL,cancellation_reason='Payment arrived after hold expiry',cancelled_at=now(),version=version+1 WHERE club_id=$1 AND id=$2",
        [checkout.club_id, checkout.booking_id],
      );
    await tx.query(
      "UPDATE service_checkout_sessions SET status='late_paid',checkout_url=NULL,updated_at=now() WHERE id=$1",
      [checkout.id],
    );
    await tx.query(
      `INSERT INTO service_payment_exceptions(id,club_id,booking_id,payment_id,kind,detail)
       VALUES($1,$2,$3,$4,'late_paid','Payment captured after the capacity hold expired; refund or staff-assisted rebooking required')`,
      [randomUUID(), checkout.club_id, checkout.booking_id, paymentId],
    );
    return true;
  }
  await tx.query(
    "UPDATE grooming_bookings SET status='confirmed',payment_hold_expires_at=NULL,version=version+1 WHERE club_id=$1 AND id=$2",
    [checkout.club_id, checkout.booking_id],
  );
  await tx.query(
    "UPDATE service_checkout_sessions SET status='completed',checkout_url=NULL,updated_at=now() WHERE id=$1",
    [checkout.id],
  );
  await tx.query(
    "INSERT INTO booking_events(club_id,booking_id,actor_id,actor_kind,action,reason) VALUES($1,$2,NULL,'stripe','booking.payment_confirmed','Stripe payment captured')",
    [checkout.club_id, checkout.booking_id],
  );
  return true;
}

export async function expireServicePaymentHolds(db: Db, now = new Date()) {
  return db.transaction(async (tx) => {
    const expired = await tx.query<{
      id: string;
      club_id: string;
      booking_id: string;
    }>(
      `SELECT c.id,c.club_id,c.booking_id FROM service_checkout_sessions c
       JOIN grooming_bookings b ON b.club_id=c.club_id AND b.id=c.booking_id
       WHERE c.status IN ('creating','open','awaiting_payment') AND c.expires_at<=$1
       AND b.status='awaiting_payment' FOR UPDATE OF c,b`,
      [now.toISOString()],
    );
    for (const item of expired.rows) {
      await tx.query(
        "UPDATE grooming_bookings SET status='cancelled',payment_hold_expires_at=NULL,cancellation_reason='Payment hold expired',cancelled_at=$1,version=version+1 WHERE club_id=$2 AND id=$3",
        [now.toISOString(), item.club_id, item.booking_id],
      );
      await tx.query(
        "UPDATE service_checkout_sessions SET status='expired',checkout_url=NULL,updated_at=$1 WHERE id=$2",
        [now.toISOString(), item.id],
      );
      await tx.query(
        "INSERT INTO booking_events(club_id,booking_id,actor_id,actor_kind,action,reason,created_at) VALUES($1,$2,NULL,'system','booking.payment_expired','Payment hold expired',$3)",
        [item.club_id, item.booking_id, now.toISOString()],
      );
    }
    return expired.rows.length;
  });
}
