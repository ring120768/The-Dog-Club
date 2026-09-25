# Operator setup and branding — 25/09/2026

## This increment
A separately authorised platform owner creates a club with an immutable URL slug and assigns one existing registered account as manager. Creation, manager membership and configuration audit are atomic. Managers edit their own club identity; platform owners can manage club branding without receiving operational memberships or private dog/care access.

Brand controls: trading name, location label, welcome tagline, five tested colour palettes, four built-in emblems and three fallback illustration tones. Settings preview before save, persist in the datastore and appear across member pages, manager pages and public profiles. Palette choices preserve legibility of the existing light text. Custom logo files, custom domains and arbitrary colour choices are not part of this increment.

Database policies and column grants restrict club creation to platform owners and branding updates to authorised managers/platform owners. Initial manager ID, creator, URL slug and club ID are immutable through the application role. An initial-manager policy only grants the configured manager access to that newly created club, never arbitrary membership to existing businesses. Version checks prevent a stale editor from silently overwriting newer settings. Audit rows store configuration changes, not care data or passwords.

Seed `owner@demo.invalid` with the existing synthetic password `PawsTogether!26`. It has no club memberships. Demo manager `manager@demo.invalid` can be assigned to a new club and then switch between assigned clubs. New-account registration/invites, staff MFA, location/resource inventory, service setup, commercial activation and production hosting are separate milestones. No invitations are sent by this increment.

## Acceptance
- Member/manager cannot enter platform console or create clubs.
- Platform owner creates a club + initial manager + audit in one transaction; duplicate/invalid slug or unregistered manager does not leave partial records.
- Manager edits only their own club; members cannot edit branding; URL/identity/membership fields cannot be changed through raw application-role writes.
- Owner branding rights do not confer private dog, photo, care or staff access.
- New club renders from saved configuration without source changes; no location or avatar behaviour depends on a slug.
- Concurrent branding edits surface a conflict. Existing profiles and photo policies still pass.
