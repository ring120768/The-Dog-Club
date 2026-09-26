# Project handover

25/09/2026

Canonical working directory: `/Users/ianring/Documents/ChatGPT/The Dog club`.
GitHub: https://github.com/ring120768/The-Dog-Club.git

The original PRD, roadmap and white-label specification remain the product scope. The application is a local, persistent web foundation with a growing end-to-end demo journey, not a production-ready release.

Implemented: Next.js/TypeScript application; server-side opaque sessions and account recovery; tenant membership and PostgreSQL row-level security; configurable branding; secure operator, member, household-adult and staff invitations; dog profiles/photos/audiences; grooming approval, booking and visit lifecycle; membership entitlements and Stripe sandbox checkout contracts; admission/capacity; staff permissions; venue, service, station and shift configuration; a platform-owned operator demo-readiness view; and a shared iOS/Android member foundation with sign-in, club selection, dog profile/photo editing and a read-only membership/upcoming-booking summary. Sensitive care, household, billing and operational records retain their separate access boundaries.

Verified: TypeScript and 111 automated checks pass locally. Acceptance creates two differently branded synthetic operators through invitations, configures distinct services/stations/qualified rotas from the same build, and reports both as demo-ready. Lifecycle coverage proves state gates, retained obligations and closed access. Export coverage proves tenant boundaries, credential removal, tamper detection and transactional restoration. The complete 18-migration stack and the then-current 98-test suite passed against disposable PostgreSQL 17; later mobile tests still require the next PostgreSQL rehearsal. Details are in VERIFICATION.md, NON_PRODUCTION_POSTGRES_REHEARSAL.md and HANDOVER.md.

Outstanding: managed-cloud staging/ledger rehearsal, production identity/email verification/staff MFA, managed private object storage, store-ready iOS/Android member journeys, production payment/POS/payroll integrations, deletion/retention execution, deployment and operational release gates. “Demo ready” is deliberately narrower than live readiness.

Next: complete mobile visual acceptance on iOS and Android, then add availability search and booking confirmation to the shared member client. Live provider work still needs supplier credentials and agreed operator decisions. No RoundMate infrastructure is used.

The canonical checkout remains `/Users/ianring/Documents/ChatGPT/The Dog club`. Earlier Downloads and RoundMate planning copies are snapshots.

Photo increment: one normalised image per dog, additive database migration, metadata removal, direct-image permission checks and no-store responses. Browser-tested invalid-file recovery, valid upload/preview, public rendering and removal. Changes remain local and unpushed.
