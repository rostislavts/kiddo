import { eq, sql, count, sum, countDistinct, and, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database, QueryDb } from "@/db";
import * as s from "@/db/schema";
import { assert } from "@/lib/errors";
import { challengeInput, challengeSchemas, missionInput, escapeSchema } from "@/lib/ai/schemas";
import { aiConfigSchema } from "@/lib/ai/models";
export async function labAdmin(tx: QueryDb, userId: string) {
  const [user] = await tx.select().from(s.users).where(eq(s.users.id, userId));
  assert(user?.role === "admin", "Нямаш достъп.", "forbidden", 403);
}
export async function saveAISettings(
  database: Database,
  userId: string,
  raw: unknown,
  version: number,
) {
  const configuration = aiConfigSchema.parse(raw);
  return database.transaction(async (tx) => {
    await labAdmin(tx, userId);
    const [current] = await tx
      .select()
      .from(s.aiSettings)
      .where(eq(s.aiSettings.id, "lab"))
      .for("update");
    assert(current?.version === version, "Настройките са променени. Презареди.", "conflict", 409);
    return (
      await tx
        .update(s.aiSettings)
        .set({ configuration, version: version + 1, updatedAt: new Date() })
        .where(eq(s.aiSettings.id, "lab"))
        .returning()
    )[0];
  });
}
export async function saveChallenge(database: Database, userId: string, raw: unknown) {
  const input = challengeInput.parse(raw);
  const configuration = challengeSchemas[input.type].parse(input.configuration) as Record<
    string,
    unknown
  >;
  return database.transaction(async (tx) => {
    await labAdmin(tx, userId);
    const { id, expectedVersion, ...fields } = input;
    const [original] = id
      ? await tx.select().from(s.labChallenges).where(eq(s.labChallenges.id, id)).for("update")
      : [];
    if (id) {
      assert(original, "Задачата не е намерена.", "not_found", 404);
      assert(
        original.version === expectedVersion,
        "Задачата е променена. Презареди.",
        "conflict",
        409,
      );
      assert(original.type === input.type, "Видът на задачата не може да се променя.");
    }
    if (input.type === "escape-rooms") {
      const room = escapeSchema.parse(configuration);
      assert(
        new Set(room.challengeIds).size === room.challengeIds.length,
        "Стъпките трябва да са различни.",
      );
      for (const challengeId of room.challengeIds) {
        const [step] = await tx
          .select()
          .from(s.labChallenges)
          .where(eq(s.labChallenges.id, challengeId));
        assert(
          step && !["escape-rooms", "projects"].includes(step.type),
          "Стъпките трябва да сочат към изпълним Lab инструмент.",
        );
        if (input.status === "published")
          assert(step.status === "published", "Публикувай всяка стъпка преди стаята.");
      }
      if (id) {
        const [run] = await tx
          .select()
          .from(s.escapeRoomRuns)
          .where(eq(s.escapeRoomRuns.roomId, id))
          .limit(1);
        assert(
          !run || JSON.stringify(original.configuration) === JSON.stringify(configuration),
          "Тази стая вече има участници. Създай нова стая за различни стъпки.",
          "conflict",
          409,
        );
      }
    }
    const values = {
      ...fields,
      configuration,
      version: (original?.version ?? 0) + 1,
      updatedAt: new Date(),
    };
    const [row] = id
      ? await tx.update(s.labChallenges).set(values).where(eq(s.labChallenges.id, id)).returning()
      : await tx.insert(s.labChallenges).values(values).returning();
    if (
      input.type === "escape-rooms" &&
      (!original || JSON.stringify(original.configuration) !== JSON.stringify(configuration))
    ) {
      await tx.delete(s.escapeRoomSteps).where(eq(s.escapeRoomSteps.roomId, row.id));
      await tx.insert(s.escapeRoomSteps).values(
        escapeSchema.parse(configuration).challengeIds.map((challengeId, position) => ({
          roomId: row.id,
          challengeId,
          position,
        })),
      );
    }
    return row;
  });
}
export async function saveFeaturedMission(database: Database, userId: string, raw: unknown) {
  const input = missionInput.parse(raw);
  return database.transaction(async (tx) => {
    await labAdmin(tx, userId);
    const [challenge] = await tx
      .select()
      .from(s.labChallenges)
      .where(eq(s.labChallenges.id, input.challengeId));
    assert(challenge, "Задачата не е намерена.");
    if (input.status === "published")
      assert(challenge.status === "published", "Първо публикувай задачата.");
    const { id, startsAt, endsAt, ...fields } = input;
    const values = {
      ...fields,
      featureType: challenge.type,
      configuration: {},
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    };
    if (id) {
      const [existing] = await tx
        .select()
        .from(s.featuredMissions)
        .where(eq(s.featuredMissions.id, id))
        .for("update");
      assert(existing, "Мисията не е намерена.");
      const [completed] = await tx
        .select()
        .from(s.missionCompletions)
        .where(eq(s.missionCompletions.missionId, id))
        .limit(1);
      assert(
        !completed ||
          (existing.challengeId === input.challengeId &&
            existing.startsAt.toISOString() === startsAt &&
            existing.endsAt.toISOString() === endsAt),
        "Мисията има завършвания. Създай нова за следващ период.",
        "conflict",
        409,
      );
      return (
        await tx
          .update(s.featuredMissions)
          .set(values)
          .where(eq(s.featuredMissions.id, id))
          .returning()
      )[0];
    }
    return (await tx.insert(s.featuredMissions).values(values).returning())[0];
  });
}
export async function saveLabAchievement(database: Database, userId: string, raw: unknown) {
  const input = z
    .object({
      id: z.uuid().optional(),
      key: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(80),
      title: z.string().min(2).max(100),
      description: z.string().min(2).max(500),
      event: z.enum([
        "prompt_playground_run",
        "prompt_battle_completed",
        "bot_tested",
        "agent_mission_completed",
        "knowledge_query_run",
        "detective_challenge_completed",
        "image_generated",
        "escape_room_completed",
        "creator_project_completed",
        "monthly_mission_completed",
        "game_completed",
      ]),
      count: z.number().int().min(1).max(1000),
      published: z.boolean(),
    })
    .strict()
    .parse(raw);
  await labAdmin(database, userId);
  const { id, event, count, ...fields } = input;
  const values = { ...fields, icon: "sparkles", criteria: { type: "lab" as const, event, count } };
  if (id) {
    const [old] = await database.select().from(s.achievements).where(eq(s.achievements.id, id));
    assert(old?.criteria.type === "lab", "Избери Lab значка.");
    return (
      await database.update(s.achievements).set(values).where(eq(s.achievements.id, id)).returning()
    )[0];
  }
  return (await database.insert(s.achievements).values(values).returning())[0];
}
export async function labTelemetry(database: QueryDb) {
  const runs = await database
    .select({
      feature: s.aiRuns.feature,
      status: s.aiRuns.status,
      runs: count(),
      energy: sum(s.aiRuns.energyUsed),
      estimatedUsd: sql<string>`sum((${s.aiRuns.outputMetadata}->>'estimatedCostUsd')::numeric)`,
    })
    .from(s.aiRuns)
    .groupBy(s.aiRuns.feature, s.aiRuns.status);
  const events = await database
    .select({ event: s.analytics.event, total: count() })
    .from(s.analytics)
    .groupBy(s.analytics.event);
  const subscribers = await database
    .select({ userId: s.subscriptions.userId, status: s.subscriptions.status, total: count() })
    .from(s.subscriptions)
    .groupBy(s.subscriptions.userId, s.subscriptions.status);
  const activeDays = await database.execute(
    sql`select date_trunc('day', started_at) as day, count(distinct child_profile_id) as children, count(distinct user_id) as families from ai_runs where status='completed' group by 1 order by 1 desc limit 30`,
  );
  const [accounts] = await database.select({ total: count() }).from(s.users);
  const [converted] = await database
    .select({ total: countDistinct(s.subscriptions.userId) })
    .from(s.subscriptions)
    .where(eq(s.subscriptions.paddlePriceId, process.env.PADDLE_MONTHLY_PRICE_ID ?? ""));
  const [active] = await database
    .select({ total: countDistinct(s.subscriptions.userId) })
    .from(s.subscriptions)
    .where(
      and(
        eq(s.subscriptions.paddlePriceId, process.env.PADDLE_MONTHLY_PRICE_ID ?? ""),
        inArray(s.subscriptions.status, ["active", "trialing"]),
        gt(s.subscriptions.periodEnd, new Date()),
      ),
    );
  const perSubscriber = await database
    .select({
      userId: s.aiRuns.userId,
      runs: count(),
      children: countDistinct(s.aiRuns.childId),
      energy: sum(s.aiRuns.energyUsed),
      estimatedUsd: sql<string>`sum((${s.aiRuns.outputMetadata}->>'estimatedCostUsd')::numeric)`,
      unpricedRuns: sql<number>`count(*) filter(where ${s.aiRuns.outputMetadata}->>'estimatedCostUsd' is null)`,
    })
    .from(s.aiRuns)
    .where(gt(s.aiRuns.startedAt, new Date(Date.now() - 30 * 86400000)))
    .groupBy(s.aiRuns.userId)
    .limit(200);
  const participation = await database
    .select({
      challengeId: s.labAttempts.challengeId,
      children: countDistinct(s.labAttempts.childId),
      attempts: count(),
      passed: sql<number>`count(*) filter(where ${s.labAttempts.passed})`,
    })
    .from(s.labAttempts)
    .groupBy(s.labAttempts.challengeId);
  const projects = await database
    .select({
      feature: s.labProjects.feature,
      total: count(),
      children: countDistinct(s.labProjects.childId),
    })
    .from(s.labProjects)
    .groupBy(s.labProjects.feature);
  const retention = await database.execute(
    sql`select count(*) as active_children, count(*) filter(where weeks >= 2) as returning_across_weeks from (select child_profile_id, count(distinct date_trunc('week',started_at)) as weeks from ai_runs where status='completed' and started_at > now()-interval '30 days' group by child_profile_id) cohort`,
  );
  const [churn] = await database
    .select({ families: countDistinct(s.subscriptions.userId) })
    .from(s.subscriptions)
    .where(
      and(
        eq(s.subscriptions.status, "canceled"),
        gt(s.subscriptions.updatedAt, new Date(Date.now() - 30 * 86400000)),
      ),
    );
  return {
    runs,
    events,
    subscribers,
    activeDays,
    conversion: {
      accounts: accounts.total,
      everSubscribed: converted.total,
      activeFamilies: active.total,
      percent: accounts.total ? Math.round((converted.total / accounts.total) * 10000) / 100 : 0,
    },
    perSubscriber,
    participation,
    projects,
    retention,
    canceledFamiliesLast30Days: churn.families,
  };
}
