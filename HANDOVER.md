# Handover — getting the live site working

Updated 25/09/2026

Working folder on Ringo's Mac: `~/Documents/ChatGPT/The Dog club` (not `DogClubPlatform`, which is empty).

## Done

- `main` includes the Supabase Postgres adapter (PR #2, merged).
- Vercel project `the-dog-club` deploys automatically from `main`. Live address: https://the-dog-club-psi.vercel.app (`the-dog-club.vercel.app` belongs to someone else).
- Supabase project `The-Dog-Club` (ref `bbujzczcucdcdscjeynx`, Frankfurt) now has migrations 000–003 applied: 11 tables, row-level security on all of them, all empty.
- `.env.local` `DATABASE_URL` now includes the database password; connection tested OK. `.env.local` stays gitignored.

## What's left before the live site works

1. **Vercel environment variables.** Vercel currently has none. Add, for Production (and Preview if wanted):
   - `DOGCLUB_DB=supabase` (Config)
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Config — public by design)
   - `DATABASE_URL` and `SUPABASE_SECRET_KEY` (Secret — never prefix with `NEXT_PUBLIC_`)
   - Do **not** set `DOGCLUB_LOCAL_DEMO` on Vercel.
   Copy values from `.env.local` (e.g. `vercel env add`), never through chat.
2. **Redeploy** after adding the variables — existing deployments don't pick up new env vars.
3. **Accounts.** The database has no users, so nobody can log in. The seed only runs for the local PGlite demo. Decision needed: load the two synthetic demo clubs into the live database, or create a single platform-owner login only.
4. **Optional security tidy-up.** Supabase advisor warns that `public.rls_auto_enable()` (pre-existing, not from our migrations) is executable by `anon`/`authenticated`. Revoke `EXECUTE` from those roles.

## Housekeeping

- The database password was shared in a chat session on 25/09/2026. Reset it in Supabase (Project Settings → Database) once the site is running, then update `.env.local` and Vercel.
- `docs/PROJECT_STATUS.md` still lists the old `DogClubPlatform` path; update it.
- The Claude project docs are v0.1; the repo docs are v0.8 and are the source of truth.
