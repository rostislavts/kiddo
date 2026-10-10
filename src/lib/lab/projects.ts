import { and, eq, inArray, desc, count, sql } from "drizzle-orm";
import type { Database, QueryDb } from "@/db";
import * as s from "@/db/schema";
import { ownedChild } from "@/lib/learning/service";
import { assert } from "@/lib/errors";
import {
  projectInput,
  projectSchemas,
  cardInput,
  creatorSchema,
  agentSchema,
} from "@/lib/ai/schemas";
import { aiConfiguration } from "@/lib/ai/settings";
import { localSafety } from "@/lib/ai/safety";
import { labReward } from "./rewards";
import { canUseAILab } from "@/lib/ai/entitlement";
export async function authorizeLabEdit(tx: QueryDb, userId: string, childId: string) {
  await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
  await ownedChild(tx, userId, childId, true);
  assert(
    await canUseAILab(tx, userId, childId),
    "Създаването в AI Lab изисква Premium.",
    "premium",
    403,
  );
}
export async function ownedProject(tx: QueryDb, childId: string, id: string) {
  const [row] = await tx
    .select()
    .from(s.labProjects)
    .where(and(eq(s.labProjects.id, id), eq(s.labProjects.childId, childId)));
  assert(row, "Проектът не е намерен.", "not_found", 404);
  return row;
}
export async function saveProject(
  database: Database,
  userId: string,
  childId: string,
  raw: unknown,
) {
  const input = projectInput.parse(raw);
  const configuration = projectSchemas[input.feature].parse(input.configuration);
  localSafety(
    Object.values(configuration)
      .filter((v) => typeof v === "string" && !/^[0-9a-f-]{36}$/i.test(v))
      .join("\n"),
  );
  return database.transaction(async (tx) => {
    await authorizeLabEdit(tx, userId, childId);
    const { config } = await aiConfiguration(tx);
    let original: typeof s.labProjects.$inferSelect | undefined;
    if (input.id) {
      original = await ownedProject(tx, childId, input.id);
      assert(original.feature === input.feature, "Видът на проекта не може да се променя.");
      assert(
        original.version === input.expectedVersion,
        "Проектът е променен. Презареди страницата.",
        "conflict",
        409,
      );
      const [busy] = await tx
        .select()
        .from(s.aiRuns)
        .where(
          and(
            eq(s.aiRuns.projectId, original.id),
            inArray(s.aiRuns.status, ["running", "pending"]),
          ),
        );
      assert(!busy, "Изчакай AI задачата да завърши.", "busy", 409);
    }
    if (original && input.feature === "games") {
      const [session] = await tx
        .select()
        .from(s.aiGameSessions)
        .where(eq(s.aiGameSessions.projectId, original.id));
      assert(
        !session ||
          session.turn === 0 ||
          JSON.stringify(configuration) ===
            JSON.stringify(projectSchemas.games.parse(original.configuration)),
        "Играта е започнала. Създай нов проект за различни правила.",
        "game_started",
        409,
      );
    }
    if (!original) {
      const [n] = await tx
        .select({ total: count() })
        .from(s.labProjects)
        .where(eq(s.labProjects.childId, childId));
      assert(
        n.total < config.maxProjects,
        "Достигна лимита за проекти. Изтрий ненужен проект.",
        "project_limit",
        409,
      );
    }
    if (
      "knowledgeProjectId" in configuration &&
      typeof configuration.knowledgeProjectId === "string"
    ) {
      const knowledge = await ownedProject(tx, childId, configuration.knowledgeProjectId);
      assert(knowledge.feature === "knowledge", "Избери Knowledge проект.");
    }
    if (input.feature === "projects") {
      const c = creatorSchema.parse(configuration);
      for (const id of c.projectIds) {
        const linked = await ownedProject(tx, childId, id);
        assert(linked.feature !== "projects", "Свържи инструмент, а не друга колекция.");
      }
    }
    const values = {
      childId,
      feature: input.feature,
      title: input.title,
      configuration: configuration as Record<string, unknown>,
      state:
        original && JSON.stringify(original.configuration) === JSON.stringify(configuration)
          ? original.state
          : "draft",
      version: (original?.version ?? 0) + 1,
      updatedAt: new Date(),
    };
    const [project] = original
      ? await tx
          .update(s.labProjects)
          .set(values)
          .where(eq(s.labProjects.id, original.id))
          .returning()
      : await tx.insert(s.labProjects).values(values).returning();
    if (input.feature === "agents") {
      await tx.delete(s.agentProjectTools).where(eq(s.agentProjectTools.projectId, project.id));
      await tx.insert(s.agentProjectTools).values(
        [...new Set(agentSchema.parse(configuration).tools)].map((tool) => ({
          projectId: project.id,
          tool,
        })),
      );
    }
    const event =
      input.feature === "bots"
        ? original
          ? "bot_edited"
          : "bot_created"
        : input.feature === "agents"
          ? "agent_created"
          : input.feature === "knowledge"
            ? "knowledge_project_created"
            : input.feature === "games"
              ? "game_created"
              : input.feature === "projects"
                ? "creator_project_created"
                : "lab_project_saved";
    if (!original || input.feature === "bots")
      await labReward(tx, userId, childId, event, project.id);
    return project;
  });
}
export async function deleteProject(
  database: Database,
  userId: string,
  childId: string,
  id: string,
) {
  return database.transaction(async (tx) => {
    await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    await ownedChild(tx, userId, childId, true);
    await ownedProject(tx, childId, id);
    const [busy] = await tx
      .select()
      .from(s.aiRuns)
      .where(and(eq(s.aiRuns.projectId, id), inArray(s.aiRuns.status, ["running", "pending"])));
    assert(!busy, "Изчакай текущата задача.", "busy", 409);
    await tx
      .update(s.labAttempts)
      .set({ input: {}, output: {}, evaluation: {} })
      .where(
        inArray(
          s.labAttempts.runId,
          tx.select({ id: s.aiRuns.id }).from(s.aiRuns).where(eq(s.aiRuns.projectId, id)),
        ),
      );
    await tx.delete(s.labProjects).where(eq(s.labProjects.id, id));
  });
}
export async function saveCard(database: Database, userId: string, childId: string, raw: unknown) {
  const input = cardInput.parse(raw);
  localSafety(input.title + "\n" + input.content);
  return database.transaction(async (tx) => {
    await authorizeLabEdit(tx, userId, childId);
    const project = await ownedProject(tx, childId, input.projectId);
    assert(project.feature === "knowledge", "Това не е Knowledge проект.");
    const { config } = await aiConfiguration(tx);
    if (input.id) {
      const [row] = await tx
        .update(s.knowledgeCards)
        .set({ title: input.title, content: input.content, updatedAt: new Date() })
        .where(and(eq(s.knowledgeCards.id, input.id), eq(s.knowledgeCards.projectId, project.id)))
        .returning();
      assert(row, "Картата не е намерена.", "not_found", 404);
      return row;
    }
    const [n] = await tx
      .select({ total: count() })
      .from(s.knowledgeCards)
      .where(eq(s.knowledgeCards.projectId, project.id));
    assert(n.total < config.maxCards, "Достигна лимита за Knowledge карти.");
    return (await tx.insert(s.knowledgeCards).values(input).returning())[0];
  });
}
export async function deleteCard(database: Database, userId: string, childId: string, id: string) {
  await ownedChild(database, userId, childId);
  const [card] = await database.select().from(s.knowledgeCards).where(eq(s.knowledgeCards.id, id));
  assert(card, "Картата не е намерена.", "not_found", 404);
  await ownedProject(database, childId, card.projectId);
  await database.delete(s.knowledgeCards).where(eq(s.knowledgeCards.id, id));
}
export async function retrieveKnowledge(
  tx: QueryDb,
  childId: string,
  projectId: string,
  question: string,
) {
  const project = await ownedProject(tx, childId, projectId);
  assert(project.feature === "knowledge", "Избери Knowledge проект.");
  const tokens =
    question
      .toLocaleLowerCase("bg")
      .match(/[\p{L}\p{N}]{3,}/gu)
      ?.slice(0, 20) ?? [];
  if (!tokens.length) return [];
  const query = tokens.join(" | ");
  const vector = sql`to_tsvector('simple', ${s.knowledgeCards.title} || ' ' || ${s.knowledgeCards.content})`;
  return tx
    .select({
      id: s.knowledgeCards.id,
      title: s.knowledgeCards.title,
      content: s.knowledgeCards.content,
    })
    .from(s.knowledgeCards)
    .where(
      and(
        eq(s.knowledgeCards.projectId, projectId),
        sql`${vector} @@ to_tsquery('simple', ${query})`,
      ),
    )
    .orderBy(sql`ts_rank(${vector}, to_tsquery('simple', ${query})) desc`, s.knowledgeCards.id)
    .limit(5);
}
export async function projectList(database: QueryDb, userId: string, childId: string) {
  await ownedChild(database, userId, childId);
  return database
    .select()
    .from(s.labProjects)
    .where(eq(s.labProjects.childId, childId))
    .orderBy(desc(s.labProjects.updatedAt))
    .limit(100);
}
