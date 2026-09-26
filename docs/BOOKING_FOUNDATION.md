# Grooming booking foundation

This increment proves one real, tenant-scoped grooming booking journey without presenting payments or the full rota system as complete.

## Included

- Managers configure a grooming service with duration, clean-up buffer, fixed GBP price, cancellation terms, whether membership credits are accepted and how many credits it costs.
- Existing services migrate with credit use disabled, so a manager must explicitly opt them in before members can spend benefits against them.
- Managers configure a grooming station and publish a dated shift for themselves as the qualified groomer, with an optional break.
- Members can request availability only for a dog they own whose grooming application is approved.
- Availability is shown in 15-minute increments in `Europe/London`. A slot must fit the service and clean-up buffer inside one published qualified shift, outside breaks and resource closures, with both groomer and station free.
- Confirmation rechecks every rule inside one transaction. It locks the club's candidate staff and resources before checking conflicts, so concurrent requests cannot confirm the same groomer or station.
- The booking records the displayed price, amount due, credit cost and cancellation terms as snapshots. No card payment is taken in this increment.
- An eligible member may apply the configured number of grooming credits. Booking confirmation and ledger redemption share one transaction, so a concurrent request cannot overspend the final credit. The listed price remains visible and the amount due snapshot becomes £0.
- Members can cancel their own confirmed booking. Managers can cancel a club booking with a reason. Cancellation before a visit starts immediately releases the slot, restores applied credits once and remains in both audit histories.
- Member reads expose their own bookings and bookable times, not the underlying staff rota or another household's appointments. Managers can see the club schedule.

## Known-answer acceptance fixture

A qualified groomer has a published 09:00–17:00 shift with a 12:00–12:30 break. One station is available. The service lasts 60 minutes and has a 15-minute staff/equipment clean-up buffer.

- 11:00 is unavailable because the buffer overlaps the break.
- 12:30 is available.
- After 12:30 is confirmed, a competing 13:00 request fails because it overlaps the same groomer and station.
- 13:45 can be confirmed when otherwise free.
- Cancelling 12:30 releases it again.
- An unapproved dog, unpublished shift, closed station, unqualified staff member, another tenant and another household cannot create or read the booking.

## Deferred

Deposits, Stripe service payment/refunds, part-credit balances, cancellation-window forfeiture, staff-confirmed estimates, recurring rota patterns, leave/sickness/swap workflows, member rescheduling, waitlists and automated notifications remain later PRD work. The UI must say that card payment is not collected and must not imply those capabilities are connected.

The migration remains local until it has been reviewed and exercised against non-production PostgreSQL. Production is unchanged.
