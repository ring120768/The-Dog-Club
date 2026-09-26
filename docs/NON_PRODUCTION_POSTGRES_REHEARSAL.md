# Non-production PostgreSQL rehearsal

## 26/09/2026 result

The complete migration and test chain was rehearsed against a disposable local container running the same Supabase PostgreSQL 17 image used by the local Supabase stack (`public.ecr.aws/supabase/postgres:17.6.1.106`). No cloud project, production schema or customer data was touched.

Results:

- all 18 migration files applied in filename order to a clean database;
- the resulting schema contained 52 public tables;
- effective `club_app` table grants were enumerated and contained no grants for credentials, sessions, password recovery, raw payment webhooks, operator lifecycle or operator export history;
- `npm run test:supabase` passed all 98 tests against PostgreSQL 17 with test changes enclosed in rollback-only transactions;
- the post-test database contained zero clubs and zero operator export events, confirming that the shared-database harness left no synthetic rows behind.

The first attempt used the image's `postgres` login and failed before creating the migration ledger because that role does not own the `public` schema. The clean rerun succeeded as `supabase_admin`, the schema owner. Deployment automation must therefore apply these migrations through the approved migration-owner connection rather than an application or lower-privilege login.

This proves compatibility of the current migration stack and application tests with an isolated PostgreSQL 17 instance. It does not prove the historic cloud migration ledger is aligned, authorise `supabase db push`, configure Vercel, rotate credentials, deliver real email, process a real Stripe test payment or approve production rollout.

## Rehearsal outline

1. Start a disposable PostgreSQL 17 database with a unique local port and database name.
2. Connect as the database/schema migration owner.
3. Run `migrate` from `src/lib/migrations.ts` against the empty database.
4. Record migration count, public-table count and effective `club_app` grants.
5. Run `DATABASE_URL=<disposable-url> npm run test:supabase`.
6. Confirm no synthetic tenant rows remain after the rollback-only test runs.
7. Destroy the disposable database.

For a future managed staging rehearsal, compare the provider's migration ledger with the repository before applying anything. The existing live Supabase ledger uses historical versions that do not match all local filenames.
