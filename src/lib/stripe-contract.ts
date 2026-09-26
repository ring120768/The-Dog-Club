export type StripeCheckoutResult = {
  id: string;
  url: string;
  expiresAt: Date;
};

export type StripeCheckoutInput = {
  connectedAccountId: string;
  customerEmail: string;
  priceId: string;
  clientReferenceId: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  integrationIdentifier: string;
};

export interface StripeMembershipGateway {
  createSubscriptionCheckout(
    input: StripeCheckoutInput,
  ): Promise<StripeCheckoutResult>;
  scheduleCancellation(input: {
    connectedAccountId: string;
    subscriptionId: string;
  }): Promise<void>;
}

export type CheckoutEvent = {
  kind: "checkout.completed";
  sessionId: string;
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  customerId: string | null;
  subscriptionId: string | null;
};

export type CheckoutFailedEvent = {
  kind: "checkout.failed";
  sessionId: string;
};

export type InvoiceEvent = {
  kind: "invoice.paid" | "invoice.payment_failed";
  invoiceId: string;
  subscriptionId: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  periodStartsOn: string;
  periodEndsOn: string;
  hostedInvoiceUrl: string | null;
};

export type SubscriptionEvent = {
  kind: "subscription.updated" | "subscription.deleted";
  subscriptionId: string;
  customerId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  periodStartsOn: string;
  periodEndsOn: string;
};

export type NormalisedStripeEvent =
  | CheckoutEvent
  | CheckoutFailedEvent
  | InvoiceEvent
  | SubscriptionEvent
  | { kind: "ignored"; sourceType: string };

export type StripeEventEnvelope = {
  id: string;
  connectedAccountId: string;
  livemode: boolean;
  sourceType: string;
  data: NormalisedStripeEvent;
};
