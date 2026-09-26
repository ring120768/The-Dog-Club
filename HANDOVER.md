# Handover — getting the live site working

Updated 26/09/2026

## Commercial pricing proposal — 26/09/2026

`docs/COMMERCIAL_PRICING.md` records the initial UK sales hypothesis: £349 per location/month plus £2,500 onboarding, and a limited Founding Partner offer of £1,500 onboarding plus £249/month for the first 12 months. Managed operator-branded iOS/Android apps, additional locations, dedicated infrastructure, usage charges and bespoke work are separate. The proposal is not an approved quote; it includes market evidence and explicit validation gates before public pricing.

## Database hosting architecture decision — 26/09/2026

The commercial white-label hosting rule is now explicit in `docs/ARCHITECTURE_DATABASE_HOSTING.md`. Supabase PostgreSQL is the shared multi-tenant production platform by default; operator separation is enforced through tenant relationships, server-side authorisation and row-level security. Neon remains synthetic Preview/mobile staging only. Dedicated managed PostgreSQL deployments are separately contracted enterprise exceptions using the same migrations and application contracts, with their own credentials and operations.

## Mobile HTTPS staging configuration checkpoint — 26/09/2026

Branch `codex/mobile-https-staging`, stacked on `codex/mobile-secure-sessions`. Native assets are now generated into ignored `mobile-build/`. Setting `MOBILE_APP_SERVER_URL` to a reviewed HTTPS origin compiles that origin into both native apps, hides the editable server field and overrides any older server saved with a Keychain/Keystore session. The preparation command rejects HTTP, credentials, paths, queries and fragments. Builds without the variable retain the local development field and must not be signed or distributed.

`npm run mobile:verify-staging` performs a secret-safe acceptance probe with a synthetic staging member: sign in, list club memberships, confirm the current device session, then revoke the probe session in a `finally` block. It logs counts and status only.

Vercel Marketplace resource `dog-club-staging` (`orange-haze-45910454`) is now provisioned on Neon's Free plan in London, with Neon Auth disabled and connectivity limited to Preview. The complete 22-migration stack applied transactionally through the unpooled owner connection, producing 56 public tables, two synthetic clubs and five synthetic accounts. The pooled `DATABASE_URL` is injected by the integration. `DOGCLUB_DB=postgres` is scoped to branch `codex/mobile-https-staging`; Production retains its existing Supabase variables and data.

Deployment `dpl_AjT84xu1zAy5cs3iRXshmnHciTWb` completed successfully. A protected live acceptance signed in `alice@demo.invalid`, returned the Willow membership, listed the current device session and revoked that session. The temporary Vercel automation bypass used for the probe was revoked and the project reports no remaining bypass secrets. Standard Preview Authentication still prevents a native simulator from reaching the API. Making only the stable staging branch domain public through a Deployment Protection Exception is the next reversible configuration step and requires explicit approval because it changes external access permissions.

Validation: TypeScript, all 138 tests, the local Next.js production build, Android debug assembly with Java 21 and the unsigned iOS simulator build pass. Native builds were verified from a clean temporary worktree because the primary checkout contains the known untracked duplicate `android/app/src/main/res/xml/config 2.xml`; that user file was left untouched. Production data, environment variables and deployment remain untouched.

Live activation completed on 25/09/2026 after the initial verification. Production now has DOGCLUB_DB=supabase and a sensitive DATABASE_URL (production only). Deployment `dpl_JBmSJCdR6jy351PK6VeDWsis93Wf` is READY and serves https://the-dog-club-psi.vercel.app from commit `5744bc2`.

The requested initial platform-owner account was created with a salted password hash; no synthetic accounts or clubs were seeded. Actual browser sign-in reached the platform-owner console. The absent demo public profile returns 404 instead of 500. Credentials are intentionally omitted from this handover.

The [verification report](docs/LIVE_SERVICE_VERIFICATION.md) records the earlier pre-activation findings; its missing-configuration and zero-accounts findings are superseded by this update.

Working folder on Ringo's Mac: `~/Documents/ChatGPT/The Dog club` (not `DogClubPlatform`, which is empty).

## Done

- `main` includes the Supabase Postgres adapter (PR #2, merged).
- Vercel project `the-dog-club` deploys automatically from `main`. Live address: https://the-dog-club-psi.vercel.app (`the-dog-club.vercel.app` belongs to someone else).
- Supabase project `The-Dog-Club` (ref `bbujzczcucdcdscjeynx`, Frankfurt) now has migrations 000–003 applied: 11 tables with row-level security. An initial owner account now exists; no clubs have been created.
- `.env.local` `DATABASE_URL` now includes the database password; connection tested OK. `.env.local` stays gitignored.

## Remaining work

1. Remove local-demo badges and prefilled synthetic credentials from production UI. They remain in deployed code but the synthetic accounts do not exist in the production database.
2. Review and apply the onboarding migration in a non-production PostgreSQL environment, then merge the stacked logo and onboarding PRs before using invitations with the first actual club. Production still has only the platform-owner account and no clubs.
3. Resolve the Supabase advisor warning for public.rls_auto_enable(). Effective EXECUTE is inherited from PUBLIC; revoking only anon/authenticated is insufficient. Review and remove the PUBLIC grant as appropriate, retain required administrative access, then verify effective privileges and advisors. See the verification report for the event-trigger caveat.
4. Replace the initial testing password before real-customer use. Support-assisted reset is implemented in the recovery checkpoint below; automated verified delivery and staff MFA remain incomplete. Do not write credentials into handovers.
5. Preview has not been connected to the production database. Do not add production credentials to previews casually.

## Housekeeping

- The database password was shared in a chat session on 25/09/2026. Reset it in Supabase (Project Settings → Database) once the site is running, then update `.env.local` and Vercel.
- `docs/PROJECT_STATUS.md` has obsolete implementation/deployment status; its canonical path is already correct. The verification report supersedes those status claims.
- The Claude project docs are v0.1; the repo docs are v0.8 and are the source of truth.

## Demo logo update

The user-supplied dog photo is copied unchanged to `public/brand/demo-dog.jpg` and used beside The Dog Club name on the login page and platform console. A shared DemoLogo component preserves its 4:3 composition. Operator emblems remain configurable. This source change is included in the logo checkpoint branch; it is not yet deployed to production.

Login hero retains “Their happy place. Yours, too.” The approved supporting line is “Good friends, tasty treats and a little pampering.” This copy change is included in the same checkpoint, not deployed to production.

Checkpoint validation: TypeScript check and all 28 local tests passed; the local login response contains the original headline, approved supporting line and demo logo. Branch: `codex/demo-logo-checkpoint`. Production merge remains a separate step.

Preview visibility fix: the narrow-screen layout no longer hides the login supporting paragraph. The approved sentence stays visible in the embedded viewing window and on mobile.

## PRD review

See `docs/PRD_REVIEW.md` for the requirement-by-requirement review against v0.8 at commit `23b1362`. Foundation and web profiles are partial delivery, not a completed pilot. Proposed next priority: account/invitation and operator setup, then care/community and staffing-aware booking. Review document is local pending publication; implementation unchanged.

## Onboarding implementation checkpoint

Branch `codex/onboarding-approval`, stacked on the unmerged logo branch. Implements operator/member invitation pages, hashed single-use 72-hour invitations with revocation, existing-account sign-in requirement, atomic account/club/grant acceptance, grooming care applications, private owner/manager reads and versioned manager decisions/audit. Manual link sharing only; no emails sent or email ownership verification claimed. Approval is grooming-only, not booking/payment/admission.

Validation: typecheck and 36 isolated tests pass (8 new onboarding/application tests including full domain journey, expiry/reuse/revocation, existing-account protection, tenant/privacy checks and concurrent claims). New migration exists locally only; production untouched.

Browser walkthrough completed on 25/09/2026. The rejected local sign-in was caused by an older local database that predated the synthetic platform-owner fixture; the account was restored without resetting other demo data. A platform owner then invited a new operator, the operator created the club while accepting, invited a member, the member created Pickle, saved and submitted grooming details, and the manager approved the application. No production records or schema were changed.

The review also keeps grooming drafts private from managers until submission, renames the slug field to “Club web address” and removes stale platform copy that said invitations were still to come. Typecheck, all 36 tests and diff checks pass after these changes.

Review before rollout: application/invitation writes use privileged server transactions with explicit actor checks; restricted roles have read-only application access. Validate that boundary against production role grants. Add request throttling for invitation acceptance before public rollout, stronger care/document coverage and accessible form/pending-state checks. Review potential issuer-permission revocation races, transaction rollback and existing-manager/self-review UX. Test in non-production PostgreSQL before applying the migration. Do not run production schema changes from a preview.

The earlier usage checkpoint preserved this work in draft PR #4. The browser acceptance milestone is now complete; the PR remains draft pending PostgreSQL migration review, rollout hardening and the production/demo presentation work above.

## Grooming booking foundation checkpoint

Branch `codex/grooming-booking`, stacked on the unmerged onboarding branch. Adds tenant-scoped grooming services and stations, staff qualifications, dated published shifts and breaks, resource closures, member availability, atomic booking confirmation, cancellation and audit events. A dog must belong to the signed-in household and have an approved grooming application. Prices and cancellation terms are snapshotted when the booking is made; the UI states that no payment is taken.

The known-answer browser walkthrough passed on 25/09/2026 using local synthetic data: a 09:00–17:00 shift, 12:00–12:30 break and 60-minute service with a 15-minute clean-up buffer. The unsafe 11:00 slot was absent, 12:30 was available, confirmation removed the conflicting period through 13:30, 13:45 remained available, and cancellation restored 12:30. Persistent confirmation and cancellation messages were also verified.

Validation: TypeScript check and all 43 isolated tests pass. The seven booking tests cover buffer/break calculations, price snapshots, concurrent confirmation, cancellation/audit, household and tenant isolation, resource closure/unpublished shifts and manager-only setup. The migration and all demo records remain local; production schema and data are untouched.

Review before rollout: exercise the migration against non-production PostgreSQL and review effective database grants. The broad transactional locks deliberately favour correctness for this foundation and may need narrower advisory locking under measured multi-site load. Payments, recurring rotas, leave/sickness/swaps, rescheduling, notifications and the visit/collection workflow remain deferred.

## Grooming visit lifecycle checkpoint

Branch `codex/grooming-visit-lifecycle`, stacked on the unmerged booking branch. A manager acting as reception/grooming staff can progress a confirmed booking through arrived, handed over, in progress, ready and collected. Handover records a named authorised collection adult; collection requires an explicit staff match. Repeated arrival is idempotent, member cancellation is blocked after arrival, and corrections require a reason and append to the audit history.

The ready step creates one private `manual_required` outbox item. It does not send email, SMS or push. The manager workspace calls out the manual contact requirement only while the visit is ready, and the owner sees the current state and visit history for their own dog. Public profiles receive no visit or whereabouts data.

Browser acceptance completed on 26/09/2026 with local synthetic data. A new £50 grooming booking was created for Pickle, progressed through every state, shown as ready in the member view, collected after matching “Sam Pickle”, corrected back to in progress with a reason, then restored to verified collection. The UI also exposed and resolved a client/server bundling boundary and a stale manual-contact warning during the walkthrough.

Validation: TypeScript and all 49 isolated tests pass; six visit tests cover duplicate arrival, collector authorisation, one-shot ready fallback, correction history, collection verification and tenant/household isolation. Production schema and data remain untouched.

Review before rollout: apply and test the booking and visit migrations together in non-production PostgreSQL. General café admission, membership/payment checks, venue capacity, walk-ins, household-adult permissions, automated delivery/retries and a formal collection identity policy remain incomplete.

## Membership entitlement checkpoint

Branch `codex/membership-entitlements`, stacked on the unmerged grooming visit branch. Managers can define GBP membership plans with inclusions, limits, additional-dog, renewal and cancellation terms; assign a clearly labelled demo entitlement to an existing club account; manage active, payment-issue, cancellation-scheduled and ended states; and record grooming-credit allocations, redemptions, restorations and adjustments in an append-only ledger. The ledger uses per-subscription locking, idempotency keys, actor/reason fields and balance checks. Member reads are restricted to their own account, while manager reads remain club-scoped.

Browser acceptance completed on 26/09/2026 using local synthetic data. A manager created the £39 Care Demo plan with two grooming credits, assigned it to `member-walkthrough@demo.invalid`, redeemed one credit, and the member saw only their own plan, terms, remaining credit and explicit “Demo entitlement · no payment-provider confirmation” label. The member then scheduled cancellation for 26/10/2026 and retained the remaining benefit through the recorded period end.

Validation: TypeScript and all 55 isolated tests pass. Six membership tests cover plan allocation, concurrent final-credit redemption, idempotent replay, restoration and payment-issue behaviour, cancellation/ended lifecycle, and tenant/household isolation. Production schema and data remain untouched.

Review before rollout: rehearse the membership migration in non-production PostgreSQL and review effective grants. Stripe, webhooks, self-purchase, automatic renewals, billing recovery, proration/VAT, receipts/refunds, household-adult permissions and applying credits directly to a booking remain incomplete. Demo assignment must not be represented as payment confirmation.

## Stripe membership checkout checkpoint

Branch `codex/stripe-membership-checkout`, stacked on the unmerged membership branch. Adds per-club Stripe sandbox account configuration, manager-owned Stripe Price mapping, member hosted subscription Checkout, raw-body signature verification, durable connected-account event storage and reconciliation. A mapped Price is first retrieved from the club's connected account and must be active, monthly, GBP and an exact amount match. Paid invoices activate or renew the local entitlement and allocate that period's grooming credits once; failed payment, scheduled cancellation and deletion remain distinct states. Browser return does not grant access.

Checkout retries preserve the same local attempt, Stripe idempotency key and deterministic integration identifier after an uncertain network failure. Expired hosted sessions are replaced, while a checkout for a different plan is not silently reused. Webhook writes are atomic, provider customer/subscription links cannot be rebound to another member or plan, invalid environment events are rejected, and failed processing can be retried from the stored event. Payment configuration and webhook tables remain server-only under forced RLS.

Validation: TypeScript and all 62 isolated tests pass. The seven new tests cover platform/manager authority, tenant-trusted checkout and retry identity, signature tampering, out-of-order invoices, duplicate allocation prevention, payment failure/recovery, provider-controlled cancellation/deletion, link/customer validation and live-to-sandbox rejection. Local browser acceptance confirms the new manager Price field and the existing member view after the schema change; no real Stripe test account or hosted payment has been used yet.

Production is untouched. No Stripe key, webhook secret, connected account, Price or production migration was configured. Before rollout, rehearse both membership migrations in non-production PostgreSQL, connect a real Stripe test account, run a hosted Checkout plus Stripe CLI webhook sequence, review restricted-role grants and decide the operator's VAT/tax treatment. Keep automatic Stripe Tax disabled until an active registration and the intended tax treatment are confirmed. Customer Portal, receipts, refunds, deposits/balances, café/Terminal payments, Connect onboarding, proration and applying credits to bookings remain later increments.

## Booking membership-credit checkpoint

Branch `codex/booking-membership-credits`, stacked on the unmerged Stripe membership branch. Managers can mark each grooming service as credit-eligible and set its whole-credit cost; existing services migrate with credit use disabled until a manager opts them in. An eligible member can apply that cost while confirming a slot; the booking snapshots the listed price, £0 amount due, subscription and credits used. The booking, ledger redemption and resource reservation share one transaction and subscription lock, so the final credit cannot be spent by two simultaneous requests.

Cancelling before the visit starts restores the exact booking credit cost with a booking-scoped idempotency key. The member view distinguishes listed price from £0 due, and the manager operations view shows whether credits cover the booking. Card payment, part-credit/cash combinations and cancellation-window forfeiture are not implied.

Validation: TypeScript and all 63 isolated tests pass. The integration test covers price/amount snapshots, atomic redemption, balance visibility, cancellation restoration and concurrent final-credit protection. Local browser acceptance demonstrates a one-credit £65 booking, the member balance falling from two credits to one, the manager seeing £0 due, cancellation restoring the balance to two, and the 09:00 slot becoming available again. Production remains untouched; rehearse the new migration with the preceding booking/membership migrations in non-production PostgreSQL before rollout.

## Club admission and capacity checkpoint

Branch `codex/club-admission-capacity`, stacked on the unmerged booking-credit branch. Managers configure separate operator-approved human and dog capacities; no values are inferred from draft drawings. Club admission has its own dog eligibility decision and append-only history, separate from grooming approval. Members can create a reusable opaque pass that contains no profile or care data and has no public lookup route.

Authenticated reception staff use the pass to verify a current paid-through usable membership, selected dogs and live capacity. Admission locks the venue setting while rechecking both counts; concurrent arrivals cannot overfill it. A repeat scan returns the existing active visit without incrementing occupancy, and idempotent checkout releases both human and dog capacity. Household adults, guests, documents/expiry, admission exceptions, camera QR scanning and zone/lounge capacity remain deferred.

Validation: TypeScript and all 67 isolated tests pass. Four admission tests cover pass privacy and household scope, configuration/membership/dog-eligibility gates, concurrent and duplicate capacity protection, idempotent checkout and tenant isolation. Local browser acceptance used Alice and Bertie: a 16-character pass was created, reception configured 1 human / 1 dog, approved Bertie, admitted them to reach 1 / 1, recognised the repeat lookup as already inside, then checked them out to return occupancy to 0 / 0. Production remains untouched; rehearse this migration with the preceding stack in non-production PostgreSQL before rollout.

## Account recovery checkpoint

Branch `codex/account-recovery`, stacked on the unmerged admission branch. A signed-out user can submit a generic password-help request without learning whether an account exists. Known accounts are limited to three requests per hour. The platform owner reviews the private queue, verifies the requester outside the app and creates a 30-minute one-time link; the raw token is shown once and only its SHA-256 hash is stored.

Completing recovery changes the salted password hash, consumes the link, expires other links, clears failed-login throttling and deletes every session for the account. Recovery tables are server-only with forced RLS and no `club_app` grants. Automated email delivery, staff MFA and the support identity-verification policy remain rollout work, so the UI does not claim that email was sent.

Validation: TypeScript and all 72 isolated tests pass. Five recovery tests cover non-enumerating requests, rate limits, platform-owner authority, dismissal, token hashing, expiry, single use, password replacement, session invalidation and restricted-role denial. Local browser acceptance requested help for Alice, created a link as platform owner, rejected the old password, accepted the new password and restored the documented synthetic credential through the same audited flow. Production remains untouched; rehearse the migration in non-production PostgreSQL before rollout.

## Household-adult permissions checkpoint

Branch `codex/household-adult-permissions`, stacked on the unmerged account-recovery branch. A club member can issue a hashed, single-use 72-hour invitation and independently grant dog-profile/grooming-care access, grooming-booking access or both. Existing accounts must sign in before accepting; a new adult receives a normal club-member record. One adult can assist only one primary household per club at a time. The owner can change or revoke the grant, the assisting adult can leave, and invitation, acceptance, permission changes, departure and revocation are appended to the household audit history.

Dog ownership never transfers. The grant does not expose the primary account's membership subscription, billing, grooming-credit balance, admission pass or public ownership. A booking helper can make, view and cancel grooming bookings for an approved shared dog and see visit progress, but only the primary account can spend its membership credits. Matching row-level policies protect dog records, photos, care applications, bookings, visit history and ready-contact metadata; the restricted database role cannot write grants or inspect another household.

Local browser acceptance used a disposable synthetic adult. Dog-care-only access exposed Bertie's edit and grooming-application actions without booking. Booking-only access exposed booking actions without profile editing or the owner's grooming-credit choice. Revocation removed the private actions immediately; the public/member community card remained governed by its own audience setting. The synthetic grant was revoked at the end of the walkthrough.

Validation: TypeScript and all 77 isolated tests pass. The five household tests cover token hashing, existing-account authentication, audited invitation revocation, separate permissions, owner-credit protection, immediate grant revocation, new-member boundaries, one-household/tenant isolation and restricted-role denial. Production schema and data remain untouched. Rehearse this migration with the full stacked migration sequence in non-production PostgreSQL and review effective grants before rollout.

## Production/demo and recovery-delivery checkpoint

Branch `codex/production-demo-recovery-delivery`, stacked on the unmerged household-adult branch. Demo badges, synthetic sign-in defaults, demo-account hints, public-profile labels and the synthetic initial-manager default now require `DOGCLUB_LOCAL_DEMO=1` and are forcibly disabled whenever `NODE_ENV=production`. The shared dog photograph remains the platform logo; it is no longer accompanied by misleading fictional-demo presentation in production.

Configured deployments can send a 30-minute, one-time password-reset link to the account's stored email through the Resend REST API. The request uses a stable idempotency key, production reset origins require HTTPS, and only the token hash is stored. Support sees pending, provider-accepted or failed delivery status plus a provider message ID or bounded error code. Provider response bodies and raw tokens are not retained. Provider acceptance is explicitly not represented as inbox delivery. Failed or unconfigured email remains available through the existing platform-owner manual process, and public responses continue to hide account and delivery status.

Local demo mode never sends recovery email. No Resend key, sender domain or production environment variable was configured, and no external message was sent during this checkpoint. Before rollout, verify a sending domain, set `RECOVERY_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `RECOVERY_EMAIL_FROM` and the HTTPS `APP_URL` in the intended production environment, then exercise a real test inbox and one-time reset. Delivery/bounce webhooks, account-creation email verification, staff MFA and formal support identity checks remain incomplete.

Validation: TypeScript and all 83 isolated tests pass. Six new tests cover the Resend request/idempotency contract, bounded provider failures, configuration safety, production demo-mode denial, hashed automatic links, delivery audit state and manual fallback. Local browser acceptance confirms demo presentation and manual recovery copy remain visible in the explicitly enabled local demo. Production schema and data remain untouched; rehearse the delivery migration with the full stack in non-production PostgreSQL before rollout.

## Staff permissions and operational inventory checkpoint — 26/09/2026

Branch `codex/staff-permissions-inventory`, stacked on `codex/production-demo-recovery-delivery`. Adds tenant-scoped staff records, operational roles, independent staff-administration and booking/inventory permissions, service qualifications, reversible deactivation and access audit events. Managers retain implicit full administration. Staff assignment starts from an existing club membership; use the member invitation first, then assign staff access. No private care, admission or household-data policies were broadened in this increment.

Adds tenant-scoped venue locations. New operators receive a Main venue automatically. Services and stations can be retired/restored; stations and published shifts belong to one location; booking availability only pairs an active groomer with a station at the shift's location. A venue cannot be retired while it still has an active station or published shift. Historical bookings and audit ownership are retained after staff deactivation.

Validation: TypeScript and all 86 tests pass. Focused coverage proves delegated setup, location matching, immediate deactivation, retained audit, self-escalation denial and tenant isolation. Browser acceptance assigned `bea@demo.invalid` as a qualified groomer with booking/inventory permission and confirmed the staff and booking-setup pages render without console warnings/errors. This changed only persistent local synthetic demo data. Production schema, data and services remain untouched.

Before rollout: rehearse migration `20260927170000_staff_permissions_inventory.sql` with the complete stack in non-production PostgreSQL and inspect effective grants. Add a dedicated staff-invitation journey, staff MFA, narrowly reviewed reception/care permissions and full rota workflows before describing AD-02 or RO-01–08 as complete. The next sensible foundation proof is two freshly onboarded synthetic operators configured end-to-end without SQL, alongside a non-production migration rehearsal.

## Staff invitation checkpoint — 26/09/2026

Branch `codex/staff-invitations`, stacked on `codex/staff-permissions-inventory`. Managers and staff with delegated staff-administration permission can issue a hashed, single-use 72-hour invitation containing the intended operational role, the two bounded delegated permissions and selected grooming qualifications. Acceptance atomically creates or reuses the account, adds ordinary club membership, activates staff access, replaces qualifications and appends the staff audit event. Existing accounts must authenticate as the invited account before accepting; issuer permission is rechecked at acceptance.

The staff workspace now creates, lists and revokes these invitations. Links are shown once for private sharing; no email-delivery claim is made. Invalid or cross-tenant qualifications, cross-tenant issuers, unauthenticated existing-account claims and attempts to wrap a core manager in a staff record are rejected.

Validation: TypeScript and all 89 tests pass. The three staff-invitation tests cover token hashing, atomic membership/access/qualification/audit creation, existing-account authentication, delegated staff-admin authority and tenant/service boundaries. Local browser acceptance created a synthetic groomer invitation with one qualification and showed it as awaiting acceptance; no console warnings/errors and no external email. Production remains untouched.

## Operator demo-readiness checkpoint — 26/09/2026

Branch `codex/operator-readiness`, stacked on `codex/staff-invitations`. The platform console computes five configuration checks from persisted tenant data: manager access, active venue, active grooming service, active station and a published shift with an active qualified groomer at the matching venue. It exposes configuration counts only and does not return member, dog, care, booking or payroll records. The UI labels a passing operator “Demo ready” and explicitly separates that status from payment-provider connection, production approval and app-store release.

Validation: TypeScript and all 91 tests pass. New acceptance coverage provisions two differently branded synthetic operators through secure invitations and configures a distinct service, station and qualified rota for each through the same application service layer—no SQL or source-code fork. A tenant member cannot read readiness. Local browser acceptance shows Coast at 1/5 and both Willow and Pavilion Pooch at 5/5, then verifies the complete Willow checklist. Production schema, data and services remain untouched.

Next: implement trial, onboarding, active, restricted and closed operator lifecycle states with explicit access/export behaviour before describing WL-06 as complete. Rehearse the full stacked migration sequence in non-production PostgreSQL before any live rollout.

## Operator lifecycle checkpoint — 26/09/2026

Branch `codex/operator-lifecycle`, stacked on `codex/operator-readiness`. Adds onboarding, trial, active, restricted and closed operator states with server-controlled, audited transitions. Trial and active require the five operator-readiness checks; active also requires an explicit external production/payments/support/operations review acknowledgement. Restricted operators retain existing access so customer obligations continue, while new member and staff invitations are blocked. Closed removes ordinary tenant and public-profile access without deleting memberships, bookings, subscriptions or payment history, and cannot be silently reopened.

Validation: TypeScript and all 95 tests pass. Four lifecycle tests cover onboarding access, readiness and external activation gates, platform-only audit history, restricted growth with retained records, closure, direct profile-write denial and irreversible closure. Local browser acceptance shows Willow’s Trial controls and rejects Coast activation at 1/5 readiness. The client/server lifecycle contract is split so no database module reaches the browser bundle. Production remains untouched.

Next: implement a permissioned per-operator export plus tested restore/offboarding procedure, then rehearse the full migration stack in non-production PostgreSQL before any live rollout.

## Operator export and restore checkpoint — 26/09/2026

Branch `codex/operator-export-restore`, stacked on `codex/operator-lifecycle`. The platform-owner console downloads a versioned, tenant-bound JSON archive with a record count and SHA-256 integrity value. It includes operator configuration and operational history, including binary dog photographs, while excluding passwords, sessions, invitation/recovery tokens, admission pass bearer codes, hosted Stripe URLs and raw Stripe webhook payloads. Export and completed restore operations are audited.

Restore is intentionally engineer-operated. It requires a clean migrated destination and exact, separately verified account identities; credentials never travel in the archive. Restore is transactional, refuses an existing operator ID, recreates admission passes with replacement codes in an inactive state and advances restored identity sequences. The offboarding runbook is in `docs/OPERATOR_EXPORT_AND_RESTORE.md`; this feature never deletes live data.

Validation: TypeScript and all 98 tests pass. The export suite covers platform-only access, tenant boundaries, credential and hosted-URL removal, tamper detection, dog-photo restoration, inactive replacement admission passes, a complete isolated-database restore and rollback when an identity prerequisite is missing. The authenticated local Willow download returned HTTP 200 and the platform panel rendered without errors.

The complete 18-migration stack was also applied to a clean disposable Supabase PostgreSQL 17 container as `supabase_admin`, producing 52 public tables. Effective `club_app` grants were inspected and all 98 tests passed through the rollback-only shared-PostgreSQL harness; final counts showed zero synthetic clubs and export events. The lower-privilege `postgres` login correctly failed to create the migration ledger because it does not own `public`, so deployment must use the approved migration-owner connection. See `docs/NON_PRODUCTION_POSTGRES_REHEARSAL.md`. Production remains untouched.

Next: begin the next approved product slice. Community moderation/search and the iOS/Android shared-client foundation are the strongest code-owned gaps; live email, Stripe, POS and payroll proof still depend on provider credentials and operator decisions. Do not describe the disposable rehearsal as managed-cloud staging approval.

## Shared mobile foundation checkpoint — 26/09/2026

Branch `codex/mobile-foundation`, stacked on `codex/operator-export-restore`. Adds generated iOS and Android Capacitor 8.4.3 projects under the shared member-app identifier `uk.co.thedogclub.member`, a safe-area-aware bundled development shell, the approved demo dog image and repeatable sync/open scripts. The shell explicitly says when no Dog Club server is connected; this is a build foundation, not a store-ready native member journey.

The latest 8.5.2 CLI was rejected because `npm audit` reported a moderate transitive `uuid` advisory through its Xcode parser. The compatible 8.4.3 dependency set reports zero vulnerabilities. Android debug assembly passes with the installed Java 21 runtime; Java 25 is too new for the generated Gradle toolchain. The unsigned iOS simulator build passes with Xcode 26.5. No signing identity, store listing, production endpoint, push entitlement or external deployment was created.

Next: add a native-safe authentication/API contract and exercise sign-in, tenant selection, dog profile and photo selection on both simulators. Keep camera permissions, push/deep links, account deletion, signing and distribution behind their own acceptance gates.

## Mobile member-session checkpoint — 26/09/2026

Branch `codex/mobile-member-session`, stacked on `codex/mobile-foundation`. Adds a native-safe server contract and shared iOS/Android development journey for member sign-in, club selection and tenant-scoped dog lists. Mobile sessions use 256-bit bearer tokens, store only SHA-256 digests, expire after eight hours and revoke on sign-out. The shell keeps the token in memory only and therefore signs out on close or refresh. Password hashes, care notes, owner account IDs and stored token hashes are never returned.

The API reuses the existing lifecycle and row-level tenant boundary. It allows the fixed Capacitor origins plus exact configured test origins, never wildcard CORS. The development shell accepts only HTTPS endpoints or recognised local simulator addresses. The visible server field must be removed in favour of a compiled reviewed endpoint before a signed release.

Validation: TypeScript and all 104 isolated tests pass. Mobile coverage proves token hashing, normalised sign-in, generic invalid credentials, expiry, revocation, club/dog tenant isolation, restricted-role denial and CORS rejection. Both native projects have been synchronised with the new shell. Production schema, data, credentials and deployment remain untouched.

Next: provide bearer-authorised dog detail/photo delivery, then run the complete journey on iOS and Android against an HTTPS non-production deployment. Review Keychain/Keystore storage and device-loss revocation before persisting sessions; review camera/library privacy text before adding photo selection.

## Mobile dog-profile checkpoint — 26/09/2026

Branch `codex/mobile-dog-profile`, stacked on `codex/mobile-member-session`. Adds a bearer-authorised dog-detail route and versioned photo route. Both re-check the member's current club access and reuse the established dog/photo row-level policies, so private, members-only and public audience changes take effect immediately. Photo responses are WebP-only, non-cacheable and fetched with the bearer header; the app converts the response to a temporary object URL and revokes it when leaving the profile.

The shared shell now opens each visible dog into a profile with photograph or branded fallback, breed, biography, audience label and “Your dog” marker. It still receives no owner identifier or care note. Hostile club substitution returns the same not-found result as a missing profile.

Validation: TypeScript and all 105 isolated tests pass; focused response coverage verifies the mobile photo content type, cross-origin policy, no-store policy, exact bytes and unavailable response. A live localhost probe returned Bertie's permitted profile and rejected Coast substitution with 404. Capacitor synchronisation, Android debug assembly with Java 21 and unsigned iOS simulator build all pass. The local seed has no Bertie photograph, while existing image-policy tests cover authorised bytes and immediate revocation. Production remains untouched.

Next: add authorised profile editing and photo upload/replace/remove. Do not add camera or library capabilities until iOS usage descriptions, Android permissions, size/type handling and denial/retry behaviour are reviewed together.

## Mobile dog-profile editing checkpoint — 26/09/2026

Branch `codex/mobile-dog-edit`, stacked on `codex/mobile-dog-profile`. Owners and household adults with delegated dog-care permission can edit a dog's name, breed, biography, profile colour and private/members/public audience from the shared mobile shell. The PATCH route re-checks the live bearer session, club lifecycle, current dog visibility and `can_manage` permission before calling the same validated, audited `saveDog` service used by the web app. Another member, a booking-only household adult or a substituted tenant receives no edit control and cannot write through the route.

The editor enforces the same server-side length and enum schema as the web app. Saving refreshes the detail view and returning to the club refreshes the list, so an audience or profile change is not left stale in memory. Mobile CORS now explicitly permits PATCH while retaining exact-origin matching.

Validation: TypeScript and all 105 isolated tests pass, including explicit PATCH preflight coverage and the existing ownership, household-permission, tenant-isolation, validation and audit tests exercised by the shared service. Capacitor sync and both native debug builds pass. Production remains untouched.

Next: design the photo upload/replace/remove boundary with iOS library/camera usage descriptions, Android permission behaviour, the existing 5 MB/20-megapixel normalisation limits and denial/retry UX before adding native media access.

## Mobile dog-photo editing checkpoint — 26/09/2026

Branch `codex/mobile-dog-photo-edit`, stacked on `codex/mobile-dog-edit`. Owners and household adults with dog-care permission can select a JPEG, PNG or still WebP through the operating system picker, replace the current profile photograph and remove it after confirmation. This deliberately uses no capture attribute, camera plugin or broad photo-library permission. Camera access remains a separate capability requiring iOS/Android privacy copy and denial/retry acceptance.

The upload route authenticates the bearer session, distinguishes unauthenticated from unavailable records, re-checks live tenant and `can_manage` authority, and reads request bytes through a hard 5 MB streaming bound even when content length is absent. The established image pipeline validates actual bytes and decoded pixels, auto-rotates, resizes, strips metadata and stores still WebP. Replacement/removal stays atomic with the existing profile and audit service; another member receives 404.

Validation: TypeScript and all 108 isolated tests pass. Three new tests cover exact bounded bytes, early rejection from declared size and streamed over-limit rejection. A live localhost round trip replaced Bertie's synthetic photograph, fetched the resulting 23,194-byte WebP, denied Bea's replacement with 404, removed the photograph and confirmed the profile URL cleared. The synthetic local record was returned to its original no-photo state. Capacitor sync and both native debug builds pass. Production remains untouched.

Next: run the complete member journey interactively on named iOS and Android simulators against a reviewed HTTPS non-production endpoint. Then address secure Keychain/Keystore session persistence and device-level revocation before signing or distribution.

## Mobile simulator acceptance checkpoint — 26/09/2026

Branch `codex/mobile-simulator-polish`, stacked on `codex/mobile-dog-photo-edit`. The unsigned iOS build was installed on a disposable iPhone 17 Pro simulator running iOS 26.5 and exercised against the local synthetic server. The synthetic member signed in, selected The Willow Club, opened Bertie’s club-member profile, saw the bearer-delivered photograph and authorised photo controls, opened the populated profile editor, then returned to a blank login screen after the app was terminated and relaunched. This confirms the current session is memory-only on device.

Interactive acceptance exposed a CSS specificity defect: when a dog had a photograph, the coloured initial fallback could remain visible beneath it because `.profile-photo.avatar` overrode `.hidden`. The shared shell now makes the visibility state authoritative, with a regression test covering the rule. The corrected profile displays one image only.

Validation at this checkpoint originally covered 109 isolated tests, TypeScript, Capacitor sync, Android debug assembly with Java 21 and the unsigned iOS simulator build. Android interactive acceptance has since completed on the named Pixel 9 Pro emulator; see the Android guided-demo rehearsal below. The simulator passes used localhost synthetic records rather than a reviewed HTTPS non-production deployment. Production remains untouched.

Next: move both native clients to a reviewed HTTPS non-production endpoint and design Keychain/Keystore session persistence plus device-level revocation before signing or distribution.

## Mobile member-home checkpoint — 26/09/2026

Branch `codex/mobile-member-home`, stacked on `codex/mobile-simulator-polish`. The shared member client now loads a tenant-scoped home summary alongside the club’s dog directory: the signed-in account’s current plan and state, monthly price, remaining grooming credits, benefit availability and period/cancellation date, plus up to five confirmed future grooming bookings with the dog, service, London date/time and either credits used or amount due.

The server applies explicit actor predicates in addition to row-level security. This matters for managers: using the member client does not return other households’ subscriptions or bookings even though the manager’s operational role can see them elsewhere. Delegated household adults see only future bookings for dogs where their live grant includes booking management. Provider IDs, card details, staff IDs, care notes and other households’ records are absent from the response.

Validation: all 111 isolated tests and TypeScript validation pass. A focused domain test creates a synthetic membership and credit-funded future booking, verifies Alice’s summary, and proves Bea and the Willow manager receive empty commercial summaries. A direct bearer-authorised localhost probe returned Alice’s `Care Demo` membership with two credits and no upcoming local bookings. Capacitor sync, Android debug assembly with Java 21 and the unsigned iOS simulator build pass. Simulator automation signed in successfully, but external clicking became unreliable at the club card after reinstall, so this slice does not claim a completed iOS visual pass. Production remains untouched.

Next: complete the member-home visual pass on iOS and Android, then add mobile availability/search and booking confirmation without collecting card payment. Keep secure session persistence, reviewed HTTPS configuration and store signing behind their existing gates.

## Mobile grooming-booking checkpoint — 26/09/2026

Branch `codex/mobile-booking`, stacked on `codex/mobile-member-home`. The shared iOS/Android member client now lists only grooming-approved dogs the signed-in household may book, loads the club's active services and cancellation terms, searches real London-time availability and confirms a selected slot through the existing atomic booking service. Availability continues to enforce qualified staff, published shifts, breaks, station closures, service and clean-up duration, existing appointments and future-time rules without exposing staff or resource identities.

The primary account can choose an eligible grooming credit when the current membership permits benefits and has enough balance. A delegated household adult with live booking permission can book the shared dog but cannot see or spend the owner's subscription credits. A manager who signs into the member client receives no other household's booking choices or membership balance. The member must explicitly accept the displayed cancellation terms. Cash bookings show the GBP amount due at the club and state that no payment is taken in this demo; no card details are requested or stored.

Validation: TypeScript passes and all 114 isolated tests pass. The new coverage proves owner, household-adult and manager projections, owner-only credit use, credit balance reduction and the presence of the complete mobile search/confirmation contract. A bearer-authorised localhost probe returned HTTP 200 with synthetic Bertie, the active service and two credits. Capacitor sync, Android debug assembly with Java 21 and the unsigned iOS simulator build pass. The rebuilt app launches and the login screen renders correctly on the disposable iOS simulator. External simulator input automation became unreliable before reaching the booking screen, so this checkpoint does not claim a completed interactive booking visual pass. The later Android guided-demo rehearsal below completes that platform's interactive booking and paywall acceptance. Production remains untouched.

Next: complete the booking journey visually on iOS and Android against a reviewed HTTPS non-production endpoint, then add member cancellation/rescheduling. Decide whether service payments remain pay-at-club or use the existing Stripe direction before adding card collection. Secure Keychain/Keystore sessions, device revocation, signing and store distribution remain separate release gates.

## Mobile booking-cancellation checkpoint — 26/09/2026

Branch `codex/mobile-booking-cancellation`, stacked on `codex/mobile-booking`. Each future appointment on the mobile member home now has a Cancel booking action with a confirmation naming the dog, service and London appointment time. The bearer-authorised DELETE route rechecks the live club membership and delegates to the existing locked cancellation service. Owners and household adults with current booking permission can cancel; another household receives a generic not-found response. A visit that has started cannot be cancelled in the app.

Cancellation records the mobile-member reason in the booking and audit event, immediately removes the appointment from the member home, releases staff/station availability and restores an applied grooming credit exactly once. The success copy tells the member that any applied credit has been restored. Rescheduling is deliberately not represented as cancel-plus-book because that could surrender the existing appointment before the replacement is secured.

Validation: TypeScript and all 116 isolated tests pass, including confirmed-booking removal and restoration of the synthetic credit balance from one to two. Capacitor sync, Android debug assembly with Java 21 and the unsigned iOS simulator build also pass. Production remains untouched.

Next: complete the iOS/Android visual journey against reviewed HTTPS non-production infrastructure. Then design a transactional rescheduling operation that locks the existing booking and replacement capacity together.

## Mobile booking-rescheduling checkpoint — 26/09/2026

Branch `codex/mobile-booking-reschedule`, stacked on `codex/mobile-booking-cancellation`. Each future appointment now has a Change time action. The member chooses another date and live slot while the dog and service stay fixed. Availability excludes the current booking only after verifying that it is a confirmed appointment for that club, dog and service.

The bearer-authorised PATCH route locks the existing appointment, rechecks owner or live household booking authority, rejects cancelled bookings and visits that have started, and secures qualified staff and station capacity before changing any booking data. The move is one database transaction: an unavailable replacement leaves the original appointment intact. The booking keeps its snapshotted price, amount due, applied credits and cancellation terms, while an append-only `booking.rescheduled` event records the old and new times.

Validation: TypeScript and all 119 isolated tests pass. New domain coverage proves a successful move retains the booking identity and commercial terms, does not debit another credit, writes the reschedule event, rejects another household and preserves the original appointment when replacement capacity cannot be secured. Capacitor sync, Android debug assembly with Java 21 and the unsigned iOS simulator build pass. Production remains untouched.

Next: complete the iOS/Android visual journey against reviewed HTTPS non-production infrastructure and resolve whether service payments remain pay-at-club or use a reviewed Stripe flow. Secure Keychain/Keystore sessions, device revocation, signing and store distribution remain separate release gates.

## Grooming service-payment design checkpoint — 26/09/2026

Branch `codex/mobile-service-checkout`, stacked on `codex/mobile-booking-reschedule`. The product decision is now explicit: non-credit grooming bookings use Stripe-hosted one-time Checkout through the club's configured connected account. The implementation contract is in `docs/SERVICE_PAYMENTS.md`.

The design holds capacity for 30 minutes in an `awaiting_payment` booking, confirms only from a signature-verified paid webhook and releases failed or expired holds. Browser return never fulfils a booking. Stable idempotency, duplicate/out-of-order webhook handling, late-payment reconciliation, tenant separation and immutable price/terms snapshots are required. Dynamic payment methods remain enabled; Stripe Tax and automatic refunds stay off until the operator confirms VAT and cancellation/refund policy.

This checkpoint changes documentation only. No payment schema, Stripe session, provider configuration or production service was created. Next: implement the schema and domain lifecycle with isolated gateway tests before exposing Checkout in the mobile client.

## Grooming service-payment server checkpoint — 26/09/2026

Branch `codex/mobile-service-checkout`, continuing from the design commit. Adds server-only one-time Stripe Checkout preparation for non-credit grooming bookings. A validated request creates an `awaiting_payment` booking and 30-minute staff/station hold in one transaction, then creates the hosted Checkout Session with a stable local ID and Stripe idempotency key. A retry reuses the same attempt and URL. Availability blocks unexpired holds and automatically ignores expired ones.

Signed webhook events now route to the service-payment lifecycle before the existing membership flow. Paid events must match the connected account, local checkout ID, exact GBP amount and booking before confirmation. Unpaid events remain pending; failed and expired attempts cancel the hold and release capacity. A payment arriving after expiry is stored as `late_paid` with an open manual reconciliation exception and never silently confirms capacity. Browser return remains informational and cannot fulfil the booking.

The provider/session, payment and exception tables use forced RLS with no restricted-client grants. Operator archive schema v2 includes the financial ledger and exceptions, removes hosted Checkout URLs and continues to omit raw webhook payloads. TypeScript and all 123 isolated tests pass; new coverage proves safe retry, capacity exclusion, tenant denial, paid confirmation, failed/expired release, late-payment quarantine and amount mismatch rejection. Supabase's local security advisor reported only the pre-existing mutable `public.set_updated_at` search-path warning. Production and real Stripe accounts remain untouched.

Next: add the bearer-authorised mobile checkout route and native system-browser handoff/status refresh. Then run a real Stripe sandbox Checkout plus signed webhook sequence against reviewed HTTPS non-production infrastructure before describing service payment as connected.

## Mobile grooming Checkout checkpoint — 26/09/2026

Branch `codex/mobile-service-checkout-ui`, stacked on `codex/mobile-service-checkout`. Non-credit mobile grooming confirmation now calls a bearer-authorised service-Checkout endpoint, which creates or safely reuses the 30-minute booking hold and returns the Stripe-hosted URL. Credit-covered bookings continue through the existing immediate-confirmation route. The client preserves a UUID request key across retry, opens Checkout using Capacitor Browser 8.0.4 and keeps a manual status-refresh control for web fallback or delayed webhook delivery.

Closing the native browser reads a separate authenticated status projection. It reports awaiting payment, confirmed, failed, expired or late-paid follow-up without exposing provider account, Checkout Session, PaymentIntent or hosted URL data. The return itself never confirms a booking; only the existing signed webhook path does that. Status access requires the initiating account's live club membership and exact club/booking relationship.

Validation: TypeScript, all 123 isolated tests, Capacitor synchronisation, Android debug assembly with Java 21 and the unsigned iOS simulator build pass. Focused coverage includes request reuse, tenant denial and pending/confirmed/expired/late status projection. `npm audit` reports zero vulnerabilities. This checkpoint has not run a real Stripe sandbox Checkout or a visual device journey, and production remains untouched.

Next: run a real Stripe sandbox Checkout and signed webhook sequence against reviewed HTTPS non-production infrastructure. Add Universal Links/App Links plus the HTTPS fallback before treating return-to-app as release-ready; automatic refunds and café POS remain later policy-led slices.

## Service-payment expiry reconciliation checkpoint — 26/09/2026

Branch `codex/service-payment-expiry`, stacked on `codex/mobile-service-checkout-ui`. Adds a protected Vercel maintenance endpoint that converts effectively expired payment holds into persisted cancelled bookings, expired checkout sessions and audit events. Work is bounded to four batches of 250 rows per invocation, and `SKIP LOCKED` makes overlapping invocations safe. The endpoint requires an exact `Bearer` match against a `CRON_SECRET` of at least 16 characters and returns non-cacheable aggregate counts only.

Capacity already releases exactly when the 30-minute timestamp passes because availability and payment-status reads compare the expiry directly. The checked-in schedule runs at 03:17 UTC once daily to reconcile durable state and remains valid on Vercel Hobby, whose cron minimum is once per day and whose timing may vary within the hour. No secret was generated or added to Vercel, and production remains untouched.

Validation: TypeScript, all 125 isolated tests, `vercel.json` parsing and the production Next.js build pass. Authentication coverage proves exact bearer matching and fail-closed behaviour for absent or weak secrets; service-payment coverage exercises bounded multi-batch reconciliation and the existing late-payment quarantine.

Next: validate the maintenance endpoint in a non-production deployment with a configured `CRON_SECRET`, then run the real Stripe sandbox Checkout and signed webhook sequence once the missing Stripe and app-origin credentials are available.

## Local demo service-payment wall checkpoint — 26/09/2026

Branch `codex/demo-service-paywall`, stacked on `codex/service-payment-expiry`. Explicit local demo mode now replaces the unavailable Stripe-hosted page with a polished, hosted-looking payment wall that shows the club, service, dog, London appointment time and GBP total. It offers successful and declined outcomes, states prominently that no money or card data is involved, and contains no card inputs.

The simulator uses the same service-payment event lifecycle as the Stripe adapter. A completed demonstration confirms the held booking and writes a captured synthetic GBP payment; a decline cancels the booking and releases capacity. The mobile API selects this gateway only when `DOGCLUB_LOCAL_DEMO=1` and the runtime is not production. The page, server action and synthetic provider-account setup all repeat that fail-closed gate, so production cannot silently use the simulator.

Focused TypeScript and four new tests pass. Browser acceptance created checkout `26e5cf8b-da13-41fa-b8a6-966b4dcd10b3` for Bertie's £65 Member full groom, rendered the labelled payment wall, completed it and displayed the confirmed result. A direct local ledger read then showed booking `099d4df5-7423-4540-bc80-835ea6b16fc7` as `confirmed`, the checkout as `completed`, the payment as `captured` for 6,500 pence GBP and the capacity hold cleared. Production remains untouched.

Next: retain this simulator for demonstrations, but do not describe payments as connected. A real Stripe sandbox Checkout plus signed webhook sequence against a reviewed HTTPS non-production deployment remains the payment acceptance gate.

## Local demo activity-reset checkpoint — 26/09/2026

Branch `codex/demo-reset`, stacked on `codex/demo-service-paywall`. The local platform-owner console now exposes a confirmation-gated reset for each synthetic operator. It transactionally removes grooming bookings and visit history, service-payment attempts/payments/exceptions, booking-linked grooming-credit entries and admission visit history while preserving branding, accounts, dogs, approvals, subscriptions and opening benefit allocations, services, resources, staffing and rotas.

The server permits the reset only in explicit non-production local demo mode, refuses `DOGCLUB_DB=supabase`, rechecks platform-owner authority and rejects any club with a member address outside the reserved `@demo.invalid` domain. Browser acceptance proved the unchecked request is rejected and a confirmed Willow reset removed its existing demonstration activity while the operator remained Demo ready. Production remains untouched.

Validation: TypeScript, all 131 isolated tests and the production Next.js build pass. Next: keep the reset behind the same local-only boundary while preparing the repeatable member-to-manager demonstration script.

## Guided local sales-demo checkpoint — 26/09/2026

Branch `codex/demo-guide`, stacked on `codex/demo-reset`. The local platform console now links to a guided demonstration command centre. It selects Willow by default, can switch between synthetic operators, reads live configuration readiness and bounded activity counts, and derives the member and manager demo addresses from the selected tenant rather than hard-coding one brand.

The six-step story covers a clean reset, member app introduction, grooming booking and labelled payment simulation, manager diary, grooming visit through verified collection and the member's reschedule/cancellation controls. The page and companion `docs/DEMO_WALKTHROUGH.md` state the simulation and missing-provider boundaries explicitly. The guide rechecks platform ownership, requires explicit local demo mode, refuses Supabase and rejects mixed/non-demo tenant accounts; production returns not found.

TypeScript, all 133 isolated tests and the production Next.js build pass. Browser acceptance rendered Willow as Ready with its live dog/activity counts, Alice and the manager, working operator switching links and all six steps. Next: use this guide for an uninterrupted rehearsal on one iOS simulator and one Android emulator.

## iOS guided-demo rehearsal checkpoint — 26/09/2026

Branch `codex/ios-demo-rehearsal`, stacked on `codex/demo-guide`. The current unsigned build completed the synthetic member journey on the named `Dog Club iPhone` simulator running iOS 26.5: Alice signed in, selected The Willow Club, saw the Care Demo membership and dog directory, chose Bertie and a live Member full groom slot, declined use of a membership credit, accepted the cancellation terms, opened the clearly labelled local payment wall in Capacitor Browser, completed the no-money simulation, returned to the app and refreshed the booking to confirmed.

The rehearsal exposed a commercial-status copy bug: the confirmed £65 booking still displayed `£65.00 due`. The member-home projection now returns an explicit `membership_credit`, `paid` or `due` state. Paid state is derived from the tenant-scoped `booking.payment_confirmed` event, so the restricted member client still cannot read the protected service-payment ledger. The corrected simulator visibly renders `£65.00 paid`; credit-funded and genuine amount-due bookings retain their own labels.

Validation at this checkpoint covered TypeScript, all 133 isolated tests, the production Next.js build, Capacitor sync, a clean Android debug assembly with Java 21 and the unsigned iOS simulator build. The extra untracked `android/app/src/main/res/xml/config 2.xml` was moved to `/private/tmp` only during Android assembly and restored automatically; all pre-existing duplicate files remain untracked and untouched. The later Android guided-demo rehearsal below completes the second native-platform acceptance. The rehearsal used synthetic localhost records and the local no-money payment simulator; production and real Stripe remain untouched.

Next: move both clients to a reviewed HTTPS non-production endpoint and complete the real Stripe sandbox plus signed-webhook acceptance gate before any release or payment-connected claim.

## Android guided-demo rehearsal checkpoint — 26/09/2026

Branch `codex/android-demo-rehearsal`, stacked on `codex/ios-demo-rehearsal`. The shared Capacitor build completed the synthetic member journey on the named `Dog_Club_Pixel` Pixel 9 Pro emulator running Android API 36. Alice signed in, selected The Willow Club, saw the Care Demo membership and two grooming credits, chose Bertie and the Member full groom at 11:45 on 27/09/2026, declined use of a membership credit, accepted the cancellation terms and opened the local demonstration payment wall.

The paywall visibly showed Bertie, the service, the London appointment time, the £65 total and `DEMONSTRATION · NO MONEY OR CARD DATA`. Completing the simulation confirmed the checkout. Returning to the app and signing in again showed both the earlier 09:15 iOS rehearsal booking and the new 11:45 Android booking as `£65.00 paid`.

The rehearsal exposed four Android-local issues. The native Capacitor origin `https://localhost` was absent from the exact CORS allowlist; Android blocked the local HTTP server as mixed content; the checkout route generated a `0.0.0.0` URL instead of preserving the emulator-facing `10.0.2.2` host; and handing local checkout to Chrome reached its first-run terms screen on a fresh emulator. The fix adds the missing native origin and preserves the forwarded request host. A self-contained checkout activity handles recognised localhost addresses in debug builds only. Cleartext and mixed-content access remain restricted to the debuggable Android build and the allowlisted local hosts; normal HTTPS checkout continues through Capacitor Browser. The payment explanation also updates immediately when the member changes the credit choice.

Final validation passes: `npm run typecheck`, all 134 tests, `npm run build`, Capacitor sync and a clean Android debug assembly with Java 21. The pre-existing untracked duplicate resource `config 2.xml` was moved out only for assembly and restored automatically. Production, real Stripe and card data were untouched.

Next: move both native clients to a reviewed HTTPS non-production endpoint, persist sessions through Keychain/Keystore with device-level revocation, and complete the real Stripe sandbox plus signed-webhook acceptance gate before signing or distribution.

## Secure native-session checkpoint — 26/09/2026

Branch `codex/mobile-secure-sessions`, stacked on `codex/android-demo-rehearsal`. The shared member client now persists its eight-hour bearer session on native devices without storing the member password. iOS uses a this-device-only Keychain item and Android uses AES-GCM with a non-exportable Android Keystore key; the encrypted Android preference contains only ciphertext and an IV. Browser previews remain memory-only.

The club picker now lists the account's active signed-in devices, marks the current one and lets the member revoke another session. Session IDs and bounded generic device labels are additive to the session table. Revocation is account-scoped, unknown or cross-account identifiers receive the same empty response, password recovery revokes every native session, and any later 401 clears the local vault and returns the app to sign-in with accurate expired-or-signed-out copy.

Validation passes: TypeScript, all 136 isolated tests, the production Next.js build, Capacitor sync, clean Android debug assembly with Java 21, unsigned iOS compilation and a normally signed simulator build. Interactive acceptance on both named simulators signed Alice in, rendered the current and other devices, terminated and relaunched into Willow without re-entering a password, then revoked the device from a temporary second session. Each next launch rejected the revoked token, cleared native storage and showed the accurate signed-out message. Android's private preference held ciphertext and an IV rather than the raw token or password; iOS restored through its this-device-only Keychain item. The temporary controller sessions were also revoked. Production and live Supabase remain untouched; the additive migration still needs its normal reviewed non-production rehearsal before deployment.

Next: move both clients to a reviewed HTTPS non-production endpoint. Real Stripe sandbox and signed-webhook acceptance, app links, distribution signing and store distribution remain release gates.
