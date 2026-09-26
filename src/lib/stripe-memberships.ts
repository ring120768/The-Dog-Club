import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db, Queryable } from "./database";
import { OnboardingError } from "./onboarding";
import type {
  CheckoutEvent,
  InvoiceEvent,
  NormalisedStripeEvent,
  StripeEventEnvelope,
  StripeMembershipGateway,
  SubscriptionEvent,
} from "./stripe-contract";

export type ClubPaymentAccount = {
  club_id: string;
  environment: "sandbox" | "live";
  external_account_id: string;
  status: "connected" | "restricted" | "disconnected";
  charges_enabled: boolean;
  details_submitted: boolean;
};

type CheckoutPreparation = {
  checkoutId: string;
  email: string;
  priceId: string;
  connectedAccountId: string;
  existingUrl: string | null;
  slug: string;
};

type StripeLink = {
  club_id: string;
  account_id: string;
  plan_id: string;
  provider_account_id: string;
  provider_customer_id: string;
  provider_subscription_id: string;
  provider_price_id: string;
};

type StoredWebhook = {
  provider_account_id: string;
  provider_event_id: string;
  event_type: string;
  livemode: boolean;
  status: "pending" | "processed" | "ignored" | "failed";
  event_data: NormalisedStripeEvent | string;
};

const stripeAccountId = z.string().regex(/^acct_[A-Za-z0-9_]+$/);
const stripePriceId = z.string().regex(/^price_[A-Za-z0-9_]+$/);

async function requireManager(tx: Queryable, actor: string, club: string) {
  const result = await tx.query(
    "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2 AND role='manager'",
    [club, actor],
  );
  if (!result.rows.length)
    throw new OnboardingError("Manager access required.");
}

async function requirePlatformOwner(tx: Queryable, actor: string) {
  const result = await tx.query(
    "SELECT 1 FROM platform_owners WHERE account_id=$1",
    [actor],
  );
  if (!result.rows.length)
    throw new OnboardingError("Platform access is required.");
}

export async function configureStripeSandboxAccount(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({
      external_account_id: stripeAccountId,
      status: z.enum(["connected", "restricted", "disconnected"]),
      charges_enabled: z.boolean(),
      details_submitted: z.boolean(),
    })
    .parse(input);
  await db.transaction(async (tx) => {
    await requirePlatformOwner(tx, actor);
    const exists = await tx.query("SELECT 1 FROM clubs WHERE id=$1", [club]);
    if (!exists.rows.length) throw new OnboardingError("Club unavailable.");
    await tx.query(
      `INSERT INTO club_payment_accounts(club_id,environment,external_account_id,status,charges_enabled,details_submitted,configured_by)
       VALUES($1,'sandbox',$2,$3,$4,$5,$6)
       ON CONFLICT(club_id) DO UPDATE SET environment='sandbox',external_account_id=excluded.external_account_id,
       status=excluded.status,charges_enabled=excluded.charges_enabled,details_submitted=excluded.details_submitted,
       configured_by=excluded.configured_by,updated_at=now()`,
      [
        club,
        data.external_account_id,
        data.status,
        data.charges_enabled,
        data.details_submitted,
        actor,
      ],
    );
  });
}

export async function setPlanStripePrice(
  db: Db,
  actor: string,
  club: string,
  plan: string,
  price: string,
) {
  z.uuid().parse(plan);
  stripePriceId.parse(price);
  await db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const updated = await tx.query(
      "UPDATE membership_plans SET stripe_price_id=$1 WHERE club_id=$2 AND id=$3 AND active",
      [price, club, plan],
    );
    if (!updated.affectedRows)
      throw new OnboardingError("Membership plan unavailable.");
  });
}

export async function stripePriceLinkContext(
  db: Db,
  actor: string,
  club: string,
  plan: string,
) {
  z.uuid().parse(plan);
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const context = (
      await tx.query<{
        monthly_price_pence: number;
        external_account_id: string;
      }>(
        `SELECT p.monthly_price_pence,a.external_account_id
         FROM membership_plans p JOIN club_payment_accounts a ON a.club_id=p.club_id
         WHERE p.club_id=$1 AND p.id=$2 AND p.active AND a.environment='sandbox'
         AND a.status='connected' AND a.charges_enabled AND a.details_submitted`,
        [club, plan],
      )
    ).rows[0];
    if (!context)
      throw new OnboardingError(
        "Connect the club's Stripe sandbox account before linking a Price.",
      );
    return context;
  });
}

export function validateMembershipPrice(
  expectedAmount: number,
  price: {
    active: boolean;
    currency: string;
    unitAmount: number | null;
    recurringInterval: string | null;
    recurringIntervalCount: number | null;
  },
) {
  if (
    !price.active ||
    price.currency !== "gbp" ||
    price.unitAmount !== expectedAmount ||
    price.recurringInterval !== "month" ||
    price.recurringIntervalCount !== 1
  )
    throw new OnboardingError(
      "Use an active monthly GBP Price matching this plan's displayed amount.",
    );
}

export async function paymentAccountFor(db: Db, club: string) {
  return (
    await db.query<ClubPaymentAccount>(
      "SELECT club_id,environment,external_account_id,status,charges_enabled,details_submitted FROM club_payment_accounts WHERE club_id=$1",
      [club],
    )
  ).rows[0];
}

const integrationSuffix = (checkoutId: string) =>
  Array.from(
    createHash("sha256").update(checkoutId).digest().subarray(0, 8),
    (value) => String.fromCharCode(97 + (value % 26)),
  ).join("");

export async function prepareMembershipCheckout(
  db: Db,
  actor: string,
  club: string,
  plan: string,
  appUrl: string,
  gateway: StripeMembershipGateway,
) {
  z.uuid().parse(plan);
  const origin = new URL(appUrl);
  if (!/^https?:$/.test(origin.protocol))
    throw new OnboardingError("The application URL is invalid.");
  const prepared = await db.transaction<CheckoutPreparation>(async (tx) => {
    const membership = await tx.query(
      "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2 FOR UPDATE",
      [club, actor],
    );
    if (!membership.rows.length)
      throw new OnboardingError("Club membership required.");
    const existingSubscription = await tx.query(
      "SELECT 1 FROM member_subscriptions WHERE club_id=$1 AND account_id=$2 AND state<>'ended'",
      [club, actor],
    );
    if (existingSubscription.rows.length)
      throw new OnboardingError("You already have a current membership.");
    const selected = (
      await tx.query<{ stripe_price_id: string; email: string; slug: string }>(
        `SELECT p.stripe_price_id,a.email,c.slug FROM membership_plans p CROSS JOIN accounts a
         JOIN clubs c ON c.id=p.club_id
         WHERE p.club_id=$1 AND p.id=$2 AND p.active AND p.stripe_price_id IS NOT NULL AND a.id=$3`,
        [club, plan, actor],
      )
    ).rows[0];
    if (!selected)
      throw new OnboardingError(
        "This plan is not available for online checkout.",
      );
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
    const existing = (
      await tx.query<{
        id: string;
        plan_id: string;
        checkout_url: string | null;
        expires_at: Date | string | null;
      }>(
        `SELECT id,plan_id,checkout_url,expires_at FROM membership_checkout_sessions
         WHERE club_id=$1 AND account_id=$2 AND status IN ('creating','open','awaiting_payment')
         ORDER BY created_at DESC LIMIT 1`,
        [club, actor],
      )
    ).rows[0];
    const expired =
      existing?.expires_at &&
      new Date(existing.expires_at).getTime() <= Date.now();
    if (expired)
      await tx.query(
        "UPDATE membership_checkout_sessions SET status='expired',checkout_url=NULL,updated_at=now() WHERE id=$1",
        [existing.id],
      );
    if (existing && !expired && existing.plan_id !== plan)
      throw new OnboardingError(
        "You already have a checkout in progress for another membership plan.",
      );
    const reusable = existing && !expired ? existing : undefined;
    const checkoutId = reusable?.id ?? randomUUID();
    if (!reusable)
      await tx.query(
        `INSERT INTO membership_checkout_sessions(id,club_id,account_id,plan_id,provider_account_id,status)
         VALUES($1,$2,$3,$4,$5,'creating')`,
        [checkoutId, club, actor, plan, payment.external_account_id],
      );
    return {
      checkoutId,
      email: selected.email,
      priceId: selected.stripe_price_id,
      connectedAccountId: payment.external_account_id,
      existingUrl: reusable?.checkout_url ?? null,
      slug: selected.slug,
    };
  });
  if (prepared.existingUrl) return prepared.existingUrl;
  try {
    const session = await gateway.createSubscriptionCheckout({
      connectedAccountId: prepared.connectedAccountId,
      customerEmail: prepared.email,
      priceId: prepared.priceId,
      clientReferenceId: prepared.checkoutId,
      successUrl: `${origin.origin}/club/${prepared.slug}/memberships?checkout=returned`,
      cancelUrl: `${origin.origin}/club/${prepared.slug}/memberships?checkout=cancelled`,
      idempotencyKey: `membership-checkout:${prepared.checkoutId}`,
      integrationIdentifier: `dogclub_membership_${integrationSuffix(prepared.checkoutId)}`,
    });
    await db.query(
      `UPDATE membership_checkout_sessions SET provider_session_id=$1,checkout_url=$2,expires_at=$3,status='open',updated_at=now()
       WHERE id=$4 AND status='creating'`,
      [session.id, session.url, session.expiresAt, prepared.checkoutId],
    );
    return session.url;
  } catch (error) {
    // The remote request may have succeeded before the connection failed. Keep
    // this attempt and its idempotency key so Stripe can safely replay it.
    throw error;
  }
}

function eventData(value: StoredWebhook["event_data"]) {
  return typeof value === "string"
    ? (JSON.parse(value) as NormalisedStripeEvent)
    : value;
}

async function stripeLink(
  tx: Queryable,
  account: string,
  subscription: string,
) {
  return (
    await tx.query<StripeLink>(
      "SELECT * FROM stripe_subscription_links WHERE provider_account_id=$1 AND provider_subscription_id=$2 FOR UPDATE",
      [account, subscription],
    )
  ).rows[0];
}

async function createOrUpdatePaidSubscription(
  tx: Queryable,
  link: StripeLink,
  invoice: InvoiceEvent,
) {
  const previousInvoice = (
    await tx.query<{ status: string }>(
      "SELECT status FROM membership_invoices WHERE provider_account_id=$1 AND provider_invoice_id=$2 FOR UPDATE",
      [link.provider_account_id, invoice.invoiceId],
    )
  ).rows[0];
  if (previousInvoice?.status === "paid") return;
  const existing = (
    await tx.query<{ id: string; provider_subscription_id: string | null }>(
      "SELECT id,provider_subscription_id FROM member_subscriptions WHERE club_id=$1 AND account_id=$2 AND state<>'ended' FOR UPDATE",
      [link.club_id, link.account_id],
    )
  ).rows[0];
  if (
    existing?.provider_subscription_id &&
    existing.provider_subscription_id !== link.provider_subscription_id
  )
    throw new Error("A different current membership already exists.");
  const subscriptionId = existing?.id ?? randomUUID();
  if (existing) {
    await tx.query(
      `UPDATE member_subscriptions SET state='active',source='stripe',plan_id=$1,period_starts_on=$2,period_ends_on=$3,
       cancellation_effective_on=NULL,ended_at=NULL,provider_account_id=$4,provider_customer_id=$5,
       provider_subscription_id=$6,provider_price_id=$7,latest_paid_invoice_id=$8,updated_at=now(),version=version+1
       WHERE club_id=$9 AND id=$10`,
      [
        link.plan_id,
        invoice.periodStartsOn,
        invoice.periodEndsOn,
        link.provider_account_id,
        link.provider_customer_id,
        link.provider_subscription_id,
        link.provider_price_id,
        invoice.invoiceId,
        link.club_id,
        subscriptionId,
      ],
    );
  } else {
    await tx.query(
      `INSERT INTO member_subscriptions(id,club_id,plan_id,account_id,state,source,period_starts_on,period_ends_on,
       provider_account_id,provider_customer_id,provider_subscription_id,provider_price_id,latest_paid_invoice_id)
       VALUES($1,$2,$3,$4,'active','stripe',$5,$6,$7,$8,$9,$10,$11)`,
      [
        subscriptionId,
        link.club_id,
        link.plan_id,
        link.account_id,
        invoice.periodStartsOn,
        invoice.periodEndsOn,
        link.provider_account_id,
        link.provider_customer_id,
        link.provider_subscription_id,
        link.provider_price_id,
        invoice.invoiceId,
      ],
    );
  }
  if (previousInvoice)
    await tx.query(
      `UPDATE membership_invoices SET status='paid',local_subscription_id=$1,amount_due=$2,amount_paid=$3,currency=$4,
       period_starts_on=$5,period_ends_on=$6,hosted_invoice_url=$7,received_at=now()
       WHERE provider_account_id=$8 AND provider_invoice_id=$9`,
      [
        subscriptionId,
        invoice.amountDue,
        invoice.amountPaid,
        invoice.currency,
        invoice.periodStartsOn,
        invoice.periodEndsOn,
        invoice.hostedInvoiceUrl,
        link.provider_account_id,
        invoice.invoiceId,
      ],
    );
  else
    await tx.query(
      `INSERT INTO membership_invoices(provider_account_id,provider_invoice_id,club_id,provider_subscription_id,local_subscription_id,
       status,amount_due,amount_paid,currency,period_starts_on,period_ends_on,hosted_invoice_url)
       VALUES($1,$2,$3,$4,$5,'paid',$6,$7,$8,$9,$10,$11)`,
      [
        link.provider_account_id,
        invoice.invoiceId,
        link.club_id,
        link.provider_subscription_id,
        subscriptionId,
        invoice.amountDue,
        invoice.amountPaid,
        invoice.currency,
        invoice.periodStartsOn,
        invoice.periodEndsOn,
        invoice.hostedInvoiceUrl,
      ],
    );
  {
    const plan = (
      await tx.query<{ grooming_credits_per_period: number }>(
        "SELECT grooming_credits_per_period FROM membership_plans WHERE club_id=$1 AND id=$2",
        [link.club_id, link.plan_id],
      )
    ).rows[0];
    if (plan.grooming_credits_per_period > 0)
      await tx.query(
        `INSERT INTO benefit_ledger(id,club_id,subscription_id,benefit_code,delta,entry_type,reason,actor_id,actor_kind,idempotency_key)
         VALUES($1,$2,$3,'grooming_credit',$4,'allocation','Paid Stripe membership period',NULL,'stripe',$5) ON CONFLICT DO NOTHING`,
        [
          randomUUID(),
          link.club_id,
          subscriptionId,
          plan.grooming_credits_per_period,
          `stripe-invoice:${invoice.invoiceId}`,
        ],
      );
    await tx.query(
      `INSERT INTO subscription_events(club_id,subscription_id,actor_id,actor_kind,action,from_state,to_state,reason)
       VALUES($1,$2,NULL,'stripe',$3,$4,'active',$5)`,
      [
        link.club_id,
        subscriptionId,
        existing ? "subscription.renewed" : "subscription.activated",
        existing ? "active" : null,
        `Stripe invoice ${invoice.invoiceId} paid`,
      ],
    );
  }
}

async function applyInvoice(
  tx: Queryable,
  account: string,
  invoice: InvoiceEvent,
) {
  const link = await stripeLink(tx, account, invoice.subscriptionId);
  if (!link) return false;
  if (invoice.kind === "invoice.paid") {
    await createOrUpdatePaidSubscription(tx, link, invoice);
    return true;
  }
  const local = (
    await tx.query<{ id: string }>(
      "SELECT id FROM member_subscriptions WHERE provider_account_id=$1 AND provider_subscription_id=$2 FOR UPDATE",
      [account, invoice.subscriptionId],
    )
  ).rows[0];
  let localId = local?.id;
  if (!localId) {
    localId = randomUUID();
    await tx.query(
      `INSERT INTO member_subscriptions(id,club_id,plan_id,account_id,state,source,period_starts_on,period_ends_on,
       provider_account_id,provider_customer_id,provider_subscription_id,provider_price_id)
       VALUES($1,$2,$3,$4,'payment_issue','stripe',$5,$6,$7,$8,$9,$10)`,
      [
        localId,
        link.club_id,
        link.plan_id,
        link.account_id,
        invoice.periodStartsOn,
        invoice.periodEndsOn,
        account,
        link.provider_customer_id,
        invoice.subscriptionId,
        link.provider_price_id,
      ],
    );
  }
  await tx.query(
    `INSERT INTO membership_invoices(provider_account_id,provider_invoice_id,club_id,provider_subscription_id,local_subscription_id,
     status,amount_due,amount_paid,currency,period_starts_on,period_ends_on,hosted_invoice_url)
     VALUES($1,$2,$3,$4,$5,'failed',$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
    [
      account,
      invoice.invoiceId,
      link.club_id,
      invoice.subscriptionId,
      localId,
      invoice.amountDue,
      invoice.amountPaid,
      invoice.currency,
      invoice.periodStartsOn,
      invoice.periodEndsOn,
      invoice.hostedInvoiceUrl,
    ],
  );
  await tx.query(
    "UPDATE member_subscriptions SET state='payment_issue',updated_at=now(),version=version+1 WHERE club_id=$1 AND id=$2",
    [link.club_id, localId],
  );
  return true;
}

const providerState = (
  status: string,
  cancelAtPeriodEnd: boolean,
): "active" | "payment_issue" | "cancellation_scheduled" | "ended" => {
  if (["canceled", "incomplete_expired"].includes(status)) return "ended";
  if (["past_due", "unpaid", "incomplete", "paused"].includes(status))
    return "payment_issue";
  return cancelAtPeriodEnd ? "cancellation_scheduled" : "active";
};

async function applySubscription(
  tx: Queryable,
  account: string,
  event: SubscriptionEvent,
) {
  const link = await stripeLink(tx, account, event.subscriptionId);
  if (!link) return false;
  if (link.provider_customer_id !== event.customerId)
    throw new Error(
      "Stripe subscription customer does not match the checkout.",
    );
  const local = (
    await tx.query<{ id: string; state: string }>(
      "SELECT id,state FROM member_subscriptions WHERE provider_account_id=$1 AND provider_subscription_id=$2 FOR UPDATE",
      [account, event.subscriptionId],
    )
  ).rows[0];
  if (!local) return false;
  const state =
    event.kind === "subscription.deleted"
      ? "ended"
      : providerState(event.status, event.cancelAtPeriodEnd);
  await tx.query(
    `UPDATE member_subscriptions SET state=$1,period_starts_on=$2,period_ends_on=$3,
     cancellation_effective_on=CASE WHEN $1='cancellation_scheduled' THEN $3::date ELSE NULL END,
     ended_at=CASE WHEN $1='ended' THEN now() ELSE NULL END,updated_at=now(),version=version+1
     WHERE id=$4 AND club_id=$5`,
    [state, event.periodStartsOn, event.periodEndsOn, local.id, link.club_id],
  );
  if (state !== local.state)
    await tx.query(
      `INSERT INTO subscription_events(club_id,subscription_id,actor_id,actor_kind,action,from_state,to_state,reason)
       VALUES($1,$2,NULL,'stripe','subscription.provider_synced',$3,$4,'Stripe subscription lifecycle event')`,
      [link.club_id, local.id, local.state, state],
    );
  return true;
}

async function applyCheckout(
  tx: Queryable,
  account: string,
  event: CheckoutEvent,
) {
  const checkout = (
    await tx.query<{
      club_id: string;
      account_id: string;
      plan_id: string;
    }>(
      "SELECT club_id,account_id,plan_id FROM membership_checkout_sessions WHERE provider_account_id=$1 AND provider_session_id=$2 FOR UPDATE",
      [account, event.sessionId],
    )
  ).rows[0];
  if (!checkout) return false;
  if (!event.customerId || !event.subscriptionId)
    throw new Error("Stripe checkout is missing customer or subscription.");
  const plan = (
    await tx.query<{ stripe_price_id: string }>(
      "SELECT stripe_price_id FROM membership_plans WHERE club_id=$1 AND id=$2",
      [checkout.club_id, checkout.plan_id],
    )
  ).rows[0];
  if (!plan?.stripe_price_id)
    throw new Error("The membership plan no longer has a Stripe Price.");
  const existingLink = await stripeLink(tx, account, event.subscriptionId);
  if (
    existingLink &&
    (existingLink.club_id !== checkout.club_id ||
      existingLink.account_id !== checkout.account_id ||
      existingLink.plan_id !== checkout.plan_id ||
      existingLink.provider_customer_id !== event.customerId ||
      existingLink.provider_price_id !== plan.stripe_price_id)
  )
    throw new Error(
      "Stripe subscription is already linked to another membership.",
    );
  await tx.query(
    `INSERT INTO stripe_subscription_links(club_id,account_id,plan_id,provider_account_id,provider_customer_id,provider_subscription_id,provider_price_id)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(provider_account_id,provider_subscription_id) DO UPDATE SET updated_at=now()`,
    [
      checkout.club_id,
      checkout.account_id,
      checkout.plan_id,
      account,
      event.customerId,
      event.subscriptionId,
      plan.stripe_price_id,
    ],
  );
  if (event.paymentStatus === "unpaid") {
    await tx.query(
      "UPDATE membership_checkout_sessions SET status='awaiting_payment',updated_at=now() WHERE provider_account_id=$1 AND provider_session_id=$2",
      [account, event.sessionId],
    );
    return true;
  }
  await tx.query(
    "UPDATE membership_checkout_sessions SET status='completed',checkout_url=NULL,updated_at=now() WHERE provider_account_id=$1 AND provider_session_id=$2",
    [account, event.sessionId],
  );
  return true;
}

async function processOne(db: Db, account: string, eventId: string) {
  try {
    return await db.transaction(async (tx) => {
      const stored = (
        await tx.query<StoredWebhook>(
          "SELECT * FROM payment_webhook_events WHERE provider_account_id=$1 AND provider_event_id=$2 FOR UPDATE",
          [account, eventId],
        )
      ).rows[0];
      if (!stored || stored.status !== "pending") return false;
      const data = eventData(stored.event_data);
      let applied = false;
      if (data.kind === "ignored") {
        await tx.query(
          "UPDATE payment_webhook_events SET status='ignored',processed_at=now(),attempts=attempts+1 WHERE provider_account_id=$1 AND provider_event_id=$2",
          [account, eventId],
        );
        return true;
      }
      if (data.kind === "checkout.completed")
        applied = await applyCheckout(tx, account, data);
      else if (data.kind === "checkout.failed") {
        const failed = await tx.query(
          `UPDATE membership_checkout_sessions SET status='failed',checkout_url=NULL,updated_at=now()
           WHERE provider_account_id=$1 AND provider_session_id=$2`,
          [account, data.sessionId],
        );
        applied = Boolean(failed.affectedRows);
      } else if (
        data.kind === "invoice.paid" ||
        data.kind === "invoice.payment_failed"
      )
        applied = await applyInvoice(tx, account, data);
      else if (
        data.kind === "subscription.updated" ||
        data.kind === "subscription.deleted"
      )
        applied = await applySubscription(tx, account, data);
      await tx.query(
        `UPDATE payment_webhook_events SET status=$1,processed_at=CASE WHEN $1='processed' THEN now() ELSE NULL END,
         attempts=attempts+1,last_error=CASE WHEN $1='pending' THEN 'Waiting for a prerequisite event.' ELSE NULL END
         WHERE provider_account_id=$2 AND provider_event_id=$3`,
        [applied ? "processed" : "pending", account, eventId],
      );
      return applied;
    });
  } catch (error) {
    await db.query(
      `UPDATE payment_webhook_events SET status='failed',attempts=attempts+1,last_error=$1
       WHERE provider_account_id=$2 AND provider_event_id=$3`,
      [
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Processing failed",
        account,
        eventId,
      ],
    );
    throw error;
  }
}

export async function recordStripeWebhookEvent(
  db: Db,
  envelope: StripeEventEnvelope,
) {
  stripeAccountId.parse(envelope.connectedAccountId);
  const inserted = await db.transaction(async (tx) => {
    const configured = (
      await tx.query<ClubPaymentAccount>(
        "SELECT * FROM club_payment_accounts WHERE external_account_id=$1",
        [envelope.connectedAccountId],
      )
    ).rows[0];
    if (!configured) throw new Error("Unknown Stripe connected account.");
    if (configured.environment === "sandbox" && envelope.livemode)
      throw new Error("Live Stripe event rejected for a sandbox account.");
    if (configured.environment === "live" && !envelope.livemode)
      throw new Error("Sandbox Stripe event rejected for a live account.");
    return (
      await tx.query(
        `INSERT INTO payment_webhook_events(provider_account_id,provider_event_id,event_type,livemode,status,event_data)
         VALUES($1,$2,$3,$4,'pending',$5::jsonb) ON CONFLICT DO NOTHING`,
        [
          envelope.connectedAccountId,
          envelope.id,
          envelope.sourceType,
          envelope.livemode,
          JSON.stringify(envelope.data),
        ],
      )
    ).affectedRows;
  });
  const duplicate = !inserted;
  if (duplicate) {
    const existing = (
      await db.query<{ status: string }>(
        "SELECT status FROM payment_webhook_events WHERE provider_account_id=$1 AND provider_event_id=$2",
        [envelope.connectedAccountId, envelope.id],
      )
    ).rows[0];
    if (existing?.status === "processed" || existing?.status === "ignored")
      return { duplicate: true };
    if (existing?.status === "failed")
      await db.query(
        `UPDATE payment_webhook_events SET status='pending',last_error=NULL
         WHERE provider_account_id=$1 AND provider_event_id=$2`,
        [envelope.connectedAccountId, envelope.id],
      );
  }
  for (let pass = 0; pass < 3; pass += 1) {
    const pending = (
      await db.query<{ provider_event_id: string }>(
        `SELECT provider_event_id FROM payment_webhook_events
         WHERE provider_account_id=$1 AND status='pending' ORDER BY received_at,provider_event_id`,
        [envelope.connectedAccountId],
      )
    ).rows;
    let progress = false;
    for (const event of pending)
      progress =
        (await processOne(
          db,
          envelope.connectedAccountId,
          event.provider_event_id,
        )) || progress;
    if (!progress) break;
  }
  return { duplicate };
}

export async function requestStripeCancellation(
  db: Db,
  actor: string,
  club: string,
  subscription: string,
  gateway: StripeMembershipGateway,
) {
  z.uuid().parse(subscription);
  const provider = await db.transaction(async (tx) => {
    const current = (
      await tx.query<{
        account_id: string;
        source: string;
        provider_account_id: string | null;
        provider_subscription_id: string | null;
      }>(
        "SELECT account_id,source,provider_account_id,provider_subscription_id FROM member_subscriptions WHERE club_id=$1 AND id=$2 FOR UPDATE",
        [club, subscription],
      )
    ).rows[0];
    if (!current) throw new OnboardingError("Membership unavailable.");
    const manager = await tx.query(
      "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2 AND role='manager'",
      [club, actor],
    );
    if (current.account_id !== actor && !manager.rows.length)
      throw new OnboardingError("Membership unavailable.");
    if (
      current.source !== "stripe" ||
      !current.provider_account_id ||
      !current.provider_subscription_id
    )
      throw new OnboardingError("This membership is not managed by Stripe.");
    return {
      connectedAccountId: current.provider_account_id,
      subscriptionId: current.provider_subscription_id,
    };
  });
  await gateway.scheduleCancellation(provider);
}
