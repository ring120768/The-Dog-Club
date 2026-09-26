import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db, Queryable } from "./database";
import { hashPassword } from "./passwords";
import { onboardingInput } from "./brand-contract";
export class OnboardingError extends Error {}
const emailInput = z
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
const tokenHash = (s: string) => createHash("sha256").update(s).digest("hex");
async function authorised(
  tx: Queryable,
  actor: string,
  kind: string,
  club: string | null,
) {
  if (club) {
    const operator = (
      await tx.query<{ operator_state: string }>(
        "SELECT operator_state FROM clubs WHERE id=$1",
        [club],
      )
    ).rows[0];
    if (!operator || ["restricted", "closed"].includes(operator.operator_state))
      throw new OnboardingError(
        "New invitations are unavailable while this operator is restricted or closed.",
      );
    if (kind === "member" && operator.operator_state === "onboarding")
      throw new OnboardingError(
        "Member invitations become available when the operator enters trial or active service.",
      );
  }
  if (kind === "staff") {
    const access = await tx.query(
      `SELECT 1 FROM memberships m LEFT JOIN staff_members s ON s.club_id=m.club_id AND s.account_id=m.account_id
      WHERE m.account_id=$1 AND m.club_id=$2 AND (m.role='manager' OR (s.active AND s.can_manage_staff))`,
      [actor, club],
    );
    if (!access.rows.length)
      throw new OnboardingError(
        "You do not have permission for this invitation.",
      );
    return;
  }
  const result =
    kind === "operator"
      ? await tx.query("SELECT 1 FROM platform_owners WHERE account_id=$1", [
          actor,
        ])
      : await tx.query(
          "SELECT 1 FROM memberships WHERE account_id=$1 AND club_id=$2 AND role='manager'",
          [actor, club],
        );
  if (!result.rows.length)
    throw new OnboardingError(
      "You do not have permission for this invitation.",
    );
}
const staffInviteInput = z.object({
  managerEmail: emailInput,
  role: z.enum(["manager", "groomer", "reception", "cafe"]),
  can_manage_staff: z.boolean().default(false),
  can_manage_booking_setup: z.boolean().default(false),
  service_ids: z.array(z.uuid()).max(100).default([]),
});
export async function issueInvite(
  db: Db,
  actor: string,
  kind: "operator" | "member" | "staff",
  input: unknown,
  club: string | null = null,
) {
  const staffData = kind === "staff" ? staffInviteInput.parse(input) : null;
  const data =
    kind === "operator"
      ? onboardingInput.parse(input)
      : staffData
        ? staffData
        : z.object({ managerEmail: emailInput }).parse(input);
  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    await authorised(tx, actor, kind, club);
    const count = await tx.query<{ count: string }>(
      "SELECT count(*) FROM onboarding_invites WHERE created_by=$1 AND expires_at>now() AND accepted_at IS NULL AND revoked_at IS NULL",
      [actor],
    );
    if (Number(count.rows[0].count) >= 50)
      throw new OnboardingError(
        "Revoke unused invitations before issuing more.",
      );
    if (staffData) {
      const coreManager = await tx.query(
        `SELECT 1 FROM accounts a JOIN memberships m ON m.account_id=a.id
         WHERE a.email=$1 AND m.club_id=$2 AND m.role='manager'`,
        [staffData.managerEmail, club],
      );
      if (coreManager.rows.length)
        throw new OnboardingError(
          "Core managers already have full club administration.",
        );
    }
    if (staffData?.service_ids.length) {
      const valid = await tx.query<{ id: string }>(
        "SELECT id FROM grooming_services WHERE club_id=$1 AND id=ANY($2::uuid[])",
        [club, [...new Set(staffData.service_ids)]],
      );
      if (valid.rows.length !== new Set(staffData.service_ids).size)
        throw new OnboardingError(
          "One or more service qualifications are unavailable.",
        );
    }
    await tx.query(
      "INSERT INTO onboarding_invites(id,token_hash,email,kind,club_id,branding,staff_config,created_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '72 hours')",
      [
        randomUUID(),
        tokenHash(token),
        data.managerEmail,
        kind,
        club,
        kind === "operator" ? JSON.stringify(data) : null,
        kind === "staff" ? JSON.stringify(data) : null,
        actor,
      ],
    );
  });
  return token;
}
export async function invitationSummary(db: Db, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    (
      await db.query<{ kind: string; club_name: string | null }>(
        "SELECT i.kind,COALESCE(c.name,i.branding->>'name') AS club_name FROM onboarding_invites i LEFT JOIN clubs c ON c.id=i.club_id WHERE token_hash=$1 AND expires_at>now() AND accepted_at IS NULL AND revoked_at IS NULL",
        [tokenHash(token)],
      )
    ).rows[0] ?? null
  );
}
export async function acceptInvite(
  db: Db,
  token: string,
  input: unknown,
  accountId?: string,
) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new OnboardingError("This invitation is unavailable.");
  const data = z
    .object({ email: emailInput, password: z.string().max(128).optional() })
    .parse(input);
  const newHash = !accountId
    ? hashPassword(
        z
          .string()
          .min(12, "Choose a password of at least 12 characters.")
          .max(128)
          .parse(data.password),
      )
    : null;
  return db.transaction(async (tx) => {
    const invite = (
      await tx.query<{
        id: string;
        email: string;
        kind: string;
        club_id: string | null;
        branding: Record<string, string>;
        staff_config: unknown;
        created_by: string;
      }>(
        "SELECT * FROM onboarding_invites WHERE token_hash=$1 AND expires_at>now() AND accepted_at IS NULL AND revoked_at IS NULL FOR UPDATE",
        [tokenHash(token)],
      )
    ).rows[0];
    if (!invite || invite.email !== data.email)
      throw new OnboardingError(
        "This invitation is unavailable for those details.",
      );
    await authorised(tx, invite.created_by, invite.kind, invite.club_id);
    const existing = (
      await tx.query<{ id: string }>("SELECT id FROM accounts WHERE email=$1", [
        data.email,
      ])
    ).rows[0];
    if (existing && existing.id !== accountId)
      throw new OnboardingError(
        "Sign in with the invited account first, then return to this link.",
      );
    if (accountId && existing?.id !== accountId)
      throw new OnboardingError(
        "This invitation belongs to a different account. Sign out and return to the invitation.",
      );
    const id = existing?.id ?? randomUUID();
    if (!existing)
      await tx.query(
        "INSERT INTO accounts(id,email,password_hash) VALUES($1,$2,$3)",
        [id, data.email, newHash],
      );
    let club = invite.club_id;
    let slug: string;
    if (invite.kind === "operator") {
      const b = onboardingInput.parse(invite.branding);
      club = randomUUID();
      slug = b.slug;
      if (
        (await tx.query("SELECT 1 FROM clubs WHERE slug=$1", [slug])).rows
          .length
      )
        throw new OnboardingError(
          "That club address is already taken. Ask for a new invitation.",
        );
      await tx.query(
        "INSERT INTO clubs(id,slug,name,tagline,colour,location,emblem,avatar_tone,created_by,initial_manager_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          club,
          slug,
          b.name,
          b.tagline,
          b.colour,
          b.location,
          b.emblem,
          b.avatar_tone,
          invite.created_by,
          id,
        ],
      );
      await tx.query(
        "INSERT INTO memberships(club_id,account_id,role) VALUES($1,$2,'manager')",
        [club, id],
      );
      await tx.query(
        "INSERT INTO club_locations(id,club_id,name,address_label) VALUES($1,$2,'Main venue',$3)",
        [randomUUID(), club, b.location],
      );
      await tx.query(
        "INSERT INTO club_config_events(club_id,actor_id,action,changes) VALUES($1,$2,'club.created',$3)",
        [
          club,
          invite.created_by,
          JSON.stringify({ invitation: invite.id, initialManagerId: id }),
        ],
      );
    } else {
      slug = (
        await tx.query<{ slug: string }>("SELECT slug FROM clubs WHERE id=$1", [
          club,
        ])
      ).rows[0].slug;
      await tx.query(
        "INSERT INTO memberships(club_id,account_id,role) VALUES($1,$2,'member') ON CONFLICT DO NOTHING",
        [club, id],
      );
      if (invite.kind === "staff") {
        const staff = staffInviteInput.parse(invite.staff_config);
        await tx.query(
          `INSERT INTO staff_members(club_id,account_id,role,active,can_manage_staff,can_manage_booking_setup,deactivated_at)
          VALUES($1,$2,$3,true,$4,$5,NULL) ON CONFLICT(club_id,account_id) DO UPDATE SET role=excluded.role,active=true,
          can_manage_staff=excluded.can_manage_staff,can_manage_booking_setup=excluded.can_manage_booking_setup,deactivated_at=NULL,updated_at=now()`,
          [
            club,
            id,
            staff.role,
            staff.can_manage_staff,
            staff.can_manage_booking_setup,
          ],
        );
        await tx.query(
          "DELETE FROM staff_service_qualifications WHERE club_id=$1 AND account_id=$2",
          [club, id],
        );
        for (const service of [...new Set(staff.service_ids)])
          await tx.query(
            "INSERT INTO staff_service_qualifications(club_id,account_id,service_id) VALUES($1,$2,$3)",
            [club, id, service],
          );
        await tx.query(
          "INSERT INTO staff_access_events(club_id,staff_account_id,actor_id,action,details) VALUES($1,$2,$3,'staff.assigned',$4)",
          [
            club,
            id,
            invite.created_by,
            JSON.stringify({
              invitation: invite.id,
              role: staff.role,
              permissions: {
                manageStaff: staff.can_manage_staff,
                manageBookingSetup: staff.can_manage_booking_setup,
              },
              serviceIds: staff.service_ids,
            }),
          ],
        );
      }
    }
    await tx.query(
      "UPDATE onboarding_invites SET accepted_at=now() WHERE id=$1",
      [invite.id],
    );
    return { slug, accountId: id };
  });
}
export async function listInvites(
  db: Db,
  actor: string,
  kind: "operator" | "member" | "staff",
  club: string | null = null,
) {
  return db.transaction(async (tx) => {
    await authorised(tx, actor, kind, club);
    return (
      await tx.query<{
        id: string;
        email: string;
        expires_at: string;
        accepted_at: string | null;
        revoked_at: string | null;
      }>(
        "SELECT id,email,expires_at,accepted_at,revoked_at FROM onboarding_invites WHERE created_by=$1 AND kind=$2 AND club_id IS NOT DISTINCT FROM $3 ORDER BY expires_at DESC LIMIT 50",
        [actor, kind, club],
      )
    ).rows;
  });
}
export async function revokeInvite(db: Db, actor: string, id: string) {
  z.uuid().parse(id);
  await db.transaction(async (tx) => {
    const i = (
      await tx.query<{
        kind: string;
        club_id: string | null;
        created_by: string;
      }>(
        "SELECT kind,club_id,created_by FROM onboarding_invites WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!i || i.created_by !== actor)
      throw new OnboardingError("Invitation unavailable.");
    await authorised(tx, actor, i.kind, i.club_id);
    await tx.query(
      "UPDATE onboarding_invites SET revoked_at=now() WHERE id=$1 AND accepted_at IS NULL",
      [id],
    );
  });
}
