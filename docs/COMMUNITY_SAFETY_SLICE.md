# Community discovery and safety slice

Status: implementation specification · 26/09/2026

## Outcome

Eligible club members can search opted-in dog profiles by dog name. A member can report a profile or its current photo, block the account behind another dog's profile and later remove that block. Managers receive a tenant-scoped review queue, can record an outcome and can hide or restore a profile with an audit reason.

## Privacy and behaviour

- Search starts from the existing row-level-security-filtered member directory. It never searches owners, email addresses, care records, bookings, visits or attendance.
- Blocking is account-to-account and symmetric for member-only discovery: neither account sees the other's opted-in profiles inside that club.
- A block cannot prevent anonymous access to an otherwise public link. The interface explains this before the member blocks.
- Manager hiding overrides member and public discovery, while the owner and managers retain access for correction and review.
- Reports contain a bounded category and optional explanation. They never copy care records or contact details.
- Managers can trace the involved account IDs inside the protected operational queue. Community viewers never receive them.
- Every block, unblock, report, review, hide and restore operation is tenant-scoped and appended to the community audit history.

## Acceptance

1. Dog-name search matches case-insensitively after visibility, tenant and block filtering.
2. Private profiles and cross-tenant dogs never enter search results.
3. Blocking another dog's owner removes both accounts' profiles from each other's member directories without changing the public-link warning or public projection.
4. Reporting creates one open manager item with the selected target and no private dog fields.
5. Only a club manager can review, hide or restore; hostile tenant IDs and unqualified actors fail.
6. Hiding removes the profile and protected photo from other members and anonymous public access immediately.
7. Owner and manager access remains available while hidden so the content can be corrected and reviewed.

This slice advances SC-03 and SC-06. Gallery-level moderation, paid-membership expiry enforcement, community guidelines/response ownership and retention execution remain separate gates before a real community pilot.
