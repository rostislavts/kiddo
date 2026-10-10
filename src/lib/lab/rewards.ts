import { and, eq, count, sql } from "drizzle-orm";
import type { QueryDb } from "@/db";
import * as s from "@/db/schema";
import { awardXp } from "@/lib/learning/service";
export async function labReward(
  tx: QueryDb,
  userId: string,
  childId: string,
  event: string,
  referenceId: string,
  xp = 0,
) {
  if (event.endsWith("_completed")) {
    const [old] = await tx
      .select({ id: s.analytics.id })
      .from(s.analytics)
      .where(
        and(
          eq(s.analytics.childId, childId),
          eq(s.analytics.event, event),
          sql`${s.analytics.properties}->>'reference_id' = ${referenceId}`,
        ),
      )
      .limit(1);
    if (old) return 0;
  }
  const awarded = await awardXp(tx, childId, event, referenceId, xp);
  // Reward events (with XP) are emitted only once. Non-reward activity is intentionally repeatable.
  if (xp > 0 && !awarded) return 0;
  await tx
    .insert(s.analytics)
    .values({ userId, childId, event, properties: { reference_id: referenceId } });
  const definitions = await tx
    .select()
    .from(s.achievements)
    .where(eq(s.achievements.published, true));
  for (const definition of definitions) {
    const criteria = definition.criteria;
    if (criteria.type !== "lab" || criteria.event !== event) continue;
    const [n] = await tx
      .select({ value: count() })
      .from(s.analytics)
      .where(and(eq(s.analytics.childId, childId), eq(s.analytics.event, event)));
    if (n.value >= criteria.count)
      await tx
        .insert(s.childAchievements)
        .values({ childId, achievementId: definition.id })
        .onConflictDoNothing();
  }
  return awarded;
}
