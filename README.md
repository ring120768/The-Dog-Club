# Dog Club Platform

Commercial white-label software for membership-led dog clubs, grooming and pet hospitality businesses.

## Status

Project established on 25/09/2026. The first local web increment is implemented: synthetic account sign-in, club branding, dog profiles with photo uploads, audience controls, public pages and a manager overview. This is not production-ready software. The Chiswick club is the first design partner. Platform name is provisional.

## Planning documents

- [Product requirements](docs/PRD.md)
- [Build roadmap](docs/ROADMAP.md)
- [White-label platform specification](docs/WHITE_LABEL_PLATFORM.md)

## First milestone

Build authenticated tenant isolation, configurable branding, operator onboarding and working dog profiles. Demonstrate two fictional clubs using the same application, with private records kept separate.

Member apps target iOS and Android. Manager/staff and platform-owner consoles are web-based. Payments, payroll and till integrations require validated provider adapters; simulated integrations must be labelled clearly.

## Project boundaries

This is independent of RoundMate. Do not reuse its codebase, production database, storage, credentials or merchant accounts. No live accounts or integrations are configured here.

## Development

Requires Node.js 22 or later. Run only one development process against the local database.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3100. The login form starts with a synthetic member account. Other demo accounts appear under **Explore the demo accounts**. All use the synthetic password `PawsTogether!26`.

| Account              | Access                              |
| -------------------- | ----------------------------------- |
| alice@demo.invalid   | Willow member, Bertie's owner       |
| bea@demo.invalid     | Willow member, Mabel's owner        |
| manager@demo.invalid | Willow manager overview             |
| coast@demo.invalid   | Coast & Canine member, Otis's owner |

```sh
npm run typecheck
npm test
```

The local database is created automatically in `.data/postgres` and persists across restarts. Never use real customer data in this increment. The database adapter requires `DOGCLUB_LOCAL_DEMO=1` and refuses production mode. Demo badges, synthetic sign-in defaults and demo-account hints also require that flag and are forcibly hidden whenever `NODE_ENV=production`. Credentials, local data and build output are ignored by Git.

The platform-owner console includes a confirmed **Reset demo activity** control for each wholly synthetic club. It clears bookings, grooming/admission visits, simulated payments and booking-linked credit entries while preserving the prepared operator, dogs, membership, services and staffing setup. It refuses production, Supabase-backed and mixed/non-demo tenants. See [demo activity reset](docs/DEMO_RESET.md).

Account recovery stays support-assisted in the local demo. A deployed environment can send one-time recovery links to the stored account email by configuring `RECOVERY_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `RECOVERY_EMAIL_FROM` and an HTTPS `APP_URL`. The From address must use a domain verified with Resend. Provider acceptance is recorded for support, but is not represented as proof of inbox delivery. See [account recovery](docs/ACCOUNT_RECOVERY.md).

See [implementation scope](docs/IMPLEMENTATION.md) and [verification](docs/VERIFICATION.md). Photo upload, replacement and removal now work with the profile’s visibility rules. JPEG, PNG and still WebP are supported; HEIC and animated images are not. See [photo design](docs/PHOTO_UPLOADS.md). Secure operator onboarding, audited lifecycle controls, a computed demo-readiness checklist and a platform-owned verified export/restore path are implemented locally. The full stack has been rehearsed against disposable PostgreSQL 17. Managed production storage, native mobile clients and live integrations remain outstanding.

GitHub repository: [ring120768/The-Dog-Club](https://github.com/ring120768/The-Dog-Club).

## Staff permissions and operational inventory

Managers can assign an existing club member as manager, groomer, reception or café staff; grant staff-administration and booking/inventory permissions independently; record service qualifications; reactivate or deactivate access; and review an append-only access history. Deactivation retains historical booking ownership while immediately removing delegated workspace access and the groomer from future availability.

Every operator receives a default venue location during onboarding. Managers and authorised staff can add locations, choose the location and qualified groomer for a dated shift, and retire or restore services and stations. Availability only combines an active groomer, published shift and station at the same venue. A location with active stations or published shifts cannot be retired accidentally.

Managers and delegated staff administrators can also issue a hashed, single-use 72-hour staff invitation carrying the intended role, permissions and qualifications. A new account and its ordinary club membership, staff access, qualifications and audit event are created atomically; an existing account must sign in before accepting. No invitation email is sent yet. Private care and daily reception access remain manager-only until their narrower permission slices are reviewed and tested. Production remains untouched.

## Operator demo readiness

The platform console now reports five evidence-based setup checks for every operator: manager access, an active venue, an active grooming service, an active station and a published shift with a qualified active groomer. “Demo ready” means those five synthetic walkthrough conditions pass. It does not mean the operator is approved for live use, connected to a production payment provider or ready for an app-store release.

Automated acceptance provisions two differently branded operators through secure invitations, then gives each a distinct service, station and qualified rota using the same application build. No manual SQL or source-code fork is used.

Platform owners can move operators through onboarding, trial, active, restricted and closed states using audited transition rules. Restriction preserves existing service obligations while blocking new invitations; closure removes ordinary tenant and public-profile access without deleting records. See [operator lifecycle](docs/OPERATOR_LIFECYCLE.md).

Platform owners can also download a tenant-bound JSON archive with a record count and SHA-256 integrity value. Credentials, bearer tokens, hosted Stripe URLs and raw webhooks are excluded; restore requires separately verified identities and has been rehearsed against an isolated database. See [operator export and restore](docs/OPERATOR_EXPORT_AND_RESTORE.md) and [PostgreSQL rehearsal](docs/NON_PRODUCTION_POSTGRES_REHEARSAL.md).

## iOS and Android

Shared Capacitor projects now live in `ios/` and `android/`. Both debug targets build from the same repository and bundle the same member journey: server selection for development, opaque bearer-token sign-in, club selection, a tenant-scoped dog list, profile detail, permission-checked text/audience editing and sanitised photo replacement/removal through the system picker. The bearer token stays in memory and disappears when the app reloads. Run `npm run mobile:sync` after changing bundled assets. Secure device persistence, camera capture, push/deep links, signing and store distribution remain later mobile increments; see [mobile foundation](docs/MOBILE_FOUNDATION.md).
