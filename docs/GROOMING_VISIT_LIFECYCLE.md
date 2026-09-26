# Grooming visit lifecycle

This increment turns a confirmed grooming booking into a staff-managed visit without claiming that general club admission, capacity control or external notifications are complete.

## Included

- A club manager acting as reception or grooming staff sees confirmed bookings in the daily workspace.
- Staff can mark a booking as arrived exactly once. Repeating the arrival action returns the existing visit and does not increase the count or duplicate the audit event.
- The visit follows the ordered states `arrived`, `handed_over`, `in_progress`, `ready` and `collected`.
- Handover records the adult authorised to collect the dog. Collection requires staff to confirm that the collecting adult matches that recorded authorisation; no identity-document image or number is stored.
- Moving to `ready` creates a notification outbox item with `manual_required` status. The member sees the ready state when signed in, while the staff workspace clearly says that no message has been sent and a manual contact is required.
- A manager can correct a visit to an earlier or later state only with a reason. The current state changes, while the original and corrected states remain in the audit history.
- Members can read visit status and history only for their own dogs. Managers can read visits for their club. Visit state and live whereabouts are never exposed on public dog profiles.

## Known-answer acceptance fixture

A member has one approved dog and one confirmed grooming booking.

- The first arrival creates one visit and one `visit.arrived` event.
- A repeated arrival request returns the same visit and leaves the arrival event count at one.
- `handed_over` is rejected until an authorised collection adult is recorded.
- Staff progress the visit through handover and grooming to `ready`; one manual-contact notification item is created.
- Collection is rejected unless staff explicitly confirm the adult matches the authorisation.
- A correction from `ready` back to `in_progress` requires a reason and is appended to history rather than rewriting it.
- Another household and another club cannot read or change the visit.

## Deferred

General café/club passes, membership-payment checks, premises capacity, walk-in visits, household-adult permissions, admission exceptions, automated email/SMS/push delivery, delivery retries and collection identity policy remain later PRD work. The interface must not imply that a ready notification has been delivered.

The migration remains local until reviewed and exercised against non-production PostgreSQL. Production is unchanged.
