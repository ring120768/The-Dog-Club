import { createHash, randomBytes } from "node:crypto";
import type { Db, Queryable } from "./database";

const format = "dog-club-operator-export" as const;
const schemaVersion = 2 as const;

// This order is both the archive contract and the foreign-key-safe restore order.
// Tables containing credentials, invitation/recovery tokens or raw webhook payloads
// are deliberately absent. Admission pass bearer codes are removed separately below.
export const operatorExportTables = [
  "clubs",
  "memberships",
  "club_locations",
  "dogs",
  "care_notes",
  "dog_photos",
  "audit_events",
  "club_config_events",
  "dog_applications",
  "application_events",
  "membership_plans",
  "member_subscriptions",
  "benefit_ledger",
  "subscription_events",
  "club_payment_accounts",
  "membership_checkout_sessions",
  "stripe_subscription_links",
  "membership_invoices",
  "grooming_services",
  "grooming_resources",
  "staff_members",
  "staff_service_qualifications",
  "published_shifts",
  "shift_breaks",
  "resource_closures",
  "grooming_bookings",
  "booking_events",
  "service_checkout_sessions",
  "service_payments",
  "service_payment_exceptions",
  "grooming_visits",
  "visit_events",
  "notification_outbox",
  "admission_settings",
  "admission_passes",
  "dog_admission_eligibilities",
  "dog_admission_events",
  "admission_visits",
  "admission_visit_dogs",
  "admission_events",
  "household_adult_grants",
  "household_events",
  "staff_access_events",
  "operator_lifecycle_events",
  "operator_export_events",
] as const;

type ExportTable = (typeof operatorExportTables)[number];
type JsonRow = Record<string, unknown>;

export type OperatorExport = {
  format: typeof format;
  schemaVersion: typeof schemaVersion;
  generatedAt: string;
  clubId: string;
  accounts: Array<{ id: string; email: string }>;
  tables: Record<ExportTable, JsonRow[]>;
  omissions: string[];
  integrity: { algorithm: "sha256"; sha256: string; recordCount: number };
};

export class OperatorExportError extends Error {}

const identityTables = new Set<ExportTable>([
  "audit_events",
  "club_config_events",
  "application_events",
  "booking_events",
  "visit_events",
  "subscription_events",
  "dog_admission_events",
  "admission_events",
  "household_events",
  "staff_access_events",
  "operator_lifecycle_events",
  "operator_export_events",
]);

const omissions = [
  "Authentication credentials, sessions and login-attempt records",
  "Pending onboarding, staff and household invitation tokens",
  "Password-recovery requests and tokens",
  "Raw payment-webhook payloads and processing errors",
  "Hosted Stripe Checkout and invoice URLs",
  "Admission pass bearer codes; restored passes are inactive and must be reissued",
];

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(payload: unknown) {
  return createHash("sha256").update(canonical(payload)).digest("hex");
}

async function requirePlatformOwner(tx: Queryable, actorId: string) {
  const owner = await tx.query(
    "SELECT 1 FROM platform_owners WHERE account_id=$1",
    [actorId],
  );
  if (!owner.rows.length)
    throw new OperatorExportError("Platform access is required.");
}

async function rowsFor(
  tx: Queryable,
  table: ExportTable,
  clubId: string,
): Promise<JsonRow[]> {
  const where = table === "clubs" ? "t.id=$1" : "t.club_id=$1";
  const projection =
    table === "admission_passes"
      ? "to_jsonb(t)-'code' AS data"
      : table === "membership_checkout_sessions" ||
          table === "service_checkout_sessions"
        ? "jsonb_set(to_jsonb(t),'{checkout_url}','null'::jsonb) AS data"
        : table === "membership_invoices"
          ? "jsonb_set(to_jsonb(t),'{hosted_invoice_url}','null'::jsonb) AS data"
          : "to_jsonb(t) AS data";
  return (
    await tx.query<{ data: JsonRow }>(
      `SELECT ${projection} FROM ${table} t WHERE ${where} ORDER BY to_jsonb(t)::text`,
      [clubId],
    )
  ).rows.map(({ data }) => data);
}

function referencedAccountIds(tables: Record<ExportTable, JsonRow[]>) {
  const values = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "string") values.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object")
      Object.values(value).forEach(visit);
  };
  Object.values(tables).forEach(visit);
  return values;
}

export async function createOperatorExport(
  db: Db,
  actorId: string,
  clubId: string,
): Promise<OperatorExport> {
  return db.transaction(async (tx) => {
    await requirePlatformOwner(tx, actorId);
    const tables = {} as Record<ExportTable, JsonRow[]>;
    for (const table of operatorExportTables)
      tables[table] = await rowsFor(tx, table, clubId);
    if (tables.clubs.length !== 1)
      throw new OperatorExportError("Operator was not found.");

    const referenced = referencedAccountIds(tables);
    const accounts = (
      await tx.query<{ id: string; email: string }>(
        "SELECT id,email FROM accounts ORDER BY id",
      )
    ).rows.filter((account) => referenced.has(account.id));
    const generatedAt = new Date().toISOString();
    const recordCount =
      accounts.length +
      Object.values(tables).reduce((sum, rows) => sum + rows.length, 0);
    const payload = {
      format,
      schemaVersion,
      generatedAt,
      clubId,
      accounts,
      tables,
      omissions,
    };
    const sha256 = digest(payload);
    await tx.query(
      `INSERT INTO operator_export_events(club_id,actor_id,action,archive_sha256,record_count,details)
       VALUES($1,$2,'export.created',$3,$4,$5::jsonb)`,
      [clubId, actorId, sha256, recordCount, JSON.stringify({ schemaVersion })],
    );
    return {
      ...payload,
      integrity: { algorithm: "sha256", sha256, recordCount },
    };
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateOperatorExport(value: unknown): OperatorExport {
  if (!isObject(value))
    throw new OperatorExportError("Archive is not an object.");
  if (value.format !== format || value.schemaVersion !== schemaVersion)
    throw new OperatorExportError(
      "Archive format or schema version is unsupported.",
    );
  if (typeof value.clubId !== "string" || typeof value.generatedAt !== "string")
    throw new OperatorExportError("Archive identity is invalid.");
  if (!Array.isArray(value.accounts) || !isObject(value.tables))
    throw new OperatorExportError("Archive records are invalid.");
  if (
    Object.keys(value.tables).sort().join("|") !==
    [...operatorExportTables].sort().join("|")
  )
    throw new OperatorExportError("Archive table set is invalid.");
  const tables = value.tables as Record<ExportTable, unknown>;
  for (const table of operatorExportTables) {
    const rows = tables[table];
    if (!Array.isArray(rows) || rows.some((row) => !isObject(row)))
      throw new OperatorExportError(`Archive table ${table} is invalid.`);
    for (const row of rows) {
      const rowClub = table === "clubs" ? row.id : row.club_id;
      if (rowClub !== value.clubId)
        throw new OperatorExportError(
          `Archive table ${table} crosses a tenant boundary.`,
        );
      if ("password_hash" in row || "token_hash" in row || "code" in row)
        throw new OperatorExportError(
          `Archive table ${table} contains a credential.`,
        );
    }
  }
  if ((tables.clubs as unknown[]).length !== 1)
    throw new OperatorExportError("Archive must contain exactly one operator.");
  for (const account of value.accounts) {
    if (
      !isObject(account) ||
      typeof account.id !== "string" ||
      typeof account.email !== "string" ||
      Object.keys(account).some((key) => key !== "id" && key !== "email")
    )
      throw new OperatorExportError("Archive account directory is invalid.");
  }
  if (!Array.isArray(value.omissions) || !isObject(value.integrity))
    throw new OperatorExportError("Archive manifest is invalid.");
  const payload = {
    format: value.format,
    schemaVersion: value.schemaVersion,
    generatedAt: value.generatedAt,
    clubId: value.clubId,
    accounts: value.accounts,
    tables: value.tables,
    omissions: value.omissions,
  };
  const expectedCount =
    value.accounts.length +
    operatorExportTables.reduce(
      (sum, table) =>
        sum + (value.tables as Record<string, unknown[]>)[table].length,
      0,
    );
  if (
    value.integrity.algorithm !== "sha256" ||
    value.integrity.recordCount !== expectedCount ||
    value.integrity.sha256 !== digest(payload)
  )
    throw new OperatorExportError("Archive integrity check failed.");
  return value as OperatorExport;
}

export async function restoreOperatorExport(
  db: Db,
  actorId: string,
  candidate: unknown,
) {
  const archive = validateOperatorExport(candidate);
  return db.transaction(async (tx) => {
    await requirePlatformOwner(tx, actorId);
    if (
      (await tx.query("SELECT 1 FROM clubs WHERE id=$1", [archive.clubId])).rows
        .length
    )
      throw new OperatorExportError(
        "Destination already contains this operator.",
      );

    for (const account of archive.accounts) {
      const existing = (
        await tx.query<{ email: string }>(
          "SELECT email FROM accounts WHERE id=$1",
          [account.id],
        )
      ).rows[0];
      if (!existing || existing.email !== account.email)
        throw new OperatorExportError(
          `Pre-provision matching identity ${account.id} before restore.`,
        );
    }

    for (const table of operatorExportTables) {
      let rows = archive.tables[table];
      if (table === "admission_passes")
        rows = rows.map((row) => ({
          ...row,
          code: randomBytes(8).toString("hex").toUpperCase(),
          active: false,
        }));
      if (!rows.length) continue;
      const overriding = identityTables.has(table)
        ? " OVERRIDING SYSTEM VALUE"
        : "";
      await tx.query(
        `INSERT INTO ${table}${overriding} SELECT * FROM json_populate_recordset(NULL::${table},$1::json)`,
        [JSON.stringify(rows)],
      );
    }

    for (const table of identityTables) {
      await tx.exec(
        `SELECT setval(pg_get_serial_sequence('${table}','id'),COALESCE((SELECT MAX(id) FROM ${table}),0)+1,false)`,
      );
    }
    await tx.query(
      `INSERT INTO operator_export_events(club_id,actor_id,action,archive_sha256,record_count,details)
       VALUES($1,$2,'restore.completed',$3,$4,$5::jsonb)`,
      [
        archive.clubId,
        actorId,
        archive.integrity.sha256,
        archive.integrity.recordCount,
        JSON.stringify({ schemaVersion: archive.schemaVersion }),
      ],
    );
    return {
      clubId: archive.clubId,
      recordCount: archive.integrity.recordCount,
    };
  });
}
