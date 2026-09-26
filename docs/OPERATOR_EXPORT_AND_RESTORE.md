# Operator export, restore and offboarding

## Purpose

The platform-owner console can download a versioned JSON archive for one operator. The archive is intended for portability, support-controlled restoration and offboarding evidence. Every archive contains a SHA-256 integrity value and a record count; each export and completed restore is recorded in `operator_export_events`.

This is a privileged platform operation. Club managers and members cannot create an archive.

## Included data

The archive contains the selected club record and its tenant-scoped configuration, memberships, dogs, care records, dog photographs, grooming setup and history, visit history, membership plans and derived payment records, admission records, household grants, staff records and audit history.

Its `accounts` section contains only the IDs and email addresses required to identify accounts referenced by the operator data. It does not contain authentication material.

## Deliberate exclusions

The archive never contains:

- password hashes, login sessions or failed-login counters;
- onboarding, staff, household or password-recovery tokens;
- raw Stripe webhook payloads or processing errors;
- hosted Stripe Checkout and invoice URLs;
- admission pass bearer codes.

Admission pass records retain their history, but restore generates replacement codes and marks every restored pass inactive. Members must receive newly issued passes after the operator is restored.

## Create and verify an archive

1. Sign in as a platform owner and open the operator in the platform console.
2. Choose **Download operator archive**.
3. Store the downloaded JSON in the operator's approved encrypted offboarding location. Treat it as personal and special-category-adjacent operational data because it can include contact details, private dog care notes and photographs.
4. Parse the file and call `validateOperatorExport` before accepting or moving it. Validation checks the format, schema version, exact table allowlist, tenant boundary, credential exclusions, record count and SHA-256 digest.

The archive is a point-in-time snapshot. Creating it does not close the operator, delete data or stop new transactions.

## Restore procedure

Restoration is an engineer-operated recovery procedure, not a self-service web action.

1. Provision a clean destination database and apply the complete migration set in filename order. Do not use `supabase db push` against an existing environment; this repository's historic migration filenames do not match the production ledger.
2. Restore and verify the identity-provider accounts separately. Every `{id, email}` pair in the archive must already exist exactly in `accounts`. Create no shared or synthetic production passwords; use the approved identity recovery process.
3. Provision the engineer performing the restore as a platform owner.
4. Run `validateOperatorExport` and retain its SHA-256 value in the change record.
5. Call `restoreOperatorExport(db, platformOwnerId, parsedArchive)` from a controlled one-off server-side runner. The destination must not already contain the club ID. The operation is transactional: any missing identity or relational failure rolls back the whole operator.
6. Confirm the returned club ID and record count, and compare per-table counts with the archive manifest.
7. Verify that restored admission passes are inactive. Reissue passes only after the operator confirms member access.
8. Test platform-owner access, manager access, one known member and dog, one booking, one photograph and any applicable Stripe-derived invoice history. Do not enable live payments until the destination Stripe account and webhook endpoint have been independently reconnected and checked.
9. Retain the `restore.completed` audit event and the approved change record.

Automated tests rehearse a full export into a separately migrated PGlite database, including binary dog-photo data, identity prerequisites, tenant integrity, credential removal, inactive replacement admission passes and transactional failure when an identity is missing.

## Offboarding order

1. Move the operator to `restricted` when new membership and staff growth must stop while existing obligations are resolved.
2. Reconcile bookings, visits, member subscriptions, credits, invoices, refunds and any statutory retention requirements.
3. Create the final archive, validate it and record its SHA-256 digest and approved storage location.
4. Move the operator to `closed` only after the export and obligations have been reviewed. Closure removes ordinary tenant and public-profile access without deleting records.
5. Retain or delete live records only under the agreed UK GDPR retention schedule and a separately approved deletion procedure. This feature does not perform deletion.
