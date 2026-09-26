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
  delivery_status:
    "manual_required" | "pending" | "provider_accepted" | "failed";
  delivery_provider: string | null;
  delivery_message_id: string | null;
  delivery_attempted_at: string | null;
  delivery_error_code: string | null;
};

export type PreparedRecoveryDelivery = {
  requestId: string;
  email: string;
  token: string;
};

export async function requestPasswordRecovery(
  db: Db,
  email: unknown,
  delivery: "manual" | "email" = "manual",
): Promise<PreparedRecoveryDelivery | null> {
  const normalised = emailInput.parse(email);
  const token = randomBytes(32).toString("hex");
  return db.transaction(async (tx) => {
    const account = (
      await tx.query<{ id: string }>(
        "SELECT id FROM accounts WHERE email=$1 FOR UPDATE",
        [normalised],
      )
    ).rows[0];
    // The public response is deliberately identical when no account exists.
    if (!account) return null;
    const recent = await tx.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM password_recovery_requests
       WHERE account_id=$1 AND requested_at>now()-interval '1 hour'`,
      [account.id],
    );
    if (recent.rows[0].count >= 3) return null;
    const id = randomUUID();
    if (delivery === "email") {
      await tx.query(
        `UPDATE password_recovery_requests SET expires_at=now()
         WHERE account_id=$1 AND token_hash IS NOT NULL AND consumed_at IS NULL`,
        [account.id],
      );
      await tx.query(
        `INSERT INTO password_recovery_requests(
          id,account_id,token_hash,expires_at,handled_at,delivery_status
         ) VALUES($1,$2,$3,now()+interval '30 minutes',now(),'pending')`,
        [id, account.id, digest(token)],
      );
    } else {
      await tx.query(
        "INSERT INTO password_recovery_requests(id,account_id) VALUES($1,$2)",
        [id, account.id],
      );
    }
    await tx.query(
      `INSERT INTO password_recovery_events(request_id,account_id,action)
       VALUES($1,$2,'recovery.requested')`,
      [id, account.id],
    );
    if (delivery === "email") {
      await tx.query(
        `INSERT INTO password_recovery_events(request_id,account_id,action)
         VALUES($1,$2,'recovery.link_issued'),($1,$2,'recovery.delivery_queued')`,
        [id, account.id],
      );
      return { requestId: id, email: normalised, token };
    }
    return null;
  });
}

export async function recoveryRequestsForPlatform(db: Db, actor: string) {
  return db.transaction(async (tx) => {
    await requirePlatformOwner(tx, actor);
    return (
      await tx.query<RecoveryRequest>(
        `SELECT r.id,a.email,r.requested_at,r.handled_at,r.expires_at,r.consumed_at,r.dismissed_at,
          r.delivery_status,r.delivery_provider,r.delivery_message_id,r.delivery_attempted_at,r.delivery_error_code
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
       SET token_hash=$1,expires_at=now()+interval '30 minutes',handled_at=now(),handled_by=$2,
       delivery_status='manual_required',delivery_provider=NULL,delivery_message_id=NULL,
       delivery_attempted_at=NULL,delivery_error_code=NULL
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

export async function recordPasswordRecoveryDelivery(
  db: Db,
  requestId: string,
  result:
    | { status: "provider_accepted"; provider: string; messageId: string }
    | { status: "failed"; provider: string; errorCode: string },
) {
  z.uuid().parse(requestId);
  const provider = z.string().trim().min(1).max(40).parse(result.provider);
  const messageId =
    result.status === "provider_accepted"
      ? z.string().trim().min(1).max(200).parse(result.messageId)
      : null;
  const errorCode =
    result.status === "failed"
      ? z
          .string()
          .trim()
          .regex(/^[a-z0-9_-]+$/)
          .max(80)
          .parse(result.errorCode)
      : null;
  await db.transaction(async (tx) => {
    const request = (
      await tx.query<{ account_id: string; delivery_status: string }>(
        `SELECT account_id,delivery_status FROM password_recovery_requests
         WHERE id=$1 FOR UPDATE`,
        [requestId],
      )
    ).rows[0];
    if (!request || request.delivery_status !== "pending")
      throw new RecoveryError("Recovery delivery is unavailable.");
    await tx.query(
      `UPDATE password_recovery_requests SET delivery_status=$1,delivery_provider=$2,
       delivery_message_id=$3,delivery_attempted_at=now(),delivery_error_code=$4
       WHERE id=$5`,
      [result.status, provider, messageId, errorCode, requestId],
    );
    await tx.query(
      `INSERT INTO password_recovery_events(request_id,account_id,action)
       VALUES($1,$2,$3)`,
      [
        requestId,
        request.account_id,
        result.status === "provider_accepted"
          ? "recovery.delivery_accepted"
          : "recovery.delivery_failed",
      ],
    );
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
