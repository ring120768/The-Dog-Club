# Dog Club — Product Requirements Document

Version 0.8 · 25/09/2026 · Status: discovery draft

## 1. Product intent

Create a membership dog café where owners can enjoy food and social time while accessing grooming and services for their dogs. Provide one coherent digital experience for joining, managing dogs, booking grooming and visiting, supported by a practical staff workspace.

The launch also includes a dog-first community: members connect as their dogs’ humans, with dog photos and personalities taking centre stage. This playful pseudonymity is a social presentation choice; authorised staff retain accountable household ownership.

The business combines hospitality and animal care. Software must make those services easier to deliver and help members return regularly. This is a commercial white-label platform from the outset. The Chiswick venue is the first design partner; other operators must be onboarded through configuration without code forks. A demonstration uses isolated synthetic data on the same product architecture, not a separate throwaway implementation.

## 2. Known facts and assumptions

| Item | Status |
|---|---|
| UK venue; premises secured | Confirmed by Ringo |
| Membership dog café, human and dog food, multiple grooming facilities, dog toilets | Confirmed concept; detailed operation unconfirmed |
| Drawing evidence | Four-page Kitchens set.pdf reviewed; Evolve Architecture project 2512, drawings GA01, GA02, A15 and A22, dated 18/03/2026, revision X, all marked DRAFT |
| Location | Drawing title blocks: Chiswick High Road, London W4 1TE, England; exact trading address to confirm |
| Business name, budget and opening date | Unknown |
| Drop-off daycare, boarding and off-lead play | Not confirmed; outside launch scope unless explicitly added |
| Training, members’ lounge and call pods | Shown in proposed basement layout; launch services, access and booking rules unconfirmed |
| Ground-floor wash and dry | Shown separately from basement grooming; self-service versus staffed use unconfirmed |
| Dog-first social profiles at launch | Approved by Ringo; photo, playful bio, optional public visibility and discreet owner identity |
| White-label commercial platform | Confirmed by Ringo; first live operator in Chiswick, repeatable onboarding for other operators |
| Tenant and location model | One tenant per operating business; locations belong to that tenant; member and staff permissions are tenant-scoped |
| iOS and Android member apps plus tablet-friendly staff web dashboard | iOS and Android explicitly required by Ringo for launch; shared mobile implementation preferred, framework pending technical discovery |
| Groomers employed by the venue versus independent concession operators | Unknown; affects scheduling and payment ownership |

## 3. Users and jobs

| User | Primary need |
|---|---|
| Prospective member | Understand the offer, prices, eligibility and how a first visit works |
| Member / authorised household adult | Manage dogs, benefits, appointments and payments without phoning |
| Reception | Know who may enter, which dogs are present and what requires attention |
| Groomer | See their schedule, handling notes, agreed service and collection contact |
| Café team | Show accurate menus and apply authorised benefits without accessing private care records |
| Manager | Configure services, resources, memberships and permissions; reconcile activity |

## 4. Product outcomes and measures

Targets below are proposed pilot criteria, not market benchmarks.

| Outcome | Measurement | Initial target |
|---|---|---|
| Joining is understandable | Moderated test: complete registration without assistance | At least 4 of 5 participants |
| Repeat booking is simple | Time for a returning user to choose and book a known service | Under 2 minutes in usability testing |
| Arrival is efficient | Median routine member check-in time | Under 30 seconds, excluding exceptions |
| Resources cannot be double-booked | Confirmed bookings overlapping the same required resource | Zero |
| Financial records are reliable | Subscription and booking payments reconcile with provider | Every pilot payment accounted for |
| Members return | Cohort repeat visits, grooming rebooking and membership retention | Establish baseline in first 30 days; set targets after pilot |
| Benefits are sustainable | Revenue less direct service/benefit costs, by membership tier | Operator-approved positive contribution model before sale |

Instrument registration completion, dog submission/approval, subscription activation, booking confirmation/cancellation, check-in/out and benefit redemption. Use identifiers rather than names or care notes in analytics. Track staff admin time per booking and no-show rate alongside revenue.

## 5. Current and desired journeys

### Current state

```text
Customer explores proposed club
└─ Offer, facilities and operating rules are being defined
   └─ No customer app or staff system has been supplied for assessment
      └─ No existing implementation is assumed
```

### Desired member journey

```text
Explore club
├─ Read services, transparent pricing, visit rules and separate food menus
└─ Create household account
   └─ Add dog and required information
      ├─ Incomplete → explain what is missing; save progress
      ├─ Review needed → staff assesses; membership charge not implied
      └─ Approved for relevant activity
         └─ Choose membership → review terms → pay → receive confirmation
            ├─ Book grooming
            │  └─ Select dog/service → suitable slot → price/deposit → confirm
            └─ Visit
               └─ Staff validates pass, dog eligibility and capacity
                  ├─ Café / club visit → view menus and use applicable benefits
                  └─ Grooming handover → in progress → ready → authorised collection
                     └─ Check out, receipt and rebooking option
```

### Desired staff journey

```text
Open today's workspace
├─ Review applications and expiring records
├─ See appointments, assigned groomers and stations
├─ Check guests in and out; resolve admission exceptions
├─ Progress grooms and notify collection contacts
├─ Complete cleaning checks and record incidents
└─ Reconcile payments, benefit use and outstanding work
```

Eligibility is activity-specific: grooming approval does not automatically mean approval for group play or daycare. Payment state, dog eligibility and visit state remain separate.

## 6. Launch requirements and acceptance criteria

P0 means required for pilot. P1 means post-pilot unless operational discovery makes it essential.

### Launch platform requirements

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| PL-01 | P0 | iOS and Android member apps | Core membership, dog profiles/community, grooming booking and visit flows work on both platforms; agree minimum OS versions during discovery |
| PL-02 | P0 | Shared account and backend | Same household, bookings, benefits and profile visibility across devices; no platform-specific duplicate records |
| PL-03 | P0 | Photos and notifications | Camera/library upload with permission-denied fallback; push opt-in and deep links tested on both platforms; critical care communications retain staff fallback |
| PL-04 | P0 | Distribution readiness | Operator-controlled Apple/Google developer accounts, signing, store assets, privacy disclosures, reviewer access and account deletion flow prepared; verify current store/payment rules before implementation and submission |
| PL-05 | P0 | Web companion | Staff dashboard works on desktop/tablet; public dog-profile links open without installation and respect publication status; verified app links route appropriately when installed |

Treat App Store and Google Play release as launch deliverables, not merely mobile-browser compatibility. Store approval dates are external dependencies. Validate paid membership/community entitlements against current store rules before selecting payment flows; do not assume all entitlements have the same treatment.


| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| AC-01 | P0 | Secure household accounts | Verified access; multiple dogs; invited adults have explicit permissions; users cannot read another household's records |
| DG-01 | P0 | Dog profiles | Capture identity, size/coat details relevant to service, owner-declared sensitivities, handling needs, emergency contact and required documents; distinguish unknown from explicitly none |
| DG-02 | P0 | Staff approval | Pending, approved, needs-information, expired and suspended are distinct; record reviewer, reason and date; eligibility is checked per activity |
| MB-01 | P0 | Membership purchase and management | Show inclusions, limits, additional-dog rules, renewal and cancellation terms before payment; issue confirmation; duplicate payment events cannot create duplicate benefits |
| MB-02 | P0 | Membership lifecycle | Display active, payment-issue, cancellation-scheduled and ended states; agreed grace policy controls benefits; accessible cancellation path and effective date |
| MB-03 | P0 | Benefit tracking | Staff and members see remaining allowances and expiry; concurrent redemptions cannot spend the same credit twice; every adjustment has an audit record |
| BK-01 | P0 | Resource-aware grooming bookings | Availability respects suitable groomer, station, service duration, opening hours and cleaning buffer; concurrent requests cannot confirm the same resource |
| BK-02 | P0 | Booking price and consent | Display confirmed price or clearly labelled estimate, deposit and cancellation terms; additional work requires recorded agreement; uncertain first grooms can use staff-confirmed requests |
| BK-03 | P0 | Changes and cancellations | Member can request/change/cancel within agreed rules; released slots return to availability; refunds and benefit restoration follow recorded policy |
| VS-01 | P0 | Staff-assisted admission | Pass reveals no care data publicly; staff verifies membership, selected dogs and applicable eligibility/capacity; duplicate check-in does not increase count |
| VS-02 | P0 | Grooming progress and collection | Arrived, handed-over, in-progress, ready and collected states; ready notification; collection by authorised adult; staff can correct errors with audit history |
| FD-01 | P0 | Human and dog menus | Clearly separate menus; show current prices, ingredient/allergen information supplied by operator and availability; no claim of automated food-safety assurance |
| OP-01 | P0 | Staff workspace | Role-based daily schedule, member lookup, admission and document review; café staff cannot browse private dog-care files |
| OP-02 | P0 | Basic cleaning and incident records | Zone/task, due/completed time and responsible staff; flag overdue dog-toilet checks; restricted incident log and manager escalation; never imply a tick proves premises safety |
| NT-01 | P0 | Transactional notifications | Booking confirmation/reminder, relevant record expiry and groom-ready message; delivery failure visible to staff with manual fallback; marketing opt-in separate |
| RP-01 | P0 | Manager reporting | Membership status, bookings, resource utilisation, check-ins and benefit use; reconcile provider payments without storing card details |
| EV-01 | P1 | Events and guest passes | Capacity, guest eligibility, cancellation and attendance rules applied consistently |
| FD-02 | P1 | Table ordering | Subject to POS capability; correct menu/table/dog association, stock handling, order acknowledgement, payment and refund reconciliation |
| RT-01 | P1 | Retention tools | Rebooking reminders, waitlists and referral offers with clear eligibility and communication preferences |

### Launch community: meet the pooches

The purpose is recognition and belonging: “You’re Pickle’s human!” Owners can participate through their dog without publishing a personal profile. This is a private care record plus a separately controlled social profile, not a public view of the care record.

Launch includes dog name, profile photo, optional breed and birthday month, short bio, personality prompts, favourite activities and a small moderated photo gallery. Example prompts: “Chief biscuit inspector”, “Usually found under the café table” and “Looking for a walking buddy”. Use fictional profiles only in prototypes.

An owner must explicitly choose to participate. The editor defaults to members-only as the suggested audience, but nothing is published until confirmed. Available states: private/unpublished, members-only and public. Members-only profiles appear in an authenticated “Meet the pooches” directory searchable by dog name; owners can preview the audience before publishing. Public profiles have an optional shareable link and are excluded from search-engine indexing by default. Clearly explain that public links can be forwarded and screenshots cannot be recalled.

Display the owner as “[Dog name]’s human”; an owner-chosen first name is optional and separately previewed. Never expose account surnames, contact details, exact birth dates, household links, care notes, vaccination documents, booking schedules, check-in status or live whereabouts. No public owner search or automatic “met at” history. Photo uploads remove location metadata; guide users to avoid identifying people without permission.

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| SC-01 | P0 | Dog photo and social profile editor | Save private draft, add photo/bio/prompts and preview each audience; gallery uploads have type/size limits and unsafe markup is rejected |
| SC-02 | P0 | Explicit audience control | New profiles remain unpublished until owner confirms; server enforces private/member/public reads; hiding a profile removes it from directory and public access |
| SC-03 | P0 | Member discovery | Eligible signed-in members browse opted-in profiles by dog name; private profiles never appear; do not show visit times or attendance |
| SC-04 | P0 | Optional public sharing | Owner can publish and copy a share link; public page contains only allowlisted social fields; protected original media cannot bypass visibility rules |
| SC-05 | P0 | Accountable pseudonymity | Social display uses dog identity; authorised staff can trace ownership; community viewers cannot resolve household or contact records |
| SC-06 | P0 | Moderation and control | Report profile/photo, block another member account and manager hide/review queue; record actions and reasons; blocked accounts cannot discover/view member-only content, but anonymous public viewing cannot be prevented and this is explained |
| SC-07 | P0 | Withdrawal and lifecycle | Owner can unpublish/delete gallery items; revoke access and invalidate controlled caches/media links; ended memberships remove directory participation and unpublish public pages under the proposed lifecycle policy |

Assign a moderation owner before pilot. Proposed workflow: reports enter a staff queue, serious privacy reports can immediately hide content pending review, and managers record outcomes. Approve response expectations and community guidelines before launch. Standard privacy and retention review must cover user-generated content.

The first release does not include an endless posting feed, followers, likes, comments, direct messages or live “who’s here” features. These remain later decisions; the launch social experience is profiles, photo galleries, member discovery and public sharing.

Proposed validation: at least 4 of 5 usability participants correctly identify who can see their profile. Test logged-out access, another household, expired membership, blocking, unpublishing and direct image URLs. Confirm stripped photo metadata and that profile responses contain no care/contact fields. Track voluntary profile publication and directory use without treating participation as a requirement for membership.

### Manager/admin portal and staff rotas — launch scope

Provide a responsive web portal for managers and staff, usable on desktop, tablet and phone. This is separate from the member-facing iOS/Android apps; dedicated staff native apps are not required. Managers run the venue through one workspace for memberships, dog approvals, bookings/resources, visits, payments/reconciliation, cleaning/incidents, community moderation and staff rotas.

Access roles: owner/admin configures permissions and venue settings; manager runs operations and publishes rotas; groomer sees assigned appointments and necessary care notes; reception manages arrival/collection and relevant bookings; café staff see applicable benefits and their tasks without private care records. Refunds, subscription adjustments and moderation require explicitly granted permissions. Staff rota and leave information is never visible to members. Sensitive absence reasons remain restricted; the general rota shows only availability.

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| AD-01 | P0 | Manager overview | Show today's appointments, staffing/coverage gaps, arrivals, unresolved payments, overdue tasks and moderation items; each alert opens an actionable record |
| AD-02 | P0 | Staff access management | Invite/deactivate staff, assign roles and service qualifications; deactivate access without losing historical ownership/audit records; privileged changes are logged |
| RO-01 | P0 | Weekly rota editor | Create shifts by staff member, role and floor/area; support recurring patterns, breaks and date-specific exceptions; flag overlapping shifts and unavailable staff |
| RO-02 | P0 | Draft and published rotas | Managers review before publishing; only published shifts create bookable availability; preserve revision history and notify affected staff of published changes; notification failure is visible |
| RO-03 | P0 | Availability and leave | Staff submit availability and leave requests; manager approves/rejects with status history; approved leave blocks availability; pending requests do not silently alter the published rota |
| RO-04 | P0 | Coverage checks | Configure minimum coverage by role/area/time; flag gaps after breaks, leave and changes; manager resolves or records permitted operational exceptions; qualified grooming availability cannot be overridden by a coverage acknowledgement |
| RO-05 | P0 | Rota-driven grooming slots | Slot requires a qualified groomer on a published shift for the full assigned service interval plus a compatible free resource and applicable buffers; breaks, leave, closures and concurrent bookings prevent conflicts |
| RO-06 | P0 | Sickness and change impact | Immediately remove unavailable staff from new slots; show affected existing bookings in a resolution queue; manager reassigns or reschedules and contacts owners; never silently cancel or move confirmed appointments |
| RO-07 | P0 | Staff self-service | Staff see their own published shifts, daily appointments/tasks and request status on mobile web; requests do not grant access to other staff's confidential records |
| RO-08 | P0 | Shift swap requests | Staff propose a swap; manager approves only after checking qualification, availability, overlaps, coverage and affected bookings; successful approval updates both shifts atomically and notifies both staff |

Bookable availability is the intersection of venue hours, published staffing, service qualification, resources, existing bookings and applicable buffers. The scheduling system remains the single calendar of record. If an external system supplies shifts/bookings, validate how restrictions reach it before choosing an integration; stale or unverifiable availability must not produce a confirmed booking.

Do not assume every staff member can cover grooming, café and reception interchangeably. Configure responsibilities and coverage with the operator. Recurring shifts use Europe/London local time with explicit handling of clock changes. Record whether each buffer requires staff time, equipment time or both.

Validation fixtures: a qualified groomer works 09:00–17:00 with a 12:00–12:30 break, one station and a service requiring 60 minutes of staff time plus 15 minutes of staff/equipment clean-up. An 11:00 slot must be rejected; 12:30 can be offered if otherwise free. Repeat with approved leave, an unpublished shift, concurrent requests and equipment closure. Sickness must flag confirmed bookings while preventing new ones; a proposed swap must not change availability until approved. Verify staff cannot publish their own changes without the manager permission.

Payroll and time recording are now launch requirements, as specified below. The rota feeds attendance review; scheduled hours must never be silently treated as hours actually worked.

### Attendance and payroll — launch scope

Staff clock in/out and start/end breaks using an authenticated mobile-friendly staff portal or venue kiosk. A kiosk must identify each staff member securely, clear sessions between users and avoid exposing payroll details. No biometric or continuous location tracking is assumed. Device and offline policy must be agreed during discovery.

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| TM-01 | P0 | Clock events | Record actual start/end and breaks with server time and actor; reject duplicate active sessions; missing clock-outs and overlaps enter an exception queue rather than inventing hours |
| TM-02 | P0 | Timesheet review | Compare actual versus scheduled hours, distinguish paid/unpaid breaks and approved overtime; staff request corrections, authorised manager approves with reason and original events retained |
| TM-03 | P0 | Offline and overnight work | Failed clock submissions show unsent status and a manual correction path; reconcile duplicates on recovery; overnight shifts and Europe/London clock changes calculate elapsed time correctly |
| PY-01 | P0 | Payroll preparation | Approved hours plus effective-dated pay rates/pay codes produce a reviewable pay-period batch; salary, overtime, leave and other inputs follow provider/adviser configuration; distinguish forecast labour cost from final pay |
| PY-02 | P0 | UK payroll integration | Use an agreed HMRC-recognised payroll product for PAYE/NI, statutory pay, pensions and reporting; transfer approved inputs by verified API or validated provider import; record accepted/rejected records and reconcile employee totals |
| PY-03 | P0 | Approval and locking | Restricted payroll approver reviews batch; approved export is versioned/locked; retries cannot duplicate a pay run; corrections require a traceable adjustment or new version |
| PY-04 | P0 | Payroll completion | Track provider calculation and submission status, payslip availability, payment authorisation and reconciliation separately; export alone never means HMRC submitted or wages paid |
| PY-05 | P0 | Staff payslips and privacy | Staff access only their own payslips through a secure provider link or authenticated portal; only payroll-authorised roles see rates, bank/tax details and deductions; minimise duplication of sensitive data |

Employee salary disbursement uses the payroll provider/bank process with authorised approval and recorded reconciliation. Stripe customer receipts are not the employee payroll system. Independent groomers must not be classified as employees merely because they appear on the rota; confirm employment/payment arrangements with the operator and adviser.

Validation: 09:00–17:00 attendance with a 30-minute unpaid break gives 7.5 payable hours; a 30-minute paid break gives 8 hours under that configured policy. Check missing punches, unauthorised rate edits, approved corrections after export, duplicate batch submission, rejected employee imports, salary-only staff, overnight work and clock changes. Complete a parallel trial payroll against the chosen provider before live use.

References: [HMRC payroll software](https://www.gov.uk/payroll-software) and [reporting payroll](https://www.gov.uk/running-payroll/reporting-to-hmrc), checked 24/09/2026. Statutory rules belong in the maintained provider, not hard-coded assumptions in this app.

### Stripe payments — launch scope

Stripe is the required online customer payment connector for memberships and approved services, with food/beverage payments through Stripe-compatible setups or a separately configured counter processor. See the configurable integrations requirements for alternative POS/reader support. Include in-app service payments and staff-entered café sales at launch. Self-service table ordering remains a separate P1 feature; collecting payment for café sales does not require a bespoke restaurant till.

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| SP-01 | P0 | Services and memberships | Collect subscription payments, service deposits and remaining balances using suitable Stripe-supported flows; link transactions to household and service/subscription; receipt shows amount paid and outstanding balance |
| SP-02 | P0 | Food/beverage sales | Staff enters itemised sale in the agreed POS/order system; calculate approved item prices, discounts and tax treatment on trusted server/POS; accept payment through Stripe-compatible counter hardware or a supported payment-link flow |
| SP-03 | P0 | Counter and app consistency | One order ledger prevents an app and counter retry from charging the same balance twice; choose supported Terminal readers/Tap to Pay or an integrated POS after device and UK compatibility checks |
| SP-04 | P0 | Payment state and recovery | Separate pending, paid, failed, cancelled, refunded and disputed states; verify signed webhooks, process idempotently and reconcile missing/out-of-order events; browser success is never proof of payment |
| SP-05 | P0 | Adjustments and receipts | Authorised partial/full refunds reference original items/payments, deposits and redeemed benefits; notify staff of unsuccessful refunds; itemised receipts distinguish human/dog menu items and services |
| SP-06 | P0 | Reconciliation | Report gross sales, discounts, refunds, fees, disputes and net payouts separately; reconcile order/payment totals to Stripe settlements, preserving category-level sales reporting |
| SP-07 | P0 | Payment security and environments | Stripe handles card capture; no raw card data stored; least-privilege server credentials, signed webhook validation and isolated non-live test environments; no real charges during development |

Confirm merchant ownership and whether independent groomers receive direct/split settlement before selecting the account model. Stripe Connect is conditional on that model, not a substitute for payroll. Confirm VAT registration and item-specific treatment with the adviser; do not apply one blanket rate or assume automatic tax is configured. Any tips/service charges require an agreed accounting and payroll treatment before enablement.

Counter food payment is P0; customer table-order submission, kitchen printing and automatic dispatch integration remain P1 unless explicitly promoted. If existing POS cannot integrate with Stripe, decide between a compatible POS and an explicit reconciled payment workflow before build. Do not maintain two conflicting order totals.

Validation includes service deposit then counter balance, duplicate/replayed payment events, simultaneous pay attempts, declined counter card, network loss, cancelled service/refund, mixed café basket, sold-out item before payment, partial refund and end-of-day reconciliation. Confirm fulfilment rules for counter payments and manual fallback before pilot.

References: [Stripe Terminal](https://stripe.com/gb/terminal), [Stripe Connect](https://stripe.com/connect). Detailed SDK/API selection and current app-store treatment of membership entitlements require technical verification before implementation.

## 7. Membership and service design

Test two simple propositions: a Social membership with defined access/perks, and a Care membership with a specified grooming or bathing allowance. These are research options, not approved commercial packages.

Before selling, define whether the membership belongs to a person, household or dog; eligible household adults; extra dogs; guest limits; busy-period access; benefit expiry and rollover; cancellations; refunds; and any assessment requirement. Do not assume a membership guarantees capacity at every hour.

Price from labour, capacity, consumables, benefit uptake and expected visit frequency. Avoid unlimited grooming commitments. Consumer-facing prices must make the total payable clear; confirm applicable tax treatment with the operator's adviser rather than applying one rate to everything.

## 8. Facilities and operating dependencies

Source: [Kitchens set.pdf](</Users/ianring/Downloads/Kitchens set.pdf>), reviewed visually and by text extraction across all four pages. All sheets are DRAFT, dated 18/03/2026. Drawing annotations describe proposed design work; they are not instructions to modify the building or authorisation to expand the app scope.

| Sheet | Observed proposed facilities | Product implication / unresolved decision |
|---|---|---|
| GA01, page 1 | Basement grooming, training room, members’ area, call pods, kitchen, staff room and WCs | Treat services and floor locations separately; confirm training format and whether pods require reservations |
| GA02, page 2 | Ground-floor seating/café arrangement, dog wash and dry, dumbwaiter area, staff WC and accessible WC | Establish front-of-house check-in and care handover; distinguish wash-only bookings from full grooming |
| A15, page 3 | Basement kitchen sections with two dumbwaiters depicted | Confirm food preparation and dispatch workflow before any ordering integration |
| A22, page 4 | Ground-floor waiting, kitchen/order, bistro, storage/display and guest clean-up areas | Future orders need a clear service destination; counter ordering remains the launch assumption |

A22 contains a red proposal to remove one dumbwaiter and move the dog-wash partition to enlarge the wash/dry space. Two dumbwaiters remain depicted elsewhere. Confirm the latest coordinated revision and final equipment layout; do not assume this change is approved.

Dedicated dog toilets are part of the user’s concept but are not clearly labelled in this set. Do not classify the human WCs as dog toilets. Station counts, seating capacity, supervision arrangements and accessible routes to basement services remain subject to operator/designer confirmation. Do not infer dimensions from the rendered images.

### Proposed service blueprint

1. Arrive at the ground floor: staff identifies household, dogs, visit purpose and relevant access rights.
2. Café-only visit: seat/order using the agreed counter workflow; apply eligible benefits.
3. Wash/dry visit: follow the confirmed self-service or staff handover model; reserve equipment and cleaning time where needed.
4. Basement grooming visit: record the agreed handover point, responsible staff member and collection contact. An owner remaining upstairs is not the same as a dog collected after treatment.
5. Members’ lounge: verify access entitlement; track zone occupancy only through an agreed staff process, not inferred from the entry scan.
6. Training and call pods: do not offer bookings until format, capacity, staffing, duration and membership entitlement are agreed.
7. Collection and departure: confirm authorised collection and close the visit; moving between floors does not count as leaving the venue.

### Scope controls from the drawings

| ID | Status | Candidate requirement and acceptance condition |
|---|---|---|
| ZN-01 | Proposed P0 | Display floor/location and handover instructions on appointments; one venue visit persists across internal transfers |
| WS-01 | Decision required | If wash/dry launches as bookable, availability includes the correct equipment, staffing where needed and cleaning buffer; closures remove slots |
| LG-01 | Decision required | Define lounge entitlement and capacity; do not promise reserved seating through general membership |
| TR-01 | Conditional, not committed | Training bookings reserve trainer, room and session capacity; individual sessions versus classes must be chosen before estimation |
| CP-01 | Conditional, not committed | If pods are bookable, enforce duration, access rules and no overlaps; avoid collecting call content |
| FD-03 | Future ordering dependency | Route orders to preparation and delivery locations explicitly; define a manual fallback for dumbwaiter outage |

Request the approved layout, resource inventory, opening hours, staffing and accessible service arrangements before freezing these requirements.

The operator and relevant professionals determine safe capacity and permitted activities. Do not derive a final dog limit from floor area alone. Model human capacity, dog capacity and grooming resources separately. Grooming bath/dryer bottlenecks may need separate resources if stations are not self-contained.

For an England daycare model, review the applicable [government licensing guidance](https://www.gov.uk/government/publications/animal-activities-licensing-guidance-for-local-authorities/dog-day-care-licensing-statutory-guidance-for-local-authorities) with the local authority. Other UK nations need their own checks. This is a discovery dependency, not an assertion that the café itself is daycare.

Confirm food preparation and pet-food supply with the operator and environmental health team. Relevant reference: [FSA co-location guidance](https://www.food.gov.uk/sites/default/files/media/document/fsa-guidance-for-the-co-location-of-food-and-pet-food-production.pdf). App features do not replace physical food-handling controls.

## 9. Non-functional requirements

- Mobile-first, keyboard accessible and designed to WCAG 2.2 AA; test core flows with screen readers and clear error recovery.
- GBP, DD/MM/YYYY and 24-hour display; store timestamps consistently and schedule in Europe/London, including BST/GMT transitions.
- Staff roles, least-privilege access, private document storage, staff MFA and logged administrative changes.
- Collect only necessary information; documented retention by record type, access/export/deletion workflow and lawful retention exceptions. Use [ICO principles](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/) in the privacy design.
- Hosted payment collection; no raw card storage. Signed payment events and idempotent processing; membership never activated solely by a browser success page.
- Visible loading/error states; a failed eligibility lookup must show 'unable to verify', never 'approved' or 'rejected'.
- Pilot target: core pages usable within 3 seconds on representative mobile connectivity, excluding external payment challenges; confirm realistic load after capacity is known.
- Documented backup/restore process and tested recovery. Internet failure uses a manager-controlled manual arrival/collection procedure; reconcile later without duplicating transactions.

## 10. Product and system boundaries

Recommended: branded iOS and Android member apps sharing a backend with the staff web dashboard. Keep public dog-profile share pages accessible in a browser without an app download. Prefer a shared mobile codebase, subject to a proof of concept for camera/photo upload, notifications, authentication and booking/payment integrations. Native platform-specific code remains an option where needed. Use established services for payments and potentially scheduling. Supplier capabilities, exports, APIs and commercial terms require validation before committing.

| Boundary | Ownership |
|---|---|
| Member UI | Collects intent and displays authoritative status; does not grant admission or credits |
| Application service | Validates permissions, eligibility, capacity and booking rules; owns state transitions |
| Payment provider | Authoritative payment/subscription events; application maintains reconciled local state |
| Scheduling system | One authoritative calendar; avoid competing custom and supplier calendars |
| Staff operations | Human approval, handling decisions, exceptions and collection verification |
| Persistence | Household/dog records, bookings, benefits, visits and audit history; separate from RoundMate |

Conceptual records: Household, AdultAccess, Dog, EligibilityReview, Document, MembershipPlan, Subscription, BenefitLedger, Service, StaffMember, StaffQualification, Shift, ShiftBreak, RotaRevision, AvailabilityRequest, LeaveRequest, ShiftSwapRequest, CoverageRule, Resource, Booking, Visit, MenuItem, CleaningTask, Incident, Notification, SocialProfile, SocialPhoto, CommunityReport, AccountBlock, ClockEvent, Timesheet, PayRate, PayrollBatch, PayrollAdjustment, Sale, SaleItem, Payment, Refund and AuditEvent. Social records expose an explicit allowlist; never serialise the care profile as the public profile.

Provisional implementation anchors, to map into a NEW project only after the integration decision: `evaluateEligibility`, `getAvailability`, `reserveBooking`, `applyPaymentEvent`, `redeemBenefit`, `checkInVisit`, `completeCollection`. Suggested modules: `membership`, `dogs`, `booking`, `visits`, `operations`, `integrations`. Exact file paths and framework choices are deferred until the system of record is agreed.

## 11. Validation scenarios

Use synthetic records only. Known-answer fixture: one available groomer and one compatible station at 10:00 for 60 minutes plus 15-minute buffer; a competing 10:30 booking must fail, while 11:15 may succeed if all other rules permit.

Other required checks: two dogs with different eligibility on one account; unknown versus explicitly no dietary sensitivities; expired document; failed renewal; duplicate payment event; cancelled subscription still valid until period end; cancellation/refund with restored allowance; repeated pass scan; unauthorised collection; staff absence and station closure; notification outage; unauthorised record access; clock change; internet loss.

Pilot launch requires an end-to-end member journey, a complete staff shift simulation, financial reconciliation and no unresolved critical access, booking or payment defects.

## 12. Out of scope for first release

Dedicated staff native apps and a bespoke statutory payroll/tax engine are deferred. Clocking, timesheets, payroll-provider integration, manager/admin portal and operational rotas ARE launch requirements. Provider-managed statutory and leave calculations must be agreed with the payroll adviser.

Training and call-pod booking remain conditional on the decisions above. Cross-location membership entitlements (location-aware data remains core), boarding/daycare unless approved, marketplace discovery, social feeds, followers, likes, comments and chat (opt-in social profiles, galleries, member discovery and public sharing ARE included), automated veterinary advice, AI meal recommendations, custom till/kitchen software, door hardware automation and sensor-based dog-toilet monitoring.

## 13. Research evidence

Desk research checked 24/09/2026; advertised features are not hands-on product verification.

| Comparator | Evidence and implication |
|---|---|
| [WagWorks](https://www.wagworks.co.uk/) and [app](https://play.google.com/store/apps/details?hl=en&id=com.fisikal.member.wagworks) | UK membership club with care bookings; useful membership journey benchmark |
| [Collar memberships](https://www.collarapp.uk/solution/memberships.html) and [Club K9](https://clubk9.co.uk/) | Existing platform used by a UK membership operator; assess buy/integrate option |
| [Tuft](https://tuftapp.com/) | Grooming-specific customer booking; assess resource and integration fit |
| [Love My Human](https://www.lovemyhuman.co.uk/pages/doggy-day-care) | UK memberships spanning care and café-related benefits |
| [Skiptown](https://skiptown.io/) | US care plus social venue with app-supported visits |
| [DOG PPL](https://dogppl.co/faq) | Club membership and app-based guest invitations |
| [Paws & Pints](https://pawsandpintsdsm.com/) | Broad hospitality and pet-care comparison |
| [Pavilion Pooch](https://pavilionpooch.co.uk/) | Advertises October 2026 opening; premium grooming/boutique benchmark; café, membership and dedicated app not verified |

## 14. Decisions

Recommend a single-venue launch on iOS and Android with a clear household/dog model and one calendar of record. A responsive staff dashboard and public share pages complement the apps. Build tenant isolation and branding now; validate repeatable onboarding with a second synthetic business before adding a second paying operator. Confirm the exact address and resolve care model, capacity, membership economics, staffing/payment ownership and supplier fit before freezing the build specification. See the roadmap decision register.

## Configurable UK integrations — v0.7

Requirement: the product must support interchangeable payroll, POS and payment integrations through an admin Integrations area. Provider choice is configuration, not a rewrite of core member/staff workflows. Each provider still needs a built, tested adapter; selecting an unsupported provider must never suggest a live connection.

### Initial UK shortlist and evidence

This is a UK-market research shortlist, NOT a verified ranking by market share. Product edition, contract, regional availability and API access must be verified per connector.

| Category/provider | Evidence / constraint | Planned disposition |
|---|---|---|
| BrightPay Cloud payroll | [Official API](https://devdocs.brightpay.com/) explicitly describes timesheet integration with Cloud | First payroll adapter candidate; validate supported writes and payroll completion workflow |
| Xero UK Payroll | [UK API reference](https://developer.xero.com/documentation/api/payroll-uk/overview); full reference could not be retrieved in this research pass | Priority discovery candidate; do not infer UK capabilities from other countries or Accounting API |
| Sage payroll products | [Sage's support answer](https://communityhub.sage.com/gb/sage-50-payroll/f/online-services/264329/api) states Sage 50 Payroll has no open API | Priority compatibility target; validate exact edition and approved import/partner route, not generic 'Sage API' |
| Stripe / Terminal | [Terminal](https://stripe.com/gb/terminal) supports online/in-person integration | Required launch connector for online membership/services and supported in-person workflows |
| Square | [Terminal API](https://developer.squareup.com/docs/terminal-api/overview) documents Square payment checkout integration | Priority alternative counter payment/POS adapter candidate |
| SumUp | [Cloud API](https://developer.sumup.com/terminal-payments/cloud-api) initiates payments on supported Solo readers | Priority alternative counter adapter candidate; validate model and account prerequisites |
| PayPal POS / Zettle | [Developer FAQ](https://developer.zettle.com/docs/faq) describes integration APIs; [UK page](https://www.zettle.com/gb/integrations/pos) notes PayPal POS branding | Assess sales/catalogue integration separately from terminal payment initiation |
| Lightspeed Restaurant | [Restaurant API portal](https://api-portal.lsk.lightspeed.app/) | Priority hospitality POS candidate; confirm series, access fees and allowed operations |
| Epos Now | [UK product](https://www.eposnow.com/uk/) | Priority hospitality POS discovery candidate; exact API and payment compatibility unverified |

Research checked 24/09/2026. No connector has been implemented or commercially authorised. Prioritise final adapter order using this venue's systems and prospective UK operator demand; review the shortlist as evidence improves.

### How dynamic configuration works

1. Admin selects payroll provider, POS system and online/in-person processor separately from the supported catalogue.
2. Connect using provider-supported authorisation; credentials are encrypted/server-side, scoped per business and never exposed to members or ordinary staff.
3. Map staff/pay codes/pay periods and menu items/tax categories/locations as applicable. Display missing mappings before sync.
4. Run a test connection and reviewed sample import/payment in non-live mode; show capability limits and read/write direction.
5. Activate the supported connector; display last successful sync, queued/rejected records, retry controls and audit history.
6. Disconnect or switch through a controlled cutover: reconcile outstanding records, preserve historic provider IDs, revoke credentials and prevent dual writes.

### Contract and acceptance requirements

- INT-01 (P0): one internal model for approved hours, payroll batches, sales, payments/refunds and settlements. Adapters translate provider formats; unsupported capabilities are explicit.
- INT-02 (P0): connection states distinguish unsupported, disconnected, configuring, active, degraded and reauthorisation required. Never display API-level automation for a file-export-only connection.
- INT-03 (P0): retry/idempotency and provider-scoped external IDs prevent duplicate payroll batches or payments. Failed auth pauses writes and raises an actionable alert.
- INT-04 (P0): each entity has one authoritative source and documented direction. Reconciliation spans processors, but refunds are sent to the original processor; a provider switch cannot re-charge an uncertain transaction.
- INT-05 (P0): provider-specific validated export/import fallback for payroll where supported; preview validation and import acknowledgement required. Generic CSV is not proof of compatibility or submission.
- INT-06 (P0): retain the original processor route for refunds/disputes after a switch. Saved cards/subscriptions do not automatically migrate; any migration requires a separate supported plan and customer action where necessary.
- INT-07 (P0): payroll adapter acceptance covers approved hours and rejected imports; statutory results/payslips/status may remain in the provider with explicit manual acknowledgement if API support is absent. Payment adapter acceptance covers sale, failure, partial refund and settlement matching.

### Stripe and other readers

Stripe remains the required online connector, but third-party terminals are not universally interchangeable with Stripe readers. A Square or SumUp checkout uses that provider's payment integration and settlement flow. Where a venue chooses such hardware, reconcile those counter transactions alongside Stripe online payments. Do not promise that every supported POS can settle through Stripe or that card tokens transfer between processors. The chosen merchant contract and hardware decide supported payment routes.

### Delivery scope and estimate

Build the configurable adapter framework at launch, with Stripe and at least one validated payroll adapter plus one end-to-end café POS/payment route. Prove interchangeability with a second payroll adapter and a second counter-payment adapter before describing the product as multi-provider. These are required expansion milestones, not implied support for every shortlisted brand at launch. The remaining shortlist is a prioritised connector backlog with individual capability and partner-access gates.

The previous 17–27 week estimate covers the core product with a limited initial integration set. It is not a quote for the full UK connector catalogue. Estimate the adapter framework and each committed connector after technical spikes; add integration maintenance, vendor fees and hardware testing to the budget. No selected payroll vendor is required to begin core product design, but actual access is required before certifying its connector.

## Commercial white-label requirements — v0.8

The detailed [platform specification](WHITE_LABEL_PLATFORM.md) defines tenancy, branding, operator onboarding, platform administration, payment ownership, demo isolation and commercial release gates. These requirements apply across all earlier feature sections; references to a single venue describe the first customer, not a hard-coded product limit.

The accepted [database hosting decision](ARCHITECTURE_DATABASE_HOSTING.md) makes the deployment model explicit: Supabase is the shared multi-tenant commercial production platform, Neon is isolated synthetic staging, and a dedicated database is an optional contracted enterprise deployment rather than the default white-label model.

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| WL-01 | P0 | Business data isolation | Tenant A cannot access Tenant B through API, media, exports, search, queues, analytics or provider callbacks; tests exercise hostile ID substitution |
| WL-02 | P0 | Configurable branding/modules | Tenant name, logo, accessible colour theme, services and enabled modules change without a source-code fork; API also enforces disabled modules |
| WL-03 | P0 | Platform-owner administration | Create/onboard operators, manage software plans and deployment/integration status; routine platform staff do not receive blanket access to care or payroll data |
| WL-04 | P0 | Repeatable onboarding | Configure two differently branded synthetic clubs using the same application build; activate through a documented readiness checklist |
| WL-05 | P0 | Separate commercial accounts | Distinguish software charges to operators from membership/service/café receipts paid by their customers; no pooled payroll or customer balances |
| WL-06 | P0 | Operator lifecycle | Trial, onboarding, active, restricted and closed states have explicit access/export rules; product cancellation does not silently cancel members' paid services |
| WL-07 | P0 | Safe sales demonstration | Synthetic demo tenants use non-live providers, no real customer messaging and a visible demo indicator; labelled simulations cannot be mistaken for working connectors |
| WL-08 | P0 | Support and portability | Permissioned support access is time-limited/audited; documented per-tenant export/offboarding and tested restore; own branding and operational data remain attributable to each operator |

Implementation note (26/09/2026): WL-04 now has an automated local proof that provisions two differently branded synthetic operators through the invitation flow and configures distinct services, stations and qualified rotas without SQL or a code fork. The platform console computes and displays five configuration checks. This is a demo-readiness gate only; production activation and the remaining WL-03/WL-05/WL-08 controls are still open.

WL-06 implementation note (26/09/2026): onboarding, trial, active, restricted and closed states now have audited transitions and documented access/retention rules. Readiness gates trial and active; active also requires explicit external-review acknowledgement. Restricted operators retain existing access and records but cannot invite new members or staff. Closed operators disappear from ordinary tenant/public-profile access without deleting customer obligations. Packaged export, tested restore and the wider WL-08 offboarding process remain open.

Previously quoted week ranges are superseded pending estimation of the white-label baseline. Core requested modules remain in product scope, delivered in gated milestones; no broad connector or production-readiness claim is made before validation.
