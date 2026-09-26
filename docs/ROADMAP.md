# Dog Club Platform — commercial build roadmap

Version 0.8 · 25/09/2026 · Supersedes earlier single-venue and demo-only delivery estimates

## Delivery principle

Build one sellable white-label product, with Chiswick as the first design partner. Demonstrate it with two synthetic clubs on the same architecture. Previously approved payroll, rotas, payments, social profiles and iOS/Android scope remains; deliver it incrementally through acceptance gates rather than promising every provider in the first demonstration.

This is the implementation plan, not completed software. A separate repository and infrastructure are required before source-code work. See [platform specification](WHITE_LABEL_PLATFORM.md) and [PRD](PRD.md).

## Build milestones

| Stage | Deliverable | Exit gate |
|---|---|---|
| 1. White-label foundation | Separate project, authentication, tenant isolation, operator onboarding, branding, roles and location/resource configuration | Two synthetic clubs configured without code changes; negative isolation tests pass |
| 2. Member and community journey | iOS/Android client foundation, dogs/photos, profile audiences, member discovery, moderation and public share pages | Real persisted workflow; audience and media privacy tests; both mobile platforms exercised |
| 3. Membership and booking | Member plans/benefits, service catalogue, qualified staffing/resource availability, appointment and visit lifecycle | One complete member journey with concurrency and permission checks |
| 4. Commerce | Operator merchant connection, software billing separate from member receipts, subscriptions, services/deposits and café payments/refunds | Non-live end-to-end reconciliation, then authorised operator pilot; no simulation presented as real processing |
| 5. Workforce | Manager rotas, leave/swaps, attendance/breaks, corrections, timesheets and first payroll provider | Actual hours reconciled to provider trial payroll; restricted payroll access verified |
| 6. Configurable integrations | Admin connection/mapping/health, initial payroll/POS routes and second-adapter validation | Provider switching does not duplicate payment/payroll; capabilities labelled accurately |
| 7. First customer pilot | Chiswick configuration, approved physical workflows, staff rehearsal, mobile distribution and live readiness | Core PRD P0 scope passes; financial/support/recovery procedures tested |
| 8. Repeatable sale | Second operator onboarding, commercial terms, software billing, import/export and support process | Second operator operates without code fork or first-customer data leakage |

Stages can overlap after foundations are proven. A demonstration after stages 1–3 can show clearly labelled simulated later modules. It cannot be sold as a fully functioning payroll/payment integration before those acceptance gates pass.

## First development backlog

| ID | Work item | Completion evidence |
|---|---|---|
| F01 | Separate repository and environments | No RoundMate dependencies, credentials or shared live tables |
| F02 | Tenant, location and scoped role model | Operator/staff/member roles and A/B isolation tests |
| F03 | Authentication and tenant resolution | Server-verified tenant grants, safe unknown-host behaviour |
| F04 | Branding and module registry | Two brands rendered; unavailable modules also rejected by APIs |
| F05 | Platform console onboarding | Create draft operator, configure locations and invite tenant owner |
| F06 | Synthetic demo provisioning | Clearly labelled fictional records and non-live provider bindings |
| F07 | Member/dog profile slice | Persist private profile/photo and explicit public/member publication |
| F08 | Operational foundations | Audit log, errors, backup plan and support-access boundaries |

The first milestone is not a complete platform. Demonstrate its value through repeatable tenant onboarding and a working dog-profile flow rather than a large collection of disconnected mock screens.

## Integration release policy

Retain the sourced UK shortlist in the PRD: BrightPay Cloud, Xero UK Payroll, edition-specific Sage routes; Stripe, Square, SumUp, PayPal POS/Zettle, Lightspeed Restaurant and Epos Now. These are research candidates, not certified connectors or a verified market-share ranking.

Initial commercial pilot needs Stripe, one validated payroll route and one working café POS/payment route. Before claiming multi-provider support, validate a second payroll connector and a second counter route against the same domain contracts. Remaining connectors are separately prioritised and estimated. Supplier access/fees and exact editions are explicit dependencies.

## Demo walkthrough

Platform owner configures a club → member joins and creates a dog profile → member books a groom → reception checks them in → café sale is recorded → groomer completes handover/collection → manager views rota and attendance → approved payroll batch is prepared. Switch to a second synthetic brand to demonstrate configuration and isolation. Label all not-yet-integrated financial actions as simulated.

## Estimate and commercial gates

All earlier week ranges are superseded. White-label tenancy, software billing, onboarding/support and mobile distribution change the baseline; a new date or price would be premature before technical spikes. Produce estimates per milestone including engineering, design, QA, provider access and maintenance. Identify the smallest completed set that supports a paid design-partner pilot without misrepresenting incomplete modules.

Commercial discovery: agree platform ownership, customer asset rights, target operators, onboarding scope, subscription packaging and who supports payroll/POS issues. Proposed revenue is subscription plus onboarding and optional modules; pricing is not approved.

## Prototype/design decisions from Chiswick

Review draft GA01, GA02, A15 and A22 with operator/designer. Confirm wash/dry service model, grooming resource counts, training format, lounge/pod entitlement, dog-toilet location, handover/access routes and final dumbwaiter arrangement. These become tenant configuration, not global product assumptions.

## Decision register

| ID | Decision | Current position | Needed by / owner |
|---|---|---|---|
| D01 | Business name and exact trading address | Drawings identify Chiswick High Road, London W4 1TE, England; name and exact address unconfirmed | Discovery / operator |
| D02 | Opening target and software budget | Unknown | Discovery / operator + Ringo |
| D03 | Owner-stay versus drop-off care | Unknown; daycare excluded provisionally | Before scope freeze / operator |
| D04 | Dimensions, stations, table count and permitted capacity | Draft layouts reviewed; final inventory and professional/operator capacity input required | Before booking design / operator |
| D05 | Membership ownership, tiers and prices | Household account proposed; commercial unit undecided | Before payment build / operator |
| D06 | Groomer staffing and payment ownership | Unknown | Before supplier decision / operator |
| D07 | Scheduling and POS suppliers; API/export access | No supplier selected | Before build estimate / technical lead |
| D08 | Admission, documents and activity eligibility | Staff review proposed; requirements undecided | Before prototype sign-off / operator |
| D09 | Dog-food preparation/supply and café ordering | Menus first; till-based ordering proposed | Before launch scope freeze / café lead |
| D10 | Cancellation, grace periods, refunds and benefit rules | Undecided | Before membership build / operator |
| D11 | Records, retention, consent and staff permissions | Minimise access; final policy pending | Before real data / operator + appropriate adviser |
| D12 | Support owner, outages and after-hours incidents | Undecided | Before pilot / operator |
| D13 | Wash/dry service model | Ground-floor facility shown; self-service/staffed use and equipment count unknown | Before scheduling specification / operator |
| D14 | Training service | Basement room shown; individual sessions, classes, hire or deferred launch undecided | Before scope freeze / operator |
| D15 | Lounge and call pods | Basement spaces shown; membership entitlement and reservation need unknown | Before membership/prototype sign-off / operator |
| D16 | Kitchen and dumbwaiter arrangement | A22 proposes removing one; other sheets show two; latest revision needed | Before service-flow sign-off / operator + designer |
| D17 | Dog toilets, handover and access routes | Dog toilets not clearly labelled; confirm care transfer points and access to basement services | Before operational sign-off / operator + designer |
| D18 | Community operations | Launch profiles approved; confirm moderator, response expectations, guidelines and expiry policy | Before community pilot / operator |


## Additional decisions and owners

| ID | Decision | Owner / milestone |
|---|---|---|
| D19–D20 | Mobile stack, shared-platform versus dedicated branded distribution, developer-account responsibility | Ringo + technical lead / foundation |
| D21–D22 | Staff qualifications/coverage and authoritative rota source | Operator + technical lead / booking |
| D23–D24 | Payroll provider/adviser, pay codes and approval/payment process; clocking device and correction rules | Operator / workforce |
| D25–D26 | Tenant merchant ownership, POS/device setup, initial adapters and multi-provider acceptance | Operator + technical lead / commerce |
| D27 | Platform name, IP/commercial ownership and separate repository location | Ringo / foundation |
| D28 | Software packages, usage limits, onboarding fees and support/offboarding terms | Ringo / paid pilot |
| D29 | Platform support permissions and incident/recovery ownership | Ringo + technical lead / pilot |

## Current status

Completed: competitor research, four-page drawing review, detailed feature PRD, white-label product specification, gated build backlog and the local application checkpoints recorded below. The shared mobile client now reaches grooming booking confirmation, transactional rescheduling and cancellation in development. No live service payment, payroll submission, mobile-store release or production booking migration has been completed.

Next execution milestone: implement the approved hosted-Checkout service-payment lifecycle in [SERVICE_PAYMENTS.md](SERVICE_PAYMENTS.md), then finish iOS and Android booking/payment acceptance against reviewed HTTPS non-production infrastructure. Project location is `/Users/ianring/Documents/ChatGPT/The Dog club`, connected to `ring120768/The-Dog-Club`.


## Implementation checkpoint — 25/09/2026

The local web foundation now includes secure operator/member/staff invitations, tenant-scoped venue/resource setup, configurable branding and a computed operator demo-readiness checklist. Automated acceptance provisions two distinct synthetic operators and configures each without SQL or a code fork. Stage 1 remains in progress because production identity/datastore rehearsal, operator lifecycle enforcement and deployment controls are outstanding. Stage 2 has working web dog profiles and controlled photos plus a shared iOS/Android client for sign-in, club selection, dog profile/photo editing, membership/upcoming-booking summaries, live grooming availability, booking confirmation, transactional rescheduling and cancellation. Reviewed HTTPS acceptance on both platforms, payment collection, persisted secure sessions and distribution remain outstanding.


### Photo increment — 25/09/2026

Local profile photo upload, replacement/removal and audience-based image access are implemented and verified. See [photo design](PHOTO_UPLOADS.md). The earlier photo-storage gap is now limited to managed production storage; native clients remain outstanding.
