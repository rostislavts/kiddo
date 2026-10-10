import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { seedDatabase } from "../src/db/seed";
if (!process.env.DATABASE_URL) throw new Error("Попълни DATABASE_URL в .env.");
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  await seedDatabase(drizzle(client, { schema }));
  console.log("Добавени са 2 публикувани свята, 6 урока, 8 бъдещи свята, нива и значки.");
} finally {
  await client.end();
}
