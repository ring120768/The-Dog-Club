import type Stripe from "stripe";
import type {
  NormalisedStripeEvent,
  StripeEventEnvelope,
} from "./stripe-contract";

const id = (value: string | { id: string } | null) =>
  typeof value === "string" ? value : (value?.id ?? null);

const date = (seconds: number) =>
  new Date(seconds * 1000).toISOString().slice(0, 10);

function invoiceSubscription(invoice: Stripe.Invoice) {
  return id(invoice.parent?.subscription_details?.subscription ?? null);
}

export function normaliseStripeEvent(event: Stripe.Event): StripeEventEnvelope {
  const connectedAccountId = event.account;
  if (!connectedAccountId)
    throw new Error("A connected-account Stripe event is required.");
  let data: NormalisedStripeEvent;
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    if (
      !["paid", "unpaid", "no_payment_required"].includes(
        session.payment_status,
      )
    )
      throw new Error("Stripe checkout returned an unknown payment status.");
    data = {
      kind: "checkout.completed",
      sessionId: session.id,
      paymentStatus: session.payment_status as
        "paid" | "unpaid" | "no_payment_required",
      customerId: id(session.customer),
      subscriptionId: id(session.subscription),
      amountTotal: session.amount_total,
      currency: session.currency,
      paymentIntentId: id(session.payment_intent),
      clientReferenceId: session.client_reference_id,
    };
  } else if (event.type === "checkout.session.async_payment_failed") {
    data = { kind: "checkout.failed", sessionId: event.data.object.id };
  } else if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed"
  ) {
    const invoice = event.data.object;
    const subscriptionId = invoiceSubscription(invoice);
    const line = invoice.lines.data[0];
    if (!subscriptionId || !line)
      throw new Error("Stripe invoice is missing its subscription period.");
    data = {
      kind:
        event.type === "invoice.paid"
          ? "invoice.paid"
          : "invoice.payment_failed",
      invoiceId: invoice.id,
      subscriptionId,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      periodStartsOn: date(line.period.start),
      periodEndsOn: date(line.period.end),
      hostedInvoiceUrl: invoice.hosted_invoice_url?.startsWith("https://")
        ? invoice.hosted_invoice_url
        : null,
    };
  } else if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object;
    const item = subscription.items.data[0];
    const customerId = id(subscription.customer);
    if (!item || !customerId)
      throw new Error("Stripe subscription is missing its billed period.");
    data = {
      kind:
        event.type === "customer.subscription.deleted"
          ? "subscription.deleted"
          : "subscription.updated",
      subscriptionId: subscription.id,
      customerId,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      periodStartsOn: date(item.current_period_start),
      periodEndsOn: date(item.current_period_end),
    };
  } else {
    data = { kind: "ignored", sourceType: event.type };
  }
  return {
    id: event.id,
    connectedAccountId,
    livemode: event.livemode,
    sourceType: event.type,
    data,
  };
}

export function verifyStripeWebhookWithClient(
  stripe: Stripe,
  body: string,
  signature: string,
  secret: string,
) {
  return normaliseStripeEvent(
    stripe.webhooks.constructEvent(body, signature, secret),
  );
}
