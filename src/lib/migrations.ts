import type { Db } from "./database";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Supabase migrations are the single schema source. The Supabase CLI applies them in production;
// this applies the same files, in the same order, to local PGlite databases.
export const migrationsDir = join(process.cwd(), "supabase/migrations");

export async function migrate(db: Db) {
  const names = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => f.slice(0, -4));
  await db.transaction(async (tx) => {
    await tx.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    // Local databases created before the base schema was tracked already have it.
    if (
      (
        await tx.query(
          "SELECT 1 FROM information_schema.tables WHERE table_name='clubs'",
        )
      ).rows.length
    )
      await tx.exec(
        `INSERT INTO schema_migrations(name) VALUES('${names[0]}') ON CONFLICT DO NOTHING`,
      );
    for (const name of names) {
      const applied = await tx.query(
        "SELECT name FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (applied.rows.length) continue;
      await tx.exec(await readFile(join(migrationsDir, `${name}.sql`), "utf8"));
      await tx.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    }
  });
}
