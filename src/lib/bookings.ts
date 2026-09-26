import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scoped, type Db, type Queryable } from "./database";
import { OnboardingError } from "./onboarding";

export type GroomingService = {
  id: string;
  club_id: string;
  name: string;
  duration_minutes: number;
  cleanup_minutes: number;
  price_pence: number;
  cancellation_terms: string;
  active: boolean;
};

export type GroomingBooking = {
  id: string;
  club_id: string;
  dog_id: string;
  service_id: string;
  resource_id: string;
  staff_id: string;
  starts_at: string;
  service_ends_at: string;
  busy_ends_at: string;
  status: "confirmed" | "cancelled";
  price_pence_snapshot: number;
  cancellation_terms_snapshot: string;
  cancellation_reason: string;
  version: number;
  dog_name?: string;
  service_name?: string;
  resource_name?: string;
};

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeInput = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const optionalTime = z.union([timeInput, z.literal("")]);

const minutes = (time: string) => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};

async function requireManager(tx: Queryable, actor: string, club: string) {
  const allowed = await tx.query(
    "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2 AND role='manager'",
    [club, actor],
  );
  if (!allowed.rows.length)
    throw new OnboardingError("Manager access required.");
}

async function requireEligibleDog(
  tx: Queryable,
  actor: string,
  club: string,
  dog: string,
) {
  const eligible = await tx.query(
    `SELECT d.id FROM dogs d
     JOIN memberships m ON m.club_id=d.club_id AND m.account_id=d.owner_id
     JOIN dog_applications a ON a.club_id=d.club_id AND a.dog_id=d.id AND a.activity='grooming' AND a.status='approved'
     WHERE d.club_id=$1 AND d.id=$2 AND d.owner_id=$3`,
    [club, dog, actor],
  );
  if (!eligible.rows.length)
    throw new OnboardingError(
      "This dog is not approved for grooming bookings.",
    );
}

export async function createBookingSetup(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({
      service_name: z.string().trim().min(2).max(100),
      resource_name: z.string().trim().min(2).max(100),
      duration_minutes: z.coerce.number().int().min(15).max(480),
      cleanup_minutes: z.coerce.number().int().min(0).max(120),
      price_pounds: z.string().regex(/^\d{1,5}(\.\d{1,2})?$/),
      cancellation_terms: z.string().trim().min(1).max(1000),
      date: dateInput,
      starts_at: timeInput,
      ends_at: timeInput,
      break_starts_at: optionalTime.default(""),
      break_ends_at: optionalTime.default(""),
    })
    .parse(input);
  if (data.duration_minutes % 15 || data.cleanup_minutes % 15)
    throw new OnboardingError(
      "Duration and clean-up must use 15-minute increments.",
    );
  const shiftStart = minutes(data.starts_at);
  const shiftEnd = minutes(data.ends_at);
  if (shiftEnd <= shiftStart)
    throw new OnboardingError("The shift must end after it starts.");
  const hasBreak = !!data.break_starts_at || !!data.break_ends_at;
  if (hasBreak) {
    if (!data.break_starts_at || !data.break_ends_at)
      throw new OnboardingError("Add both break times or leave both blank.");
    const breakStart = minutes(data.break_starts_at);
    const breakEnd = minutes(data.break_ends_at);
    if (
      breakStart < shiftStart ||
      breakEnd > shiftEnd ||
      breakEnd <= breakStart
    )
      throw new OnboardingError("The break must sit inside the shift.");
  }
  const pricePence = Math.round(Number(data.price_pounds) * 100);
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const serviceId = randomUUID();
    const resourceId = randomUUID();
    const shiftId = randomUUID();
    await tx.query(
      "INSERT INTO grooming_services(id,club_id,name,duration_minutes,cleanup_minutes,price_pence,cancellation_terms) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        serviceId,
        club,
        data.service_name,
        data.duration_minutes,
        data.cleanup_minutes,
        pricePence,
        data.cancellation_terms,
      ],
    );
    await tx.query(
      "INSERT INTO grooming_resources(id,club_id,name) VALUES($1,$2,$3)",
      [resourceId, club, data.resource_name],
    );
    await tx.query(
      "INSERT INTO staff_service_qualifications(club_id,account_id,service_id) VALUES($1,$2,$3)",
      [club, actor, serviceId],
    );
    await tx.query(
      `INSERT INTO published_shifts(id,club_id,staff_id,starts_at,ends_at)
       VALUES($1,$2,$3,($4||' '||$5)::timestamp AT TIME ZONE 'Europe/London',($4||' '||$6)::timestamp AT TIME ZONE 'Europe/London')`,
      [shiftId, club, actor, data.date, data.starts_at, data.ends_at],
    );
    if (hasBreak)
      await tx.query(
        `INSERT INTO shift_breaks(id,club_id,shift_id,starts_at,ends_at)
         VALUES($1,$2,$3,($4||' '||$5)::timestamp AT TIME ZONE 'Europe/London',($4||' '||$6)::timestamp AT TIME ZONE 'Europe/London')`,
        [
          randomUUID(),
          club,
          shiftId,
          data.date,
          data.break_starts_at,
          data.break_ends_at,
        ],
      );
    return { serviceId, resourceId, shiftId };
  });
}

export async function closeResource(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({
      resource_id: z.uuid(),
      date: dateInput,
      starts_at: timeInput,
      ends_at: timeInput,
      reason: z.string().trim().min(1).max(500),
    })
    .parse(input);
  if (minutes(data.ends_at) <= minutes(data.starts_at))
    throw new OnboardingError("The closure must end after it starts.");
  await db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const resource = await tx.query(
      "SELECT id FROM grooming_resources WHERE club_id=$1 AND id=$2 FOR UPDATE",
      [club, data.resource_id],
    );
    if (!resource.rows.length)
      throw new OnboardingError("Resource unavailable.");
    await tx.query(
      `INSERT INTO resource_closures(id,club_id,resource_id,starts_at,ends_at,reason)
       VALUES($1,$2,$3,($4||' '||$5)::timestamp AT TIME ZONE 'Europe/London',($4||' '||$6)::timestamp AT TIME ZONE 'Europe/London',$7)`,
      [
        randomUUID(),
        club,
        data.resource_id,
        data.date,
        data.starts_at,
        data.ends_at,
        data.reason,
      ],
    );
  });
}

export async function activeServices(db: Db, actor: string, club: string) {
  return scoped(
    db,
    actor,
    club,
    false,
    async (tx) =>
      (
        await tx.query<GroomingService>(
          "SELECT * FROM grooming_services WHERE active ORDER BY name",
        )
      ).rows,
  );
}

export async function bookingSetupFor(db: Db, actor: string, club: string) {
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const [services, resources, shifts, closures] = await Promise.all([
      tx.query<GroomingService>(
        "SELECT * FROM grooming_services WHERE club_id=$1 ORDER BY name",
        [club],
      ),
      tx.query<{ id: string; name: string; active: boolean }>(
        "SELECT id,name,active FROM grooming_resources WHERE club_id=$1 ORDER BY name",
        [club],
      ),
      tx.query<{
        id: string;
        starts_at: string;
        ends_at: string;
        status: string;
      }>(
        "SELECT id,starts_at,ends_at,status FROM published_shifts WHERE club_id=$1 ORDER BY starts_at",
        [club],
      ),
      tx.query<{
        resource_id: string;
        starts_at: string;
        ends_at: string;
        reason: string;
      }>(
        "SELECT resource_id,starts_at,ends_at,reason FROM resource_closures WHERE club_id=$1 ORDER BY starts_at",
        [club],
      ),
    ]);
    return {
      services: services.rows,
      resources: resources.rows,
      shifts: shifts.rows,
      closures: closures.rows,
    };
  });
}

export async function availabilityFor(
  db: Db,
  actor: string,
  club: string,
  dog: string,
  service: string,
  date: string,
) {
  z.uuid().parse(dog);
  z.uuid().parse(service);
  dateInput.parse(date);
  return db.transaction(async (tx) => {
    await requireEligibleDog(tx, actor, club, dog);
    const item = (
      await tx.query<GroomingService>(
        "SELECT * FROM grooming_services WHERE club_id=$1 AND id=$2 AND active",
        [club, service],
      )
    ).rows[0];
    if (!item) throw new OnboardingError("Service unavailable.");
    const busyMinutes = item.duration_minutes + item.cleanup_minutes;
    const slots = await tx.query<{ starts_at: string; local_time: string }>(
      `WITH candidates AS (
       SELECT gs AS starts_at,s.staff_id,r.id AS resource_id
       FROM published_shifts s
       JOIN staff_service_qualifications q ON q.club_id=s.club_id AND q.account_id=s.staff_id AND q.service_id=$2
       JOIN memberships m ON m.club_id=s.club_id AND m.account_id=s.staff_id AND m.role='manager'
       CROSS JOIN grooming_resources r
       CROSS JOIN LATERAL generate_series(s.starts_at,s.ends_at-($4*interval '1 minute'),interval '15 minutes') gs
       WHERE s.club_id=$1 AND s.status='published' AND r.club_id=s.club_id AND r.active
       AND (gs AT TIME ZONE 'Europe/London')::date=$3::date AND gs>now()
       AND NOT EXISTS(SELECT 1 FROM shift_breaks b WHERE b.club_id=s.club_id AND b.shift_id=s.id AND b.starts_at<gs+($4*interval '1 minute') AND b.ends_at>gs)
       AND NOT EXISTS(SELECT 1 FROM resource_closures c WHERE c.club_id=s.club_id AND c.resource_id=r.id AND c.starts_at<gs+($4*interval '1 minute') AND c.ends_at>gs)
       AND NOT EXISTS(SELECT 1 FROM grooming_bookings x WHERE x.club_id=s.club_id AND x.status='confirmed' AND (x.staff_id=s.staff_id OR x.resource_id=r.id) AND x.starts_at<gs+($4*interval '1 minute') AND x.busy_ends_at>gs)
      ) SELECT starts_at,to_char(starts_at AT TIME ZONE 'Europe/London','HH24:MI') AS local_time
        FROM candidates GROUP BY starts_at ORDER BY starts_at`,
      [club, service, date, busyMinutes],
    );
    return { service: item, slots: slots.rows };
  });
}

export async function reserveBooking(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({
      dog_id: z.uuid(),
      service_id: z.uuid(),
      starts_at: z.coerce.date(),
      accepted_terms: z.literal("yes"),
    })
    .parse(input);
  if (data.starts_at <= new Date())
    throw new OnboardingError("Choose a future slot.");
  return db.transaction(async (tx) => {
    await requireEligibleDog(tx, actor, club, data.dog_id);
    const service = (
      await tx.query<GroomingService>(
        "SELECT * FROM grooming_services WHERE club_id=$1 AND id=$2 AND active",
        [club, data.service_id],
      )
    ).rows[0];
    if (!service) throw new OnboardingError("Service unavailable.");
    const aligned = await tx.query<{ aligned: boolean }>(
      `SELECT extract(minute FROM $1::timestamptz AT TIME ZONE 'Europe/London')::int%15=0
       AND extract(second FROM $1::timestamptz)=0 AS aligned`,
      [data.starts_at.toISOString()],
    );
    if (!aligned.rows[0].aligned)
      throw new OnboardingError("Choose a listed start time.");
    const serviceEnds = new Date(
      data.starts_at.getTime() + service.duration_minutes * 60_000,
    );
    const busyEnds = new Date(
      serviceEnds.getTime() + service.cleanup_minutes * 60_000,
    );
    const resources = await tx.query<{ id: string }>(
      "SELECT id FROM grooming_resources WHERE club_id=$1 AND active ORDER BY id FOR UPDATE",
      [club],
    );
    const staff = await tx.query<{ account_id: string }>(
      `SELECT m.account_id FROM memberships m
       JOIN staff_service_qualifications q ON q.club_id=m.club_id AND q.account_id=m.account_id AND q.service_id=$2
       WHERE m.club_id=$1 AND m.role='manager' ORDER BY m.account_id FOR UPDATE OF m`,
      [club, data.service_id],
    );
    let chosen: { staff: string; resource: string } | undefined;
    for (const person of staff.rows) {
      const shift = await tx.query(
        `SELECT s.id FROM published_shifts s WHERE s.club_id=$1 AND s.staff_id=$2 AND s.status='published'
         AND s.starts_at<=$3 AND s.ends_at>=$4
         AND NOT EXISTS(SELECT 1 FROM shift_breaks b WHERE b.club_id=s.club_id AND b.shift_id=s.id AND b.starts_at<$4 AND b.ends_at>$3)
         AND NOT EXISTS(SELECT 1 FROM grooming_bookings x WHERE x.club_id=s.club_id AND x.status='confirmed' AND x.staff_id=s.staff_id AND x.starts_at<$4 AND x.busy_ends_at>$3)
         LIMIT 1`,
        [
          club,
          person.account_id,
          data.starts_at.toISOString(),
          busyEnds.toISOString(),
        ],
      );
      if (!shift.rows.length) continue;
      for (const resource of resources.rows) {
        const free = await tx.query(
          `SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM resource_closures c WHERE c.club_id=$1 AND c.resource_id=$2 AND c.starts_at<$4 AND c.ends_at>$3)
           AND NOT EXISTS(SELECT 1 FROM grooming_bookings x WHERE x.club_id=$1 AND x.status='confirmed' AND x.resource_id=$2 AND x.starts_at<$4 AND x.busy_ends_at>$3)`,
          [
            club,
            resource.id,
            data.starts_at.toISOString(),
            busyEnds.toISOString(),
          ],
        );
        if (free.rows.length) {
          chosen = { staff: person.account_id, resource: resource.id };
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen)
      throw new OnboardingError(
        "That slot has just become unavailable. Choose another time.",
      );
    const id = randomUUID();
    await tx.query(
      `INSERT INTO grooming_bookings(id,club_id,dog_id,service_id,resource_id,staff_id,starts_at,service_ends_at,busy_ends_at,price_pence_snapshot,cancellation_terms_snapshot,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        club,
        data.dog_id,
        data.service_id,
        chosen.resource,
        chosen.staff,
        data.starts_at.toISOString(),
        serviceEnds.toISOString(),
        busyEnds.toISOString(),
        service.price_pence,
        service.cancellation_terms,
        actor,
      ],
    );
    await tx.query(
      "INSERT INTO booking_events(club_id,booking_id,actor_id,action) VALUES($1,$2,$3,'booking.confirmed')",
      [club, id, actor],
    );
    return id;
  });
}

export async function bookingsFor(db: Db, actor: string, club: string) {
  return scoped(
    db,
    actor,
    club,
    false,
    async (tx) =>
      (
        await tx.query<GroomingBooking>(
          `SELECT b.*,d.name AS dog_name,s.name AS service_name,r.name AS resource_name
         FROM grooming_bookings b JOIN dogs d ON d.club_id=b.club_id AND d.id=b.dog_id
         JOIN grooming_services s ON s.club_id=b.club_id AND s.id=b.service_id
         JOIN grooming_resources r ON r.club_id=b.club_id AND r.id=b.resource_id
         ORDER BY b.starts_at`,
        )
      ).rows,
  );
}

export async function cancelBooking(
  db: Db,
  actor: string,
  club: string,
  booking: string,
  reason: string,
) {
  z.uuid().parse(booking);
  const cancellationReason = z.string().trim().min(1).max(500).parse(reason);
  await db.transaction(async (tx) => {
    const item = (
      await tx.query<GroomingBooking & { owner_id: string; manager: boolean }>(
        `SELECT b.*,d.owner_id,EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=b.club_id AND m.account_id=$2 AND m.role='manager') AS manager
         FROM grooming_bookings b JOIN dogs d ON d.club_id=b.club_id AND d.id=b.dog_id
         WHERE b.club_id=$1 AND b.id=$3 FOR UPDATE OF b`,
        [club, actor, booking],
      )
    ).rows[0];
    if (!item || (item.owner_id !== actor && !item.manager))
      throw new OnboardingError("Booking unavailable.");
    if (item.status !== "confirmed")
      throw new OnboardingError("This booking is already cancelled.");
    const activeVisit = await tx.query(
      "SELECT 1 FROM grooming_visits WHERE club_id=$1 AND booking_id=$2",
      [club, booking],
    );
    if (activeVisit.rows.length)
      throw new OnboardingError(
        "This visit has started. Ask the club team for help.",
      );
    await tx.query(
      "UPDATE grooming_bookings SET status='cancelled',cancelled_by=$1,cancellation_reason=$2,cancelled_at=now(),version=version+1 WHERE club_id=$3 AND id=$4",
      [actor, cancellationReason, club, booking],
    );
    await tx.query(
      "INSERT INTO booking_events(club_id,booking_id,actor_id,action,reason) VALUES($1,$2,$3,'booking.cancelled',$4)",
      [club, booking, actor, cancellationReason],
    );
  });
}
