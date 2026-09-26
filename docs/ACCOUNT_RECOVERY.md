# Account recovery

A visitor submits an email through `/recover`; the response remains identical whether or not that account exists. Known accounts create at most three requests per hour. Each usable link lasts 30 minutes, works once and is stored only as a SHA-256 hash. Issuing a newer link expires the account's older links.

Local demo mode remains support-assisted and never sends email. The platform owner reviews requests at `/platform/recovery`, verifies the requester using the business's agreed private support process and creates a manual one-time link.

A deployed environment can enable automatic delivery with these server-side variables:

```text
RECOVERY_EMAIL_PROVIDER=resend
RESEND_API_KEY=...
RECOVERY_EMAIL_FROM=The Dog Club <help@verified-domain.example>
APP_URL=https://the-production-origin.example
```

The From address must use a sending domain verified with Resend. Production recovery refuses a non-HTTPS `APP_URL`. The REST request uses a stable request-scoped idempotency key. The database records `pending`, provider-accepted or failed delivery state plus the provider message ID or a bounded error code; it never stores the raw recovery token or provider response body. Provider acceptance means the provider accepted the API request, not that the message reached the inbox. Resend documents both [sending email](https://resend.com/features/email-api) and [domain verification](https://resend.com/docs/dashboard/domains/introduction).

If automatic delivery fails or is not configured, the request remains visible to platform support and a manual link can be issued. Public responses do not reveal the account or delivery result. A successful reset proves control of the registered mailbox link, changes the salted password hash, consumes the link, expires other links, clears failed-login throttling and deletes every existing session for the account.

Recovery tables remain server-only and receive no `club_app` grants or policies. Platform ownership is rechecked inside every manual support action. Before production activation, verify the sender domain, use a restricted server-side API key, exercise a real test inbox, confirm expiry and one-time use, and review provider logs without copying recovery links into support notes.

Staff MFA, a formal support identity-verification policy, delivery webhooks/bounce handling, abuse monitoring and managed identity-provider integration remain rollout work.
