import { PGlite } from "@electric-sql/pglite";
import { initialise, rollbackOnlyDb, seed, type Db } from "../src/lib/database";

// PGlite by default. With DOGCLUB_DB=postgres or supabase, run against DATABASE_URL
// after migrations have been applied, inside a transaction that is always rolled back.
export async function testDatabase(): Promise<Db> {
  if (!["postgres", "supabase"].includes(process.env.DOGCLUB_DB ?? ""))
    return initialise(await PGlite.create());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const db = await rollbackOnlyDb(process.env.DATABASE_URL);
  await seed(db);
  return db;
}
