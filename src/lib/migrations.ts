import { hashPassword } from "./passwords";
import type { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Additive, versioned upgrades for both existing and newly seeded local databases.
export async function migrate(db: PGlite) {
  await db.transaction(async (tx) => {
    await tx.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of ["001_dog_photos", "002_operator_branding"]) {
      const applied = await tx.query(
        "SELECT name FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (applied.rows.length) continue;
      await tx.exec(
        await readFile(
          join(process.cwd(), "src/lib/migrations", `${name}.sql`),
          "utf8",
        ),
      );
      if(name === "002_operator_branding") {
        await tx.query("INSERT INTO accounts(id,email,password_hash) VALUES('platform-owner','owner@demo.invalid',$1)", [hashPassword("PawsTogether!26")]);
        await tx.exec("INSERT INTO platform_owners VALUES('platform-owner')");
      }
      await tx.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    }
  });
}
