import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scoped, type Db, type Queryable } from "./database";
import { OnboardingError } from "./onboarding";
import { visitStatuses, type VisitStatus } from "./visit-contract";
export type { VisitStatus } from "./visit-contract";

export type GroomingVisit = {
  id: string;
  club_id: string;
  booking_id: string;
  status: VisitStatus;
  authorised_collector_name: string;
  collection_verified: boolean;
  arrived_at: string;
  updated_at: string;
  collected_at: string | null;
  version: number;
  dog_name: string;
  service_name: string;
  starts_at: string;
  notification_status: "manual_required" | null;
};

export type VisitEvent = {
  id: number;
  visit_id: string;
  action: "visit.arrived" | "visit.progressed" | "visit.corrected";
  from_status: VisitStatus | null;
  to_status: VisitStatus;
  reason: string;
  created_at: string;
};

async function requireManager(tx: Queryable, actor: string, club: string) {
  const allowed = await tx.query(
    "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2 AND role='manager'",
    [club, actor],
  );
  if (!allowed.rows.length)
    throw new OnboardingError("Manager access required.");
}

export async function visitsFor(db: Db, actor: string, club: string) {
  return scoped(db, actor, club, false, async (tx) => {
    const visits = await tx.query<GroomingVisit>(
      `SELECT v.*,d.name AS dog_name,s.name AS service_name,b.starts_at,
       (SELECT n.delivery_status FROM notification_outbox n WHERE n.club_id=v.club_id AND n.visit_id=v.id AND n.kind='groom_ready') AS notification_status
       FROM grooming_visits v
       JOIN grooming_bookings b ON b.club_id=v.club_id AND b.id=v.booking_id
       JOIN dogs d ON d.club_id=b.club_id AND d.id=b.dog_id
       JOIN grooming_services s ON s.club_id=b.club_id AND s.id=b.service_id
       ORDER BY b.starts_at`,
    );
    const events = await tx.query<VisitEvent>(
      "SELECT id,visit_id,action,from_status,to_status,reason,created_at FROM visit_events ORDER BY id",
    );
    return { visits: visits.rows, events: events.rows };
  });
}

export async function arriveForBooking(
  db: Db,
  actor: string,
  club: string,
  booking: string,
) {
  z.uuid().parse(booking);
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const booked = await tx.query(
      "SELECT id FROM grooming_bookings WHERE club_id=$1 AND id=$2 AND status='confirmed' FOR UPDATE",
      [club, booking],
    );
    if (!booked.rows.length)
      throw new OnboardingError("Confirmed booking unavailable.");
    const existing = await tx.query<GroomingVisit>(
      "SELECT * FROM grooming_visits WHERE club_id=$1 AND booking_id=$2",
      [club, booking],
    );
    if (existing.rows[0]) return existing.rows[0];
    const id = randomUUID();
    const visit = await tx.query<GroomingVisit>(
      "INSERT INTO grooming_visits(id,club_id,booking_id) VALUES($1,$2,$3) RETURNING *",
      [id, club, booking],
    );
    await tx.query(
      "INSERT INTO visit_events(club_id,visit_id,actor_id,action,to_status) VALUES($1,$2,$3,'visit.arrived','arrived')",
      [club, id, actor],
    );
    return visit.rows[0];
  });
}

const nextStatus: Record<VisitStatus, VisitStatus | null> = {
  arrived: "handed_over",
  handed_over: "in_progress",
  in_progress: "ready",
  ready: "collected",
  collected: null,
};

async function queueReadyContact(tx: Queryable, club: string, visit: string) {
  await tx.query(
    `INSERT INTO notification_outbox(id,club_id,visit_id,recipient_account_id,kind)
     SELECT $1,$2,$3,d.owner_id,'groom_ready' FROM grooming_visits v
     JOIN grooming_bookings b ON b.club_id=v.club_id AND b.id=v.booking_id
     JOIN dogs d ON d.club_id=b.club_id AND d.id=b.dog_id
     WHERE v.club_id=$2 AND v.id=$3 ON CONFLICT(club_id,visit_id,kind) DO NOTHING`,
    [randomUUID(), club, visit],
  );
}

export async function progressVisit(
  db: Db,
  actor: string,
  club: string,
  visit: string,
  target: VisitStatus,
  input: unknown,
) {
  z.uuid().parse(visit);
  const to = z.enum(visitStatuses).parse(target);
  const data = z
    .object({
      collector_name: z.string().trim().max(100).default(""),
      collector_verified: z.string().optional(),
    })
    .parse(input);
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const current = (
      await tx.query<GroomingVisit>(
        "SELECT * FROM grooming_visits WHERE club_id=$1 AND id=$2 FOR UPDATE",
        [club, visit],
      )
    ).rows[0];
    if (!current) throw new OnboardingError("Visit unavailable.");
    if (current.status === to) return current;
    if (nextStatus[current.status] !== to)
      throw new OnboardingError("Complete the visit steps in order.");
    const collector =
      to === "handed_over"
        ? z.string().trim().min(2).max(100).parse(data.collector_name)
        : current.authorised_collector_name;
    if (to === "collected" && data.collector_verified !== "yes")
      throw new OnboardingError(
        "Confirm that the collecting adult matches the authorisation.",
      );
    const updated = await tx.query<GroomingVisit>(
      `UPDATE grooming_visits SET status=$1,authorised_collector_name=$2,
       collection_verified=CASE WHEN $1='collected' THEN true ELSE collection_verified END,
       collected_at=CASE WHEN $1='collected' THEN now() ELSE collected_at END,
       updated_at=now(),version=version+1 WHERE club_id=$3 AND id=$4 RETURNING *`,
      [to, collector, club, visit],
    );
    await tx.query(
      "INSERT INTO visit_events(club_id,visit_id,actor_id,action,from_status,to_status) VALUES($1,$2,$3,'visit.progressed',$4,$5)",
      [club, visit, actor, current.status, to],
    );
    if (to === "ready") await queueReadyContact(tx, club, visit);
    return updated.rows[0];
  });
}

export async function correctVisit(
  db: Db,
  actor: string,
  club: string,
  visit: string,
  input: unknown,
) {
  z.uuid().parse(visit);
  const data = z
    .object({
      status: z.enum(visitStatuses),
      reason: z.string().trim().min(3).max(500),
    })
    .parse(input);
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const current = (
      await tx.query<GroomingVisit>(
        "SELECT * FROM grooming_visits WHERE club_id=$1 AND id=$2 FOR UPDATE",
        [club, visit],
      )
    ).rows[0];
    if (!current) throw new OnboardingError("Visit unavailable.");
    if (current.status === data.status)
      throw new OnboardingError("Choose a different state to correct.");
    if (data.status === "collected")
      throw new OnboardingError(
        "Use verified collection rather than correcting into collected.",
      );
    if (
      ["handed_over", "in_progress", "ready"].includes(data.status) &&
      !current.authorised_collector_name
    )
      throw new OnboardingError(
        "Record the authorised collection adult before using that state.",
      );
    const updated = await tx.query<GroomingVisit>(
      `UPDATE grooming_visits SET status=$1,collection_verified=false,collected_at=NULL,
       updated_at=now(),version=version+1 WHERE club_id=$2 AND id=$3 RETURNING *`,
      [data.status, club, visit],
    );
    await tx.query(
      "INSERT INTO visit_events(club_id,visit_id,actor_id,action,from_status,to_status,reason) VALUES($1,$2,$3,'visit.corrected',$4,$5,$6)",
      [club, visit, actor, current.status, data.status, data.reason],
    );
    if (data.status === "ready") await queueReadyContact(tx, club, visit);
    return updated.rows[0];
  });
}
