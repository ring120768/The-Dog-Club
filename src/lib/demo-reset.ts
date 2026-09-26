import { z } from "zod";
import type { Db, Queryable } from "./database";
import { isDemoMode, type RuntimeEnvironment } from "./runtime";

const clubId = z.string().trim().min(1).max(100);

export class DemoResetError extends Error {}

export type DemoResetResult = {
  club: string;
  removedRecords: number;
  bookings: number;
  groomingVisits: number;
  payments: number;
  admissionVisits: number;
  creditEntries: number;
};

async function remove(tx: Queryable, table: string, club: string, extra = "") {
  const result = await tx.query<{ id: string }>(
    `DELETE FROM ${table} WHERE club_id=$1 ${extra} RETURNING id`,
    [club],
  );
  return result.rows.length;
}

export async function resetDemoActivity(
  db: Db,
  actor: string,
  requestedClub: string,
  environment: RuntimeEnvironment = process.env,
): Promise<DemoResetResult> {
  if (!isDemoMode(environment) || environment.DOGCLUB_DB === "supabase")
    throw new DemoResetError("Demo reset is unavailable in this environment.");
  const club = clubId.parse(requestedClub);

  return db.transaction(async (tx) => {
    const owner = await tx.query(
      "SELECT 1 FROM platform_owners WHERE account_id=$1",
      [actor],
    );
    if (!owner.rows.length)
      throw new DemoResetError("Platform access is required.");

    const tenant = (
      await tx.query<{ members: number; non_demo_members: number }>(
        `SELECT count(m.account_id)::int AS members,
         count(m.account_id) FILTER (WHERE a.email !~* '^[^@]+@demo\\.invalid$')::int AS non_demo_members
         FROM clubs c
         LEFT JOIN memberships m ON m.club_id=c.id
         LEFT JOIN accounts a ON a.id=m.account_id
         WHERE c.id=$1 GROUP BY c.id`,
        [club],
      )
    ).rows[0];
    if (!tenant) throw new DemoResetError("That demo club was not found.");
    if (!tenant.members || tenant.non_demo_members)
      throw new DemoResetError(
        "Reset is limited to clubs containing only synthetic demo accounts.",
      );

    let removedRecords = 0;
    removedRecords += await remove(tx, "service_payment_exceptions", club);
    const payments = await remove(tx, "service_payments", club);
    removedRecords += payments;
    removedRecords += await remove(tx, "service_checkout_sessions", club);
    removedRecords += await remove(tx, "notification_outbox", club);
    removedRecords += await remove(tx, "visit_events", club);
    const groomingVisits = await remove(tx, "grooming_visits", club);
    removedRecords += groomingVisits;
    removedRecords += await remove(tx, "booking_events", club);
    const creditEntries = await remove(
      tx,
      "benefit_ledger",
      club,
      "AND idempotency_key LIKE 'booking:%:grooming-credit%'",
    );
    removedRecords += creditEntries;
    const bookings = await remove(tx, "grooming_bookings", club);
    removedRecords += bookings;
    removedRecords += await remove(tx, "admission_events", club);
    removedRecords += (
      await tx.query<{ visit_id: string }>(
        "DELETE FROM admission_visit_dogs WHERE club_id=$1 RETURNING visit_id",
        [club],
      )
    ).rows.length;
    const admissionVisits = await remove(tx, "admission_visits", club);
    removedRecords += admissionVisits;

    return {
      club,
      removedRecords,
      bookings,
      groomingVisits,
      payments,
      admissionVisits,
      creditEntries,
    };
  });
}
