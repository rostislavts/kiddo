import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { initializeEnergy } from "../src/lib/ai/energy";
import { eq } from "drizzle-orm";

const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Попълни DATABASE_URL в .env.local или .env преди миграцията.");
const client = postgres(url, { max: 1, prepare: false });
try {
  await migrate(drizzle(client), { migrationsFolder: "src/db/migrations" });
  // Versioned v2 data migration: recognized subscriptions receive one grant per billing period.
  // No V1 learning, subscription or XP rows are rewritten. Safe on repeated migrations.
  if (process.env.PADDLE_MONTHLY_PRICE_ID) {
    const database = drizzle(client, { schema });
    const owners = await database
      .selectDistinct({ userId: schema.subscriptions.userId })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.paddlePriceId, process.env.PADDLE_MONTHLY_PRICE_ID));
    for (const owner of owners) await initializeEnergy(database, owner.userId);
  }
  console.log("Миграциите са приложени; AI Lab Energy е инициализирана идемпотентно.");
} finally {
  await client.end();
}
