import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db, Queryable } from "./database";
import { OnboardingError } from "./onboarding";
import { hashPassword } from "./passwords";

const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const emailInput = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());

const permissionsInput = z
  .object({
    can_manage_dogs: z.boolean(),
    can_manage_bookings: z.boolean(),
  })
  .refine((value) => value.can_manage_dogs || value.can_manage_bookings, {
    message: "Choose at least one permission.",
  });

async function requireClubMember(tx: Queryable, actor: string, club: string) {
  const membership = await tx.query(
    "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2 FOR SHARE",
    [club, actor],
  );
  if (!membership.rows.length)
    throw new OnboardingError("Club membership required.");
}

export type HouseholdGrant = {
  club_id: string;
  owner_account_id: string;
  owner_email: string;
  adult_account_id: string;
  adult_email: string;
  can_manage_dogs: boolean;
  can_manage_bookings: boolean;
  created_at: string;
  revoked_at: string | null;
};

export type HouseholdInvite = {
  id: string;
  email: string;
  can_manage_dogs: boolean;
  can_manage_bookings: boolean;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export async function issueHouseholdInvite(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({ email: emailInput })
    .and(permissionsInput)
    .parse(input);
  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    await requireClubMember(tx, actor, club);
    const owner = (
      await tx.query<{ email: string }>(
        "SELECT email FROM accounts WHERE id=$1 FOR UPDATE",
        [actor],
      )
    ).rows[0];
    if (!owner || owner.email === data.email)
      throw new OnboardingError("Invite another adult, not your own account.");
    const count = await tx.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM household_invites
       WHERE club_id=$1 AND owner_account_id=$2 AND expires_at>now()
       AND accepted_at IS NULL AND revoked_at IS NULL`,
      [club, actor],
    );
    if (count.rows[0].count >= 10)
      throw new OnboardingError(
        "Revoke unused household invitations before creating more.",
      );
    await tx.query(
      `UPDATE household_invites SET revoked_at=now()
       WHERE club_id=$1 AND owner_account_id=$2 AND email=$3
       AND accepted_at IS NULL AND revoked_at IS NULL`,
      [club, actor, data.email],
    );
    const id = randomUUID();
    await tx.query(
      `INSERT INTO household_invites(id,token_hash,club_id,owner_account_id,email,can_manage_dogs,can_manage_bookings,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '72 hours')`,
      [
        id,
        tokenHash(token),
        club,
        actor,
        data.email,
        data.can_manage_dogs,
        data.can_manage_bookings,
      ],
    );
    await tx.query(
      `INSERT INTO household_events(club_id,owner_account_id,actor_id,action,details)
       VALUES($1,$2,$2,'household.invited',$3)`,
      [
        club,
        actor,
        JSON.stringify({
          inviteId: id,
          canManageDogs: data.can_manage_dogs,
          canManageBookings: data.can_manage_bookings,
        }),
      ],
    );
  });
  return token;
}

export async function acceptHouseholdInvite(
  db: Db,
  token: string,
  input: unknown,
  accountId?: string,
) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new OnboardingError("This household invitation is unavailable.");
  const data = z
    .object({ email: emailInput, password: z.string().max(128).optional() })
    .parse(input);
  const passwordHash = !accountId
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
        club_id: string;
        owner_account_id: string;
        email: string;
        can_manage_dogs: boolean;
        can_manage_bookings: boolean;
      }>(
        `SELECT id,club_id,owner_account_id,email,can_manage_dogs,can_manage_bookings
         FROM household_invites WHERE token_hash=$1 AND expires_at>now()
         AND accepted_at IS NULL AND revoked_at IS NULL FOR UPDATE`,
        [tokenHash(token)],
      )
    ).rows[0];
    if (!invite || invite.email !== data.email)
      throw new OnboardingError(
        "This household invitation is unavailable for those details.",
      );
    await requireClubMember(tx, invite.owner_account_id, invite.club_id);
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
    const adult = existing?.id ?? randomUUID();
    if (adult === invite.owner_account_id)
      throw new OnboardingError("You cannot join your own household twice.");
    if (!existing)
      await tx.query(
        "INSERT INTO accounts(id,email,password_hash) VALUES($1,$2,$3)",
        [adult, data.email, passwordHash],
      );
    const membership = (
      await tx.query<{ role: string }>(
        "SELECT role FROM memberships WHERE club_id=$1 AND account_id=$2",
        [invite.club_id, adult],
      )
    ).rows[0];
    if (membership?.role === "manager")
      throw new OnboardingError(
        "Club managers already have staff access and cannot join as a household adult.",
      );
    if (!membership)
      await tx.query(
        "INSERT INTO memberships(club_id,account_id,role) VALUES($1,$2,'member')",
        [invite.club_id, adult],
      );
    const otherHousehold = await tx.query(
      `SELECT 1 FROM household_adult_grants WHERE club_id=$1 AND adult_account_id=$2
       AND owner_account_id<>$3 AND revoked_at IS NULL FOR UPDATE`,
      [invite.club_id, adult, invite.owner_account_id],
    );
    if (otherHousehold.rows.length)
      throw new OnboardingError(
        "This account already helps another household at this club.",
      );
    await tx.query(
      `INSERT INTO household_adult_grants(club_id,owner_account_id,adult_account_id,can_manage_dogs,can_manage_bookings)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(club_id,owner_account_id,adult_account_id) DO UPDATE SET
       can_manage_dogs=EXCLUDED.can_manage_dogs,can_manage_bookings=EXCLUDED.can_manage_bookings,revoked_at=NULL,created_at=now()`,
      [
        invite.club_id,
        invite.owner_account_id,
        adult,
        invite.can_manage_dogs,
        invite.can_manage_bookings,
      ],
    );
    await tx.query(
      "UPDATE household_invites SET accepted_at=now() WHERE id=$1",
      [invite.id],
    );
    await tx.query(
      `INSERT INTO household_events(club_id,owner_account_id,adult_account_id,actor_id,action,details)
       VALUES($1,$2,$3,$3,'household.joined',$4)`,
      [
        invite.club_id,
        invite.owner_account_id,
        adult,
        JSON.stringify({
          inviteId: invite.id,
          canManageDogs: invite.can_manage_dogs,
          canManageBookings: invite.can_manage_bookings,
        }),
      ],
    );
    const slug = (
      await tx.query<{ slug: string }>("SELECT slug FROM clubs WHERE id=$1", [
        invite.club_id,
      ])
    ).rows[0].slug;
    return { accountId: adult, slug };
  });
}

export async function householdDashboard(db: Db, actor: string, club: string) {
  return db.transaction(async (tx) => {
    await requireClubMember(tx, actor, club);
    const grants = await tx.query<HouseholdGrant>(
      `SELECT h.*,owner.email AS owner_email,adult.email AS adult_email
       FROM household_adult_grants h JOIN accounts owner ON owner.id=h.owner_account_id
       JOIN accounts adult ON adult.id=h.adult_account_id
       WHERE h.club_id=$1 AND h.revoked_at IS NULL
       AND (h.owner_account_id=$2 OR h.adult_account_id=$2) ORDER BY h.created_at`,
      [club, actor],
    );
    const invites = await tx.query<HouseholdInvite>(
      `SELECT id,email,can_manage_dogs,can_manage_bookings,expires_at,accepted_at,revoked_at
       FROM household_invites WHERE club_id=$1 AND owner_account_id=$2
       ORDER BY created_at DESC LIMIT 25`,
      [club, actor],
    );
    return { grants: grants.rows, invites: invites.rows };
  });
}

export async function updateHouseholdGrant(
  db: Db,
  actor: string,
  club: string,
  adult: string,
  input: unknown,
) {
  const permissions = permissionsInput.parse(input);
  await db.transaction(async (tx) => {
    await requireClubMember(tx, actor, club);
    const current = (
      await tx.query(
        `SELECT 1 FROM household_adult_grants WHERE club_id=$1 AND owner_account_id=$2
         AND adult_account_id=$3 AND revoked_at IS NULL FOR UPDATE`,
        [club, actor, adult],
      )
    ).rows[0];
    if (!current) throw new OnboardingError("Household access unavailable.");
    await tx.query(
      `UPDATE household_adult_grants SET can_manage_dogs=$1,can_manage_bookings=$2
       WHERE club_id=$3 AND owner_account_id=$4 AND adult_account_id=$5`,
      [
        permissions.can_manage_dogs,
        permissions.can_manage_bookings,
        club,
        actor,
        adult,
      ],
    );
    await tx.query(
      `INSERT INTO household_events(club_id,owner_account_id,adult_account_id,actor_id,action,details)
       VALUES($1,$2,$3,$2,'household.access_changed',$4)`,
      [
        club,
        actor,
        adult,
        JSON.stringify({
          canManageDogs: permissions.can_manage_dogs,
          canManageBookings: permissions.can_manage_bookings,
        }),
      ],
    );
  });
}

export async function revokeHouseholdGrant(
  db: Db,
  actor: string,
  club: string,
  owner: string,
  adult: string,
) {
  await db.transaction(async (tx) => {
    await requireClubMember(tx, actor, club);
    if (actor !== owner && actor !== adult)
      throw new OnboardingError("Household access unavailable.");
    const current = (
      await tx.query(
        `SELECT 1 FROM household_adult_grants WHERE club_id=$1 AND owner_account_id=$2
         AND adult_account_id=$3 AND revoked_at IS NULL FOR UPDATE`,
        [club, owner, adult],
      )
    ).rows[0];
    if (!current) throw new OnboardingError("Household access unavailable.");
    await tx.query(
      `UPDATE household_adult_grants SET revoked_at=now()
       WHERE club_id=$1 AND owner_account_id=$2 AND adult_account_id=$3`,
      [club, owner, adult],
    );
    await tx.query(
      `INSERT INTO household_events(club_id,owner_account_id,adult_account_id,actor_id,action)
       VALUES($1,$2,$3,$4,$5)`,
      [
        club,
        owner,
        adult,
        actor,
        actor === adult ? "household.left" : "household.revoked",
      ],
    );
  });
}

export async function revokeHouseholdInvite(
  db: Db,
  actor: string,
  club: string,
  inviteId: string,
) {
  z.uuid().parse(inviteId);
  await db.transaction(async (tx) => {
    await requireClubMember(tx, actor, club);
    const result = await tx.query<{ owner_account_id: string }>(
      `UPDATE household_invites SET revoked_at=now() WHERE id=$1 AND club_id=$2
       AND owner_account_id=$3 AND accepted_at IS NULL AND revoked_at IS NULL
       RETURNING owner_account_id`,
      [inviteId, club, actor],
    );
    if (!result.rows.length)
      throw new OnboardingError("Household invitation unavailable.");
    await tx.query(
      `INSERT INTO household_events(club_id,owner_account_id,actor_id,action,details)
       VALUES($1,$2,$2,'household.invite_revoked',$3)`,
      [club, actor, JSON.stringify({ inviteId })],
    );
  });
}
