# Demo activity reset

## Purpose

The local sales demonstration needs a repeatable starting point without rebuilding the operator, dogs, memberships or grooming setup. A platform owner can reset one synthetic club's transactional activity from the platform console before a walkthrough.

## Safety boundary

Reset is available only when all of these conditions hold:

- `DOGCLUB_LOCAL_DEMO=1`;
- `NODE_ENV` is not `production`;
- `DOGCLUB_DB` is neither `postgres` nor the legacy `supabase` value;
- the signed-in account is a platform owner;
- the selected club has at least one member and every member account uses the reserved `@demo.invalid` domain;
- the operator ticks the confirmation box for that request.

The server repeats every check. Hiding the form is not treated as authorisation.

## Removed activity

The reset transaction removes grooming visit notifications and history, grooming visits, service-payment exceptions/payments/Checkout attempts, booking audit events, booking-linked grooming-credit ledger entries, grooming bookings, and admission visit history. Deletion order follows the foreign-key graph and the whole operation commits or rolls back together.

## Preserved setup

Branding, club lifecycle, accounts, club memberships, household permissions, dogs, dog photographs, care and admission decisions, membership plans/subscriptions and their opening credit allocations, services, stations, staff, qualifications, shifts, closures and connected-account configuration remain unchanged. This keeps a prepared demonstration ready while restoring spent booking credits by removing only booking-linked debits and restorations.

This facility is for fictional local records. It is not a customer-data deletion or production disaster-recovery mechanism.
