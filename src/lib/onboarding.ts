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
export async function issueInvite(
  db: Db,
  actor: string,
  kind: "operator" | "member",
  input: unknown,
  club: string | null = null,
) {
  const data =
    kind === "operator"
      ? onboardingInput.parse(input)
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
    await tx.query(
      "INSERT INTO onboarding_invites(id,token_hash,email,kind,club_id,branding,created_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '72 hours')",
      [
        randomUUID(),
        tokenHash(token),
        data.managerEmail,
        kind,
        club,
        kind === "operator" ? JSON.stringify(data) : null,
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
  kind: "operator" | "member",
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
