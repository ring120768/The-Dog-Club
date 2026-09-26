# Grooming service payments

## Decision

Paid grooming services will use Stripe-hosted Checkout in `payment` mode through the club's configured Stripe connected account. The Dog Club will not collect card details. Eligible bookings paid fully with membership credits continue to confirm immediately and do not create a Stripe session.

This is a separate flow from membership subscriptions. A service payment buys one booking at its snapshotted GBP price. Membership Checkout creates or renews an entitlement. The two flows share connected-account configuration, webhook signature verification and the durable event inbox, but they do not share checkout or fulfilment records.

Dynamic payment methods remain enabled by omitting `payment_method_types`. Stripe Tax stays disabled until the operator confirms its VAT registrations and item treatment. Each operator remains the merchant for its customer payments unless the commercial and settlement review explicitly selects another model.

## Implemented server foundation

The local schema and domain service now implement the 30-minute capacity hold, request-level idempotency, Stripe-hosted one-time Checkout creation, signature-verified paid/failed event routing, amount/currency/account/booking matching, successful confirmation, failed and expired hold release, and late-payment exception isolation. Availability treats only unexpired payment holds as conflicts. Provider and finance tables have forced RLS and no client-role grants. Operator archives retain the service-payment ledger and exceptions while removing hosted Checkout URLs.

This foundation is not exposed to the mobile client yet. No real Stripe sandbox session has been created, no automatic refund is implemented and production remains untouched.

## Booking and payment lifecycle

1. The member selects an approved dog, service, date and live slot and accepts the cancellation terms.
2. The server locks the relevant staff, station and conflicting bookings. It creates the booking as `awaiting_payment`, snapshots the price and terms, and places a 30-minute capacity hold.
3. The server creates one Stripe Checkout Session with an idempotency key derived from the local checkout ID. A retry reuses the same open attempt.
4. The client opens the Stripe-hosted HTTPS URL outside the native WebView. Returning to the app only refreshes status; it never confirms payment.
5. A signature-verified `checkout.session.completed` or `checkout.session.async_payment_succeeded` event confirms the booking only when `payment_status` is `paid` or `no_payment_required`.
6. `checkout.session.async_payment_failed`, an expired session or a locally expired hold releases the staff and station capacity. A late paid event must enter manual reconciliation rather than silently confirming a slot that may have been sold again.
7. Cancellation creates a refund decision record. Automatic refunding is enabled only after the operator approves cancellation-window, fee, no-show and partial-refund rules. Until then an authorised manager records the decision and the system never promises an automatic refund.

The return page and mobile deep link are status views. Fulfilment belongs only in the webhook processor because a customer may never return after paying and asynchronous payment methods can complete later.

## Required persistence

`grooming_bookings` gains:

- `awaiting_payment` in its status contract;
- `payment_hold_expires_at` for capacity release;
- no provider IDs or mutable price fields.

`service_checkout_sessions` stores the local checkout ID, club, member, booking, connected account, Stripe Session ID, HTTPS Checkout URL, expiry, status and timestamps. Only one creating/open/awaiting attempt may exist for a booking.

`service_payments` stores the immutable club and booking relationship, provider account, PaymentIntent or Checkout reference, currency, amount authorised/captured/refunded and lifecycle status. Refunds are append-only `service_refunds` rows with actor, reason and provider reference. Provider payloads remain in the existing restricted webhook inbox and are never returned to member clients.

Booking audit actions distinguish `booking.payment_started`, `booking.payment_confirmed`, `booking.payment_failed`, `booking.payment_expired` and the existing booking actions. Financial audit rows and operational booking events remain separate so access to the appointment diary does not grant access to provider records.

## Concurrency and recovery rules

- The capacity hold and local checkout attempt are created in one database transaction.
- The Stripe API call occurs after commit and uses a stable idempotency key. A network timeout leaves the local attempt retryable.
- Availability treats unexpired `awaiting_payment` bookings as conflicts and ignores expired holds.
- Checkout creation locks the booking. Webhook fulfilment locks both the checkout and booking before changing state.
- Duplicate and out-of-order events are safe. Event identity is the connected account plus Stripe event ID.
- One payment can confirm one booking only. Provider references have unique constraints.
- A confirmed paid booking cannot be moved to a different service. The existing same-service reschedule preserves the price and payment record.
- A paid event received after the hold has been released cannot allocate capacity automatically. It creates a manual exception for refund or staff-assisted rebooking.

## Mobile contract

The booking options response tells the client whether a selection is covered by credits or requires online payment. For online payment, the confirmation action returns a checkout URL and an `awaiting_payment` booking ID. The app displays “Held for 30 minutes” and opens the hosted page using a reviewed system-browser flow.

Universal Links/App Links and an HTTPS fallback page must be configured before mobile acceptance. The app refreshes the booking after returning and shows `Payment processing`, `Confirmed`, `Payment failed` or `Hold expired`. It never infers success from a query parameter.

## Acceptance gates

Automated coverage must prove:

- concurrent attempts cannot hold or sell the same staff/station slot twice;
- retries reuse one Stripe session and one idempotency key;
- return URLs do not confirm a booking;
- paid and asynchronous-paid webhooks confirm once;
- unpaid, failed and expired flows release capacity;
- late payment creates a reconciliation exception;
- amount, currency, connected account and booking identity are verified before confirmation;
- hostile tenant, household and booking substitutions fail;
- cancellation/refund records never exceed the captured amount;
- exports exclude hosted Checkout URLs and raw webhook payloads while retaining the financial ledger.

Before pilot acceptance, run a real Stripe sandbox Checkout and Stripe CLI webhook sequence against reviewed HTTPS non-production infrastructure. Confirm merchant ownership, statement descriptor, VAT treatment, refund responsibility and whether independent groomers require direct or split settlement. Production keys, live connected accounts and automatic Stripe Tax remain prohibited until that review is recorded.

## Source references

- [Stripe Checkout](https://docs.stripe.com/payments/checkout)
- [Checkout fulfilment and webhooks](https://docs.stripe.com/checkout/fulfillment)
- [Dynamic payment methods](https://docs.stripe.com/payments/payment-methods/dynamic-payment-methods)
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [Stripe sandboxes](https://docs.stripe.com/sandboxes)
