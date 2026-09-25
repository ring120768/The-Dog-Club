import { PGlite } from "@electric-sql/pglite";
import { initialise, rollbackOnlyDb, seed, type Db } from "../src/lib/database";

// PGlite by default. With DOGCLUB_DB=supabase, run against DATABASE_URL (migrations already applied
// by the Supabase CLI) inside a transaction that is always rolled back: nothing is committed.
export async function testDatabase(): Promise<Db> {
  if (process.env.DOGCLUB_DB !== "supabase")
    return initialise(await PGlite.create());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const db = await rollbackOnlyDb(process.env.DATABASE_URL);
  await seed(db);
  return db;
}
