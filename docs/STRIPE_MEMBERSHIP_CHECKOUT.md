# Stripe membership checkout and reconciliation

This increment connects the existing membership entitlement model to Stripe Billing in an isolated non-live environment. It does not configure production keys, create live charges or decide the operator's VAT registration.

## Commercial boundary

- Each club owns its customer relationship and payment receipts in its own Stripe connected account.
- Checkout uses direct charges on that connected account. The platform stores provider IDs and reconciled state; it does not store card details or present itself as merchant of record.
- Platform software billing remains a separate future commercial flow.
- A club must have an explicitly configured non-live Stripe account before checkout is shown as available. Unsupported, disconnected or live-only configuration must remain visibly unavailable.

## Checkout contract

- A signed-in member chooses an active club plan whose Price has been retrieved from that club's connected account and verified as active, monthly, GBP and an exact amount match.
- The server verifies club membership, plan ownership, current-subscription state and configured connected account before creating a hosted Checkout Session.
- Checkout uses Billing subscription mode, dynamic payment methods and a unique integration identifier. It never accepts amount, currency, account or Price ID from the browser.
- The server stores the Checkout Session before redirecting. The return page reports that confirmation is pending; it never activates benefits.
- Automatic tax remains disabled until the operator confirms tax treatment and an active Stripe Tax registration.

## Webhook contract

- The webhook reads the raw request body and verifies Stripe's signature before parsing or writing anything.
- Provider event IDs are unique. Duplicate delivery returns success without applying the event twice.
- Connected-account events must match the club's configured Stripe account.
- `checkout.session.completed` and `checkout.session.async_payment_succeeded` bind the provider Customer and Subscription to the stored checkout. An unpaid session remains awaiting payment and grants no entitlement.
- `invoice.paid` activates or renews the local subscription and allocates the period's benefits exactly once.
- `invoice.payment_failed` moves the local record to payment issue. The plan's recorded grace rule controls benefit use.
- `customer.subscription.updated` records cancellation at period end and period dates. `customer.subscription.deleted` ends the membership.
- Events that arrive before their local prerequisite are retained as pending and can be retried; they are not discarded or falsely marked complete.

## Acceptance

- Checkout cannot be created for another household, another tenant, an inactive/unmapped plan, a club without a usable connected account, or an account that already has a current membership.
- The success URL cannot grant an entitlement.
- An invalid signature causes no database write.
- Duplicate checkout, invoice and subscription events are idempotent.
- Out-of-order invoice events become pending, then apply after the Checkout event establishes the provider mapping.
- A paid invoice creates one active period and one benefit allocation; replay does not add credits.
- Failed payment, scheduled cancellation and deletion map to distinct local states and preserve audit history.
- No raw card data, API key or webhook secret is stored in the database or committed to Git.

## Deferred

Stripe Connect onboarding UI, production credentials, Stripe Customer Portal, refunds, service deposits and balances, café/Terminal payments, payouts/fees/disputes, VAT configuration, promotion codes, plan changes and proration remain later increments. The first live operator must confirm merchant ownership, refund responsibility, statement descriptor, VAT treatment and cancellation policy before activation.
