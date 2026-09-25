# App review against PRD v0.8

25/09/2026 · Reviewed branch `codex/demo-logo-checkpoint`, commit `23b1362`. Fresh GitHub fetch: branch up to date; PR #3 remains open. Main is `5744bc2`. Logo/copy changes are in the draft PR, not main. Production activation evidence comes from HANDOVER.md and the earlier live verification, not a new live-service audit in this review.

## Assessment

The app is a persisted web foundation and dog-profile slice, not yet the operational membership/grooming/café product specified for the pilot. Stage 1 is incomplete; Stage 2 has partial web implementation. A successful deployment and attractive login do not satisfy the launch gates. No percentage is assigned: requirements differ greatly in size and operational importance.

Basis: PRD.md v0.8, ROADMAP.md v0.8, WHITE_LABEL_PLATFORM.md, application routes/components/domain code, migrations, test inventory and handover. This is a requirements/code review, not a fresh full usability, security or native-device audit. The existing 28 passing tests cover isolation/photos and password verification; they do not prove booking, commerce, workforce or onboarding acceptance. No test rerun was needed for this documentation-only review.

## Requirement coverage

Partial means a working subset exists; it does not mean the full acceptance criterion passes. Missing means no implementation was found in routes, domain code or database schema.

| PRD references | Area | Assessment and remaining acceptance work |
| --- | --- | --- |
| PL-01, PL-02 | iOS/Android and shared accounts | Native clients missing. Shared web backend exists; cross-device native journeys untested. Responsive web is not the required store release. |
| PL-03, PL-04 | Mobile media, push, distribution | Web photo upload exists. Native camera/library permissions, push/deep links, store assets/signing and account deletion missing. |
| PL-05 | Web companion | Partial: responsive member/manager pages and public links. Staff tablet workflows and verified app links incomplete. |
| AC-01 | Household accounts | Partial: salted passwords, opaque sessions, login throttling and scoped access. No signup, verification, recovery, household/adult invitations or household permission model. |
| DG-01 | Dog records | Partial: multiple dogs per account; name, breed, bio, illustration, audience and one photo. Size/coat fields, structured sensitivities/handling, emergency contact and documents missing. A private notes table is not the complete care workflow. |
| DG-02 | Activity eligibility | Missing: review states, reviewer/reason/date, document expiry and activity-specific approval. |
| MB-01–03 | Paid membership and benefits | Missing. The current memberships table is an account-to-club role grant, not a subscription or benefit ledger. |
| BK-01–03 | Grooming appointments | Missing: services, price/consent, resources, availability, concurrency safeguards, change/cancellation/refunds. |
| VS-01–02 | Visits and collection | Missing: passes, admission/capacity, handover/progress/authorised collection and corrective audit workflow. |
| FD-01 | Human and dog menus | Missing: separate catalogues, prices, ingredients/allergens and availability. |
| OP-01, AD-01 | Daily staff/manager workspace | Partial shell: manager can list dogs and restricted care notes. No schedule, arrivals, staffing gaps, payments, task alerts or moderation queue. |
| AD-02 | Staff administration | Missing invites/deactivation/qualifications and fine-grained operational permissions. Only member/manager club roles plus separate platform-owner grants exist. |
| OP-02 | Cleaning and incidents | Missing, including dog-toilet checks and restricted incident escalation. |
| NT-01 | Notifications | Missing transactional delivery, reminder/expiry/groom-ready notifications and failure/manual fallback tracking. |
| RP-01 | Reporting | Missing operational/financial reporting and provider reconciliation. Dog counts are not the specified reporting feature. |
| SC-01 | Social profile editor | Partial: bio, single photo, private saves and local photo preview. No gallery, birthday month, structured prompts/activities or full audience preview. |
| SC-02 | Audience controls | Implemented core: explicit private/member/public selection, private default, server/database restrictions and revocation when unpublished. PRD suggests members-only audience before confirmation; current private default is more conservative and should be reconciled in the spec. |
| SC-03 | Member discovery | Partial: opted-in cards appear; no dog-name search or paid-membership eligibility/expiry enforcement. |
| SC-04 | Public sharing | Core public route and allowlisted fields exist; direct image access honours audience, no indexing by default. Open-link UI exists; dedicated copy-share action missing. |
| SC-05 | Pseudonymity | Partial: owner/contact/care fields excluded from public projection, ownership retained internally. No explicit “Dog’s human” display/optional first-name preview or staff ownership lookup workflow. |
| SC-06 | Moderation and blocking | Missing reports, blocks, manager hide/review queue and moderation audit. Required before a real community pilot. |
| SC-07 | Withdrawal/lifecycle | Partial: unpublish and single-photo removal/replacement revoke controlled access. No gallery lifecycle, account deletion or ended-membership unpublication. |
| RO-01–08 | Staff rotas | Missing all operational rota, leave, coverage, sickness, swap and staff self-service flows. |
| TM-01–03 | Attendance | Missing clock/break events, corrections, actual-vs-scheduled hours and overnight/offline/BST handling. |
| PY-01–05 | Payroll | Missing preparation, provider adapter/import, approval locks, reconciliation and secure payslip access. |
| SP-01–07 | Stripe and café payments | Missing subscriptions/deposits/balances, order ledger, counter payment, webhook/idempotency, refunds and reconciliation. No card capture is implemented. |
| Configurable UK integrations | Payroll/POS provider choice | Missing connector registry, authorisation, mappings, health, retries and provider-switch validation. Research shortlist is not integration support. |
| WL-01 | Tenant isolation | Partial acceptance coverage: existing dog/care/photo operations use scoped database roles and negative tests. Exports, queues, integrations and staff/payroll separation cannot pass before those features exist. |
| WL-02 | Branding/modules | Partial: name/tagline/location label, palette, built-in emblem and illustration tone. Supplied photo is a shared platform logo, not per-operator logo upload. No module registry, server entitlements, domains or full contact/service/policy configuration. |
| WL-03–04 | Operator setup | Partial: owner console, create club with existing manager, editable branding, config audit and version conflict logic. Missing invitations, draft/activation lifecycle, locations/resources and completed two-operator onboarding evidence. Existing clubs are seeded fixtures. |
| WL-05–06 | Commercial accounts/lifecycle | Missing software subscriptions vs merchant receipts, operator states and suspension/closure rules. |
| WL-07 | Demo separation | Partial: isolated local synthetic seed and production datastore selection. Demo badges and prefilled demo credentials are unconditional in production UI. Production must not be labelled fictional. |
| WL-08; section 9 | Support and readiness | Partial audit/error handling. No time-limited support access, tenant export/offboarding, tested restore evidence, staff MFA or retention/deletion workflow. Accessibility/performance targets not acceptance-tested. |
| EV-01, FD-02, RT-01 | Post-pilot features | Events/guest passes, table ordering and retention tools missing; remain P1 rather than pilot blockers unless promoted. |
| ZN-01, WS-01, LG-01, TR-01, CP-01, FD-03 | Premises-dependent flows | No zones/resources/transfer or conditional wash/training/pod flows. Keep decision-required/conditional status; do not infer capacity or service rules from draft drawings. |

## Evidence anchors

- `src/lib/auth.ts`: existing login/session behaviour; no account registration or recovery routes in src/app.
- `supabase/migrations/000_schema.sql`: accounts, club role grants, basic dog fields and care notes; no households, subscriptions, shifts, bookings or sales.
- `src/lib/dogs.ts`, `src/components/dog-form.tsx`, `src/lib/photos.ts`: profile/photo implementation and public projection.
- `src/app/club/[slug]/page.tsx`: profile cards and community list; explicitly labels membership/booking/café work as future milestones.
- `src/app/club/[slug]/operations/page.tsx`: dog/care table; explicitly identifies rotas, clocking, payroll, bookings and integrations as unconnected.
- `src/lib/branding.ts`, `src/lib/brand-contract.ts`, `src/app/platform/`: existing-account manager assignment and limited branding configuration.
- `tests/isolation.test.ts`, `tests/photos.test.ts`: 28 tests; no dedicated platform onboarding/branding authorisation or concurrent-editor tests found. OPERATOR_ONBOARDING.md acceptance bullets are desired tests, not evidence they ran; its claim of tested palettes is not substantiated by the test inventory.
- `HANDOVER.md`: successful production-owner sign-in, no clubs provisioned at activation, residual security/credential work. `PROJECT_STATUS.md` and old roadmap status paragraphs are stale; do not use them as completion evidence.

## Highest-priority gaps

1. **No complete new-customer journey.** A prospect cannot register, join, receive approval, pay or book. Operator creation itself requires a manager account that cannot be invited through the app. Finish identity/invitations and tenant setup before selling self-service onboarding.
2. **Care and social data need separate workflows.** Preserve the existing public allowlist while introducing household ownership, care fields/documents and activity eligibility. Do not turn the public bio into a substitute care record.
3. **Community launch needs moderation and lifecycle controls.** Unpublishing works, but reports/blocks and membership-ending behaviour are absent. Keep the pilot closed until those PRD P0 controls are in place.
4. **Scheduling depends on staffing.** Roadmap Stage 3 requires qualified published shifts, but the rota is placed in Stage 5. Bring minimum qualifications/shifts/breaks/leave into the booking foundation; payroll can remain later. Otherwise early booking would violate BK-01/RO-05.
5. **Production identity is misleading.** Remove unconditional demo labels/default credentials, add password recovery/change and staff MFA, resolve the already-recorded database privilege warning and verify credential rotation before real customers.
6. **Native apps remain a launch obligation.** Start the shared mobile foundation alongside backend contract stabilisation, not after declaring the web product complete.

## Recommended next delivery sequence

This is a proposed refinement, not an approved reduction in PRD scope.

1. Finish foundation: production/demo presentation, account lifecycle, invited manager/member access, households, staff permissions, configurable location/resource/service inventory. Add direct operator-permission and concurrency tests. Demonstrate two operator setups without SQL/account bootstrapping or code changes.
2. Complete dog/community slice: private care capture and approval, gallery/audience preview/search, moderation/blocking, membership expiry policy; start iOS/Android sign-in/profile/photo path against shared domain contracts.
3. Build one real operational journey in a test environment: plan/benefit model, qualified staffing availability, conflict-safe grooming request/booking, check-in, handover and collection. Agree operator rules first; label any simulation clearly.
4. Connect commerce: Stripe test-mode subscriptions/deposits/balances and café sale/refund reconciliation; keep operator software billing separate. Choose and validate one supported counter route.
5. Complete workforce/integrations: rotas/leave/swaps/coverage, actual clocking, approved timesheets, first validated payroll route, then second-adapter evidence before claiming interchangeable providers.
6. Pilot gate: native device/store readiness, complete member journey and staff shift rehearsal, financial reconciliation, notifications, privacy/export/deletion, recovery, accessibility and operator sign-off.

## Decisions to obtain before booking/payment build

Membership unit and tiers/prices; real operator name/address; staffing and independent-groomer model; service durations/buffers/resources/opening hours; admission/documents/cancellation rules; payroll and POS edition/hardware; shared app versus separately branded store distribution. These affect behaviour and cannot safely be replaced by guessed production defaults.

## Conclusion

Ready to demonstrate the visual identity, profiles, audience controls and initial branding configuration with known limitations. Not ready for a paid operational pilot or a claim of complete white-label onboarding. The best next milestone is a new operator and member joining through the product, followed by the first conflict-safe grooming journey—not additional disconnected screens.
