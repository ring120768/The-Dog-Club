# Handover — getting the live site working

Updated 25/09/2026

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
2. Set up the first actual club and its manager. The current creation flow requires a registered manager account; only the platform-owner account has been provisioned. Invitations are not implemented.
3. Resolve the Supabase advisor warning for public.rls_auto_enable(). Effective EXECUTE is inherited from PUBLIC; revoking only anon/authenticated is insufficient. Review and remove the PUBLIC grant as appropriate, retain required administrative access, then verify effective privileges and advisors. See the verification report for the event-trigger caveat.
4. Replace the initial testing password before real-customer use. Password-change/reset UI is not implemented yet. Do not write credentials into handovers.
5. Preview has not been connected to the production database. Do not add production credentials to previews casually.

## Housekeeping

- The database password was shared in a chat session on 25/09/2026. Reset it in Supabase (Project Settings → Database) once the site is running, then update `.env.local` and Vercel.
- `docs/PROJECT_STATUS.md` has obsolete implementation/deployment status; its canonical path is already correct. The verification report supersedes those status claims.
- The Claude project docs are v0.1; the repo docs are v0.8 and are the source of truth.

## Demo logo update

The user-supplied dog photo is copied unchanged to `public/brand/demo-dog.jpg` and used beside The Dog Club name on the login page and platform console. A shared DemoLogo component preserves its 4:3 composition. Operator emblems remain configurable. This source change is included in the logo checkpoint branch; it is not yet deployed to production.

Login hero retains “Their happy place. Yours, too.” The approved supporting line is “Good friends, tasty treats and a place to belong.” This copy change is included in the same checkpoint, not deployed to production.

Checkpoint validation: TypeScript check and all 28 local tests passed; the local login response contains the original headline, approved supporting line and demo logo. Branch: `codex/demo-logo-checkpoint`. Production merge remains a separate step.

Preview visibility fix: the narrow-screen layout no longer hides the login supporting paragraph. The approved sentence stays visible in the embedded viewing window and on mobile.
