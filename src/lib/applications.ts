import { z } from "zod";
import { scoped, type Db } from "./database";
import { OnboardingError } from "./onboarding";
export type Application = {
  club_id: string;
  dog_id: string;
  activity: string;
  status: string;
  emergency_contact: string;
  handling_notes: string;
  reason: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  version: number;
  submitted_at: string | null;
};
export async function applicationsFor(db: Db, actor: string, club: string) {
  return scoped(
    db,
    actor,
    club,
    false,
    async (tx) =>
      (
        await tx.query<Application>(
          "SELECT * FROM dog_applications ORDER BY submitted_at NULLS LAST",
        )
      ).rows,
  );
}
export async function submitApplication(
  db: Db,
  actor: string,
  club: string,
  dog: string,
  input: unknown,
) {
  z.uuid().parse(dog);
  const d = z
    .object({
      emergency_contact: z
        .string()
        .trim()
        .min(3, "Add an emergency contact and phone number.")
        .max(200),
      handling_notes: z
        .string()
        .trim()
        .min(1, "Describe handling needs, or explicitly say none known.")
        .max(2000),
      version: z.coerce.number().int().nonnegative(),
      intent: z.enum(["draft", "submit"]),
    })
    .parse(input);
  await db.transaction(async (tx) => {
    const owned = await tx.query(
      "SELECT d.id FROM dogs d JOIN memberships m ON m.club_id=d.club_id AND m.account_id=d.owner_id WHERE d.id=$1 AND d.club_id=$2 AND d.owner_id=$3 FOR UPDATE OF d",
      [dog, club, actor],
    );
    if (!owned.rows.length)
      throw new OnboardingError("Dog record unavailable.");
    const old = (
      await tx.query<Application>(
        "SELECT * FROM dog_applications WHERE club_id=$1 AND dog_id=$2 FOR UPDATE",
        [club, dog],
      )
    ).rows[0];
    if ((old?.version ?? 0) !== d.version)
      throw new OnboardingError(
        "The application changed. Reload before saving.",
      );
    if (old && !["draft", "needs-information"].includes(old.status))
      throw new OnboardingError(
        "This application is with your manager. Contact them to arrange changes.",
      );
    const status = d.intent === "submit" ? "pending" : "draft";
    await tx.query(
      "INSERT INTO dog_applications(club_id,dog_id,status,emergency_contact,handling_notes,submitted_at) VALUES($1,$2,$3,$4,$5,CASE WHEN $3='pending' THEN now() ELSE NULL END) ON CONFLICT(club_id,dog_id,activity) DO UPDATE SET status=EXCLUDED.status,emergency_contact=EXCLUDED.emergency_contact,handling_notes=EXCLUDED.handling_notes,submitted_at=EXCLUDED.submitted_at,version=dog_applications.version+1",
      [club, dog, status, d.emergency_contact, d.handling_notes],
    );
    await tx.query(
      "INSERT INTO application_events(club_id,dog_id,actor_id,action) VALUES($1,$2,$3,$4)",
      [
        club,
        dog,
        actor,
        status === "pending" ? "application.submitted" : "application.draft",
      ],
    );
  });
}
export async function reviewApplication(
  db: Db,
  actor: string,
  club: string,
  dog: string,
  input: unknown,
) {
  const d = z
    .object({
      version: z.coerce.number().int().positive(),
      status: z.enum(["approved", "needs-information", "expired", "suspended"]),
      reason: z
        .string()
        .trim()
        .min(1, "Record a reason for this decision.")
        .max(1000),
    })
    .parse(input);
  z.uuid().parse(dog);
  await db.transaction(async (tx) => {
    if (
      !(
        await tx.query(
          "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2 AND role='manager'",
          [club, actor],
        )
      ).rows.length
    )
      throw new OnboardingError("Manager access required.");
    const old = (
      await tx.query<Application>(
        "SELECT * FROM dog_applications WHERE club_id=$1 AND dog_id=$2 FOR UPDATE",
        [club, dog],
      )
    ).rows[0];
    if (!old || old.version !== d.version)
      throw new OnboardingError(
        "The application changed. Reload before deciding.",
      );
    const allowed: Record<string, string[]> = {
      pending: ["approved", "needs-information", "suspended"],
      approved: ["expired", "suspended"],
      expired: ["needs-information", "suspended"],
      suspended: ["needs-information"],
    };
    if (!allowed[old.status]?.includes(d.status))
      throw new OnboardingError(
        "That decision is not available from the current status.",
      );
    await tx.query(
      "UPDATE dog_applications SET status=$1,reason=$2,reviewer_id=$3,reviewed_at=now(),version=version+1 WHERE club_id=$4 AND dog_id=$5",
      [d.status, d.reason, actor, club, dog],
    );
    await tx.query(
      "INSERT INTO application_events(club_id,dog_id,actor_id,action,reason) VALUES($1,$2,$3,$4,$5)",
      [club, dog, actor, "application." + d.status, d.reason],
    );
  });
}
