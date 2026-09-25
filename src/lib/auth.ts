import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { database, verifyPassword, hashPassword } from "./database";
const cookieName = "dogclub_session";
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const dummyHash = hashPassword("not-a-real-account");
export async function signIn(email: string, password: string) {
  const db = await database();
  // Persist the attempt counter so restarting the web process does not clear it.
  const permitted = await db.transaction(async (tx) => {
    const r = await tx.query<{ attempts: number }>(
      `INSERT INTO login_attempts VALUES($1,1,now()) ON CONFLICT(email) DO UPDATE SET attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END, window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts`,
      [email],
    );
    return r.rows[0].attempts <= 10;
  });
  if (!permitted) return false;
  const account = (
    await db.query<{ id: string; password_hash: string }>(
      "SELECT id,password_hash FROM accounts WHERE email=$1",
      [email],
    )
  ).rows[0];
  const valid = verifyPassword(password, account?.password_hash ?? dummyHash);
  if (!account || !valid) return false;
  await db.query("DELETE FROM login_attempts WHERE email=$1", [email]);
  const token = randomBytes(32).toString("hex");
  const jar = await cookies();
  const old = jar.get(cookieName)?.value;
  if (old)
    await db.query("DELETE FROM sessions WHERE token_hash=$1", [digest(old)]);
  await db.query(
    "INSERT INTO sessions VALUES($1,$2,now()+interval '8 hours')",
    [digest(token), account.id],
  );
  jar.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 28800,
  });
  return true;
}
export async function currentAccount() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const db = await database();
  return (
    (
      await db.query<{ id: string; email: string }>(
        "SELECT a.id,a.email FROM accounts a JOIN sessions s ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now()",
        [digest(token)],
      )
    ).rows[0] ?? null
  );
}
export async function requireAccount() {
  const account = await currentAccount();
  if (!account) redirect("/login");
  return account;
}
export async function signOut() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token)
    await (
      await database()
    ).query("DELETE FROM sessions WHERE token_hash=$1", [digest(token)]);
  jar.delete(cookieName);
}
