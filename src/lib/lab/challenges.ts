import { and, eq, count, asc, lte, gt } from "drizzle-orm";
import { z } from "zod";
import type { Database, QueryDb } from "@/db";
import * as s from "@/db/schema";
import { assert } from "@/lib/errors";
import { detectiveSchema, creatorSchema, creatorChallengeSchema } from "@/lib/ai/schemas";
import { normalizeAnswer } from "./evaluation";
import { ownedProject, authorizeLabEdit } from "./projects";
import { attemptContext } from "./context";
import { labReward } from "./rewards";
import { isBasicMission } from "./access-policy";
import { ownedChild } from "@/lib/learning/service";
export async function publishedChallenge(tx: QueryDb, id: string) {
  const [row] = await tx
    .select()
    .from(s.labChallenges)
    .where(and(eq(s.labChallenges.id, id), eq(s.labChallenges.status, "published")));
  assert(row, "Мисията не е достъпна.", "not_found", 404);
  return row;
}
export function publicChallenge(
  row: typeof s.labChallenges.$inferSelect,
): typeof s.labChallenges.$inferSelect {
  if (row.type !== "detective") return row;
  const {
    correctIndex: _index,
    fact: _fact,
    explanation: _explanation,
    ...configuration
  } = detectiveSchema.parse(row.configuration);
  void _index;
  void _fact;
  void _explanation;
  return { ...row, configuration };
}
export async function verifyMissionContext(
  tx: QueryDb,
  childId: string,
  challengeId: string,
  missionId?: string,
  escapeRunId?: string,
) {
  if (escapeRunId) {
    const [run] = await tx
      .select()
      .from(s.escapeRoomRuns)
      .where(and(eq(s.escapeRoomRuns.id, escapeRunId), eq(s.escapeRoomRuns.childId, childId)));
    assert(run && !run.completedAt, "Escape room не е активна.", "locked", 409);
    const [step] = await tx
      .select()
      .from(s.escapeRoomSteps)
      .where(
        and(eq(s.escapeRoomSteps.roomId, run.roomId), eq(s.escapeRoomSteps.position, run.step)),
      );
    assert(step?.challengeId === challengeId, "Първо изпълни текущата стъпка.", "locked", 403);
  }
  if (missionId) {
    const [mission] = await tx
      .select()
      .from(s.featuredMissions)
      .where(
        and(
          eq(s.featuredMissions.id, missionId),
          eq(s.featuredMissions.status, "published"),
          lte(s.featuredMissions.startsAt, new Date()),
          gt(s.featuredMissions.endsAt, new Date()),
        ),
      );
    assert(mission, "Featured мисията не е активна.", "mission_expired", 409);
    if (!escapeRunId)
      assert(mission.challengeId === challengeId, "Тази задача не е част от мисията.");
    else {
      const [room] = await tx
        .select()
        .from(s.escapeRoomRuns)
        .where(eq(s.escapeRoomRuns.id, escapeRunId));
      assert(
        mission.challengeId === room.roomId || mission.challengeId === challengeId,
        "Тази задача не е част от мисията.",
      );
    }
  }
}
export async function completeFeatured(
  tx: QueryDb,
  userId: string,
  childId: string,
  challengeId: string,
  missionId?: string,
) {
  if (!missionId) return;
  const [mission] = await tx
    .select()
    .from(s.featuredMissions)
    .where(
      and(
        eq(s.featuredMissions.id, missionId),
        eq(s.featuredMissions.challengeId, challengeId),
        eq(s.featuredMissions.status, "published"),
        lte(s.featuredMissions.startsAt, new Date()),
        gt(s.featuredMissions.endsAt, new Date()),
      ),
    );
  if (!mission) return;
  const [inserted] = await tx
    .insert(s.missionCompletions)
    .values({ childId, missionId })
    .onConflictDoNothing()
    .returning();
  if (!inserted) return;
  await labReward(tx, userId, childId, "monthly_mission_completed", mission.id, mission.xpReward);
  if (mission.achievementId)
    await tx
      .insert(s.childAchievements)
      .values({ childId, achievementId: mission.achievementId })
      .onConflictDoNothing();
}
export async function creditChallenge(
  tx: QueryDb,
  userId: string,
  childId: string,
  challenge: typeof s.labChallenges.$inferSelect,
  attempt: typeof s.labAttempts.$inferSelect,
  missionId?: string,
  escapeRunId?: string,
) {
  if (!attempt.passed) return;
  const event =
    challenge.type === "prompt-battles"
      ? "prompt_battle_completed"
      : challenge.type === "agent-missions"
        ? "agent_mission_completed"
        : challenge.type === "detective"
          ? "detective_challenge_completed"
          : challenge.type === "projects"
            ? "creator_project_completed"
            : "lab_challenge_completed";
  await labReward(tx, userId, childId, event, challenge.id, challenge.xpReward);
  await completeFeatured(tx, userId, childId, challenge.id, missionId);
  if (escapeRunId) {
    const [run] = await tx
      .select()
      .from(s.escapeRoomRuns)
      .where(and(eq(s.escapeRoomRuns.id, escapeRunId), eq(s.escapeRoomRuns.childId, childId)))
      .for("update");
    if (!run || run.completedAt) return;
    const steps = await tx
      .select()
      .from(s.escapeRoomSteps)
      .where(eq(s.escapeRoomSteps.roomId, run.roomId))
      .orderBy(asc(s.escapeRoomSteps.position));
    const step = steps[run.step];
    assert(step?.challengeId === challenge.id, "Стъпката вече е променена.", "conflict", 409);
    await tx
      .insert(s.escapeRoomStepAttempts)
      .values({ runId: run.id, stepId: step.id, attemptId: attempt.id })
      .onConflictDoNothing();
    const completed = run.step + 1 === steps.length;
    await tx
      .update(s.escapeRoomRuns)
      .set({ step: run.step + 1, completedAt: completed ? new Date() : null })
      .where(eq(s.escapeRoomRuns.id, run.id));
    if (completed) {
      const room = await publishedChallenge(tx, run.roomId);
      await labReward(tx, userId, childId, "escape_room_completed", room.id, room.xpReward);
      await completeFeatured(tx, userId, childId, room.id, missionId);
    }
  }
}
export async function startEscapeRoom(
  database: Database,
  userId: string,
  childId: string,
  roomId: string,
) {
  return database.transaction(async (tx) => {
    await authorizeLabEdit(tx, userId, childId);
    const room = await publishedChallenge(tx, roomId);
    assert(room.type === "escape-rooms", "Невалидна стая.");
    const [run] = await tx
      .insert(s.escapeRoomRuns)
      .values({ childId, roomId, version: room.version })
      .onConflictDoNothing()
      .returning();
    if (run) await labReward(tx, userId, childId, "escape_room_started", run.id);
    return (
      run ??
      (
        await tx
          .select()
          .from(s.escapeRoomRuns)
          .where(and(eq(s.escapeRoomRuns.childId, childId), eq(s.escapeRoomRuns.roomId, roomId)))
      )[0]
    );
  });
}
export async function submitAssessment(
  database: Database,
  userId: string,
  childId: string,
  raw: unknown,
) {
  const input = z
    .object({
      challengeId: z.uuid(),
      answer: z.string().max(1600).default(""),
      answerIndex: z.number().int().min(0).max(5).optional(),
      projectId: z.uuid().optional(),
      missionId: z.uuid().optional(),
      escapeRunId: z.uuid().optional(),
    })
    .strict()
    .parse(raw);
  return database.transaction(async (tx) => {
    const challenge = await publishedChallenge(tx, input.challengeId);
    if (isBasicMission(challenge, input)) {
      const [user] = await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
      assert(user && !user.deletingAt, "Акаунтът не е достъпен.", "deleting", 409);
      await ownedChild(tx, userId, childId, true);
    } else {
      await authorizeLabEdit(tx, userId, childId);
    }
    await verifyMissionContext(tx, childId, challenge.id, input.missionId, input.escapeRunId);
    const [total] = await tx
      .select({ n: count() })
      .from(s.labAttempts)
      .where(
        and(
          eq(s.labAttempts.childId, childId),
          eq(s.labAttempts.challengeId, challenge.id),
          eq(s.labAttempts.contextKey, attemptContext(input, challenge.version)),
        ),
      );
    assert(total.n < 100, "Достигна лимита за опити за тази задача.", "attempt_limit", 409);
    let passed = false;
    let explanation = "";
    let fact = "";
    let source = "";
    if (challenge.type === "detective") {
      const config = detectiveSchema.parse(challenge.configuration);
      passed =
        config.mode === "fix"
          ? normalizeAnswer(input.answer) === normalizeAnswer(config.claims[config.correctIndex])
          : input.answerIndex === config.correctIndex;
      explanation = config.explanation;
      fact = config.fact;
      source = config.source;
    } else if (challenge.type === "projects") {
      assert(input.projectId, "Избери творба.");
      const project = await ownedProject(tx, childId, input.projectId);
      assert(project.feature === "projects", "Избери Creator проект.");
      const config = creatorSchema.parse(project.configuration);
      const requirements = creatorChallengeSchema.parse(challenge.configuration);
      const linked: string[] = [];
      for (const id of config.projectIds) {
        const p = await ownedProject(tx, childId, id);
        const [run] = await tx
          .select({ id: s.aiRuns.id })
          .from(s.aiRuns)
          .where(and(eq(s.aiRuns.projectId, id), eq(s.aiRuns.status, "completed")))
          .limit(1);
        if (run) linked.push(p.feature);
      }
      passed =
        config.template === requirements.template &&
        requirements.requiredFeatures.every((f) => linked.includes(f));
      if (
        passed &&
        requirements.requiredFeatures.includes("bots") &&
        requirements.requiredFeatures.includes("knowledge")
      ) {
        const connected = await Promise.all(
          config.projectIds.map((id) => ownedProject(tx, childId, id)),
        );
        passed = connected.some(
          (p) =>
            p.feature === "bots" &&
            typeof p.configuration.knowledgeProjectId === "string" &&
            config.projectIds.includes(p.configuration.knowledgeProjectId),
        );
      }
      if (config.template === "museum-guide") passed = passed && config.visualIds.length > 0;
      explanation = passed
        ? "Творбата свързва нужните инструменти и всеки е изпробван."
        : "Свържи и изпробвай всички нужни инструменти преди завършване.";
      if (passed)
        await tx
          .update(s.labProjects)
          .set({ state: "completed", updatedAt: new Date() })
          .where(eq(s.labProjects.id, project.id));
    } else assert(false, "Тази задача изисква изпълнение през AI инструмента.");
    const [attempt] = await tx
      .insert(s.labAttempts)
      .values({
        childId,
        challengeId: challenge.id,
        attemptNumber: total.n + 1,
        contextKey: attemptContext(input, challenge.version),
        configurationVersion: challenge.version,
        input: { answer: input.answer, answerIndex: input.answerIndex },
        output: { explanation, fact, source },
        evaluation: { passed },
        passed,
      })
      .returning();
    await creditChallenge(
      tx,
      userId,
      childId,
      challenge,
      attempt,
      input.missionId,
      input.escapeRunId,
    );
    return { passed, explanation, fact, source };
  });
}
