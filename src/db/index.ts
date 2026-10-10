import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type QueryDb = Database | Transaction;
// A single process-wide pool also survives Next.js development reloads.
const globalDatabase = globalThis as typeof globalThis & { academyDatabase?: Database };
export function db(): Database {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing. Follow README.md.");
  const poolSize = Number(process.env.DATABASE_POOL_SIZE || 5);
  if (!Number.isInteger(poolSize) || poolSize < 1 || poolSize > 20)
    throw new Error("Invalid DATABASE_POOL_SIZE");
  globalDatabase.academyDatabase ??= drizzle(
    postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: poolSize,
      idle_timeout: 20,
      connect_timeout: 10,
    }),
    { schema },
  );
  return globalDatabase.academyDatabase;
}
