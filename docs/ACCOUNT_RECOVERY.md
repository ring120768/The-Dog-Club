# Account recovery

The demo now has a support-assisted password recovery workflow. A visitor submits an email through `/recover`; the response is identical whether or not that account exists. Known accounts create at most three requests per hour.

The platform owner reviews requests at `/platform/recovery`, verifies the requester using the business's agreed private support process, and creates a 30-minute one-time link. The raw token is shown once and only its SHA-256 hash is stored. Issuing a newer link expires older links for that account.

Completing recovery updates the salted password hash, consumes the link, expires other outstanding links, clears failed-login throttling and deletes every existing session for the account. The user signs in again on each device.

The recovery tables are server-only and receive no `club_app` grants or RLS policies. The public form never exposes an account lookup result. Platform ownership is rechecked inside every support action.

Automated email delivery, staff MFA, support identity-verification policy, recovery abuse monitoring and managed identity-provider integration remain rollout work. Until a verified delivery route exists, the platform owner must share the generated link privately and must not claim that an email has been sent.
