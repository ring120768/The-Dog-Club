import { migrate } from "./migrations";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { hashPassword } from "./passwords";
export { hashPassword,verifyPassword } from "./passwords";

export async function initialise(db: PGlite) {
  const exists = await db.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_name='clubs'",
  );
  if (exists.rows.length) {
    await migrate(db);
    return db;
  }
  await db.transaction(async (tx) => {
    await tx.exec(
      await readFile(join(process.cwd(), "src/lib/schema.sql"), "utf8"),
    );
    await tx.exec(
      `INSERT INTO clubs VALUES ('willow','willow','The Willow Club','Good company. Happy dogs.','#235448','Chiswick, London'),('coast','coast','Coast & Canine','A little sea air. A lot of tail wags.','#2e526a','Brighton, Sussex');`,
    );
    for (const [id, email] of [
      ["alice", "alice@demo.invalid"],
      ["bea", "bea@demo.invalid"],
      ["manager", "manager@demo.invalid"],
      ["coast-member", "coast@demo.invalid"],
    ]) {
      await tx.query("INSERT INTO accounts VALUES ($1,$2,$3)", [
        id,
        email,
        hashPassword("PawsTogether!26"),
      ]);
    }
    await tx.exec(`INSERT INTO memberships VALUES ('willow','alice','member'),('willow','bea','member'),('willow','manager','manager'),('coast','coast-member','member');
  INSERT INTO dogs VALUES
  ('00000000-0000-4000-8000-000000000001','willow','alice','Bertie','Cocker spaniel','Chief crumb inspector. Excellent listener, especially near the biscuit tin.','sand','members'),
  ('00000000-0000-4000-8000-000000000002','willow','bea','Mabel','Golden retriever','Here for the company. Staying for the belly rubs.','rose','public'),
  ('00000000-0000-4000-8000-000000000003','coast','coast-member','Otis','Whippet','Professional beach zoomer and part-time sofa ornament.','sage','private');
  INSERT INTO care_notes VALUES ('willow','00000000-0000-4000-8000-000000000001','Synthetic private care note: ask owner before offering treats.');`);
  });
  await migrate(db);
  return db;
}
const globalDb = globalThis as unknown as { dogClubDb?: Promise<PGlite> };
export function database() {
  if (
    process.env.DOGCLUB_LOCAL_DEMO !== "1" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error(
      "Local demo is disabled. Configure production infrastructure before deployment.",
    );
  return (globalDb.dogClubDb ??= mkdir(join(process.cwd(), ".data"), {
    recursive: true,
  })
    .then(() => PGlite.create(join(process.cwd(), ".data/postgres")))
    .then(initialise)
    .catch((error) => {
      globalDb.dogClubDb = undefined;
      throw error;
    }));
}
// Always scope a transaction before switching to the restricted role. No tenant query uses the owner connection.
export async function scoped<T>(
  db: PGlite,
  accountId: string,
  clubId: string,
  publicOnly: boolean,
  work: (tx: Transaction) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await tx.query(
      "SELECT set_config('app.account_id',$1,true), set_config('app.club_id',$2,true), set_config('app.public',$3,true)",
      [accountId, clubId, String(publicOnly)],
    );
    await tx.exec("SET LOCAL ROLE club_app");
    return work(tx);
  });
}
