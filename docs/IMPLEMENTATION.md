# Foundation implementation — 25/09/2026

## This increment
Next.js/React/TypeScript web application, with server-side sessions, two synthetic clubs, configurable branding, member dog creation/editing, visibility controls and an explicit public profile projection. Manager access is club-specific. The mobile member clients remain a later increment, targeting a shared React Native/Expo client and the same domain contracts; no native build is claimed yet.

Local development uses PGlite (embedded PostgreSQL) because Docker is not running. Persistent synthetic records stay in `.data/`, excluded from Git. The schema uses PostgreSQL row-level security under a restricted application role. This single-process adapter is a development foundation, not a production database deployment. Managed PostgreSQL, managed identity/MFA, media storage and recovery must be validated before launch.

## Acceptance
- Sign in and sign out with synthetic accounts using server-side opaque sessions.
- Two club memberships give access only to authorised clubs; URL/ID substitution does not grant access.
- Owners create/edit their dogs; managers can read their own club’s dogs but cannot edit members’ social consent.
- Private profiles are visible only to owners and authorised club managers; members/public audiences are opt-in.
- Public pages expose only name, breed, bio and a permission-checked photo (or fallback illustration); owner identity and care notes never appear.
- Local profile persistence survives a restart. Publication can be revoked.
- Tests exercise cross-club reads/writes, owner isolation, audience visibility and revocation.

Production photo storage, operator onboarding, native clients, email verification/password reset, staff MFA, payments, payroll, rotas and deployment are still outstanding. Local photo uploads are implemented; illustrated avatars remain the fallback. See PHOTO_UPLOADS.md.

## References
- https://nextjs.org/docs/app
- https://pglite.dev/docs/
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html
