import { z } from "zod";
import { isPlatformOwner } from "./branding";
import type { Db } from "./database";
import {
  isDemoMode,
  isHostedPostgres,
  type RuntimeEnvironment,
} from "./runtime";

const clubId = z.string().trim().min(1).max(100);

export class DemoGuideError extends Error {}

export type DemoGuide = {
  club: { id: string; slug: string; name: string; location: string };
  accounts: Array<{ email: string; role: "manager" | "member" }>;
  state: {
    dogs: number;
    bookings: number;
    groomingVisits: number;
    capturedPayments: number;
    admissionVisits: number;
  };
};

export async function demoGuideFor(
  db: Db,
  actor: string,
  requestedClub: string,
  environment: RuntimeEnvironment = process.env,
): Promise<DemoGuide> {
  if (!isDemoMode(environment) || isHostedPostgres(environment))
    throw new DemoGuideError("The guided demo is unavailable.");
  if (!(await isPlatformOwner(db, actor)))
    throw new DemoGuideError("Platform access is required.");
  const club = clubId.parse(requestedClub);
  const operator = (
    await db.query<{
      id: string;
      slug: string;
      name: string;
      location: string;
      dogs: number;
      bookings: number;
      grooming_visits: number;
      captured_payments: number;
      admission_visits: number;
    }>(
      `SELECT c.id,c.slug,c.name,c.location,
       (SELECT count(*)::int FROM dogs d WHERE d.club_id=c.id) AS dogs,
       (SELECT count(*)::int FROM grooming_bookings b WHERE b.club_id=c.id) AS bookings,
       (SELECT count(*)::int FROM grooming_visits v WHERE v.club_id=c.id) AS grooming_visits,
       (SELECT count(*)::int FROM service_payments p WHERE p.club_id=c.id AND p.status='captured') AS captured_payments,
       (SELECT count(*)::int FROM admission_visits av WHERE av.club_id=c.id) AS admission_visits
       FROM clubs c WHERE c.id=$1`,
      [club],
    )
  ).rows[0];
  if (!operator) throw new DemoGuideError("That demo club was not found.");

  const accounts = (
    await db.query<{ email: string; role: "manager" | "member" }>(
      `SELECT a.email,m.role FROM memberships m
       JOIN accounts a ON a.id=m.account_id
       WHERE m.club_id=$1 ORDER BY m.role,a.email`,
      [club],
    )
  ).rows;
  if (
    !accounts.length ||
    accounts.some(({ email }) => !/^[^@]+@demo\.invalid$/i.test(email))
  )
    throw new DemoGuideError(
      "The guide is limited to wholly synthetic demo clubs.",
    );

  return {
    club: {
      id: operator.id,
      slug: operator.slug,
      name: operator.name,
      location: operator.location,
    },
    accounts,
    state: {
      dogs: Number(operator.dogs),
      bookings: Number(operator.bookings),
      groomingVisits: Number(operator.grooming_visits),
      capturedPayments: Number(operator.captured_payments),
      admissionVisits: Number(operator.admission_visits),
    },
  };
}
