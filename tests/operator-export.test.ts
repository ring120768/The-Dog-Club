import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { hashPassword, initialise, type Db } from "../src/lib/database";
import { migrate } from "../src/lib/migrations";
import {
  createOperatorExport,
  restoreOperatorExport,
  validateOperatorExport,
} from "../src/lib/operator-export";

let source: Db;

before(async () => {
  source = await initialise(await PGlite.create());
  await source.query(
    `INSERT INTO dog_photos(id,club_id,dog_id,content,width,height)
     VALUES('00000000-0000-4000-8000-000000000902','willow','00000000-0000-4000-8000-000000000001',$1,1,1)`,
    [Buffer.from("synthetic-photo")],
  );
  await source.exec(
    `INSERT INTO admission_passes(id,club_id,account_id,code,active)
     VALUES('00000000-0000-4000-8000-000000000901','willow','alice','ABCDEF0123456789',true);
     INSERT INTO membership_plans(
       id,club_id,name,monthly_price_pence,inclusions,limits_text,
       additional_dog_terms,renewal_terms,cancellation_terms
     ) VALUES(
       '00000000-0000-4000-8000-000000000903','willow','Archive plan',2500,
       'Synthetic plan','Synthetic limits','Synthetic dog terms',
       'Synthetic renewal terms','Synthetic cancellation terms'
     );
     INSERT INTO membership_checkout_sessions(
       id,club_id,account_id,plan_id,provider_account_id,provider_session_id,
       checkout_url,status
     ) VALUES(
       '00000000-0000-4000-8000-000000000904','willow','alice',
       '00000000-0000-4000-8000-000000000903','acct_SyntheticArchive',
       'cs_synthetic_archive','https://checkout.stripe.test/private-session','open'
     );
     INSERT INTO membership_invoices(
       provider_account_id,provider_invoice_id,club_id,provider_subscription_id,
       status,amount_due,amount_paid,currency,period_starts_on,period_ends_on,
       hosted_invoice_url
     ) VALUES(
       'acct_SyntheticArchive','in_synthetic_archive','willow','sub_synthetic_archive',
       'paid',2500,2500,'gbp','2099-01-01','2099-02-01',
       'https://invoice.stripe.test/private-invoice'
     )`,
  );
});

after(async () => source.close());

test("platform export is tenant-bound, integrity checked and credential-free", async () => {
  await assert.rejects(
    createOperatorExport(source, "alice", "willow"),
    /Platform access is required/,
  );
  const archive = await createOperatorExport(
    source,
    "platform-owner",
    "willow",
  );
  assert.equal(validateOperatorExport(archive).clubId, "willow");
  assert.equal(archive.tables.clubs.length, 1);
  assert.equal(archive.tables.dog_photos.length, 1);
  assert.equal(archive.tables.admission_passes[0].code, undefined);
  assert.equal(
    archive.tables.membership_checkout_sessions[0].checkout_url,
    null,
  );
  assert.equal(archive.tables.membership_invoices[0].hosted_invoice_url, null);
  assert.deepEqual(archive.tables.service_checkout_sessions, []);
  assert.deepEqual(archive.tables.service_payments, []);
  assert.deepEqual(archive.tables.service_payment_exceptions, []);
  assert.equal(archive.tables.clubs[0].id, "willow");
  assert.ok(
    archive.accounts.every(
      (account) => Object.keys(account).sort().join(",") === "email,id",
    ),
  );
  const serialised = JSON.stringify(archive);
  for (const forbidden of [
    "password_hash",
    "token_hash",
    "payment_webhook_events",
    "ABCDEF0123456789",
    "private-session",
    "private-invoice",
  ])
    assert.equal(serialised.includes(forbidden), false, forbidden);

  const tampered = structuredClone(archive);
  tampered.tables.clubs[0].name = "Tampered";
  assert.throws(
    () => validateOperatorExport(tampered),
    /integrity check failed/,
  );
});

test("archive restores transactionally into a migrated database with verified identities", async () => {
  const archive = await createOperatorExport(
    source,
    "platform-owner",
    "willow",
  );
  const destination = (await PGlite.create()) as unknown as Db;
  await migrate(destination);
  await destination.query(
    "INSERT INTO accounts(id,email,password_hash) VALUES($1,$2,$3)",
    [
      "restore-admin",
      "restore-admin@test.invalid",
      hashPassword("Test-only-password-26"),
    ],
  );
  await destination.exec("INSERT INTO platform_owners VALUES('restore-admin')");
  for (const account of archive.accounts)
    await destination.query(
      "INSERT INTO accounts(id,email,password_hash) VALUES($1,$2,$3)",
      [account.id, account.email, hashPassword("Reset-required-password-26")],
    );

  const restored = await restoreOperatorExport(
    destination,
    "restore-admin",
    archive,
  );
  assert.equal(restored.clubId, "willow");
  assert.equal(
    (await destination.query("SELECT 1 FROM dogs WHERE club_id='willow'")).rows
      .length,
    2,
  );
  const pass = (
    await destination.query<{ code: string; active: boolean }>(
      "SELECT code,active FROM admission_passes WHERE club_id='willow'",
    )
  ).rows[0];
  assert.match(pass.code, /^[A-F0-9]{16}$/);
  assert.notEqual(pass.code, "ABCDEF0123456789");
  assert.equal(pass.active, false);
  assert.equal(
    (
      await destination.query<{ count: string }>(
        "SELECT count(*) FROM operator_export_events WHERE club_id='willow' AND action='restore.completed'",
      )
    ).rows[0].count,
    1,
  );
  await destination.close();
});

test("restore refuses missing identity prerequisites before writing the club", async () => {
  const archive = await createOperatorExport(
    source,
    "platform-owner",
    "willow",
  );
  const destination = (await PGlite.create()) as unknown as Db;
  await migrate(destination);
  await destination.query(
    "INSERT INTO accounts(id,email,password_hash) VALUES($1,$2,$3)",
    [
      "restore-admin",
      "restore-admin@test.invalid",
      hashPassword("Test-only-password-26"),
    ],
  );
  await destination.exec("INSERT INTO platform_owners VALUES('restore-admin')");
  await assert.rejects(
    restoreOperatorExport(destination, "restore-admin", archive),
    /Pre-provision matching identity/,
  );
  assert.equal((await destination.query("SELECT 1 FROM clubs")).rows.length, 0);
  await destination.close();
});
