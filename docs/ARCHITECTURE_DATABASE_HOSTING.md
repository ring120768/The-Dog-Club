# Architecture decision: database hosting and tenant isolation

Status: Accepted · 26/09/2026

## Decision

The commercial Dog Club product uses one shared, multi-tenant Supabase PostgreSQL platform by default. White-label operators use the same application build and database schema. Their records are separated by immutable tenant (`club_id`) relationships, server-side authorisation and database row-level security; a new customer does not receive a code fork or a separate database as part of ordinary onboarding.

Neon is the isolated staging and sales-demo database. It contains synthetic records only and is connected to Vercel Preview. It is not the planned production datastore and must never receive copied production records or credentials.

A dedicated Supabase project or other dedicated PostgreSQL deployment may be offered only when an enterprise contract, regulatory requirement, data-residency commitment or measured scale requirement justifies the additional operation. It must use the same migrations and application contracts, have separately managed credentials, backups and monitoring, and be priced to cover its additional support and infrastructure.

## Application boundary

The application talks to standard PostgreSQL through the shared database adapter. `DOGCLUB_DB=postgres` identifies provider-neutral hosted PostgreSQL, while the existing `supabase` value remains supported for the current production deployment. Business logic must not depend on provider-specific client-side database access.

Authentication, authorisation and all writes remain server-side. Tenant scope must also cover storage, cache keys, queues, exports, audit events, provider mappings and public-profile projections. A supplied club slug or ID is never sufficient authority.

## Environment policy

| Environment | Database | Data policy |
|---|---|---|
| Local development | Local PostgreSQL | Synthetic fixtures only |
| Vercel Preview / mobile staging | Neon PostgreSQL | Synthetic tenants and test accounts only |
| Commercial production | Supabase PostgreSQL | Shared multi-tenant live service by default |
| Contracted dedicated deployment | Dedicated managed PostgreSQL | Explicit enterprise exception with separate operations and pricing |

The mobile application compiles the reviewed HTTPS endpoint for its target environment. Changing that endpoint does not change the tenancy or data-isolation model.

## Consequences and acceptance

- White labelling is configuration over one maintained product, rather than customer-specific forks.
- Tenant isolation tests are a release gate for every shared deployment.
- Provider portability is preserved at the application boundary, but moving live data is a controlled migration project rather than a runtime database switch.
- A dedicated deployment is an operational and commercial decision, not the default response to onboarding another operator.

This decision expands the tenancy rules in [WHITE_LABEL_PLATFORM.md](WHITE_LABEL_PLATFORM.md) and the WL-01/WL-04 requirements in [PRD.md](PRD.md).
