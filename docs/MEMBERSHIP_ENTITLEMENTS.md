# Membership and entitlement foundation

This increment introduces configurable membership plans and an audited benefit ledger without pretending that Stripe billing is connected or that the first operator's commercial rules are final.

## Included

- Managers configure a plan's display name, monthly GBP price, inclusions, limits, additional-dog terms, renewal terms, cancellation terms, grooming credits per period and whether benefits remain usable during a payment issue.
- Plan terms are shown to members before any subscription is assigned.
- A manager can create a clearly labelled demo subscription for an existing club account. No payment is taken and no payment-provider status is inferred.
- Subscription states are distinct: `active`, `payment_issue`, `cancellation_scheduled` and `ended`.
- Members can schedule cancellation for their own subscription. Access remains valid until the recorded period end, when a manager can close the subscription.
- The grooming-credit balance is the sum of an append-only ledger. Allocation, redemption, restoration and manager adjustment are separate entries with actor, reason, time and idempotency key.
- Redemption locks the subscription and rechecks the balance inside one transaction. Concurrent attempts cannot spend the same final credit, and a replayed idempotency key returns the original result without a second debit.
- Members can read only their own subscription and ledger. Managers can administer subscriptions in their club. Another household and another tenant cannot read or change them.

## Known-answer acceptance fixture

A plan costs £39 per month and includes two grooming credits for 01/10/2099–01/11/2099.

- Activation allocates two credits once.
- The member sees the plan terms, active state, period end and two remaining credits.
- Two concurrent attempts to redeem the final credit result in one debit and one rejection.
- Replaying the successful idempotency key does not create another ledger entry.
- A manager restoration returns one credit and records a reason.
- `payment_issue` blocks redemption unless the plan explicitly allows it.
- Scheduling cancellation keeps the subscription usable until the period end; `ended` blocks redemption.
- Another household and another club cannot read or mutate the subscription.

## Deferred

Stripe Checkout/Billing, webhook activation, receipts, refunds, provider reconciliation, automatic renewal/allocation, proration, VAT treatment, member self-purchase, household adults and applying a grooming credit to a booking price remain later work. The UI must say that demo activation takes no payment.

The account temporarily represents the membership holder until the household model is implemented. The migration remains local until reviewed and exercised against non-production PostgreSQL. Production is unchanged.
