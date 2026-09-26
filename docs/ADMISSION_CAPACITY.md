# Club admission and capacity foundation

This increment proves one staff-assisted club-entry journey without fixing a real venue capacity or inferring access rules from draft premises drawings.

## Included

- A manager must configure separate human and dog capacity before reception can admit anyone. No default capacity is inferred from floor area or seating plans.
- Each dog has a separate club-admission decision. Grooming approval does not grant general club access.
- A member can create an opaque reusable admission pass. The pass contains no email address, dog identity, care notes or membership details and has no public lookup page.
- Reception looks up the pass while authenticated, confirms the attending humans and selected dogs, and submits the admission.
- The server rechecks a current usable membership, dog ownership, dog admission approval and both capacities inside one transaction while locking the venue setting.
- Repeating a scan for someone already inside returns the active visit without increasing occupancy. Checkout is also idempotent and releases both counts.
- Members can see their own pass, dog decisions and admission history. Managers can see current occupancy and active visits without exposing care notes in the admission workflow.

## Known-answer acceptance fixture

A venue configured for one human and one dog admits one eligible member with one approved dog. A repeated scan returns the same visit and occupancy remains 1 / 1. A concurrent second admission is rejected while capacity is full. After checkout, the second eligible member can enter.

## Deferred

Household adults, guests, peak-period reservations, lounge/zone occupancy, café seating, events, door hardware, QR camera scanning, document expiry, policy exceptions and no-show handling remain later work. Final safe capacities and admission policies require operator and professional confirmation.

The migration remains local until it has been reviewed and exercised against non-production PostgreSQL. Production is unchanged.
