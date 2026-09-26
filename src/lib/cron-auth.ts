import { timingSafeEqual } from "node:crypto";

export function authorisedCronRequest(
  authorization: string | null,
  secret = process.env.CRON_SECRET,
) {
  if (!secret || secret.length < 16 || !authorization) return false;
  const actual = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
