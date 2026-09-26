# Foundation verification — 25/09/2026

## Automated

`npm run typecheck` passes. `npm test` passes 28 checks against fresh embedded PostgreSQL with the actual SQL policies:

- known accounts resolve only assigned clubs;
- hostile tenant substitution cannot read another club;
- cross-club inserts and updates are denied;
- another household cannot edit a dog;
- managers cannot change owners' social consent;
- private/member/public visibility, allowlisted public projection and revocation;
- care data remains separate from community access;
- the application role cannot read account credentials or sessions;
- invalid inputs and incorrect passwords are rejected.

The SQL policy tests do not constitute a complete production security review. Local photo storage and platform-owned operator export are covered; managed object storage and production background/provider delivery still require separate review.

## Browser

Verified synthetic Alice sign-in, member dashboard, profile creation (Scout), save confirmation, public profile projection, and retained session/profile after server restart. Inspected desktop dashboard at 1280px and the narrow browser layout during form testing. A missing local data parent directory was discovered and fixed. No iOS/Android device verification or formal accessibility audit has been performed.

## Limitations

Only the development server has been exercised; no production build, deployment or live provider connection. Local PGlite is single-process. Seeded authentication is for synthetic demonstration only. Production mode refuses database access. One photo per dog is supported in the local datastore; managed production media storage, galleries and HEIC conversion remain outstanding.

## Photo increment

17 additional automated checks cover metadata stripping/orientation/resizing, byte and pixel limits, invalid/unsupported images, WebP/APNG animation, forged MIME/filename, keep/replace/remove intent, owner/manager/member/anonymous access, tenant/dog/photo ID substitution, visibility revocation, superseded URLs, raw-SQL ownership enforcement, atomic rollback, membership revocation, response headers and additive migration re-runs.

Browser verification used a synthetic PNG swatch and deliberately invalid JPEG fixture, not customer photographs. The invalid upload preserved typed text. A valid selection displayed a preview, saved, loaded on the member card and public profile, and was removed through the editor. The temporary swatch was removed after testing. Inspected the photo editor at 390 × 844 as a responsive browser check; this is not native device testing.

Direct HTTP checks without a session: public photo returned 200 image/webp with `private, no-store`, `nosniff` and `Vary: Cookie`; members route returned 404. After removal the old public image URL returned 404. Prior seeded and user-created demo records survived the photo schema upgrade.

# Operator demo-readiness verification — 26/09/2026

TypeScript and all 91 tests pass. The readiness acceptance test uses the public service layer to issue and accept two operator invitations with different names, colours, emblems, locations and managers. Each manager configures a distinct priced grooming service, station and qualified published shift. The platform-only summary reports both at 5/5 without returning member, dog, care, booking or payroll records; an ordinary tenant member is denied access.

Local browser acceptance confirms the operator list distinguishes the intentionally incomplete Coast tenant (1/5) from Willow and Pavilion Pooch (Demo ready). Willow’s detail view renders the five named checks and the boundary note separating synthetic demo readiness from payment connection, production approval and mobile release. Production schema, data and services remain untouched.

# Operator lifecycle verification — 26/09/2026

TypeScript and all 95 tests pass. Lifecycle tests prove that onboarding admits managers for setup while blocking members; trial requires 5/5 readiness; activation additionally requires explicit external-review confirmation; restricted operators retain existing access and records while new invitations fail; and closure removes tenant and public-profile access without deleting membership records. Closed operators cannot be silently reopened. State events retain actor, reason and readiness snapshot.

## Operator portability and PostgreSQL rehearsal — 26/09/2026

TypeScript and all 98 embedded-database tests pass. The new archive suite proves platform-only access, one-tenant contents, removal of credentials, bearer codes and hosted Stripe URLs, SHA-256 tamper detection, binary dog-photo restoration, inactive replacement admission passes and full rollback when an identity prerequisite is absent. The authenticated local Willow download route returned HTTP 200 and the platform panel rendered without a browser error.

All 18 migrations then applied to a clean disposable Supabase PostgreSQL 17 container as the schema-owning `supabase_admin` role. The resulting 52-table schema passed all 98 tests through the rollback-only shared-PostgreSQL harness. Effective `club_app` grants were inspected, and final counts confirmed that no synthetic clubs or export events remained. See [the rehearsal record](NON_PRODUCTION_POSTGRES_REHEARSAL.md).

Local browser acceptance confirms Willow renders as Trial with the permitted transition form and Coast cannot be activated while its readiness score is 1/5. The failed activation leaves Coast in Trial and displays the readiness error. Production schema, data and services remain untouched.

# iOS guided-demo rehearsal — 26/09/2026

The unsigned Capacitor build was installed on the named `Dog Club iPhone` simulator running iOS 26.5 and exercised against the local synthetic server. Alice signed in, selected Willow, saw the active Care Demo membership and dog profiles, selected Bertie and the live 09:15 Member full groom on 27/09/2026, chose card payment instead of a membership credit, accepted the cancellation terms and created the 30-minute payment hold.

Capacitor Browser opened the local payment wall showing Bertie, the service, London appointment time and £65 total together with the explicit `DEMONSTRATION · NO MONEY OR CARD DATA` notice. Completing the simulation displayed a confirmed checkout. Closing the browser returned to the booking form; Refresh payment status then returned the member home and displayed the confirmed appointment.

The first pass rendered the confirmed booking as `£65.00 due`. The corrected home projection distinguishes membership credit, captured payment and amount still due without exposing the protected payment ledger to the restricted club role. A rebuilt and reinstalled iOS app visibly rendered the same booking as `£65.00 paid`.

Automated verification passes: `npm run typecheck`, all 133 tests, `npm run build`, Capacitor sync, clean Android debug assembly with Java 21 and unsigned iOS simulator compilation. Android assembly required the pre-existing untracked duplicate resource `config 2.xml` to be moved out of the resource folder for the build; it was restored automatically. Android interactive acceptance remains outstanding because no Android Virtual Device or emulator image is installed. No production service, live payment or card data was involved.
