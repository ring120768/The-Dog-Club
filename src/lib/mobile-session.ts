import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { Db } from "./database";
import { hashPassword, verifyPassword } from "./passwords";

const sessionHours = 8;
const dummyHash = hashPassword("not-a-real-mobile-account");
const tokenPattern = /^[a-f0-9]{64}$/;

export const mobileLoginInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1024),
  platform: z.enum(["ios", "android", "web_test"]),
});

export type MobileAccount = { id: string; email: string };

function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createMobileSession(db: Db, input: unknown) {
  const parsed = mobileLoginInput.safeParse(input);
  if (!parsed.success) return null;
  const { email, password, platform } = parsed.data;

  const permitted = await db.transaction(async (tx) => {
    const result = await tx.query<{ attempts: number }>(
      `INSERT INTO login_attempts VALUES($1,1,now())
       ON CONFLICT(email) DO UPDATE SET
         attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
         window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END
       RETURNING attempts`,
      [email],
    );
    return result.rows[0].attempts <= 10;
  });
  if (!permitted) return null;

  const account = (
    await db.query<{ id: string; email: string; password_hash: string }>(
      "SELECT id,email,password_hash FROM accounts WHERE email=$1",
      [email],
    )
  ).rows[0];
  const valid = verifyPassword(password, account?.password_hash ?? dummyHash);
  if (!account || !valid) return null;

  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    await tx.query("DELETE FROM login_attempts WHERE email=$1", [email]);
    await tx.query(
      `INSERT INTO mobile_sessions(token_hash,account_id,platform,expires_at)
       VALUES($1,$2,$3,now()+($4 * interval '1 hour'))`,
      [digest(token), account.id, platform, sessionHours],
    );
  });
  return { token, expiresInSeconds: sessionHours * 60 * 60 };
}

function bearerToken(header: string | null) {
  const match = header?.match(/^Bearer ([a-f0-9]{64})$/);
  return match?.[1] ?? null;
}

export async function mobileAccount(db: Db, authorization: string | null) {
  const token = bearerToken(authorization);
  if (!token || !tokenPattern.test(token)) return null;
  return (
    (
      await db.query<MobileAccount>(
        `UPDATE mobile_sessions s SET last_used_at=now()
       FROM accounts a
       WHERE s.token_hash=$1 AND s.account_id=a.id
         AND s.revoked_at IS NULL AND s.expires_at>now()
       RETURNING a.id,a.email`,
        [digest(token)],
      )
    ).rows[0] ?? null
  );
}

export async function revokeMobileSession(
  db: Db,
  authorization: string | null,
) {
  const token = bearerToken(authorization);
  if (!token || !tokenPattern.test(token)) return false;
  const result = await db.query(
    `UPDATE mobile_sessions SET revoked_at=now()
     WHERE token_hash=$1 AND revoked_at IS NULL`,
    [digest(token)],
  );
  return (result.affectedRows ?? 0) === 1;
}
