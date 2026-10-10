import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { testDatabase } from "../helpers/database";
import { createChild } from "@/lib/children/service";
import {
  answerQuestion,
  awardXp,
  completeStep,
  finishQuiz,
  snapshot,
  startLesson,
  startQuiz,
} from "@/lib/learning/service";
import { saveLesson, saveWorld } from "@/lib/admin/service";
import { seedDatabase } from "@/db/seed";
import { lessonSeeds, seedId, worldSeeds } from "@/content/seed/curriculum";
import * as s from "@/db/schema";

let fixture: Awaited<ReturnType<typeof testDatabase>>;
const user = seedId(800),
  other = seedId(801),
  admin = seedId(802),
  childId = seedId(900);
async function prepareQuiz(index = 0) {
  const lesson = lessonSeeds[index];
  const session = await startLesson(fixture.db, user, childId, lesson.id);
  for (let step = session.currentStep; step < lesson.content.blocks.length; step++) {
    const block = lesson.content.blocks[step];
    await completeStep(
      fixture.db,
      user,
      childId,
      lesson.id,
      step,
      session.version,
      "question" in block ? block.question.correct : undefined,
    );
  }
  return startQuiz(fixture.db, user, childId, lesson.id);
}
async function complete(index = 0) {
  const attempt = await prepareQuiz(index);
  for (const q of lessonSeeds[index].content.questions)
    await answerQuestion(fixture.db, user, childId, attempt.id, q.id, q.correct);
  return finishQuiz(fixture.db, user, childId, attempt.id);
}
describe("real PostgreSQL learning transactions", () => {
  beforeAll(async () => {
    vi.stubEnv("PADDLE_MONTHLY_PRICE_ID", "pri_test");
    fixture = await testDatabase();
  });
  afterAll(async () => {
    await fixture.client.close();
    vi.unstubAllEnvs();
  });
  beforeEach(async () => {
    await fixture.db.execute(sql`TRUNCATE users, tracks, achievements, levels CASCADE`);
    await seedDatabase(fixture.db);
    await fixture.db.insert(s.users).values([
      { id: user, email: "parent@example.test" },
      { id: other, email: "other@example.test" },
      { id: admin, email: "admin@example.test", role: "admin" },
    ]);
    await createChild(fixture.db, user, childId, {
      nickname: "Ева",
      avatar: "robot",
      ageBand: "8-9",
    });
  });
  it("creates a child exactly once and isolates families", async () => {
    await createChild(fixture.db, user, childId, {
      nickname: "Ева",
      avatar: "robot",
      ageBand: "8-9",
    });
    expect(await fixture.db.select().from(s.children)).toHaveLength(1);
    await expect(snapshot(fixture.db, other, childId)).rejects.toMatchObject({ status: 404 });
    await expect(startLesson(fixture.db, other, childId, lessonSeeds[0].id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("persists a step and rejects skipping ahead", async () => {
    await startLesson(fixture.db, user, childId, lessonSeeds[0].id);
    await expect(
      completeStep(fixture.db, user, childId, lessonSeeds[0].id, 2, 1),
    ).rejects.toThrow();
    await completeStep(fixture.db, user, childId, lessonSeeds[0].id, 0, 1);
    const resumed = await startLesson(fixture.db, user, childId, lessonSeeds[0].id);
    expect(resumed.currentStep).toBe(1);
    await expect(startQuiz(fixture.db, user, childId, lessonSeeds[0].id)).rejects.toThrow();
  });
  it("scores answers server-side, stores the first answer, and resumes an attempt", async () => {
    const attempt = await prepareQuiz();
    const q = lessonSeeds[0].content.questions[0];
    const first = await answerQuestion(fixture.db, user, childId, attempt.id, q.id, ["a"]);
    expect(first.isCorrect).toBe(false);
    const repeated = await answerQuestion(fixture.db, user, childId, attempt.id, q.id, q.correct);
    expect(repeated.isCorrect).toBe(false);
    const resumed = await startLesson(fixture.db, user, childId, lessonSeeds[0].id);
    expect(resumed.answers).toHaveLength(1);
    expect(resumed.attempt?.id).toBe(attempt.id);
    expect(await startQuiz(fixture.db, user, childId, lessonSeeds[0].id)).toEqual(attempt);
    await expect(finishQuiz(fixture.db, user, childId, attempt.id)).rejects.toThrow();
  });
  it("completes lessons and awards XP/achievements idempotently", async () => {
    const result = await complete();
    expect(result.percentage).toBe(100);
    expect(result.totalXp).toBe(90);
    expect(result.newAchievements).toContain("Първа мисия");
    const [attempt] = await fixture.db.select().from(s.attempts);
    const replay = await finishQuiz(fixture.db, user, childId, attempt.id);
    expect(replay.xpAwarded).toBe(0);
    expect(replay.totalXp).toBe(90);
    expect(replay.newAchievements).toEqual([]);
    const state = await snapshot(fixture.db, user, childId);
    expect(state.completed.has(lessonSeeds[0].id)).toBe(true);
    await complete();
    expect((await snapshot(fixture.db, user, childId)).totalXp).toBe(90);
    expect(await fixture.db.select().from(s.attempts)).toHaveLength(2);
  });
  it("enforces prerequisites for direct calls, then opens every world without payment", async () => {
    await expect(startLesson(fixture.db, user, childId, lessonSeeds[1].id)).rejects.toMatchObject({
      code: "locked",
    });
    await expect(startLesson(fixture.db, user, childId, lessonSeeds[3].id)).rejects.toMatchObject({
      code: "locked",
    });
    await complete(0);
    await complete(1);
    await complete(2);
    await expect(startLesson(fixture.db, user, childId, lessonSeeds[3].id)).resolves.toMatchObject({
      currentStep: 0,
    });
    expect(await fixture.db.select().from(s.subscriptions)).toHaveLength(0);
  });
  it("permits retries after low scores without falsely completing the lesson", async () => {
    const attempt = await prepareQuiz();
    for (const q of lessonSeeds[0].content.questions)
      await answerQuestion(fixture.db, user, childId, attempt.id, q.id, ["wrong"]);
    const failed = await finishQuiz(fixture.db, user, childId, attempt.id);
    expect(failed.result).toBe("retry");
    expect(failed.totalXp).toBe(0);
    expect((await snapshot(fixture.db, user, childId)).completed.size).toBe(0);
    expect((await complete()).percentage).toBe(100);
    expect((await fixture.db.select().from(s.attempts)).map((a) => a.number).sort()).toEqual([
      1, 2,
    ]);
  });
  it("completes an entire free world once and preserves mastery", async () => {
    await complete(0);
    await complete(1);
    const result = await complete(2);
    expect(result.totalXp).toBe(370);
    const state = await snapshot(fixture.db, user, childId);
    expect(state.completedWorlds.has(worldSeeds[0].id)).toBe(true);
    const attempt = await prepareQuiz(0);
    for (const q of lessonSeeds[0].content.questions)
      await answerQuestion(fixture.db, user, childId, attempt.id, q.id, ["wrong"]);
    await finishQuiz(fixture.db, user, childId, attempt.id);
    const [progress] = await fixture.db
      .select()
      .from(s.progress)
      .where(eq(s.progress.lessonId, lessonSeeds[0].id));
    expect(progress.bestScore).toBe(100);
    expect(progress.status).toBe("completed");
  });
  it("uses the ledger constraint for concurrent retries", async () => {
    await Promise.all([
      awardXp(fixture.db, childId, "challenge", "one", 25),
      awardXp(fixture.db, childId, "challenge", "one", 25),
    ]);
    expect((await snapshot(fixture.db, user, childId)).totalXp).toBe(25);
  });
  it("does not relock a completed world when editors add a lesson", async () => {
    await complete(0);
    await complete(1);
    await complete(2);
    await saveLesson(fixture.db, admin, {
      ...lessonSeeds[0],
      id: undefined,
      slug: "another-mission",
      title: "Още една мисия",
      sortOrder: 4,
    });
    expect((await snapshot(fixture.db, user, childId)).completedWorlds.has(worldSeeds[0].id)).toBe(
      true,
    );
  });
  it("pins active progress to an immutable content version", async () => {
    const lesson = lessonSeeds[0];
    await startLesson(fixture.db, user, childId, lesson.id);
    await completeStep(fixture.db, user, childId, lesson.id, 0, 1);
    const newContent = structuredClone(lesson.content);
    newContent.blocks[0].title = "Ново заглавие";
    await saveLesson(fixture.db, admin, { ...lesson, expectedVersion: 1, content: newContent });
    const resumed = await startLesson(fixture.db, user, childId, lesson.id);
    expect(resumed.version).toBe(1);
    expect(resumed.currentStep).toBe(1);
    expect(resumed.blocks[0].title).not.toBe("Ново заглавие");
    const newId = randomUUID();
    await createChild(fixture.db, user, newId, { nickname: "Ники", avatar: "cat", ageBand: "" });
    expect((await startLesson(fixture.db, user, newId, lesson.id)).version).toBe(2);
    await expect(
      saveLesson(fixture.db, admin, { ...lesson, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "conflict" });
  });
  it("protects admin mutations and prevents cyclic prerequisites", async () => {
    await expect(
      saveLesson(fixture.db, user, { ...lessonSeeds[0], expectedVersion: 1 }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      saveWorld(fixture.db, admin, {
        ...worldSeeds[0],
        visual: "robot",
        color: "violet",
        requiredWorldId: worldSeeds[1].id,
      }),
    ).rejects.toThrow("цикъл");
  });
  it("cascades child deletion across progress, answers, XP and analytics", async () => {
    await complete();
    await fixture.db.delete(s.children).where(eq(s.children.id, childId));
    expect(await fixture.db.select().from(s.progress)).toHaveLength(0);
    expect(await fixture.db.select().from(s.answers)).toHaveLength(0);
    expect(await fixture.db.select().from(s.xpEvents)).toHaveLength(0);
    expect(await fixture.db.select().from(s.childAchievements)).toHaveLength(0);
    expect(await fixture.db.select().from(s.analytics)).toHaveLength(0);
  });
  it("enables RLS for all application tables", async () => {
    const result = await fixture.client.query<{ tablename: string; rowsecurity: boolean }>(
      "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'",
    );
    expect(result.rows.length).toBe(48);
    expect(result.rows.every((r) => r.rowsecurity)).toBe(true);
  });
});
