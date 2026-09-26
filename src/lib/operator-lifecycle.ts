import { z } from "zod";
import type { Db } from "./database";
import { OnboardingError } from "./onboarding";
import {
  readinessForClubs,
  type OperatorReadiness,
} from "./operator-readiness";
import {
  operatorStates,
  operatorTransitions,
  type OperatorLifecycleEvent,
  type OperatorState,
} from "./operator-lifecycle-contract";
export type {
  OperatorLifecycleEvent,
  OperatorState,
} from "./operator-lifecycle-contract";

export async function operatorLifecycleForPlatform(
  db: Db,
  actor: string,
  club: string,
) {
  return db.transaction(async (tx) => {
    const owner = await tx.query(
      "SELECT 1 FROM platform_owners WHERE account_id=$1",
      [actor],
    );
    if (!owner.rows.length)
      throw new OnboardingError("Platform access is required.");
    const events = await tx.query<OperatorLifecycleEvent>(
      `SELECT e.from_state,e.to_state,e.reason,e.created_at,a.email AS actor_email
       FROM operator_lifecycle_events e JOIN accounts a ON a.id=e.actor_id
       WHERE e.club_id=$1 ORDER BY e.created_at DESC,e.id DESC LIMIT 20`,
      [club],
    );
    return events.rows;
  });
}

export async function changeOperatorState(
  db: Db,
  actor: string,
  club: string,
  input: unknown,
) {
  const data = z
    .object({
      state: z.enum(operatorStates),
      reason: z.string().trim().min(10).max(500),
      live_confirmation: z.enum(["yes"]).optional(),
    })
    .parse(input);
  await db.transaction(async (tx) => {
    const owner = await tx.query(
      "SELECT 1 FROM platform_owners WHERE account_id=$1",
      [actor],
    );
    if (!owner.rows.length)
      throw new OnboardingError("Platform access is required.");
    const current = (
      await tx.query<{ operator_state: OperatorState }>(
        "SELECT operator_state FROM clubs WHERE id=$1 FOR UPDATE",
        [club],
      )
    ).rows[0];
    if (!current) throw new OnboardingError("Operator unavailable.");
    if (!operatorTransitions[current.operator_state].includes(data.state))
      throw new OnboardingError(
        `The operator cannot move from ${current.operator_state} to ${data.state}.`,
      );

    const readiness = (await readinessForClubs(tx, [club]))[0];
    if (["trial", "active"].includes(data.state) && !readiness.ready)
      throw new OnboardingError(
        "Complete every operator-readiness check before enabling normal access.",
      );
    if (data.state === "active" && data.live_confirmation !== "yes")
      throw new OnboardingError(
        "Confirm the external live-readiness review before activation.",
      );

    await tx.query("UPDATE clubs SET operator_state=$1 WHERE id=$2", [
      data.state,
      club,
    ]);
    await tx.query(
      `INSERT INTO operator_lifecycle_events(club_id,actor_id,from_state,to_state,reason,readiness_snapshot)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [
        club,
        actor,
        current.operator_state,
        data.state,
        data.reason,
        JSON.stringify(readiness satisfies OperatorReadiness),
      ],
    );
  });
}
