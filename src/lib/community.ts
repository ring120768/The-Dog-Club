import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scoped, type Db } from "./database";

export const communityReportInput = z.object({
  dogId: z.uuid(),
  target: z.enum(["profile", "photo"]),
  reason: z.enum([
    "privacy",
    "unsafe_photo",
    "harassment",
    "false_information",
    "other",
  ]),
  details: z.string().trim().max(1000),
});

export function searchCommunityDogs<T extends { name: string }>(
  dogs: T[],
  query: string,
) {
  const term = query.trim().slice(0, 60).toLocaleLowerCase("en-GB");
  if (!term) return dogs;
  return dogs.filter((dog) =>
    dog.name.toLocaleLowerCase("en-GB").includes(term),
  );
}

export type CommunityReport = {
  id: string;
  dog_id: string;
  dog_name: string;
  photo_id: string | null;
  reason: z.infer<typeof communityReportInput>["reason"];
  details: string;
  status: "open" | "resolved" | "dismissed";
  outcome: string | null;
  reporter_account_id: string;
  owner_id: string;
  created_at: string;
  moderation_hidden: boolean;
};

const outcomeInput = z.object({
  reportId: z.uuid(),
  outcome: z.string().trim().min(1).max(1000),
  decision: z.enum(["hide", "resolve", "dismiss"]),
});

async function manager(
  tx: { query: Db["query"] },
  club: string,
  account: string,
) {
  return !!(
    await tx.query(
      "SELECT 1 FROM memberships WHERE club_id=$1 AND account_id=$2 AND role='manager'",
      [club, account],
    )
  ).rows.length;
}

export async function reportCommunityProfile(
  db: Db,
  account: string,
  club: string,
  input: unknown,
) {
  const data = communityReportInput.parse(input);
  return scoped(db, account, club, false, async (tx) => {
    const target = (
      await tx.query<{ owner_id: string; photo_id: string | null }>(
        `SELECT d.owner_id,p.id AS photo_id FROM dogs d
         LEFT JOIN dog_photos p ON p.club_id=d.club_id AND p.dog_id=d.id
         WHERE d.club_id=$1 AND d.id=$2`,
        [club, data.dogId],
      )
    ).rows[0];
    if (!target || target.owner_id === account)
      throw new Error("This community profile cannot be reported.");
    if (data.target === "photo" && !target.photo_id)
      throw new Error("This profile has no current photo to report.");
    const id = randomUUID();
    const photoId = data.target === "photo" ? target.photo_id : null;
    await tx.query(
      `INSERT INTO community_reports(id,club_id,reporter_account_id,dog_id,photo_id,reason,details)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [id, club, account, data.dogId, photoId, data.reason, data.details],
    );
    await tx.query(
      `INSERT INTO community_events(club_id,actor_id,dog_id,report_id,action,reason)
       VALUES($1,$2,$3,$4,'community.reported',$5)`,
      [club, account, data.dogId, id, data.reason],
    );
    return id;
  });
}

export async function blockCommunityProfile(
  db: Db,
  account: string,
  club: string,
  dogId: string,
) {
  const id = z.uuid().parse(dogId);
  return scoped(db, account, club, false, async (tx) => {
    const dog = (
      await tx.query<{ owner_id: string; name: string }>(
        "SELECT owner_id,name FROM dogs WHERE club_id=$1 AND id=$2",
        [club, id],
      )
    ).rows[0];
    if (!dog || dog.owner_id === account)
      throw new Error("This community profile cannot be blocked.");
    await tx.query(
      `INSERT INTO community_blocks(club_id,blocker_account_id,blocked_account_id,display_label)
       VALUES($1,$2,$3,$4) ON CONFLICT(club_id,blocker_account_id,blocked_account_id)
       DO NOTHING`,
      [club, account, dog.owner_id, `${dog.name}’s human`],
    );
    await tx.query(
      `INSERT INTO community_events(club_id,actor_id,dog_id,subject_account_id,action)
       VALUES($1,$2,$3,$4,'community.blocked')`,
      [club, account, id, dog.owner_id],
    );
  });
}

export async function blockedCommunityAccounts(
  db: Db,
  account: string,
  club: string,
) {
  return scoped(
    db,
    account,
    club,
    false,
    async (tx) =>
      (
        await tx.query<{
          blocked_account_id: string;
          display_label: string;
          created_at: string;
        }>(
          `SELECT blocked_account_id,display_label,created_at FROM community_blocks
         WHERE club_id=$1 AND blocker_account_id=$2 ORDER BY created_at DESC`,
          [club, account],
        )
      ).rows,
  );
}

export async function unblockCommunityAccount(
  db: Db,
  account: string,
  club: string,
  blockedAccount: string,
) {
  const target = z.string().min(1).max(100).parse(blockedAccount);
  return scoped(db, account, club, false, async (tx) => {
    const removed = await tx.query(
      `DELETE FROM community_blocks WHERE club_id=$1 AND blocker_account_id=$2 AND blocked_account_id=$3
       RETURNING blocked_account_id`,
      [club, account, target],
    );
    if (!removed.rows.length) throw new Error("This block is unavailable.");
    await tx.query(
      `INSERT INTO community_events(club_id,actor_id,subject_account_id,action)
       VALUES($1,$2,$3,'community.unblocked')`,
      [club, account, target],
    );
  });
}

export async function moderationQueue(db: Db, account: string, club: string) {
  return scoped(db, account, club, false, async (tx) => {
    if (!(await manager(tx, club, account)))
      throw new Error("Manager access is required.");
    return (
      await tx.query<CommunityReport>(
        `SELECT r.id,r.dog_id,d.name AS dog_name,r.photo_id,r.reason,r.details,r.status,r.outcome,
         r.reporter_account_id,d.owner_id,r.created_at,(h.dog_id IS NOT NULL) AS moderation_hidden
         FROM community_reports r JOIN dogs d ON d.club_id=r.club_id AND d.id=r.dog_id
         LEFT JOIN community_profile_hides h ON h.club_id=r.club_id AND h.dog_id=r.dog_id
         WHERE r.club_id=$1 ORDER BY (r.status='open') DESC,r.created_at DESC`,
        [club],
      )
    ).rows;
  });
}

export async function reviewCommunityReport(
  db: Db,
  account: string,
  club: string,
  input: unknown,
) {
  const data = outcomeInput.parse(input);
  return scoped(db, account, club, false, async (tx) => {
    if (!(await manager(tx, club, account)))
      throw new Error("Manager access is required.");
    const report = (
      await tx.query<{ dog_id: string; status: string }>(
        "SELECT dog_id,status FROM community_reports WHERE club_id=$1 AND id=$2 FOR UPDATE",
        [club, data.reportId],
      )
    ).rows[0];
    if (!report || report.status !== "open")
      throw new Error("This report is unavailable for review.");
    const status = data.decision === "dismiss" ? "dismissed" : "resolved";
    await tx.query(
      `UPDATE community_reports SET status=$1,outcome=$2,reviewed_by=$3,reviewed_at=now()
       WHERE club_id=$4 AND id=$5`,
      [status, data.outcome, account, club, data.reportId],
    );
    if (data.decision === "hide")
      await tx.query(
        `INSERT INTO community_profile_hides(club_id,dog_id,hidden_by) VALUES($1,$2,$3)
         ON CONFLICT(club_id,dog_id) DO NOTHING`,
        [club, report.dog_id, account],
      );
    await tx.query(
      `INSERT INTO community_events(club_id,actor_id,dog_id,report_id,action,reason)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [
        club,
        account,
        report.dog_id,
        data.reportId,
        data.decision === "hide"
          ? "community.profile_hidden"
          : data.decision === "dismiss"
            ? "community.report_dismissed"
            : "community.report_resolved",
        data.outcome,
      ],
    );
  });
}

export async function restoreCommunityProfile(
  db: Db,
  account: string,
  club: string,
  dogId: string,
  reason: string,
) {
  const id = z.uuid().parse(dogId);
  const note = z.string().trim().min(1).max(1000).parse(reason);
  return scoped(db, account, club, false, async (tx) => {
    if (!(await manager(tx, club, account)))
      throw new Error("Manager access is required.");
    const restored = await tx.query(
      `DELETE FROM community_profile_hides WHERE club_id=$1 AND dog_id=$2 RETURNING dog_id`,
      [club, id],
    );
    if (!restored.rows.length) throw new Error("This profile is not hidden.");
    await tx.query(
      `INSERT INTO community_events(club_id,actor_id,dog_id,action,reason)
       VALUES($1,$2,$3,'community.profile_restored',$4)`,
      [club, account, id, note],
    );
  });
}
