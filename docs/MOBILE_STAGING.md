# Mobile HTTPS staging

The native member app must be compiled against a reviewed non-production HTTPS origin before simulator acceptance or signing. The server address is public configuration, while database credentials and member credentials remain server-side or local secrets.

## Environment boundary

- The current staging database is the Vercel Marketplace Neon resource `dog-club-staging`, on the Free plan in London. It contains synthetic records only.
- Set `DOGCLUB_DB=postgres` and its staging `DATABASE_URL` in the Vercel Preview environment. Never copy the production connection string into Preview.
- Use Neon's pooled `DATABASE_URL` for the Vercel runtime and `DATABASE_URL_UNPOOLED` only for controlled migrations. The application does not use named prepared statements.
- `DOGCLUB_DB=postgres` is scoped to the `codex/mobile-https-staging` Preview branch. Production retains its existing Supabase configuration.
- Set `MOBILE_APP_SERVER_URL` locally to the stable HTTPS staging origin when preparing native assets. It is compiled into the app and removes the editable server field.
- Keep `MOBILE_STAGING_EMAIL` and `MOBILE_STAGING_PASSWORD` in the local environment only. They are used by the acceptance script and are never compiled into the app.

## Current reviewed target

The reviewed mobile staging origin is:

```text
https://the-dog-club-git-codex-mobile-9694ab-ring120768-2588s-projects.vercel.app
```

On 26/09/2026 the user authorised a Vercel Deployment Protection Exception for this domain only. It is therefore publicly reachable by native apps, while other Preview deployments retain standard Vercel authentication and Production is unchanged. The domain contains synthetic Neon data and must not be promoted as a production service.

## Build and verify

```sh
MOBILE_APP_SERVER_URL=https://staging.example.test npm run mobile:sync

MOBILE_APP_SERVER_URL=https://staging.example.test \
MOBILE_STAGING_EMAIL=member@staging.example.test \
MOBILE_STAGING_PASSWORD='use-a-local-secret' \
MOBILE_STAGING_CLUB=willow \
npm run mobile:verify-staging
```

The verifier signs in, confirms at least one club membership, confirms the current device session is listed, and signs that session out in a `finally` block. It reports status and counts only; it never prints the email, password, bearer token or response bodies.

When `MOBILE_APP_SERVER_URL` is absent, `npm run mobile:sync` creates development assets with the local server field visible. This mode is for local simulator work only and must not be signed or distributed.

## Acceptance evidence — 26/09/2026

- An unauthenticated request to `/login` returned HTTP 200 without a Vercel session.
- `npm run mobile:verify-staging` signed a synthetic Willow member in, returned one club membership, found the current device session and revoked it in the cleanup path.
- `mobile:sync` compiled the reviewed origin into both native projects. Android debug assembly with Java 21 and the unsigned iOS simulator build passed from an isolated worktree.
- The iOS build installed on `Dog Club iPhone` and rendered the branded live staging login without an editable server field.
- A deployed browser journey signed the same synthetic member in, reached `/club/willow`, displayed Bertie and the member routes, then signed out.

This evidence proves public reachability, backend authentication, native compilation and iOS staging rendering. It does not yet claim a complete interactive native sign-in and booking journey on both iOS and Android; that remains the next device acceptance.
