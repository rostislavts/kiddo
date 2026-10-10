import { eq } from "drizzle-orm";
import type { QueryDb } from "@/db";
import { aiSettings } from "@/db/schema";
import { aiConfigSchema, defaultAIConfig } from "./models";
export async function aiConfiguration(database: QueryDb) {
  const [row] = await database.select().from(aiSettings).where(eq(aiSettings.id, "lab"));
  return {
    config: row ? aiConfigSchema.parse(row.configuration) : defaultAIConfig(),
    version: row?.version ?? 0,
  };
}
