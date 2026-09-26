import { z } from "zod";
import type { Db, Queryable } from "./database";
import { OnboardingError } from "./onboarding";

export const staffRoles = ["manager", "groomer", "reception", "cafe"] as const;
export type StaffRole = (typeof staffRoles)[number];
export type StaffPermission = "can_manage_staff" | "can_manage_booking_setup";

export async function requireManager(
  tx: Queryable,
  actor: string,
  club: string,
) {
  const allowed = await tx.query(
    "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2 AND role='manager'",
    [club, actor],
  );
  if (!allowed.rows.length)
    throw new OnboardingError("Manager access required.");
}

export async function requireStaffPermission(
  tx: Queryable,
  actor: string,
  club: string,
  permission: StaffPermission,
) {
  const allowed = await tx.query(
    `SELECT 1 FROM memberships m LEFT JOIN staff_members s ON s.club_id=m.club_id AND s.account_id=m.account_id
     WHERE m.club_id=$1 AND m.account_id=$2 AND (m.role='manager' OR (s.active AND s.${permission}))`,
    [club, actor],
  );
  if (!allowed.rows.length)
    throw new OnboardingError("You do not have permission for this workspace.");
}

export async function staffAdminFor(db: Db, actor: string, club: string) {
  return db.transaction(async (tx) => {
    await requireStaffPermission(tx, actor, club, "can_manage_staff");
    const [people, services, events] = await Promise.all([
      tx.query<{
        account_id: string;
        email: string;
        membership_role: string;
        staff_role: StaffRole | null;
        active: boolean | null;
        can_manage_staff: boolean | null;
        can_manage_booking_setup: boolean | null;
        qualification_ids: string[];
      }>(
        `SELECT m.account_id,a.email,m.role AS membership_role,s.role AS staff_role,s.active,
          s.can_manage_staff,s.can_manage_booking_setup,
          COALESCE(array_agg(q.service_id::text ORDER BY q.service_id) FILTER (WHERE q.service_id IS NOT NULL),'{}') AS qualification_ids
        FROM memberships m JOIN accounts a ON a.id=m.account_id
        LEFT JOIN staff_members s ON s.club_id=m.club_id AND s.account_id=m.account_id
        LEFT JOIN staff_service_qualifications q ON q.club_id=m.club_id AND q.account_id=m.account_id
        WHERE m.club_id=$1 GROUP BY m.account_id,a.email,m.role,s.role,s.active,s.can_manage_staff,
          s.can_manage_booking_setup ORDER BY a.email`,
        [club],
      ),
      tx.query<{ id: string; name: string; active: boolean }>(
        "SELECT id,name,active FROM grooming_services WHERE club_id=$1 ORDER BY name",
        [club],
      ),
      tx.query<{
        staff_account_id: string;
        actor_id: string;
        action: string;
        details: Record<string, unknown>;
        created_at: string;
      }>(
        "SELECT staff_account_id,actor_id,action,details,created_at FROM staff_access_events WHERE club_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20",
        [club],
      ),
    ]);
    return {
      people: people.rows,
      services: services.rows,
      events: events.rows,
    };
  });
}

const staffInput = z.object({
  account_id: z.string().min(1).max(200),
  role: z.enum(staffRoles),
  can_manage_staff: z.boolean().default(false),
  can_manage_booking_setup: z.boolean().default(false),
  service_ids: z.array(z.uuid()).max(100).default([]),
});

export async function saveStaffMember(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = staffInput.parse(input);
  await db.transaction(async (tx) => {
    await requireStaffPermission(tx, actor, club, "can_manage_staff");
    const target = await tx.query<{ role: string }>(
      "SELECT role FROM memberships WHERE club_id=$1 AND account_id=$2 FOR UPDATE",
      [club, data.account_id],
    );
    if (!target.rows.length)
      throw new OnboardingError("Choose an existing club member.");
    if (target.rows[0].role === "manager")
      throw new OnboardingError(
        "Core managers already have full club administration.",
      );
    if (data.service_ids.length) {
      const valid = await tx.query<{ id: string }>(
        "SELECT id FROM grooming_services WHERE club_id=$1 AND id=ANY($2::uuid[])",
        [club, data.service_ids],
      );
      if (valid.rows.length !== new Set(data.service_ids).size)
        throw new OnboardingError(
          "One or more service qualifications are unavailable.",
        );
    }
    const existing = await tx.query<{ active: boolean }>(
      "SELECT active FROM staff_members WHERE club_id=$1 AND account_id=$2 FOR UPDATE",
      [club, data.account_id],
    );
    await tx.query(
      `INSERT INTO staff_members(club_id,account_id,role,active,can_manage_staff,can_manage_booking_setup,deactivated_at)
      VALUES($1,$2,$3,true,$4,$5,NULL)
      ON CONFLICT(club_id,account_id) DO UPDATE SET role=excluded.role,active=true,can_manage_staff=excluded.can_manage_staff,
      can_manage_booking_setup=excluded.can_manage_booking_setup,deactivated_at=NULL,updated_at=now()`,
      [
        club,
        data.account_id,
        data.role,
        data.can_manage_staff,
        data.can_manage_booking_setup,
      ],
    );
    await tx.query(
      "DELETE FROM staff_service_qualifications WHERE club_id=$1 AND account_id=$2",
      [club, data.account_id],
    );
    for (const service of [...new Set(data.service_ids)])
      await tx.query(
        "INSERT INTO staff_service_qualifications(club_id,account_id,service_id) VALUES($1,$2,$3)",
        [club, data.account_id, service],
      );
    const action = !existing.rows.length
      ? "staff.assigned"
      : existing.rows[0].active
        ? "staff.updated"
        : "staff.reactivated";
    await tx.query(
      "INSERT INTO staff_access_events(club_id,staff_account_id,actor_id,action,details) VALUES($1,$2,$3,$4,$5)",
      [
        club,
        data.account_id,
        actor,
        action,
        JSON.stringify({
          role: data.role,
          permissions: {
            manageStaff: data.can_manage_staff,
            manageBookingSetup: data.can_manage_booking_setup,
          },
          serviceIds: data.service_ids,
        }),
      ],
    );
  });
}

export async function deactivateStaffMember(
  db: Db,
  actor: string,
  club: string,
  account: string,
) {
  z.string().min(1).max(200).parse(account);
  await db.transaction(async (tx) => {
    await requireStaffPermission(tx, actor, club, "can_manage_staff");
    if (actor === account)
      throw new OnboardingError(
        "Use another manager to deactivate your own staff access.",
      );
    const changed = await tx.query(
      "UPDATE staff_members SET active=false,deactivated_at=now(),updated_at=now() WHERE club_id=$1 AND account_id=$2 AND active RETURNING account_id",
      [club, account],
    );
    if (!changed.rows.length)
      throw new OnboardingError("Active staff access was not found.");
    await tx.query(
      "INSERT INTO staff_access_events(club_id,staff_account_id,actor_id,action) VALUES($1,$2,$3,'staff.deactivated')",
      [club, account, actor],
    );
  });
}
