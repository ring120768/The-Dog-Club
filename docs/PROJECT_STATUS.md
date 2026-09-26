# Project handover

25/09/2026

Canonical working directory: `/Users/ianring/Documents/ChatGPT/The Dog club`.
GitHub: https://github.com/ring120768/The-Dog-Club.git

The original PRD, roadmap and white-label specification remain the product scope. The application is a local, persistent web foundation with a growing end-to-end demo journey, not a production-ready release.

Implemented: Next.js/TypeScript application; server-side opaque sessions and account recovery; tenant membership and PostgreSQL row-level security; configurable branding; secure operator, member, household-adult and staff invitations; dog profiles/photos/audiences; grooming approval, booking and visit lifecycle; membership entitlements and Stripe sandbox checkout contracts; admission/capacity; staff permissions; venue, service, station and shift configuration; and a platform-owned operator demo-readiness view. Sensitive care, household, billing and operational records retain their separate access boundaries.

Verified: TypeScript and 91 automated checks. The latest acceptance creates two differently branded synthetic operators through invitations, configures distinct services/stations/qualified rotas from the same build, and reports both as demo-ready. A browser walkthrough confirms the platform list and five-item checklist. Details in VERIFICATION.md and HANDOVER.md.

Outstanding: non-production PostgreSQL migration rehearsal, production identity/email verification/staff MFA, managed private object storage, iOS/Android clients, operator lifecycle and offboarding/export rules, production payment/POS/payroll integrations, deployment and operational release gates. “Demo ready” is deliberately narrower than live readiness.

Next: implement the operator lifecycle states and their access/export rules, then rehearse the complete migration stack in non-production PostgreSQL. No RoundMate infrastructure is used.

The canonical checkout remains `/Users/ianring/Documents/ChatGPT/The Dog club`. Earlier Downloads and RoundMate planning copies are snapshots.

Photo increment: one normalised image per dog, additive database migration, metadata removal, direct-image permission checks and no-store responses. Browser-tested invalid-file recovery, valid upload/preview, public rendering and removal. Changes remain local and unpushed.
