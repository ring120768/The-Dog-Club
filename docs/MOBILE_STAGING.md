# Mobile HTTPS staging

The native member app must be compiled against a reviewed non-production HTTPS origin before simulator acceptance or signing. The server address is public configuration, while database credentials and member credentials remain server-side or local secrets.

## Environment boundary

- Use a separate Supabase project or other isolated PostgreSQL database containing synthetic records only.
- Set `DOGCLUB_DB=supabase` and its staging `DATABASE_URL` in the Vercel Preview environment. Never copy the production connection string into Preview.
- For a serverless Vercel deployment, use the Supabase transaction pooler connection on port 6543. The application does not use named prepared statements.
- Set `MOBILE_APP_SERVER_URL` locally to the stable HTTPS staging origin when preparing native assets. It is compiled into the app and removes the editable server field.
- Keep `MOBILE_STAGING_EMAIL` and `MOBILE_STAGING_PASSWORD` in the local environment only. They are used by the acceptance script and are never compiled into the app.

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
