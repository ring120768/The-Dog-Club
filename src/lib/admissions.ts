import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { scoped, type Db, type Queryable } from "./database";
import { OnboardingError } from "./onboarding";

export type AdmissionSettings = {
  club_id: string;
  human_capacity: number;
  dog_capacity: number;
  updated_at: string;
};

export type AdmissionPass = {
  id: string;
  club_id: string;
  account_id: string;
  code: string;
  active: boolean;
  created_at: string;
};

export type DogAdmissionEligibility = {
  dog_id: string;
  dog_name: string;
  owner_id: string;
  status: "approved" | "suspended" | null;
  reason: string;
  reviewed_at: string | null;
  version: number | null;
};

type AdmissionVisitRecord = {
  id: string;
  account_id: string;
  human_count: number;
  status: "active" | "checked_out";
  checked_in_at: string;
  checked_out_at: string | null;
};

export type AdmissionVisit = AdmissionVisitRecord & {
  dog_count: number;
  dog_names: string;
};

async function requireManager(tx: Queryable, actor: string, club: string) {
  const allowed = await tx.query(
    "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2 AND role='manager'",
    [club, actor],
  );
  if (!allowed.rows.length)
    throw new OnboardingError("Manager access required.");
}

const usableMembershipSql = `
  SELECT s.id FROM member_subscriptions s
  JOIN membership_plans p ON p.club_id=s.club_id AND p.id=s.plan_id
  WHERE s.club_id=$1 AND s.account_id=$2
  AND CURRENT_DATE>=s.period_starts_on AND CURRENT_DATE<s.period_ends_on
  AND (s.state IN ('active','cancellation_scheduled') OR (s.state='payment_issue' AND p.payment_issue_benefits))
  LIMIT 1`;

const lockedUsableMembershipSql = `
  SELECT s.id FROM member_subscriptions s
  JOIN membership_plans p ON p.club_id=s.club_id AND p.id=s.plan_id
  WHERE s.club_id=$1 AND s.account_id=$2
  AND CURRENT_DATE>=s.period_starts_on AND CURRENT_DATE<s.period_ends_on
  AND (s.state IN ('active','cancellation_scheduled') OR (s.state='payment_issue' AND p.payment_issue_benefits))
  FOR SHARE OF s LIMIT 1`;

export async function admissionDashboard(db: Db, actor: string, club: string) {
  return scoped(db, actor, club, false, async (tx) => {
    const settings = (
      await tx.query<AdmissionSettings>(
        "SELECT * FROM admission_settings WHERE club_id=$1",
        [club],
      )
    ).rows[0];
    const pass = (
      await tx.query<AdmissionPass>(
        "SELECT * FROM admission_passes WHERE club_id=$1 AND account_id=$2 AND active",
        [club, actor],
      )
    ).rows[0];
    const eligibilities = await tx.query<DogAdmissionEligibility>(
      `SELECT d.id AS dog_id,d.name AS dog_name,d.owner_id,e.status,COALESCE(e.reason,'') AS reason,e.reviewed_at,e.version
       FROM dogs d LEFT JOIN dog_admission_eligibilities e ON e.club_id=d.club_id AND e.dog_id=d.id
       WHERE d.club_id=$1 AND (d.owner_id=$2 OR EXISTS(
        SELECT 1 FROM memberships m WHERE m.club_id=d.club_id AND m.account_id=$2 AND m.role='manager'))
       ORDER BY d.name`,
      [club, actor],
    );
    const visits = await tx.query<AdmissionVisit>(
      `SELECT v.id,v.account_id,v.human_count,v.status,v.checked_in_at,v.checked_out_at,
       count(vd.dog_id)::int AS dog_count,COALESCE(string_agg(d.name,', ' ORDER BY d.name),'') AS dog_names
       FROM admission_visits v LEFT JOIN admission_visit_dogs vd ON vd.club_id=v.club_id AND vd.visit_id=v.id
       LEFT JOIN dogs d ON d.club_id=vd.club_id AND d.id=vd.dog_id
       WHERE v.club_id=$1 GROUP BY v.id ORDER BY v.checked_in_at DESC`,
      [club],
    );
    const occupancy = (
      await tx.query<{ humans: number; dogs: number }>(
        `SELECT
         COALESCE((SELECT sum(v.human_count) FROM admission_visits v WHERE v.club_id=$1 AND v.status='active'),0)::int AS humans,
         (SELECT count(*) FROM admission_visit_dogs vd JOIN admission_visits v ON v.club_id=vd.club_id AND v.id=vd.visit_id WHERE v.club_id=$1 AND v.status='active')::int AS dogs`,
        [club],
      )
    ).rows[0];
    const membershipUsable = Boolean(
      (await tx.query(usableMembershipSql, [club, actor])).rows.length,
    );
    return {
      settings: settings ?? null,
      pass: pass ?? null,
      eligibilities: eligibilities.rows,
      visits: visits.rows,
      occupancy,
      membershipUsable,
    };
  });
}

export async function ensureAdmissionPass(db: Db, actor: string, club: string) {
  return db.transaction(async (tx) => {
    const member = await tx.query(
      "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2",
      [club, actor],
    );
    if (!member.rows.length)
      throw new OnboardingError("Club membership required.");
    const code = randomBytes(8).toString("hex").toUpperCase();
    return (
      await tx.query<AdmissionPass>(
        `INSERT INTO admission_passes(id,club_id,account_id,code) VALUES($1,$2,$3,$4)
         ON CONFLICT(club_id,account_id) DO UPDATE SET active=true RETURNING *`,
        [randomUUID(), club, actor, code],
      )
    ).rows[0];
  });
}

export async function configureAdmission(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({
      human_capacity: z.coerce.number().int().min(1).max(1000),
      dog_capacity: z.coerce.number().int().min(0).max(1000),
    })
    .parse(input);
  await db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    await tx.query(
      "SELECT club_id FROM admission_settings WHERE club_id=$1 FOR UPDATE",
      [club],
    );
    const occupancy = (
      await tx.query<{ humans: number; dogs: number }>(
        `SELECT
         COALESCE((SELECT sum(v.human_count) FROM admission_visits v WHERE v.club_id=$1 AND v.status='active'),0)::int AS humans,
         (SELECT count(*) FROM admission_visit_dogs vd JOIN admission_visits v ON v.club_id=vd.club_id AND v.id=vd.visit_id WHERE v.club_id=$1 AND v.status='active')::int AS dogs`,
        [club],
      )
    ).rows[0];
    if (
      occupancy.humans > data.human_capacity ||
      occupancy.dogs > data.dog_capacity
    )
      throw new OnboardingError(
        "The new capacity cannot be lower than the current occupancy.",
      );
    await tx.query(
      `INSERT INTO admission_settings(club_id,human_capacity,dog_capacity,updated_by) VALUES($1,$2,$3,$4)
       ON CONFLICT(club_id) DO UPDATE SET human_capacity=excluded.human_capacity,dog_capacity=excluded.dog_capacity,
       updated_by=excluded.updated_by,updated_at=now()`,
      [club, data.human_capacity, data.dog_capacity, actor],
    );
  });
}

export async function setDogAdmissionEligibility(
  db: Db,
  actor: string,
  club: string,
  dog: string,
  input: unknown,
) {
  z.uuid().parse(dog);
  const data = z
    .object({
      status: z.enum(["approved", "suspended"]),
      reason: z.string().trim().min(3).max(500),
    })
    .parse(input);
  await db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const exists = await tx.query(
      "SELECT 1 FROM dogs WHERE club_id=$1 AND id=$2",
      [club, dog],
    );
    if (!exists.rows.length) throw new OnboardingError("Dog unavailable.");
    const current = (
      await tx.query<{ status: "approved" | "suspended" }>(
        "SELECT status FROM dog_admission_eligibilities WHERE club_id=$1 AND dog_id=$2 FOR UPDATE",
        [club, dog],
      )
    ).rows[0];
    await tx.query(
      `INSERT INTO dog_admission_eligibilities(club_id,dog_id,status,reason,reviewed_by) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(club_id,dog_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,reviewed_by=excluded.reviewed_by,
       reviewed_at=now(),version=dog_admission_eligibilities.version+1`,
      [club, dog, data.status, data.reason, actor],
    );
    await tx.query(
      `INSERT INTO dog_admission_events(club_id,dog_id,actor_id,from_status,to_status,reason)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [club, dog, actor, current?.status ?? null, data.status, data.reason],
    );
  });
}

const passCode = z
  .string()
  .trim()
  .toUpperCase()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^[A-F0-9]{16}$/, "Enter the 16-character admission pass."),
  );

export async function admissionPassLookup(
  db: Db,
  actor: string,
  club: string,
  codeInput: string,
) {
  const code = passCode.parse(codeInput);
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const pass = (
      await tx.query<AdmissionPass & { email: string }>(
        `SELECT p.*,a.email FROM admission_passes p JOIN accounts a ON a.id=p.account_id
         WHERE p.club_id=$1 AND p.code=$2 AND p.active`,
        [club, code],
      )
    ).rows[0];
    if (!pass) throw new OnboardingError("Admission pass unavailable.");
    const dogs = await tx.query<DogAdmissionEligibility>(
      `SELECT d.id AS dog_id,d.name AS dog_name,d.owner_id,e.status,COALESCE(e.reason,'') AS reason,e.reviewed_at,e.version
       FROM dogs d LEFT JOIN dog_admission_eligibilities e ON e.club_id=d.club_id AND e.dog_id=d.id
       WHERE d.club_id=$1 AND d.owner_id=$2 ORDER BY d.name`,
      [club, pass.account_id],
    );
    const membershipUsable = Boolean(
      (await tx.query(usableMembershipSql, [club, pass.account_id])).rows
        .length,
    );
    const activeVisit = (
      await tx.query<{ id: string }>(
        "SELECT id FROM admission_visits WHERE club_id=$1 AND account_id=$2 AND status='active'",
        [club, pass.account_id],
      )
    ).rows[0];
    return {
      pass,
      dogs: dogs.rows,
      membershipUsable,
      activeVisitId: activeVisit?.id ?? null,
    };
  });
}

export async function checkInAdmission(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({
      code: passCode,
      human_count: z.coerce.number().int().min(1).max(20),
      dog_ids: z.array(z.uuid()).max(20).default([]),
    })
    .parse(input);
  const dogIds = [...new Set(data.dog_ids)];
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    const settings = (
      await tx.query<AdmissionSettings>(
        "SELECT * FROM admission_settings WHERE club_id=$1 FOR UPDATE",
        [club],
      )
    ).rows[0];
    if (!settings)
      throw new OnboardingError("Configure venue capacity before check-in.");
    const pass = (
      await tx.query<AdmissionPass>(
        "SELECT * FROM admission_passes WHERE club_id=$1 AND code=$2 AND active",
        [club, data.code],
      )
    ).rows[0];
    if (!pass) throw new OnboardingError("Admission pass unavailable.");
    const existing = (
      await tx.query<AdmissionVisitRecord>(
        "SELECT * FROM admission_visits WHERE club_id=$1 AND account_id=$2 AND status='active'",
        [club, pass.account_id],
      )
    ).rows[0];
    if (existing) return existing;
    if (
      !(await tx.query(lockedUsableMembershipSql, [club, pass.account_id])).rows
        .length
    )
      throw new OnboardingError("A current usable membership is required.");
    if (dogIds.length) {
      const approved = await tx.query<{ id: string }>(
        `SELECT d.id FROM dogs d JOIN dog_admission_eligibilities e ON e.club_id=d.club_id AND e.dog_id=d.id
         WHERE d.club_id=$1 AND d.owner_id=$2 AND d.id=ANY($3::uuid[]) AND e.status='approved'
         FOR SHARE OF e`,
        [club, pass.account_id, dogIds],
      );
      if (approved.rows.length !== dogIds.length)
        throw new OnboardingError(
          "Every selected dog needs current club-admission approval.",
        );
    }
    const occupancy = (
      await tx.query<{ humans: number; dogs: number }>(
        `SELECT
         COALESCE((SELECT sum(v.human_count) FROM admission_visits v WHERE v.club_id=$1 AND v.status='active'),0)::int AS humans,
         (SELECT count(*) FROM admission_visit_dogs vd JOIN admission_visits v ON v.club_id=vd.club_id AND v.id=vd.visit_id WHERE v.club_id=$1 AND v.status='active')::int AS dogs`,
        [club],
      )
    ).rows[0];
    if (occupancy.humans + data.human_count > settings.human_capacity)
      throw new OnboardingError("Human capacity is currently full.");
    if (occupancy.dogs + dogIds.length > settings.dog_capacity)
      throw new OnboardingError("Dog capacity is currently full.");
    const id = randomUUID();
    const visit = (
      await tx.query<AdmissionVisitRecord>(
        `INSERT INTO admission_visits(id,club_id,account_id,pass_id,human_count,checked_in_by)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, club, pass.account_id, pass.id, data.human_count, actor],
      )
    ).rows[0];
    for (const dog of dogIds)
      await tx.query(
        "INSERT INTO admission_visit_dogs(club_id,visit_id,dog_id) VALUES($1,$2,$3)",
        [club, id, dog],
      );
    await tx.query(
      `INSERT INTO admission_events(club_id,visit_id,actor_id,action,human_count,dog_count)
       VALUES($1,$2,$3,'admission.checked_in',$4,$5)`,
      [club, id, actor, data.human_count, dogIds.length],
    );
    return visit;
  });
}

export async function checkOutAdmission(
  db: Db,
  actor: string,
  club: string,
  visit: string,
) {
  z.uuid().parse(visit);
  return db.transaction(async (tx) => {
    await requireManager(tx, actor, club);
    await tx.query(
      "SELECT club_id FROM admission_settings WHERE club_id=$1 FOR UPDATE",
      [club],
    );
    const current = (
      await tx.query<AdmissionVisitRecord>(
        "SELECT * FROM admission_visits WHERE club_id=$1 AND id=$2 FOR UPDATE",
        [club, visit],
      )
    ).rows[0];
    if (!current) throw new OnboardingError("Admission visit unavailable.");
    if (current.status === "checked_out") return current;
    const dogCount = Number(
      (
        await tx.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM admission_visit_dogs WHERE club_id=$1 AND visit_id=$2",
          [club, visit],
        )
      ).rows[0].count,
    );
    const updated = (
      await tx.query<AdmissionVisitRecord>(
        `UPDATE admission_visits SET status='checked_out',checked_out_by=$1,checked_out_at=now()
         WHERE club_id=$2 AND id=$3 RETURNING *`,
        [actor, club, visit],
      )
    ).rows[0];
    await tx.query(
      `INSERT INTO admission_events(club_id,visit_id,actor_id,action,human_count,dog_count)
       VALUES($1,$2,$3,'admission.checked_out',$4,$5)`,
      [club, visit, actor, current.human_count, dogCount],
    );
    return updated;
  });
}
