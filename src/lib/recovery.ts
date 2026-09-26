import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db, Queryable } from "./database";
import { hashPassword } from "./passwords";

export class RecoveryError extends Error {}

const emailInput = z
  .email("Enter a valid email address.")
  .max(254)
  .transform((value) => value.trim().toLowerCase());

const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");

async function requirePlatformOwner(tx: Queryable, actor: string) {
  const allowed = await tx.query(
    "SELECT 1 FROM platform_owners WHERE account_id=$1",
    [actor],
  );
  if (!allowed.rows.length)
    throw new RecoveryError("Platform access required.");
}

export type RecoveryRequest = {
  id: string;
  email: string;
  requested_at: string;
  handled_at: string | null;
  expires_at: string | null;
  consumed_at: string | null;
  dismissed_at: string | null;
};

export async function requestPasswordRecovery(db: Db, email: unknown) {
  const normalised = emailInput.parse(email);
  await db.transaction(async (tx) => {
    const account = (
      await tx.query<{ id: string }>(
        "SELECT id FROM accounts WHERE email=$1 FOR UPDATE",
        [normalised],
      )
    ).rows[0];
    // The public response is deliberately identical when no account exists.
    if (!account) return;
    const recent = await tx.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM password_recovery_requests
       WHERE account_id=$1 AND requested_at>now()-interval '1 hour'`,
      [account.id],
    );
    if (recent.rows[0].count >= 3) return;
    const id = randomUUID();
    await tx.query(
      "INSERT INTO password_recovery_requests(id,account_id) VALUES($1,$2)",
      [id, account.id],
    );
    await tx.query(
      `INSERT INTO password_recovery_events(request_id,account_id,action)
       VALUES($1,$2,'recovery.requested')`,
      [id, account.id],
    );
  });
}

export async function recoveryRequestsForPlatform(db: Db, actor: string) {
  return db.transaction(async (tx) => {
    await requirePlatformOwner(tx, actor);
    return (
      await tx.query<RecoveryRequest>(
        `SELECT r.id,a.email,r.requested_at,r.handled_at,r.expires_at,r.consumed_at,r.dismissed_at
         FROM password_recovery_requests r JOIN accounts a ON a.id=r.account_id
         ORDER BY r.requested_at DESC LIMIT 100`,
      )
    ).rows;
  });
}

export async function issuePasswordRecoveryLink(
  db: Db,
  actor: string,
  requestId: string,
) {
  z.uuid().parse(requestId);
  return db.transaction(async (tx) => {
    await requirePlatformOwner(tx, actor);
    const request = (
      await tx.query<{ id: string; account_id: string }>(
        `SELECT id,account_id FROM password_recovery_requests
         WHERE id=$1 AND consumed_at IS NULL AND dismissed_at IS NULL FOR UPDATE`,
        [requestId],
      )
    ).rows[0];
    if (!request) throw new RecoveryError("Recovery request unavailable.");
    const token = randomBytes(32).toString("hex");
    // Only the newest issued link remains usable for this account.
    await tx.query(
      `UPDATE password_recovery_requests SET expires_at=now()
       WHERE account_id=$1 AND id<>$2 AND token_hash IS NOT NULL AND consumed_at IS NULL`,
      [request.account_id, request.id],
    );
    await tx.query(
      `UPDATE password_recovery_requests
       SET token_hash=$1,expires_at=now()+interval '30 minutes',handled_at=now(),handled_by=$2
       WHERE id=$3`,
      [digest(token), actor, request.id],
    );
    await tx.query(
      `INSERT INTO password_recovery_events(request_id,account_id,actor_id,action)
       VALUES($1,$2,$3,'recovery.link_issued')`,
      [request.id, request.account_id, actor],
    );
    return token;
  });
}

export async function dismissPasswordRecovery(
  db: Db,
  actor: string,
  requestId: string,
) {
  z.uuid().parse(requestId);
  await db.transaction(async (tx) => {
    await requirePlatformOwner(tx, actor);
    const request = (
      await tx.query<{ account_id: string }>(
        `SELECT account_id FROM password_recovery_requests
         WHERE id=$1 AND consumed_at IS NULL AND dismissed_at IS NULL FOR UPDATE`,
        [requestId],
      )
    ).rows[0];
    if (!request) throw new RecoveryError("Recovery request unavailable.");
    await tx.query(
      "UPDATE password_recovery_requests SET dismissed_at=now(),expires_at=now(),handled_at=now(),handled_by=$1 WHERE id=$2",
      [actor, requestId],
    );
    await tx.query(
      `INSERT INTO password_recovery_events(request_id,account_id,actor_id,action)
       VALUES($1,$2,$3,'recovery.dismissed')`,
      [requestId, request.account_id, actor],
    );
  });
}

export async function completePasswordRecovery(
  db: Db,
  token: unknown,
  password: unknown,
) {
  const rawToken = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(token);
  const newPassword = z
    .string()
    .min(12, "Choose a password of at least 12 characters.")
    .max(128)
    .parse(password);
  const passwordHash = hashPassword(newPassword);
  return db.transaction(async (tx) => {
    const request = (
      await tx.query<{ id: string; account_id: string }>(
        `SELECT id,account_id FROM password_recovery_requests
         WHERE token_hash=$1 AND expires_at>now() AND consumed_at IS NULL AND dismissed_at IS NULL FOR UPDATE`,
        [digest(rawToken)],
      )
    ).rows[0];
    if (!request)
      throw new RecoveryError("This recovery link is unavailable or expired.");
    await tx.query("UPDATE accounts SET password_hash=$1 WHERE id=$2", [
      passwordHash,
      request.account_id,
    ]);
    await tx.query("DELETE FROM sessions WHERE account_id=$1", [
      request.account_id,
    ]);
    await tx.query(
      "DELETE FROM login_attempts WHERE email=(SELECT email FROM accounts WHERE id=$1)",
      [request.account_id],
    );
    await tx.query(
      `UPDATE password_recovery_requests SET consumed_at=now(),expires_at=now()
       WHERE id=$1`,
      [request.id],
    );
    await tx.query(
      `UPDATE password_recovery_requests SET expires_at=now()
       WHERE account_id=$1 AND id<>$2 AND consumed_at IS NULL`,
      [request.account_id, request.id],
    );
    await tx.query(
      `INSERT INTO password_recovery_events(request_id,account_id,action)
       VALUES($1,$2,'recovery.completed')`,
      [request.id, request.account_id],
    );
    return request.account_id;
  });
}
