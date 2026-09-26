import { migrate } from "./migrations";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { hashPassword } from "./passwords";
export { hashPassword, verifyPassword } from "./passwords";

// The subset of PGlite's API the app uses. PGlite satisfies it directly; pg is wrapped below.
export type Queryable = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(sql: string): Promise<unknown>;
};
export type Db = Queryable & {
  transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

function wrap(client: pg.Pool | pg.PoolClient): Queryable {
  return {
    query: async <T>(sql: string, params?: unknown[]) => {
      const r = await client.query(sql, params);
      return { rows: r.rows as T[], affectedRows: r.rowCount ?? 0 };
    },
    exec: (sql) => client.query(sql),
  };
}

// Production PostgreSQL (Supabase). Migrations are applied with the Supabase CLI, never at runtime.
export function postgresDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 5 });
  return {
    ...wrap(pool),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(wrap(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

// Test harness for a shared database: one outer transaction that close() always rolls back,
// so synthetic seed data is never committed. App transactions become savepoints.
export async function rollbackOnlyDb(connectionString: string): Promise<Db> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  await client.query("BEGIN");
  const raw = wrap(client as unknown as pg.PoolClient);
  const transaction: Db["transaction"] = async (work) => {
    await client.query("SAVEPOINT app_tx");
    try {
      const result = await work(raw);
      await client.query("RELEASE SAVEPOINT app_tx");
      return result;
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT app_tx");
      throw error;
    } finally {
      // SET LOCAL ROLE outlives a released savepoint; drop back to the owner role.
      await client.query("RESET ROLE");
    }
  };
  return {
    // Isolate every statement so one failure cannot abort the outer transaction.
    query: (sql, params) => transaction((tx) => tx.query(sql, params)),
    exec: (sql) => transaction((tx) => tx.exec(sql)),
    transaction,
    close: async () => {
      await client.query("ROLLBACK");
      await client.end();
    },
  };
}

// Synthetic demo records. Local PGlite and rolled-back test runs only.
export async function seed(db: Db) {
  await db.transaction(async (tx) => {
    await tx.exec(
      `INSERT INTO clubs(id,slug,name,tagline,colour,location,avatar_tone,emblem) VALUES ('willow','willow','The Willow Club','Good company. Happy dogs.','#235448','Chiswick, London','sand','paw'),('coast','coast','Coast & Canine','A little sea air. A lot of tail wags.','#2e526a','Brighton, Sussex','sage','sparkles');`,
    );
    for (const [id, email] of [
      ["alice", "alice@demo.invalid"],
      ["bea", "bea@demo.invalid"],
      ["manager", "manager@demo.invalid"],
      ["coast-member", "coast@demo.invalid"],
      ["platform-owner", "owner@demo.invalid"],
    ]) {
      await tx.query(
        "INSERT INTO accounts(id,email,password_hash) VALUES ($1,$2,$3)",
        [id, email, hashPassword("PawsTogether!26")],
      );
    }
    await tx.exec(`INSERT INTO platform_owners VALUES ('platform-owner');
  INSERT INTO memberships VALUES ('willow','alice','member'),('willow','bea','member'),('willow','manager','manager'),('coast','coast-member','member');
  INSERT INTO club_locations(id,club_id,name,address_label) VALUES
  ('00000000-0000-4000-8000-000000000101','willow','Main venue','Chiswick, London'),
  ('00000000-0000-4000-8000-000000000102','coast','Main venue','Brighton, Sussex');
  INSERT INTO dogs VALUES
  ('00000000-0000-4000-8000-000000000001','willow','alice','Bertie','Cocker spaniel','Chief crumb inspector. Excellent listener, especially near the biscuit tin.','sand','members'),
  ('00000000-0000-4000-8000-000000000002','willow','bea','Mabel','Golden retriever','Here for the company. Staying for the belly rubs.','rose','public'),
  ('00000000-0000-4000-8000-000000000003','coast','coast-member','Otis','Whippet','Professional beach zoomer and part-time sofa ornament.','sage','private');
  INSERT INTO care_notes VALUES ('willow','00000000-0000-4000-8000-000000000001','Synthetic private care note: ask owner before offering treats.');`);
  });
}

export async function initialise(db: Db) {
  const fresh = !(
    await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name='clubs'",
    )
  ).rows.length;
  await migrate(db);
  if (fresh) await seed(db);
  return db;
}

const globalDb = globalThis as unknown as { dogClubDb?: Promise<Db> };
export function database() {
  if (process.env.DOGCLUB_DB === "supabase") {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
    return (globalDb.dogClubDb ??= Promise.resolve(
      postgresDb(process.env.DATABASE_URL),
    ));
  }
  if (
    process.env.DOGCLUB_LOCAL_DEMO !== "1" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error(
      "Local demo is disabled. Set DOGCLUB_DB=supabase to use production PostgreSQL.",
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
  db: Db,
  accountId: string,
  clubId: string,
  publicOnly: boolean,
  work: (tx: Queryable) => Promise<T>,
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
