# Live-service verification

**Subsequent activation:** Production configuration and redeployment have now succeeded. One initial platform owner has been created and browser sign-in verified. The absent public profile now returns 404. See HANDOVER.md for current state; the findings below preserve the earlier verification snapshot.

Verified 25/09/2026 at approximately 20:34 BST (19:34 UTC). Read-only service inspection; no deployment, environment-variable change, account creation or schema change performed.

## Confirmed

- GitHub `main` and local HEAD both `5744bc203a60651fe9b5cbcdd756c7fd220b0474`; fresh fetch reports 0 ahead / 0 behind. No open PRs. PRs #1 and #2 were merged. Working tree was clean before this report.
- Vercel project `the-dog-club` (`prj_qRPCKF6sGRnqKF7YzWifph4BXRxB`) links to `ring120768/The-Dog-Club`, production branch `main`.
- Production deployment `dpl_2bRbnoe1QjRZCriu928wb18tHkuL` is READY/PROMOTED and runs that exact commit. Its configured alias is https://the-dog-club-psi.vercel.app. Build/deployment success does not mean runtime functionality works.
- Vercel project environment listing is empty across targets. No production or preview variables are configured.
- Supabase `bbujzczcucdcdscjeynx` is ACTIVE_HEALTHY, Frankfurt (`eu-central-1`), PostgreSQL 17. Migration ledger records 000_schema, 001_dog_photos, 002_operator_branding and 003_supabase_hardening.
- All 11 public application tables have RLS enabled. Eight have FORCE RLS; accounts, sessions and login_attempts deliberately use owner-only access without policies. Both `anon` and `authenticated` lack SELECT/INSERT/UPDATE/DELETE privileges on all 11 tables.
- Exact counts: all 11 application tables contain zero rows, including accounts, platform_owners, clubs and memberships. There is no usable application login or club yet.
- The local DATABASE_URL targets this Supabase project, contains a password and successfully connects. A READ ONLY transaction confirmed the connection can SET ROLE club_app. No credential values were printed. `.env.local` is ignored and untracked.
- Local configuration still selects the PGlite demo by default: DOGCLUB_DB is unset and DOGCLUB_LOCAL_DEMO is enabled. A working localhost demo does not prove production database integration works.
- Current typecheck and all 28 isolated local automated tests pass. The production build succeeded on Vercel; no new local production build was run.

## Live HTTP checks

| Route | Result |
| --- | --- |
| `/` | 307 to `/login` |
| `/login` | 200, login form and synthetic demo credentials displayed |
| `/club/willow` | 307 to `/login` without a session |
| `/platform` | 307 to `/login` without a session |
| `/p/willow/00000000-0000-4000-8000-000000000002` | 500 |

The matching Vercel runtime log reports: `Local demo is disabled. Set DOGCLUB_DB=supabase to use production PostgreSQL.` This confirms the missing production database selection. Once configured, the empty public profile should return a normal not-found response rather than an internal error.

## Corrections and outstanding work

1. Set DOGCLUB_DB=supabase and DATABASE_URL for the intended Vercel environment, then redeploy. Do not enable DOGCLUB_LOCAL_DEMO there. Source inspection finds no usage of NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY in `src`; this adapter connects directly through `pg`. Those three keys are not prerequisites for the current implementation and should only be added if a future integration needs them.
2. Create an initial platform-owner account through a controlled setup flow, or explicitly choose a synthetic demonstration deployment. Current authentication uses the application's `public.accounts` table, not Supabase Auth; adding a Supabase Auth user alone will not enable login. The production login page still advertises local demo credentials and needs environment-appropriate copy.
3. The advisor warning about public.rls_auto_enable() remains. Catalog inspection confirms SECURITY DEFINER, event_trigger return type and EXECUTE inherited from PUBLIC. Revoking only anon/authenticated is insufficient: address the PUBLIC grant as well, preserve required administrative usage and recheck effective privileges/advisors. This verification did not execute the function or establish that the event-trigger function is exploitable via ordinary RPC.
4. Three INFO notices about RLS without policies correspond to the deliberately owner-only credential/session/attempt tables. They are distinct from the function warning.
5. The handover reports a database password was shared in another chat. Current connectivity cannot establish whether it has since been rotated. Rotation remains unverified; never copy the value into documentation or chat.
6. PROJECT_STATUS.md contains obsolete claims that the adapter/deployment are outstanding and implementation is unpushed. The old path is mentioned as a duplicate, not as the canonical checkout. Claude project document versions and ownership of another project's similarly named Vercel domain were not independently verified.

## Verification limits

No successful live sign-in, authenticated booking/profile workflow, live upload or payment flow can be claimed. There are no application accounts; production configuration is absent. Supabase-backed write tests were not run against the live database. The 28 passing tests use isolated local databases and do not establish end-to-end Vercel-to-Supabase connectivity. This is a service-readiness check, not a comprehensive security audit.

Next: configure the two runtime variables, deploy, provision the intended initial account, then verify successful login and tenant-scoped operations on the deployed app. Handle the function permission warning and password rotation before onboarding real users.
