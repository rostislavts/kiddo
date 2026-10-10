import "./load-env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { maintainLab } from "../src/lib/lab/maintenance";
if (!process.env.DATABASE_URL) throw new Error("Попълни DATABASE_URL в .env.local.");
const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
try {
  console.log(await maintainLab(drizzle(client, { schema })));
} finally {
  await client.end();
}
