# Household-adult permissions

An existing club member can invite another trusted adult with either or both of these explicit permissions:

- manage dog profiles, photos and grooming care applications;
- make, view and cancel grooming bookings and see their visit progress.

The invitation lasts 72 hours, uses a 256-bit random token and stores only its SHA-256 hash. Existing accounts must sign in before accepting. A new adult receives a normal club-member grant so they can enter the tenant, but the household grant does not expose or transfer the primary account's membership subscription, billing, grooming credits or admission pass. Applying membership credits to a shared dog's booking remains restricted to the dog's primary account.

Dog ownership remains on the primary account. Household access is additive and revocable, so the existing ownership model and audit references do not need a destructive rewrite. One adult can assist only one primary household per club at a time. The primary account can change permissions or revoke access, and the invited adult can leave. Each change is appended to `household_events`.

Row-level policies extend only the records needed by the selected permission. Dog-care permission covers the private dog record, its controlled photo and grooming application. Booking permission covers the selected dog's bookings, booking history and grooming-visit progress. Managers retain their existing operational access but cannot grant themselves household rights or inspect household grants through the restricted database role.

Revocation takes effect on the next server read and write. It does not cancel an existing booking or remove the adult's basic club membership; the owner or club can handle those separately. Household guest admission, spending the owner's benefits, membership billing, payment methods, admission passes, public ownership, legal guardian status, emergency-contact authority and dependant/minor accounts remain outside this grant.
