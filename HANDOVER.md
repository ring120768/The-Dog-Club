# Handover — getting the live site working

Updated 26/09/2026

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
