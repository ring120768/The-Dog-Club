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
4. Replace the initial testing password before real-customer use. Password-change/reset UI is not implemented yet. Do not write credentials into handovers.
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
