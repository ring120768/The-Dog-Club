import type { Db, Queryable } from "./database";
import { isPlatformOwner } from "./branding";
import { OnboardingError } from "./onboarding";

export const operatorReadinessChecks = [
  {
    key: "manager",
    label: "Operator manager",
    detail: "At least one manager can administer the club.",
  },
  {
    key: "location",
    label: "Active venue",
    detail: "At least one venue location is active.",
  },
  {
    key: "service",
    label: "Grooming service",
    detail: "At least one priced grooming service is active.",
  },
  {
    key: "station",
    label: "Grooming station",
    detail: "At least one active station belongs to an active venue.",
  },
  {
    key: "rota",
    label: "Qualified rota",
    detail:
      "A published shift has an active qualified groomer and matching venue.",
  },
] as const;

export type OperatorReadinessKey =
  (typeof operatorReadinessChecks)[number]["key"];

export type OperatorReadiness = {
  club_id: string;
  complete: number;
  total: number;
  ready: boolean;
  checks: Array<{
    key: OperatorReadinessKey;
    label: string;
    detail: string;
    complete: boolean;
  }>;
  counts: {
    managers: number;
    locations: number;
    services: number;
    stations: number;
    qualifiedShifts: number;
  };
};

type ReadinessRow = {
  club_id: string;
  managers: string | number;
  locations: string | number;
  services: string | number;
  stations: string | number;
  qualified_shifts: string | number;
};

function result(row: ReadinessRow): OperatorReadiness {
  const counts = {
    managers: Number(row.managers),
    locations: Number(row.locations),
    services: Number(row.services),
    stations: Number(row.stations),
    qualifiedShifts: Number(row.qualified_shifts),
  };
  const passed: Record<OperatorReadinessKey, boolean> = {
    manager: counts.managers > 0,
    location: counts.locations > 0,
    service: counts.services > 0,
    station: counts.stations > 0,
    rota: counts.qualifiedShifts > 0,
  };
  const checks = operatorReadinessChecks.map((check) => ({
    ...check,
    complete: passed[check.key],
  }));
  const complete = checks.filter((check) => check.complete).length;
  return {
    club_id: row.club_id,
    complete,
    total: checks.length,
    ready: complete === checks.length,
    checks,
    counts,
  };
}

export async function readinessForClubs(db: Queryable, clubIds?: string[]) {
  if (clubIds && clubIds.length === 0) return [];

  // This query deliberately returns configuration counts only. The platform
  // console never receives member, dog, care, booking or payroll records.
  const rows = await db.query<ReadinessRow>(
    `SELECT c.id AS club_id,
      (SELECT count(*) FROM memberships m WHERE m.club_id=c.id AND m.role='manager') AS managers,
      (SELECT count(*) FROM club_locations l WHERE l.club_id=c.id AND l.active) AS locations,
      (SELECT count(*) FROM grooming_services s WHERE s.club_id=c.id AND s.active) AS services,
      (SELECT count(*) FROM grooming_resources r JOIN club_locations l ON l.club_id=r.club_id AND l.id=r.location_id
        WHERE r.club_id=c.id AND r.active AND l.active) AS stations,
      (SELECT count(*) FROM published_shifts ps
        JOIN club_locations l ON l.club_id=ps.club_id AND l.id=ps.location_id AND l.active
        JOIN memberships m ON m.club_id=ps.club_id AND m.account_id=ps.staff_id
        LEFT JOIN staff_members sm ON sm.club_id=ps.club_id AND sm.account_id=ps.staff_id
        WHERE ps.club_id=c.id AND ps.status='published'
          AND (m.role='manager' OR (sm.active AND sm.role='groomer'))
          AND EXISTS(
            SELECT 1 FROM staff_service_qualifications q
            JOIN grooming_services s ON s.club_id=q.club_id AND s.id=q.service_id AND s.active
            WHERE q.club_id=ps.club_id AND q.account_id=ps.staff_id
          )) AS qualified_shifts
    FROM clubs c
    WHERE ($1::text[] IS NULL OR c.id=ANY($1::text[]))
    ORDER BY c.name`,
    [clubIds ?? null],
  );
  return rows.rows.map(result);
}

export async function operatorReadinessForPlatform(
  db: Db,
  actor: string,
  clubIds?: string[],
) {
  if (!(await isPlatformOwner(db, actor)))
    throw new OnboardingError("Platform access is required.");
  return readinessForClubs(db, clubIds);
}
