import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import type { Database } from "@/db";
import { seedDatabase } from "@/db/seed";
export async function testDatabase() {
  const client = await PGlite.create();
  const database = drizzle(client, { schema });
  await migrate(database, { migrationsFolder: "src/db/migrations" });
  // Drizzle's Pg transaction/query API is identical across these two drivers.
  // The driver adapter is confined to tests; production uses postgres-js only.
  const db = database as unknown as Database;
  await seedDatabase(db);
  return { client, db };
}
