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

Account recovery stays support-assisted in the local demo. A deployed environment can send one-time recovery links to the stored account email by configuring `RECOVERY_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `RECOVERY_EMAIL_FROM` and an HTTPS `APP_URL`. The From address must use a domain verified with Resend. Provider acceptance is recorded for support, but is not represented as proof of inbox delivery. See [account recovery](docs/ACCOUNT_RECOVERY.md).

See [implementation scope](docs/IMPLEMENTATION.md) and [verification](docs/VERIFICATION.md). Photo upload, replacement and removal now work with the profile’s visibility rules. JPEG, PNG and still WebP are supported; HEIC and animated images are not. See [photo design](docs/PHOTO_UPLOADS.md). Managed production storage, native mobile clients, operator onboarding and live integrations remain outstanding.

GitHub repository: [ring120768/The-Dog-Club](https://github.com/ring120768/The-Dog-Club).
