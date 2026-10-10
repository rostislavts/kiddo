import { and, asc, eq, sql, sum } from "drizzle-orm";
import type { Database, QueryDb, Transaction } from "@/db";
import * as s from "@/db/schema";
import {
  lessonContentSchema,
  publicBlocks,
  publicQuestion,
  type Answer,
} from "@/lib/content/schema";
import { canAccessPremium } from "@/lib/billing/entitlements";
import { completedWorldIds, lessonUnlocked, worldAccess } from "./unlocks";
import { assert } from "@/lib/errors";
import { isCorrect, mastery, quizPercentage } from "@/lib/quiz/scoring";
import { earnedAchievement, levelForXp } from "@/lib/gamification/rules";
import { thresholds } from "@/lib/config";

export async function catalog(database: QueryDb) {
  const worldRows = await database
    .select({ world: s.worlds })
    .from(s.worlds)
    .innerJoin(s.tracks, eq(s.tracks.id, s.worlds.trackId))
    .where(and(eq(s.worlds.published, true), eq(s.tracks.published, true)))
    .orderBy(asc(s.worlds.sortOrder), asc(s.worlds.id));
  const worlds = worldRows.map((row) => row.world);
  const worldSet = new Set(worlds.map((w) => w.id));
  const lessons = (
    await database
      .select()
      .from(s.lessons)
      .where(eq(s.lessons.published, true))
      .orderBy(asc(s.lessons.sortOrder), asc(s.lessons.id))
  ).filter((l) => worldSet.has(l.worldId));
  return { worlds, lessons };
}
export async function ownedChild(database: QueryDb, userId: string, childId: string, lock = false) {
  const query = database
    .select()
    .from(s.children)
    .where(and(eq(s.children.id, childId), eq(s.children.parentId, userId)));
  const [child] = lock ? await query.for("update") : await query;
  assert(child, "Профилът не е намерен.", "not_found", 404);
  return child;
}
export async function snapshot(database: QueryDb, userId: string, childId: string) {
  const child = await ownedChild(database, userId, childId);
  const { worlds, lessons } = await catalog(database);
  const progress = await database.select().from(s.progress).where(eq(s.progress.childId, childId));
  const subscriptions = await database
    .select()
    .from(s.subscriptions)
    .where(eq(s.subscriptions.userId, userId));
  const completed = new Set(
    progress.filter((p) => p.status === "completed").map((p) => p.lessonId),
  );
  const completedWorlds = completedWorldIds(worlds, lessons, completed);
  const historicalWorlds = await database
    .select()
    .from(s.worldCompletions)
    .where(eq(s.worldCompletions.childId, childId));
  historicalWorlds.forEach((entry) => completedWorlds.add(entry.worldId));
  const [xp] = await database
    .select({ total: sum(s.xpEvents.xp) })
    .from(s.xpEvents)
    .where(eq(s.xpEvents.childId, childId));
  const levels = await database.select().from(s.levels).orderBy(asc(s.levels.minXp));
  const earned = await database
    .select({ achievement: s.achievements, earnedAt: s.childAchievements.earnedAt })
    .from(s.childAchievements)
    .innerJoin(s.achievements, eq(s.achievements.id, s.childAchievements.achievementId))
    .where(eq(s.childAchievements.childId, childId));
  const totalXp = Number(xp?.total || 0);
  return {
    child,
    worlds,
    lessons,
    progress,
    completed,
    completedWorlds,
    totalXp,
    levels,
    level: levelForXp(totalXp, levels),
    earned,
    premium: canAccessPremium(subscriptions, process.env.PADDLE_MONTHLY_PRICE_ID),
  };
}
export type LearningSnapshot = Awaited<ReturnType<typeof snapshot>>;

async function accessibleLesson(
  database: QueryDb,
  userId: string,
  childId: string,
  lessonId: string,
) {
  const state = await snapshot(database, userId, childId);
  const lesson = state.lessons.find((l) => l.id === lessonId);
  assert(lesson, "Този урок вече не е достъпен.", "not_found", 404);
  const world = state.worlds.find((w) => w.id === lesson.worldId)!;
  const access = worldAccess(world, state.completedWorlds);
  assert(access === "available", "Първо завърши предишния свят.", access, 403);
  assert(
    lessonUnlocked(
      lessonId,
      state.lessons.filter((l) => l.worldId === world.id),
      state.completed,
      world.sequentialLessons,
    ),
    "Първо завърши предишния урок.",
    "locked",
    403,
  );
  return { state, lesson, world };
}
async function getContent(database: QueryDb, lessonId: string, version: number) {
  const [record] = await database
    .select()
    .from(s.lessonVersions)
    .where(and(eq(s.lessonVersions.lessonId, lessonId), eq(s.lessonVersions.version, version)));
  assert(record, "Съдържанието на урока временно не е достъпно.", "content", 422);
  const parsed = lessonContentSchema.safeParse(record.content);
  assert(
    parsed.success,
    "Този урок има нужда от малка поправка. Избери друга мисия.",
    "content",
    422,
  );
  return parsed.data;
}
async function event(
  tx: QueryDb,
  userId: string,
  childId: string,
  name: string,
  properties: Record<string, string | number | boolean>,
) {
  await tx.insert(s.analytics).values({ userId, childId, event: name, properties });
}
export async function awardXp(
  tx: QueryDb,
  childId: string,
  type: string,
  referenceId: string,
  xp: number,
) {
  if (xp <= 0) return 0;
  const rows = await tx
    .insert(s.xpEvents)
    .values({ childId, eventType: type, referenceId, xp })
    .onConflictDoNothing()
    .returning({ xp: s.xpEvents.xp });
  return rows[0]?.xp ?? 0;
}
export async function startLesson(
  database: Database,
  userId: string,
  childId: string,
  lessonId: string,
) {
  return database.transaction(async (tx) => {
    await ownedChild(tx, userId, childId, true);
    const { state, lesson } = await accessibleLesson(tx, userId, childId, lessonId);
    let row = state.progress.find((p) => p.lessonId === lessonId);
    if (!row) {
      [row] = await tx
        .insert(s.progress)
        .values({ childId, lessonId, version: lesson.contentVersion })
        .returning();
      await event(tx, userId, childId, "lesson_started", { lesson_id: lessonId });
    }
    // In-progress learning is pinned to an immutable content version, even after CMS edits.
    const content = await getContent(tx, lessonId, row.version);
    const [activeAttempt] = await tx
      .select()
      .from(s.attempts)
      .where(
        and(
          eq(s.attempts.childId, childId),
          eq(s.attempts.lessonId, lessonId),
          eq(s.attempts.status, "in_progress"),
        ),
      );
    const savedAnswers = activeAttempt
      ? await tx.select().from(s.answers).where(eq(s.answers.attemptId, activeAttempt.id))
      : [];
    return {
      lesson: { id: lesson.id, title: lesson.title, xpReward: lesson.xpReward },
      version: row.version,
      currentStep: row.currentStep,
      completed: row.status === "completed",
      bestScore: row.bestScore,
      blocks: publicBlocks(content.blocks),
      questions: content.questions.map(publicQuestion),
      attempt: activeAttempt ? { id: activeAttempt.id, number: activeAttempt.number } : null,
      answers: savedAnswers.map((a) => ({
        questionId: a.questionId,
        answer: a.answer,
        isCorrect: a.isCorrect,
        xpAwarded: a.xpAwarded,
        explanation: content.questions.find((q) => q.id === a.questionId)?.explanation ?? "",
      })),
    };
  });
}
export type LessonSession = Awaited<ReturnType<typeof startLesson>>;

export async function completeStep(
  database: Database,
  userId: string,
  childId: string,
  lessonId: string,
  step: number,
  version: number,
  answer?: Answer,
) {
  return database.transaction(async (tx) => {
    await ownedChild(tx, userId, childId, true);
    await accessibleLesson(tx, userId, childId, lessonId);
    const [row] = await tx
      .select()
      .from(s.progress)
      .where(and(eq(s.progress.childId, childId), eq(s.progress.lessonId, lessonId)));
    assert(row && row.version === version, "Зареди урока отново.", "stale", 409);
    const content = await getContent(tx, lessonId, version);
    assert(
      step >= 0 && step < content.blocks.length && step <= row.currentStep,
      "Завърши текущата стъпка.",
    );
    const block = content.blocks[step];
    let feedback: { isCorrect: boolean; explanation: string } | null = null;
    if ("question" in block) {
      assert(answer && Object.keys(answer).length > 0, "Избери отговор.");
      feedback = {
        isCorrect: isCorrect(block.question, answer),
        explanation: block.question.explanation,
      };
    }
    if (step === row.currentStep) {
      await tx
        .update(s.progress)
        .set({ currentStep: step + 1, lastActivityAt: new Date() })
        .where(eq(s.progress.id, row.id));
      await event(tx, userId, childId, "lesson_step_completed", {
        lesson_id: lessonId,
        step,
        ...(feedback ? { first_attempt_correct: feedback.isCorrect } : {}),
      });
    }
    return { currentStep: Math.max(row.currentStep, step + 1), feedback };
  });
}
export async function startQuiz(
  database: Database,
  userId: string,
  childId: string,
  lessonId: string,
) {
  return database.transaction(async (tx) => {
    await ownedChild(tx, userId, childId, true);
    await accessibleLesson(tx, userId, childId, lessonId);
    const [row] = await tx
      .select()
      .from(s.progress)
      .where(and(eq(s.progress.childId, childId), eq(s.progress.lessonId, lessonId)));
    assert(row, "Първо отвори урока.");
    const content = await getContent(tx, lessonId, row.version);
    assert(row.currentStep >= content.blocks.length, "Първо завърши стъпките на урока.");
    const previous = await tx
      .select()
      .from(s.attempts)
      .where(and(eq(s.attempts.childId, childId), eq(s.attempts.lessonId, lessonId)));
    const active = previous.find((a) => a.status === "in_progress");
    if (active) return { id: active.id, number: active.number };
    const number = Math.max(0, ...previous.map((a) => a.number)) + 1;
    const [attempt] = await tx
      .insert(s.attempts)
      .values({ childId, lessonId, version: row.version, number })
      .returning();
    await event(tx, userId, childId, number > 1 ? "quiz_retried" : "quiz_started", {
      lesson_id: lessonId,
      attempt_number: number,
    });
    return { id: attempt.id, number };
  });
}
async function ownedAttempt(tx: Transaction, userId: string, childId: string, attemptId: string) {
  await ownedChild(tx, userId, childId, true);
  const [attempt] = await tx
    .select()
    .from(s.attempts)
    .where(and(eq(s.attempts.id, attemptId), eq(s.attempts.childId, childId)));
  assert(attempt, "Тестът не е намерен.", "not_found", 404);
  const access = await accessibleLesson(tx, userId, childId, attempt.lessonId);
  return { attempt, ...access, content: await getContent(tx, attempt.lessonId, attempt.version) };
}
export async function answerQuestion(
  database: Database,
  userId: string,
  childId: string,
  attemptId: string,
  questionId: string,
  answer: Answer,
) {
  return database.transaction(async (tx) => {
    const { attempt, content } = await ownedAttempt(tx, userId, childId, attemptId);
    const question = content.questions.find((q) => q.id === questionId);
    assert(question, "Въпросът не е намерен.");
    const saved = await tx.select().from(s.answers).where(eq(s.answers.attemptId, attemptId));
    const existing = saved.find((a) => a.questionId === questionId);
    if (existing)
      return {
        questionId,
        answer: existing.answer,
        isCorrect: existing.isCorrect,
        explanation: question.explanation,
        xpAwarded: existing.xpAwarded,
      };
    assert(attempt.status === "in_progress", "Този опит вече е приключил.");
    assert(content.questions[saved.length]?.id === questionId, "Отговори на текущия въпрос.");
    assert(Object.keys(answer).length > 0, "Избери отговор.");
    const correct = isCorrect(question, answer);
    const xp = correct
      ? await awardXp(tx, childId, "quiz_answer", `${attempt.lessonId}:${questionId}`, question.xp)
      : 0;
    await tx
      .insert(s.answers)
      .values({ attemptId, questionId, answer, isCorrect: correct, xpAwarded: xp });
    await tx
      .update(s.progress)
      .set({ lastActivityAt: new Date() })
      .where(and(eq(s.progress.childId, childId), eq(s.progress.lessonId, attempt.lessonId)));
    await event(tx, userId, childId, "quiz_answered", {
      lesson_id: attempt.lessonId,
      question_id: questionId,
      attempt_number: attempt.number,
      first_attempt_correct: correct,
    });
    return {
      questionId,
      answer,
      isCorrect: correct,
      explanation: question.explanation,
      xpAwarded: xp,
    };
  });
}
export async function finishQuiz(
  database: Database,
  userId: string,
  childId: string,
  attemptId: string,
) {
  return database.transaction(async (tx) => {
    const { attempt, content, lesson, world } = await ownedAttempt(tx, userId, childId, attemptId);
    const saved = await tx.select().from(s.answers).where(eq(s.answers.attemptId, attemptId));
    assert(saved.length === content.questions.length, "Отговори на всички въпроси.");
    const score = saved.filter((a) => a.isCorrect).length;
    const percentage = quizPercentage(score, content.questions.length);
    const result = mastery(percentage, thresholds());
    const newAchievements: string[] = [];
    let awarded = 0;
    if (attempt.status !== "completed") {
      const now = new Date();
      await tx
        .update(s.attempts)
        .set({
          status: "completed",
          score,
          maxScore: content.questions.length,
          percentage,
          completedAt: now,
        })
        .where(eq(s.attempts.id, attemptId));
      await event(tx, userId, childId, "quiz_completed", {
        lesson_id: lesson.id,
        quiz_score: percentage,
        attempt_number: attempt.number,
      });
      const [p] = await tx
        .select()
        .from(s.progress)
        .where(and(eq(s.progress.childId, childId), eq(s.progress.lessonId, lesson.id)));
      const completes = result !== "retry";
      await tx
        .update(s.progress)
        .set({
          bestScore: Math.max(p.bestScore, percentage),
          status: completes ? "completed" : p.status,
          completedAt: completes ? (p.completedAt ?? now) : p.completedAt,
          lastActivityAt: now,
        })
        .where(eq(s.progress.id, p.id));
      if (completes && p.status !== "completed") {
        awarded += await awardXp(tx, childId, "lesson_completed", lesson.id, lesson.xpReward);
        await event(tx, userId, childId, "lesson_completed", {
          lesson_id: lesson.id,
          world_id: world.id,
        });
      }
      const updated = await snapshot(tx, userId, childId);
      if (updated.completedWorlds.has(world.id)) {
        const firstCompletion = await tx
          .insert(s.worldCompletions)
          .values({ childId, worldId: world.id })
          .onConflictDoNothing()
          .returning();
        if (firstCompletion.length) {
          awarded += await awardXp(tx, childId, "world_completed", world.id, world.xpReward);
          await event(tx, userId, childId, "world_completed", { world_id: world.id });
        }
      }
      const definitions = await tx
        .select()
        .from(s.achievements)
        .where(eq(s.achievements.published, true));
      const perfect =
        percentage === 100 ||
        (
          await tx
            .select({ id: s.attempts.id })
            .from(s.attempts)
            .where(and(eq(s.attempts.childId, childId), eq(s.attempts.percentage, 100)))
            .limit(1)
        ).length > 0;
      const stats = {
        lessons: updated.completed.size,
        worlds: updated.completedWorlds.size,
        xp: updated.totalXp,
        perfectQuiz: perfect,
        worldSlugs: updated.worlds
          .filter((w) => updated.completedWorlds.has(w.id))
          .map((w) => w.slug),
      };
      const [xpTotal] = await tx
        .select({ total: sum(s.xpEvents.xp) })
        .from(s.xpEvents)
        .where(eq(s.xpEvents.childId, childId));
      stats.xp = Number(xpTotal.total || 0);
      for (const definition of definitions) {
        if (!earnedAchievement(definition.criteria, stats)) continue;
        const earned = await tx
          .insert(s.childAchievements)
          .values({ childId, achievementId: definition.id })
          .onConflictDoNothing()
          .returning();
        if (earned.length) {
          newAchievements.push(definition.title);
          await event(tx, userId, childId, "achievement_earned", { achievement_id: definition.id });
        }
      }
    }
    const [xp] = await tx
      .select({ total: sum(s.xpEvents.xp) })
      .from(s.xpEvents)
      .where(eq(s.xpEvents.childId, childId));
    return {
      percentage,
      result,
      score,
      total: content.questions.length,
      xpAwarded: awarded,
      totalXp: Number(xp.total || 0),
      newAchievements,
      worldSlug: world.slug,
    };
  });
}
export type QuizResult = Awaited<ReturnType<typeof finishQuiz>>;

export async function recentActivity(database: QueryDb, childId: string) {
  return database
    .select({
      title: s.lessons.title,
      at: s.progress.lastActivityAt,
      score: s.progress.bestScore,
      status: s.progress.status,
    })
    .from(s.progress)
    .innerJoin(s.lessons, eq(s.lessons.id, s.progress.lessonId))
    .where(eq(s.progress.childId, childId))
    .orderBy(sql`${s.progress.lastActivityAt} desc`)
    .limit(5);
}
