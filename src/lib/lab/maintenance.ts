import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { Database } from "@/db";
import * as s from "@/db/schema";
import { aiConfiguration } from "@/lib/ai/settings";
import { recoverExpiredRuns, cancelChildRuns } from "@/lib/ai/energy";
import { ownedChild } from "@/lib/learning/service";
export async function deleteLabChild(database: Database, userId: string, childId: string) {
  await database.transaction(async (tx) => {
    await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    await ownedChild(tx, userId, childId, true);
    await cancelChildRuns(tx, userId, childId);
    await tx
      .delete(s.children)
      .where(and(eq(s.children.id, childId), eq(s.children.parentId, userId)));
  });
}
export async function maintainLab(database: Database, now = new Date()) {
  const { config } = await aiConfiguration(database);
  const cutoff = new Date(now.getTime() - config.historyRetentionDays * 86400000);
  const stale = await database
    .selectDistinct({ userId: s.aiRuns.userId })
    .from(s.aiRuns)
    .where(and(inArray(s.aiRuns.status, ["pending", "running"]), lt(s.aiRuns.expiresAt, now)));
  for (const { userId } of stale)
    await database.transaction(async (tx) => {
      await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
      await recoverExpiredRuns(tx, userId, now);
    });
  return database.transaction(async (tx) => {
    const assets = await tx
      .delete(s.labAssets)
      .where(lt(s.labAssets.expiresAt, now))
      .returning({ id: s.labAssets.id });
    // Keep counters, rewards, provenance IDs and billing telemetry; erase raw learner text.
    const runs = await tx
      .update(s.aiRuns)
      .set({ result: { expired: true } })
      .where(
        and(
          lt(s.aiRuns.startedAt, cutoff),
          sql`${s.aiRuns.result}->>'expired' is distinct from 'true'`,
        ),
      )
      .returning({ id: s.aiRuns.id });
    await tx.delete(s.botMessages).where(lt(s.botMessages.createdAt, cutoff));
    await tx
      .update(s.labAttempts)
      .set({ input: {}, output: {}, evaluation: {} })
      .where(lt(s.labAttempts.createdAt, cutoff));
    await tx.delete(s.agentRunSteps).where(lt(s.agentRunSteps.createdAt, cutoff));
    await tx
      .delete(s.knowledgeRetrievals)
      .where(
        inArray(
          s.knowledgeRetrievals.runId,
          tx.select({ id: s.aiRuns.id }).from(s.aiRuns).where(lt(s.aiRuns.startedAt, cutoff)),
        ),
      );
    await tx
      .update(s.aiGameSessions)
      .set({ state: {}, status: "expired" })
      .where(and(lt(s.aiGameSessions.createdAt, cutoff), eq(s.aiGameSessions.status, "active")));
    await tx
      .update(s.aiGameTurns)
      .set({ narration: "Историята е изтекла.", choice: "", choices: [] })
      .where(lt(s.aiGameTurns.createdAt, cutoff));
    await tx.delete(s.rateLimits).where(lt(s.rateLimits.expiresAt, now));
    return {
      assetsDeleted: assets.length,
      historiesCleared: runs.length,
      accountsRecovered: stale.length,
    };
  });
}
