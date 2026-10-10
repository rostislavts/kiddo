import { and, eq, desc, inArray, lte, gt, asc } from "drizzle-orm";
import type { Database } from "@/db";
import * as s from "@/db/schema";
import { ownedChild } from "@/lib/learning/service";
import { energySummary } from "@/lib/ai/energy";
import { aiConfiguration } from "@/lib/ai/settings";
import { publicChallenge } from "./challenges";
export async function labView(database: Database, userId: string, childId: string) {
  const child = await ownedChild(database, userId, childId);
  const energy = await energySummary(database, userId, childId);
  const { config } = await aiConfiguration(database);
  const projects = await database
    .select()
    .from(s.labProjects)
    .where(eq(s.labProjects.childId, childId))
    .orderBy(desc(s.labProjects.updatedAt))
    .limit(100);
  const challenges = (
    await database.select().from(s.labChallenges).where(eq(s.labChallenges.status, "published"))
  ).map(publicChallenge);
  const missions = await database
    .select()
    .from(s.featuredMissions)
    .where(
      and(
        eq(s.featuredMissions.status, "published"),
        lte(s.featuredMissions.startsAt, new Date()),
        gt(s.featuredMissions.endsAt, new Date()),
      ),
    )
    .orderBy(desc(s.featuredMissions.startsAt));
  const history = await database
    .select({
      id: s.aiRuns.id,
      feature: s.aiRuns.feature,
      projectId: s.aiRuns.projectId,
      result: s.aiRuns.result,
      status: s.aiRuns.status,
      energyUsed: s.aiRuns.energyUsed,
      createdAt: s.aiRuns.startedAt,
    })
    .from(s.aiRuns)
    .where(
      and(
        eq(s.aiRuns.childId, childId),
        gt(s.aiRuns.startedAt, new Date(Date.now() - config.historyRetentionDays * 86400000)),
      ),
    )
    .orderBy(desc(s.aiRuns.startedAt))
    .limit(60);
  const cards = projects.length
    ? await database
        .select()
        .from(s.knowledgeCards)
        .where(
          inArray(
            s.knowledgeCards.projectId,
            projects.map((p) => p.id),
          ),
        )
    : [];
  const messages = await database
    .select({
      id: s.botMessages.id,
      projectId: s.botConversations.projectId,
      role: s.botMessages.role,
      content: s.botMessages.content,
      createdAt: s.botMessages.createdAt,
    })
    .from(s.botMessages)
    .innerJoin(s.botConversations, eq(s.botConversations.id, s.botMessages.conversationId))
    .where(eq(s.botConversations.childId, childId))
    .orderBy(desc(s.botMessages.createdAt))
    .limit(100);
  const attempts = await database
    .select({
      id: s.labAttempts.id,
      challengeId: s.labAttempts.challengeId,
      contextKey: s.labAttempts.contextKey,
      passed: s.labAttempts.passed,
      evaluation: s.labAttempts.evaluation,
      output: s.labAttempts.output,
      createdAt: s.labAttempts.createdAt,
    })
    .from(s.labAttempts)
    .where(eq(s.labAttempts.childId, childId))
    .orderBy(desc(s.labAttempts.createdAt))
    .limit(200);
  const escapeRuns = await database
    .select()
    .from(s.escapeRoomRuns)
    .where(eq(s.escapeRoomRuns.childId, childId));
  const escapeSteps = await database
    .select()
    .from(s.escapeRoomSteps)
    .orderBy(asc(s.escapeRoomSteps.position));
  const completions = await database
    .select()
    .from(s.missionCompletions)
    .where(eq(s.missionCompletions.childId, childId));
  const games = await database
    .select({
      projectId: s.aiGameSessions.projectId,
      turn: s.aiGameSessions.turn,
      status: s.aiGameSessions.status,
      narration: s.aiGameTurns.narration,
      choices: s.aiGameTurns.choices,
    })
    .from(s.aiGameSessions)
    .leftJoin(
      s.aiGameTurns,
      and(
        eq(s.aiGameTurns.sessionId, s.aiGameSessions.id),
        eq(s.aiGameTurns.turn, s.aiGameSessions.turn),
      ),
    )
    .where(eq(s.aiGameSessions.childId, childId));
  return {
    childId: child.id,
    nickname: child.nickname,
    energy,
    projects,
    challenges,
    missions,
    history,
    cards,
    messages: messages.reverse(),
    attempts,
    escapeRuns,
    escapeSteps,
    completions,
    games,
    aiReady:
      !!process.env.AI_API_KEY &&
      process.env.AI_PROVIDER === "openai" &&
      process.env.AI_LAB_ENABLED !== "false" &&
      config.enabled,
    costs: Object.fromEntries(
      Object.entries(config.features).map(([key, value]) => [
        key,
        { cost: value.cost, enabled: value.enabled },
      ]),
    ),
    historyLimit: config.maxHistory,
  };
}
export type LabView = Awaited<ReturnType<typeof labView>>;
export async function parentLabSummary(database: Database, userId: string) {
  const energy = await energySummary(database, userId);
  const children = await database
    .select({ id: s.children.id })
    .from(s.children)
    .where(eq(s.children.parentId, userId));
  const ids = children.map((c) => c.id);
  const creations = ids.length
    ? await database
        .select({
          id: s.labProjects.id,
          childId: s.labProjects.childId,
          title: s.labProjects.title,
          feature: s.labProjects.feature,
          state: s.labProjects.state,
          updatedAt: s.labProjects.updatedAt,
        })
        .from(s.labProjects)
        .where(inArray(s.labProjects.childId, ids))
        .orderBy(desc(s.labProjects.updatedAt))
        .limit(60)
    : [];
  const missions = ids.length
    ? await database
        .select({
          childId: s.missionCompletions.childId,
          title: s.featuredMissions.title,
          createdAt: s.missionCompletions.createdAt,
        })
        .from(s.missionCompletions)
        .innerJoin(s.featuredMissions, eq(s.featuredMissions.id, s.missionCompletions.missionId))
        .where(inArray(s.missionCompletions.childId, ids))
    : [];
  const activity = ids.length
    ? await database
        .select({
          childId: s.aiRuns.childId,
          feature: s.aiRuns.feature,
          status: s.aiRuns.status,
          energy: s.aiRuns.energyUsed,
          createdAt: s.aiRuns.startedAt,
        })
        .from(s.aiRuns)
        .where(inArray(s.aiRuns.childId, ids))
        .orderBy(desc(s.aiRuns.startedAt))
        .limit(30)
    : [];
  // No conversation text, prompt, configuration, retrieval excerpts or model output is selected.
  return { energy, creations, missions, activity };
}
