# Dog Club Platform — white-label product specification

Version 0.8 · 25/09/2026 · Production intention; design specification, not implemented software

## Product and buyer

Sell configurable software to dog clubs, grooming-led membership venues and pet hospitality businesses. Their customers use the member experience; their teams use the manager/staff portal. Ringo's business operates the platform and sells software subscriptions, onboarding and supported add-ons. The first Chiswick venue is a design partner, not the product's permanent identity.

Keep the product coherent for this market. Do not build an unrestricted website builder, a replacement statutory payroll engine or a universal restaurant POS.

## Three product surfaces

| Surface | Audience | Responsibility |
|---|---|---|
| Branded member experience | Dog owners | Membership, dogs, social profiles, services, bookings, payment and visit information; iOS/Android plus public web links |
| Branded operations portal | Operator managers and staff | Member/care administration, bookings, café payment workflow, rotas, clocking, timesheets, payroll and moderation |
| Platform console | Software owner and authorised support | Operator onboarding, software entitlements/billing, branding setup, connector health, rollout and support access |

## White-label configuration

Each operator configures trading name, logos/icons, colour tokens, contact/support details, services, prices, locations/zones/resources, member plans, opening hours, enabled modules, operational policies and notification templates. Validate contrast and file types; prohibit arbitrary executable HTML/scripts or tenant-defined database queries. Pricing and policies are effective-dated so changing a plan does not silently alter existing contracts.

Custom domains require ownership verification, certificate provisioning and safe removal. Domain identity selects a possible tenant; authenticated membership still determines permissions. Unknown hosts must fail safely, not display a default club's private information.

Module visibility and subscription entitlements are enforced server-side. Customer-specific requests become reusable configuration or an explicit supported product enhancement, never unmaintained branches.

## Tenant and account model

Database hosting is governed by the accepted [database hosting and tenant-isolation decision](ARCHITECTURE_DATABASE_HOSTING.md): commercial operators share the multi-tenant Supabase PostgreSQL service by default, Neon is synthetic Preview/staging only, and dedicated databases are separately contracted exceptions.

A tenant is an operating business. Locations, staff access, households, dogs, care records, subscriptions, sales, payroll batches, integration accounts and social profiles belong to it. A person may authenticate once and join two clubs, but their tenant memberships and role grants are separate. Do not silently copy dog records or cross-publish profiles between clubs. A household's participation in one club must not reveal membership elsewhere.

Use immutable tenant IDs in all operational records and composite tenant-aware relationships. Derive authorised context server-side; never trust a client-supplied tenant ID alone. Apply database-level isolation as well as service checks. No assumption that adding a tenant column alone secures a system.

Tenant scope also applies to storage keys/signed media access, search indexes, cache keys, queues, notifications, audit logs, reports and exports. Public dog pages use a minimal explicit projection and publication policy; they never expose private care records. Within a tenant, maintain payroll-only and care-specific access boundaries.

Integrations have per-tenant credentials, provider account mappings and signing context. Webhooks resolve to the authorised provider account and tenant; reject conflicting object mappings. Idempotency is scoped to tenant, provider and operation. Scheduled jobs carry tenant context and re-check authorisation/state before acting.

## Recommended implementation boundaries

Start as a modular application with one authoritative relational datastore and shared business rules. Avoid microservices before operational needs justify them. Exact vendors/framework versions will be selected in a separate implementation spike.

Suggested logical layout in a NEW repository:

```text
apps/
  member-mobile/       iOS and Android member client
  operations-web/      manager/staff and separately authorised platform console
  public-web/          marketing, tenant landing pages and public dog profiles
services/
  application/         authenticated APIs, domain operations and provider callbacks
packages/
  domain/              tenancy, memberships, booking, commerce and workforce rules
  design-system/       validated branding tokens and shared UI primitives
  integrations/        payroll, POS and processor adapters
  contracts/           shared request/response validation
```

This is a boundary proposal, not a requirement to deploy six independently operated services. Keep pricing, eligibility and payment decisions off clients. Keep all new resources independent of RoundMate.

## Payment ownership

There are two separate financial relationships: platform software fees paid by operators, and membership/service/café payments paid by their customers. Track distinct billing customers, subscriptions and reporting. Do not put unrelated operators' receipts through the first club's Stripe account.

Evaluate Stripe Connect for operator merchant onboarding and platform-facilitated payments. Confirm charge model, liability, refund ownership and commercial terms before implementation; do not assume the platform is merchant of record. Independent groomer split payments are an additional decision distinct from operator onboarding. Customer saved payment methods and subscriptions are provider/account-specific, not automatically portable.

Alternative counter processors such as Square or SumUp keep their own settlements and refund routes. The platform reconciles them; it does not make their readers universally compatible with Stripe. Payroll wage payments remain an authorised provider/bank workflow.

Reference: [Stripe SaaS platform guide](https://docs.stripe.com/connect/enable-payment-acceptance-guide). Verify the chosen integration with current official documentation before writing payment code.

## Mobile white labelling

Maintain a shared mobile codebase with tenant configuration. Two distribution options require an explicit commercial decision:

1. A platform app where members select/join their club and see its branded experience. Lower release overhead, but the store listing itself carries the platform brand.
2. A separately branded app for an operator, built from shared code and released under an appropriate operator-owned account with its actual content/services. Higher onboarding/release/support overhead and no automatic guarantee of approval.

Do not promise unlimited cloned store listings. Apple's guideline 4.2.6 addresses commercial template apps and direct submission by the content provider; Google restricts repetitive content. Account ownership alone does not guarantee acceptance. Validate the first release approach before selling branded mobile publication as a contractual entitlement.

Sources checked 25/09/2026: [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/uk/), [Google Play spam/repetitive-content policy](https://support.google.com/googleplay/android-developer/answer/9899034?hl=en-GB).

## Commercial packaging proposal

Sell a monthly software subscription per operating business/location, with an onboarding fee for configuration/import/training. Optional paid modules can include workforce/payroll, additional supported integrations and managed branded mobile releases. These are packaging hypotheses; no prices have been approved.

Keep provider charges, payment processing, SMS, hardware and app-store account costs visible. Define usage allowances and support terms before quoting. Do not introduce a transaction commission until merchants understand it and the commercial/payment model supports it.

Cost the service using hosting/storage, photo traffic, notifications, integration maintenance, mobile releases, support and onboarding labour. Validate willingness to pay with design partners before making a revenue forecast. Secure rights to sell the shared code/design and use first-customer assets only with appropriate permission.

## Demo and production

The demonstration is a synthetic tenant on the same code/configuration model. Use fictional dogs, staff and financial records. Provider simulators share adapter contracts but display a clear simulation status. Separate environments and credentials prevent real charges, wage submission and messages. Production activation checks must reject fake adapters for required live capabilities.

Use two visibly distinct demo businesses from the first working increment. Show branding and services changing through configuration while data remains isolated. Reset only known synthetic tenant records. Never clone production households into demo environments.

## Initial acceptance gates

| Gate | Passing evidence |
|---|---|
| Tenant isolation | Tenant A/B negative tests for APIs, IDs, files, exports, search, background work and webhooks; staff/payroll role separation within each tenant |
| White-label onboarding | Provision two synthetic clubs with different branding, services and staff, with no source-code change |
| Member lifecycle | Onboarding, profile publication, membership, booking, handover and collection work end to end |
| Commerce | One validated merchant route reconciles memberships, deposits/balances, café sales and refunds |
| Workforce | Published rota governs bookings; clock corrections and approved hours feed a reconciled provider trial payroll |
| Commercial operations | Software subscription lifecycle, support access, export/offboarding and failed-payment policy are exercised |
| Production readiness | Backup restoration, incident procedure, permission review, accessibility, device tests and operator training pass |

Platform support has no silent universal impersonation. If temporary access is required, record tenant authorisation, reason, scope, expiry and actions. Business continuity/export policies must be defined for subscription suspension, especially when members have outstanding bookings or wages are due.

## First implementation milestone

Create a separate repository; establish authenticated tenant access and database policies; add a branding registry, location/resource configuration, platform onboarding and role-aware portal shells. Add synthetic tenant fixtures and isolation tests before connecting payments or payroll. Then implement the member/dog profile vertical slice and browser-accessible public projection.

This milestone is the production foundation and sales-demo starting point. It is not a claim that integrations, mobile releases or the wider platform already exist.
