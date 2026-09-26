import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scoped, type Db, type Queryable } from "./database";
import { OnboardingError } from "./onboarding";
import { requireStaffPermission } from "./staff";

export type GroomingService = {
  id: string;
  club_id: string;
  name: string;
  duration_minutes: number;
  cleanup_minutes: number;
  price_pence: number;
  cancellation_terms: string;
  membership_credit_eligible: boolean;
  membership_credit_cost: number;
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
  status: "awaiting_payment" | "confirmed" | "cancelled";
  payment_hold_expires_at: string | null;
  price_pence_snapshot: number;
  amount_due_pence_snapshot: number;
  membership_subscription_id: string | null;
  grooming_credits_applied: number;
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

async function requireEligibleDog(
  tx: Queryable,
  actor: string,
  club: string,
  dog: string,
) {
  const eligible = await tx.query<{ owner_id: string }>(
    `SELECT d.owner_id FROM dogs d JOIN clubs c ON c.id=d.club_id AND c.operator_state<>'closed'
     JOIN memberships m ON m.club_id=d.club_id AND m.account_id=d.owner_id
     JOIN dog_applications a ON a.club_id=d.club_id AND a.dog_id=d.id AND a.activity='grooming' AND a.status='approved'
     WHERE d.club_id=$1 AND d.id=$2 AND (d.owner_id=$3 OR EXISTS(
      SELECT 1 FROM household_adult_grants h WHERE h.club_id=d.club_id AND h.owner_account_id=d.owner_id
      AND h.adult_account_id=$3 AND h.revoked_at IS NULL AND h.can_manage_bookings))`,
    [club, dog, actor],
  );
  if (!eligible.rows.length)
    throw new OnboardingError(
      "This dog is not approved for grooming bookings.",
    );
  return eligible.rows[0].owner_id;
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
      membership_credit_eligible: z.enum(["yes", "no"]).default("yes"),
      membership_credit_cost: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(1),
      cancellation_terms: z.string().trim().min(1).max(1000),
      date: dateInput,
      starts_at: timeInput,
      ends_at: timeInput,
      break_starts_at: optionalTime.default(""),
      break_ends_at: optionalTime.default(""),
      location_id: z.uuid().optional(),
      staff_id: z.string().min(1).max(200).optional(),
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
    await requireStaffPermission(tx, actor, club, "can_manage_booking_setup");
    const location = data.location_id
      ? (
          await tx.query<{ id: string }>(
            "SELECT id FROM club_locations WHERE club_id=$1 AND id=$2 AND active",
            [club, data.location_id],
          )
        ).rows[0]
      : (
          await tx.query<{ id: string }>(
            "SELECT id FROM club_locations WHERE club_id=$1 AND active ORDER BY created_at LIMIT 1",
            [club],
          )
        ).rows[0];
    if (!location)
      throw new OnboardingError("Choose an active venue location.");
    const staffId = data.staff_id ?? actor;
    const staff = await tx.query(
      `SELECT 1 FROM memberships m LEFT JOIN staff_members s ON s.club_id=m.club_id AND s.account_id=m.account_id
       WHERE m.club_id=$1 AND m.account_id=$2 AND (m.role='manager' OR (s.active AND s.role='groomer'))`,
      [club, staffId],
    );
    if (!staff.rows.length)
      throw new OnboardingError("Choose an active groomer.");
    const serviceId = randomUUID();
    const resourceId = randomUUID();
    const shiftId = randomUUID();
    await tx.query(
      `INSERT INTO grooming_services(id,club_id,name,duration_minutes,cleanup_minutes,price_pence,cancellation_terms,
       membership_credit_eligible,membership_credit_cost) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        serviceId,
        club,
        data.service_name,
        data.duration_minutes,
        data.cleanup_minutes,
        pricePence,
        data.cancellation_terms,
        data.membership_credit_eligible === "yes",
        data.membership_credit_cost,
      ],
    );
    await tx.query(
      "INSERT INTO grooming_resources(id,club_id,name,location_id) VALUES($1,$2,$3,$4)",
      [resourceId, club, data.resource_name, location.id],
    );
    await tx.query(
      "INSERT INTO staff_service_qualifications(club_id,account_id,service_id) VALUES($1,$2,$3)",
      [club, staffId, serviceId],
    );
    await tx.query(
      `INSERT INTO published_shifts(id,club_id,staff_id,starts_at,ends_at,location_id)
       VALUES($1,$2,$3,($4||' '||$5)::timestamp AT TIME ZONE 'Europe/London',($4||' '||$6)::timestamp AT TIME ZONE 'Europe/London',$7)`,
      [
        shiftId,
        club,
        staffId,
        data.date,
        data.starts_at,
        data.ends_at,
        location.id,
      ],
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
    await requireStaffPermission(tx, actor, club, "can_manage_booking_setup");
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
    await requireStaffPermission(tx, actor, club, "can_manage_booking_setup");
    const [services, resources, shifts, closures, locations, staff] =
      await Promise.all([
        tx.query<GroomingService>(
          "SELECT * FROM grooming_services WHERE club_id=$1 ORDER BY name",
          [club],
        ),
        tx.query<{
          id: string;
          name: string;
          active: boolean;
          location_id: string;
          location_name: string;
        }>(
          `SELECT r.id,r.name,r.active,r.location_id,l.name AS location_name FROM grooming_resources r
         JOIN club_locations l ON l.club_id=r.club_id AND l.id=r.location_id WHERE r.club_id=$1 ORDER BY l.name,r.name`,
          [club],
        ),
        tx.query<{
          id: string;
          staff_id: string;
          staff_email: string;
          location_name: string;
          starts_at: string;
          ends_at: string;
          status: string;
        }>(
          `SELECT s.id,s.staff_id,a.email AS staff_email,l.name AS location_name,s.starts_at,s.ends_at,s.status
         FROM published_shifts s JOIN accounts a ON a.id=s.staff_id JOIN club_locations l ON l.club_id=s.club_id AND l.id=s.location_id
         WHERE s.club_id=$1 ORDER BY s.starts_at`,
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
        tx.query<{
          id: string;
          name: string;
          address_label: string;
          active: boolean;
        }>(
          "SELECT id,name,address_label,active FROM club_locations WHERE club_id=$1 ORDER BY name",
          [club],
        ),
        tx.query<{ account_id: string; email: string }>(
          `SELECT m.account_id,a.email FROM memberships m JOIN accounts a ON a.id=m.account_id
        LEFT JOIN staff_members s ON s.club_id=m.club_id AND s.account_id=m.account_id
        WHERE m.club_id=$1 AND (m.role='manager' OR (s.active AND s.role='groomer')) ORDER BY a.email`,
          [club],
        ),
      ]);
    return {
      services: services.rows,
      resources: resources.rows,
      shifts: shifts.rows,
      closures: closures.rows,
      locations: locations.rows,
      staff: staff.rows,
    };
  });
}

export async function createLocation(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({
      name: z.string().trim().min(2).max(100),
      address_label: z.string().trim().max(200),
    })
    .parse(input);
  await db.transaction(async (tx) => {
    await requireStaffPermission(tx, actor, club, "can_manage_booking_setup");
    await tx.query(
      "INSERT INTO club_locations(id,club_id,name,address_label) VALUES($1,$2,$3,$4)",
      [randomUUID(), club, data.name, data.address_label],
    );
  });
}

export async function setInventoryActive(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({
      kind: z.enum(["location", "service", "resource"]),
      id: z.uuid(),
      active: z.enum(["true", "false"]),
    })
    .parse(input);
  await db.transaction(async (tx) => {
    await requireStaffPermission(tx, actor, club, "can_manage_booking_setup");
    const table =
      data.kind === "location"
        ? "club_locations"
        : data.kind === "service"
          ? "grooming_services"
          : "grooming_resources";
    if (data.kind === "location" && data.active === "false") {
      const dependencies = await tx.query(
        `SELECT 1 FROM grooming_resources WHERE club_id=$1 AND location_id=$2 AND active UNION ALL SELECT 1 FROM published_shifts WHERE club_id=$1 AND location_id=$2 AND status='published' LIMIT 1`,
        [club, data.id],
      );
      if (dependencies.rows.length)
        throw new OnboardingError(
          "Retire active stations and published shifts at this location first.",
        );
    }
    const changed = await tx.query(
      `UPDATE ${table} SET active=$1 WHERE club_id=$2 AND id=$3 RETURNING id`,
      [data.active === "true", club, data.id],
    );
    if (!changed.rows.length)
      throw new OnboardingError("Inventory item unavailable.");
  });
}

export async function availabilityFor(
  db: Db,
  actor: string,
  club: string,
  dog: string,
  service: string,
  date: string,
  excludedBooking: string | null = null,
) {
  z.uuid().parse(dog);
  z.uuid().parse(service);
  dateInput.parse(date);
  if (excludedBooking) z.uuid().parse(excludedBooking);
  return db.transaction(async (tx) => {
    await requireEligibleDog(tx, actor, club, dog);
    if (excludedBooking) {
      const existing = await tx.query(
        `SELECT 1 FROM grooming_bookings
         WHERE club_id=$1 AND id=$2 AND dog_id=$3 AND service_id=$4 AND status='confirmed'`,
        [club, excludedBooking, dog, service],
      );
      if (!existing.rows.length)
        throw new OnboardingError("Booking unavailable.");
    }
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
       JOIN memberships m ON m.club_id=s.club_id AND m.account_id=s.staff_id
       LEFT JOIN staff_members sm ON sm.club_id=m.club_id AND sm.account_id=m.account_id
       CROSS JOIN grooming_resources r
       CROSS JOIN LATERAL generate_series(s.starts_at,s.ends_at-($4*interval '1 minute'),interval '15 minutes') gs
       WHERE s.club_id=$1 AND s.status='published' AND (m.role='manager' OR (sm.active AND sm.role='groomer'))
       AND r.club_id=s.club_id AND r.location_id=s.location_id AND r.active
       AND (gs AT TIME ZONE 'Europe/London')::date=$3::date AND gs>now()
       AND NOT EXISTS(SELECT 1 FROM shift_breaks b WHERE b.club_id=s.club_id AND b.shift_id=s.id AND b.starts_at<gs+($4*interval '1 minute') AND b.ends_at>gs)
       AND NOT EXISTS(SELECT 1 FROM resource_closures c WHERE c.club_id=s.club_id AND c.resource_id=r.id AND c.starts_at<gs+($4*interval '1 minute') AND c.ends_at>gs)
       AND NOT EXISTS(SELECT 1 FROM grooming_bookings x WHERE x.club_id=s.club_id
        AND (x.status='confirmed' OR (x.status='awaiting_payment' AND x.payment_hold_expires_at>now()))
        AND (x.staff_id=s.staff_id OR x.resource_id=r.id) AND x.starts_at<gs+($4*interval '1 minute') AND x.busy_ends_at>gs
        AND ($5::uuid IS NULL OR x.id<>$5::uuid))
      ) SELECT starts_at,to_char(starts_at AT TIME ZONE 'Europe/London','HH24:MI') AS local_time
        FROM candidates GROUP BY starts_at ORDER BY starts_at`,
      [club, service, date, busyMinutes, excludedBooking],
    );
    return { service: item, slots: slots.rows };
  });
}

async function chooseBookingCapacity(
  tx: Queryable,
  club: string,
  service: string,
  startsAt: Date,
  busyEnds: Date,
  excludedBooking: string | null = null,
) {
  const resources = await tx.query<{ id: string; location_id: string }>(
    "SELECT id,location_id FROM grooming_resources WHERE club_id=$1 AND active ORDER BY id FOR UPDATE",
    [club],
  );
  const staff = await tx.query<{ account_id: string }>(
    `SELECT m.account_id FROM memberships m
     JOIN staff_service_qualifications q ON q.club_id=m.club_id AND q.account_id=m.account_id AND q.service_id=$2
     LEFT JOIN staff_members s ON s.club_id=m.club_id AND s.account_id=m.account_id
     WHERE m.club_id=$1 AND (m.role='manager' OR (s.active AND s.role='groomer')) ORDER BY m.account_id FOR UPDATE OF m`,
    [club, service],
  );
  for (const person of staff.rows) {
    const shift = await tx.query<{ id: string; location_id: string }>(
      `SELECT s.id,s.location_id FROM published_shifts s WHERE s.club_id=$1 AND s.staff_id=$2 AND s.status='published'
       AND s.starts_at<=$3 AND s.ends_at>=$4
       AND NOT EXISTS(SELECT 1 FROM shift_breaks b WHERE b.club_id=s.club_id AND b.shift_id=s.id AND b.starts_at<$4 AND b.ends_at>$3)
       AND NOT EXISTS(SELECT 1 FROM grooming_bookings x WHERE x.club_id=s.club_id
        AND (x.status='confirmed' OR (x.status='awaiting_payment' AND x.payment_hold_expires_at>now()))
        AND x.staff_id=s.staff_id AND x.starts_at<$4 AND x.busy_ends_at>$3
        AND ($5::uuid IS NULL OR x.id<>$5::uuid))
       LIMIT 1`,
      [
        club,
        person.account_id,
        startsAt.toISOString(),
        busyEnds.toISOString(),
        excludedBooking,
      ],
    );
    if (!shift.rows.length) continue;
    for (const resource of resources.rows) {
      if (resource.location_id !== shift.rows[0].location_id) continue;
      const free = await tx.query(
        `SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM resource_closures c WHERE c.club_id=$1 AND c.resource_id=$2 AND c.starts_at<$4 AND c.ends_at>$3)
         AND NOT EXISTS(SELECT 1 FROM grooming_bookings x WHERE x.club_id=$1
          AND (x.status='confirmed' OR (x.status='awaiting_payment' AND x.payment_hold_expires_at>now()))
          AND x.resource_id=$2 AND x.starts_at<$4 AND x.busy_ends_at>$3
          AND ($5::uuid IS NULL OR x.id<>$5::uuid))`,
        [
          club,
          resource.id,
          startsAt.toISOString(),
          busyEnds.toISOString(),
          excludedBooking,
        ],
      );
      if (free.rows.length)
        return { staff: person.account_id, resource: resource.id };
    }
  }
  throw new OnboardingError(
    "That slot has just become unavailable. Choose another time.",
  );
}

export async function createBookingPaymentHold(
  tx: Queryable,
  actor: string,
  club: string,
  input: unknown,
  holdExpiresAt: Date,
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
  if (holdExpiresAt <= new Date())
    throw new OnboardingError("The payment hold must expire in the future.");
  await requireEligibleDog(tx, actor, club, data.dog_id);
  const service = (
    await tx.query<GroomingService>(
      "SELECT * FROM grooming_services WHERE club_id=$1 AND id=$2 AND active",
      [club, data.service_id],
    )
  ).rows[0];
  if (!service) throw new OnboardingError("Service unavailable.");
  if (service.price_pence <= 0)
    throw new OnboardingError("This service does not require online payment.");
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
  const chosen = await chooseBookingCapacity(
    tx,
    club,
    data.service_id,
    data.starts_at,
    busyEnds,
  );
  const id = randomUUID();
  await tx.query(
    `INSERT INTO grooming_bookings(id,club_id,dog_id,service_id,resource_id,staff_id,starts_at,service_ends_at,busy_ends_at,
     status,payment_hold_expires_at,price_pence_snapshot,amount_due_pence_snapshot,membership_subscription_id,
     grooming_credits_applied,cancellation_terms_snapshot,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'awaiting_payment',$10,$11,$11,NULL,0,$12,$13)`,
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
      holdExpiresAt.toISOString(),
      service.price_pence,
      service.cancellation_terms,
      actor,
    ],
  );
  await tx.query(
    "INSERT INTO booking_events(club_id,booking_id,actor_id,action) VALUES($1,$2,$3,'booking.payment_started')",
    [club, id, actor],
  );
  return {
    bookingId: id,
    amountPence: service.price_pence,
    serviceName: service.name,
  };
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
      use_membership_credit: z.literal("yes").optional(),
    })
    .parse(input);
  if (data.starts_at <= new Date())
    throw new OnboardingError("Choose a future slot.");
  return db.transaction(async (tx) => {
    const bookingOwner = await requireEligibleDog(tx, actor, club, data.dog_id);
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
    const chosen = await chooseBookingCapacity(
      tx,
      club,
      data.service_id,
      data.starts_at,
      busyEnds,
    );
    const id = randomUUID();
    let membershipSubscriptionId: string | null = null;
    let groomingCreditsApplied = 0;
    if (data.use_membership_credit) {
      if (bookingOwner !== actor)
        throw new OnboardingError(
          "Only the primary account can apply membership benefits to this booking.",
        );
      if (!service.membership_credit_eligible)
        throw new OnboardingError(
          "This service cannot be booked with grooming credits.",
        );
      const subscription = (
        await tx.query<{
          id: string;
          state: string;
          payment_issue_benefits: boolean;
        }>(
          `SELECT s.id,s.state,p.payment_issue_benefits
           FROM member_subscriptions s JOIN membership_plans p ON p.club_id=s.club_id AND p.id=s.plan_id
           WHERE s.club_id=$1 AND s.account_id=$2 AND s.state<>'ended' FOR UPDATE OF s`,
          [club, actor],
        )
      ).rows[0];
      const benefitsAvailable =
        subscription &&
        (subscription.state === "active" ||
          subscription.state === "cancellation_scheduled" ||
          (subscription.state === "payment_issue" &&
            subscription.payment_issue_benefits));
      if (!subscription || !benefitsAvailable)
        throw new OnboardingError(
          "Grooming credits are unavailable for this membership.",
        );
      const balance = Number(
        (
          await tx.query<{ balance: number }>(
            `SELECT COALESCE(sum(delta),0)::int AS balance FROM benefit_ledger
             WHERE club_id=$1 AND subscription_id=$2 AND benefit_code='grooming_credit'`,
            [club, subscription.id],
          )
        ).rows[0].balance,
      );
      if (balance < service.membership_credit_cost)
        throw new OnboardingError("Not enough grooming credits remain.");
      membershipSubscriptionId = subscription.id;
      groomingCreditsApplied = service.membership_credit_cost;
      await tx.query(
        `INSERT INTO benefit_ledger(id,club_id,subscription_id,benefit_code,delta,entry_type,reason,actor_id,idempotency_key)
         VALUES($1,$2,$3,'grooming_credit',$4,'redemption',$5,$6,$7)`,
        [
          randomUUID(),
          club,
          subscription.id,
          -groomingCreditsApplied,
          `Applied to grooming booking ${id}`,
          actor,
          `booking:${id}:grooming-credit`,
        ],
      );
    }
    await tx.query(
      `INSERT INTO grooming_bookings(id,club_id,dog_id,service_id,resource_id,staff_id,starts_at,service_ends_at,busy_ends_at,
       price_pence_snapshot,amount_due_pence_snapshot,membership_subscription_id,grooming_credits_applied,cancellation_terms_snapshot,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
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
        groomingCreditsApplied ? 0 : service.price_pence,
        membershipSubscriptionId,
        groomingCreditsApplied,
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

export async function rescheduleBooking(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({ booking_id: z.uuid(), starts_at: z.coerce.date() })
    .parse(input);
  if (data.starts_at <= new Date())
    throw new OnboardingError("Choose a future slot.");
  return db.transaction(async (tx) => {
    const item = (
      await tx.query<
        GroomingBooking & {
          owner_id: string;
          manager: boolean;
          household_adult: boolean;
          duration_minutes: number;
          cleanup_minutes: number;
          service_active: boolean;
        }
      >(
        `SELECT b.*,d.owner_id,s.duration_minutes,s.cleanup_minutes,s.active AS service_active,
         EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=b.club_id AND m.account_id=$2 AND m.role='manager') AS manager,
         EXISTS(SELECT 1 FROM household_adult_grants h WHERE h.club_id=b.club_id AND h.owner_account_id=d.owner_id
          AND h.adult_account_id=$2 AND h.revoked_at IS NULL AND h.can_manage_bookings) AS household_adult
         FROM grooming_bookings b
         JOIN dogs d ON d.club_id=b.club_id AND d.id=b.dog_id
         JOIN grooming_services s ON s.club_id=b.club_id AND s.id=b.service_id
         WHERE b.club_id=$1 AND b.id=$3 FOR UPDATE OF b`,
        [club, actor, data.booking_id],
      )
    ).rows[0];
    if (
      !item ||
      (item.owner_id !== actor && !item.manager && !item.household_adult)
    )
      throw new OnboardingError("Booking unavailable.");
    if (item.status !== "confirmed")
      throw new OnboardingError("This booking is already cancelled.");
    if (!item.service_active)
      throw new OnboardingError(
        "This service is no longer available. Ask the club team for help.",
      );
    if (new Date(item.starts_at).getTime() === data.starts_at.getTime())
      throw new OnboardingError("Choose a different appointment time.");
    const activeVisit = await tx.query(
      "SELECT 1 FROM grooming_visits WHERE club_id=$1 AND booking_id=$2",
      [club, data.booking_id],
    );
    if (activeVisit.rows.length)
      throw new OnboardingError(
        "This visit has started. Ask the club team for help.",
      );
    const aligned = await tx.query<{ aligned: boolean }>(
      `SELECT extract(minute FROM $1::timestamptz AT TIME ZONE 'Europe/London')::int%15=0
       AND extract(second FROM $1::timestamptz)=0 AS aligned`,
      [data.starts_at.toISOString()],
    );
    if (!aligned.rows[0].aligned)
      throw new OnboardingError("Choose a listed start time.");
    const serviceEnds = new Date(
      data.starts_at.getTime() + item.duration_minutes * 60_000,
    );
    const busyEnds = new Date(
      serviceEnds.getTime() + item.cleanup_minutes * 60_000,
    );
    const chosen = await chooseBookingCapacity(
      tx,
      club,
      item.service_id,
      data.starts_at,
      busyEnds,
      item.id,
    );
    await tx.query(
      `UPDATE grooming_bookings SET resource_id=$1,staff_id=$2,starts_at=$3,service_ends_at=$4,
       busy_ends_at=$5,version=version+1 WHERE club_id=$6 AND id=$7`,
      [
        chosen.resource,
        chosen.staff,
        data.starts_at.toISOString(),
        serviceEnds.toISOString(),
        busyEnds.toISOString(),
        club,
        item.id,
      ],
    );
    await tx.query(
      `INSERT INTO booking_events(club_id,booking_id,actor_id,action,reason)
       VALUES($1,$2,$3,'booking.rescheduled',$4)`,
      [
        club,
        item.id,
        actor,
        `${new Date(item.starts_at).toISOString()} -> ${data.starts_at.toISOString()}`,
      ],
    );
    return item.id;
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
      await tx.query<
        GroomingBooking & {
          owner_id: string;
          manager: boolean;
          household_adult: boolean;
        }
      >(
        `SELECT b.*,d.owner_id,
         EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=b.club_id AND m.account_id=$2 AND m.role='manager') AS manager,
         EXISTS(SELECT 1 FROM household_adult_grants h WHERE h.club_id=b.club_id AND h.owner_account_id=d.owner_id
          AND h.adult_account_id=$2 AND h.revoked_at IS NULL AND h.can_manage_bookings) AS household_adult
         FROM grooming_bookings b JOIN dogs d ON d.club_id=b.club_id AND d.id=b.dog_id
         WHERE b.club_id=$1 AND b.id=$3 FOR UPDATE OF b`,
        [club, actor, booking],
      )
    ).rows[0];
    if (
      !item ||
      (item.owner_id !== actor && !item.manager && !item.household_adult)
    )
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
    if (item.membership_subscription_id && item.grooming_credits_applied > 0) {
      await tx.query(
        "SELECT id FROM member_subscriptions WHERE club_id=$1 AND id=$2 FOR UPDATE",
        [club, item.membership_subscription_id],
      );
      await tx.query(
        `INSERT INTO benefit_ledger(id,club_id,subscription_id,benefit_code,delta,entry_type,reason,actor_id,idempotency_key)
         VALUES($1,$2,$3,'grooming_credit',$4,'restoration',$5,$6,$7) ON CONFLICT DO NOTHING`,
        [
          randomUUID(),
          club,
          item.membership_subscription_id,
          item.grooming_credits_applied,
          `Restored after cancellation of grooming booking ${booking}`,
          actor,
          `booking:${booking}:grooming-credit:restore`,
        ],
      );
    }
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
