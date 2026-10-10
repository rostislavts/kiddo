import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { testDatabase } from "../helpers/database";
import { TestAI } from "../helpers/ai";
import * as s from "@/db/schema";
import { seedDatabase } from "@/db/seed";
import { createChild } from "@/lib/children/service";
import { defaultAIConfig } from "@/lib/ai/models";
import {
  energySummary,
  initializeEnergy,
  reserveEnergy,
  failRun,
  grantEnergy,
} from "@/lib/ai/energy";
import { executeAIRun } from "@/lib/lab/runtime";
import { saveProject, saveCard, retrieveKnowledge, deleteProject } from "@/lib/lab/projects";
import { startEscapeRoom, submitAssessment, publicChallenge } from "@/lib/lab/challenges";
import { saveAISettings, saveChallenge, saveFeaturedMission } from "@/lib/lab/admin";
import { labView, parentLabSummary } from "@/lib/lab/view";
import { deleteLabChild, maintainLab } from "@/lib/lab/maintenance";
import { defaults } from "@/components/lab/builders";
import { labSeedId as labId } from "@/content/lab/seed";
let f: Awaited<ReturnType<typeof testDatabase>>;
const user = randomUUID(),
  other = randomUUID(),
  admin = randomUUID(),
  child = randomUUID(),
  sibling = randomUUID();
let provider: TestAI;
const start = () => new Date(Date.now() - 86400000);
const end = () => new Date(Date.now() + 28 * 86400000);
const input = (feature = "prompts", extra: Record<string, unknown> = {}) => ({
  requestId: randomUUID(),
  childId: child,
  feature,
  input: { builder: defaults.prompts },
  ...extra,
});
async function subscription() {
  await f.db.insert(s.subscriptions).values({
    userId: user,
    paddleSubscriptionId: "sub_lab",
    paddleCustomerId: "ctm_lab",
    paddlePriceId: "pri_lab",
    status: "active",
    periodStart: start(),
    periodEnd: end(),
    lastEventAt: new Date(),
  });
}
async function configuration(patch: Partial<ReturnType<typeof defaultAIConfig>>) {
  const c = { ...defaultAIConfig(), ...patch };
  await f.db
    .update(s.aiSettings)
    .set({ configuration: c, version: 1 })
    .where(eq(s.aiSettings.id, "lab"));
  return c;
}
async function project(feature: keyof typeof defaults, title = "Моят проект") {
  return saveProject(f.db, user, child, { feature, title, configuration: defaults[feature] });
}
async function run(feature = "prompts", extra: Record<string, unknown> = {}) {
  return executeAIRun(f.db, user, input(feature, extra), provider);
}
const prepared = async () => ({ metadata: {}, context: {} });
describe("AI Lab, real PostgreSQL transactions and provider boundary", () => {
  beforeAll(async () => {
    vi.stubEnv("PADDLE_MONTHLY_PRICE_ID", "pri_lab");
    f = await testDatabase();
  });
  afterAll(async () => {
    await f.client.close();
    vi.unstubAllEnvs();
  });
  beforeEach(async () => {
    await f.db.execute(
      sql`TRUNCATE users, tracks, achievements, levels, ai_settings, lab_challenges CASCADE`,
    );
    await seedDatabase(f.db);
    await f.db.insert(s.users).values([
      { id: user, email: "lab@example.test" },
      { id: other, email: "other@example.test" },
      { id: admin, email: "admin@example.test", role: "admin" },
    ]);
    await createChild(f.db, user, child, { nickname: "Звезда", avatar: "robot", ageBand: "8-9" });
    await createChild(f.db, user, sibling, { nickname: "Луна", avatar: "cat", ageBand: "8-9" });
    await subscription();
    provider = new TestAI();
  });
  it("initializes exactly one family grant, aligned with the Paddle period", async () => {
    await Promise.all([initializeEnergy(f.db, user), initializeEnergy(f.db, user)]);
    const state = await energySummary(f.db, user);
    expect(state.balance).toBe(1000);
    expect(await f.db.select().from(s.aiEnergyEvents)).toHaveLength(1);
    const [sub] = await f.db.select().from(s.subscriptions);
    expect(state.endsAt).toBe(sub.periodEnd!.toISOString());
  });
  it("shares Energy across children with per-child attribution", async () => {
    await run();
    await executeAIRun(f.db, user, input("prompts", { childId: sibling }), provider);
    const state = await energySummary(f.db, user);
    expect(state.balance).toBe(996);
    expect(state.perChild.map((c) => c.spent)).toEqual([2, 2]);
  });
  it("replays a completed request without a second provider call or debit", async () => {
    const request = input();
    const first = await executeAIRun(f.db, user, request, provider);
    expect(await executeAIRun(f.db, user, request, provider)).toEqual(first);
    expect(provider.calls).toHaveLength(1);
    expect((await energySummary(f.db, user)).balance).toBe(998);
    await expect(
      executeAIRun(
        f.db,
        user,
        { ...request, input: { builder: { goal: "Друга задача" } } },
        provider,
      ),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
  });
  it("atomically rejects simultaneous reservations beyond the balance", async () => {
    await configuration({ monthlyEnergy: 3 });
    const results = await Promise.allSettled([
      run(),
      executeAIRun(f.db, user, input("prompts", { childId: sibling }), provider),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await energySummary(f.db, user)).balance).toBe(1);
  });
  it("refunds provider errors once, keeping an append-only audit", async () => {
    provider.failure = true;
    await expect(run()).rejects.toMatchObject({ code: "ai_failed" });
    expect((await energySummary(f.db, user)).balance).toBe(1000);
    const [failed] = await f.db.select().from(s.aiRuns);
    await failRun(f.db, user, failed.id, new Error());
    expect(
      (await f.db.select().from(s.aiEnergyEvents)).filter((e) => e.eventType === "refund"),
    ).toHaveLength(1);
    expect(failed.status).toBe("failed");
    await expect(
      f.db
        .update(s.aiEnergyEvents)
        .set({ amount: 999 })
        .where(eq(s.aiEnergyEvents.eventType, "refund")),
    ).rejects.toThrow();
  });
  it("refunds moderated input without calling the model", async () => {
    provider.blocked = true;
    await expect(run()).rejects.toMatchObject({ code: "moderated" });
    expect(provider.calls).toHaveLength(0);
    expect((await energySummary(f.db, user)).balance).toBe(1000);
  });
  it("rejects personal data and refunds the reservation", async () => {
    await expect(
      run("prompts", { input: { builder: { goal: "Пиши на child@example.test" } } }),
    ).rejects.toMatchObject({ code: "personal_data" });
    expect((await energySummary(f.db, user)).balance).toBe(1000);
  });
  it("recovers abandoned runs and refunds even after an account loses Premium", async () => {
    const reserved = await reserveEnergy(f.db, user, input() as never, "fixture", prepared);
    await f.db
      .update(s.aiRuns)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(s.aiRuns.id, reserved.run.id));
    await f.db.update(s.subscriptions).set({ status: "canceled" });
    expect(await energySummary(f.db, user)).toMatchObject({ premium: false, balance: 1000 });
  });
  it("renews without rollover and never duplicates the renewed grant", async () => {
    await run();
    await f.db
      .update(s.subscriptions)
      .set({ periodStart: new Date(), periodEnd: new Date(Date.now() + 30 * 86400000) });
    await initializeEnergy(f.db, user);
    await initializeEnergy(f.db, user);
    expect((await energySummary(f.db, user)).balance).toBe(1000);
    expect(await f.db.select().from(s.aiEnergyPeriods)).toHaveLength(2);
  });
  it("caps configured rollover", async () => {
    await run();
    await configuration({ rollover: true, maxRollover: 50 });
    await f.db.update(s.subscriptions).set({ periodStart: new Date(), periodEnd: end() });
    expect((await energySummary(f.db, user)).balance).toBe(1050);
  });
  it("rejects expired, future or unrelated subscriptions without grants", async () => {
    await f.db.update(s.subscriptions).set({ periodEnd: new Date(Date.now() - 1) });
    await expect(run()).rejects.toMatchObject({ code: "premium" });
    await f.db
      .update(s.subscriptions)
      .set({ periodStart: new Date(Date.now() + 10000), periodEnd: end() });
    await expect(run()).rejects.toMatchObject({ code: "premium" });
    await f.db.update(s.subscriptions).set({ periodStart: start(), paddlePriceId: "pri_other" });
    await expect(run()).rejects.toMatchObject({ code: "premium" });
    expect(await f.db.select().from(s.aiEnergyEvents)).toHaveLength(0);
  });
  it("enforces global and per-feature kill switches and rate limits", async () => {
    await configuration({ enabled: false });
    await expect(run()).rejects.toMatchObject({ code: "ai_paused" });
    const config = defaultAIConfig();
    config.features.prompts.enabled = false;
    await configuration(config);
    await expect(run()).rejects.toMatchObject({ code: "ai_paused" });
    await configuration({ childRunsPerMinute: 1 });
    await run();
    await expect(run()).rejects.toMatchObject({ code: "rate_limit" });
  });
  it("blocks a second concurrent run in the same project", async () => {
    const p = await project("prompts");
    await reserveEnergy(
      f.db,
      user,
      input("prompts", { projectId: p.id }) as never,
      "fixture",
      prepared,
    );
    await expect(run("prompts", { projectId: p.id })).rejects.toMatchObject({ code: "busy" });
    await expect(
      saveProject(f.db, user, child, {
        ...p,
        configuration: p.configuration,
        expectedVersion: p.version,
      }),
    ).rejects.toThrow();
  });
  it("limits images per period and deletes expired private assets", async () => {
    await configuration({ maxImagesPerPeriod: 1 });
    const p = await project("images");
    const result = await run("images", { projectId: p.id, input: { builder: defaults.images } });
    expect(result.result.assetId).toBeTruthy();
    await expect(
      run("images", { projectId: p.id, input: { builder: defaults.images } }),
    ).rejects.toMatchObject({ code: "image_limit" });
    await f.db.update(s.labAssets).set({ expiresAt: new Date(Date.now() - 1) });
    await maintainLab(f.db);
    expect(await f.db.select().from(s.labAssets)).toHaveLength(0);
  });
  it("isolates family and child references, including bot knowledge", async () => {
    await expect(executeAIRun(f.db, other, input(), provider)).rejects.toMatchObject({
      status: 404,
    });
    const p = await project("knowledge");
    await expect(
      saveProject(f.db, user, sibling, {
        feature: "bots",
        title: "Друг бот",
        configuration: { ...defaults.bots, knowledgeProjectId: p.id },
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(labView(f.db, other, child)).rejects.toMatchObject({ status: 404 });
  });
  it("preserves creations after cancellation and restores execution on reactivation", async () => {
    const p = await project("prompts");
    await run("prompts", { projectId: p.id });
    await f.db.update(s.subscriptions).set({ status: "canceled" });
    await expect(run()).rejects.toMatchObject({ code: "premium" });
    expect((await labView(f.db, user, child)).projects).toHaveLength(1);
    await f.db.update(s.subscriptions).set({ status: "active" });
    await run();
    expect((await energySummary(f.db, user)).balance).toBe(996);
  });
  it("bounds bot history, uses edited instructions and keeps parent summaries private", async () => {
    await configuration({ maxHistory: 2 });
    let p = await project("bots");
    await run("bots", { projectId: p.id, input: { message: "Измисли герой." } });
    p = await saveProject(f.db, user, child, {
      id: p.id,
      expectedVersion: p.version,
      feature: "bots",
      title: p.title,
      configuration: { ...p.configuration, rules: "Отговаряй само с един въпрос." },
    });
    await run("bots", { projectId: p.id, input: { message: "Измисли робот." } });
    expect(provider.calls[1].messages.at(-1)?.content).toContain("само с един въпрос");
    expect(provider.calls[1].messages[0].role).toBe("user");
    expect(await f.db.select().from(s.botMessages)).toHaveLength(2);
    const parent = JSON.stringify(await parentLabSummary(f.db, user));
    expect(parent).not.toContain("Измисли герой");
    expect(parent).not.toContain("само с един въпрос");
  });
  it("retrieves only owned cards and persists provenance snapshots", async () => {
    const p = await project("knowledge");
    await saveCard(f.db, user, child, {
      projectId: p.id,
      title: "Соларен панел",
      content: "Корабът Орбита използва соларен панел за енергия.",
    });
    provider.respond = () => "Корабът използва соларен панел.";
    const result = await run("knowledge", {
      projectId: p.id,
      input: { message: "Какво използва Орбита?" },
    });
    expect(result.result.knowledge).toHaveLength(1);
    expect(await f.db.select().from(s.knowledgeRetrievals)).toHaveLength(1);
    expect(await retrieveKnowledge(f.db, child, p.id, "Непознато животно")).toHaveLength(0);
  });
  it("evaluates battle requirements, limits attempts and awards XP once", async () => {
    const challenge = await saveChallenge(f.db, admin, {
      slug: "test-battle",
      type: "prompt-battles",
      title: "Робот",
      description: "Напиши за робот.",
      configuration: {
        instructions: "Включи робот.",
        requirements: [{ type: "required_terms", terms: ["робот"] }],
        maxAttempts: 2,
        energyCost: 3,
      },
      status: "published",
      xpReward: 50,
    });
    await run("prompt-battles", {
      challengeId: challenge.id,
      input: { prompt: "Напиши за робот." },
    });
    await run("prompt-battles", { challengeId: challenge.id, input: { prompt: "Още за робот." } });
    await expect(
      run("prompt-battles", { challengeId: challenge.id, input: { prompt: "Трети робот." } }),
    ).rejects.toMatchObject({ code: "attempt_limit" });
    expect(
      (await f.db.select().from(s.xpEvents)).filter(
        (e) => e.eventType === "prompt_battle_completed",
      ),
    ).toHaveLength(1);
    expect((await energySummary(f.db, user)).balance).toBe(994);
  });
  it("grades Detective with curated truth and does not expose answers before assessment", async () => {
    const [c] = await f.db
      .select()
      .from(s.labChallenges)
      .where(eq(s.labChallenges.id, labId(20)));
    expect(publicChallenge(c).configuration).not.toHaveProperty("correctIndex");
    expect(
      await submitAssessment(f.db, user, child, {
        challengeId: c.id,
        answerIndex: c.configuration.correctIndex,
      }),
    ).toMatchObject({ passed: true, fact: c.configuration.fact });
    await submitAssessment(f.db, user, child, {
      challengeId: c.id,
      answerIndex: c.configuration.correctIndex,
    });
    expect(
      (await f.db.select().from(s.xpEvents)).filter(
        (e) => e.eventType === "detective_challenge_completed",
      ),
    ).toHaveLength(1);
  });
  it("allows all basic mission modes without Premium, AI availability or Energy", async () => {
    await f.db.delete(s.subscriptions);
    await configuration({ enabled: false });
    for (const id of [20, 21, 22, 23]) {
      const [challenge] = await f.db
        .select()
        .from(s.labChallenges)
        .where(eq(s.labChallenges.id, labId(id)));
      const config = challenge.configuration;
      const submission = {
        challengeId: challenge.id,
        answerIndex: config.correctIndex,
        answer: (config.claims as string[])[Number(config.correctIndex)],
      };
      expect(await submitAssessment(f.db, user, child, submission)).toMatchObject({
        passed: true,
        fact: config.fact,
      });
      await submitAssessment(f.db, user, child, submission);
    }
    expect(
      (await f.db.select().from(s.xpEvents)).filter(
        (e) => e.eventType === "detective_challenge_completed",
      ),
    ).toHaveLength(4);
    expect(await f.db.select().from(s.aiRuns)).toHaveLength(0);
    expect(await f.db.select().from(s.aiEnergyEvents)).toHaveLength(0);
    expect(await f.db.select().from(s.energyAccounts)).toHaveLength(0);
    expect(provider.calls).toHaveLength(0);
    const view = await labView(f.db, user, child);
    expect(view.energy.premium).toBe(false);
    expect(view.attempts).toHaveLength(8);
    expect(view.challenges.find((c) => c.id === labId(20))!.configuration).not.toHaveProperty(
      "correctIndex",
    );
    await expect(
      submitAssessment(f.db, other, child, { challengeId: labId(20), answerIndex: 0 }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
  it("keeps live AI, creation, Featured missions and Escape Rooms Premium after opening basic missions", async () => {
    await f.db.delete(s.subscriptions);
    await submitAssessment(f.db, user, child, { challengeId: labId(20), answerIndex: 0 });
    for (const feature of [
      "prompts",
      "bots",
      "agents",
      "knowledge",
      "images",
      "games",
      "projects",
    ] as const) {
      await expect(project(feature)).rejects.toMatchObject({ code: "premium" });
    }
    await expect(run()).rejects.toMatchObject({ code: "premium" });
    await expect(run("detective", { challengeId: labId(20), input: {} })).rejects.toMatchObject({
      code: "premium",
    });
    await expect(startEscapeRoom(f.db, user, child, randomUUID())).rejects.toMatchObject({
      code: "premium",
    });
    for (const context of [{ missionId: randomUUID() }, { escapeRunId: randomUUID() }]) {
      await expect(
        submitAssessment(f.db, user, child, { challengeId: labId(20), answerIndex: 0, ...context }),
      ).rejects.toMatchObject({ code: "premium" });
    }
    expect(await f.db.select().from(s.missionCompletions)).toHaveLength(0);
    expect(await f.db.select().from(s.aiEnergyEvents)).toHaveLength(0);
    expect(provider.calls).toHaveLength(0);
  });
  it("keeps basic missions available after cancellation and preserves paid Energy and learning", async () => {
    await run();
    await f.db.update(s.subscriptions).set({ status: "canceled" });
    expect(
      await submitAssessment(f.db, user, child, { challengeId: labId(20), answerIndex: 0 }),
    ).toMatchObject({ passed: true });
    expect(await energySummary(f.db, user, child)).toMatchObject({ premium: false, balance: 998 });
    await expect(run()).rejects.toMatchObject({ code: "premium" });
  });
  it("grants zero-XP challenge achievements only once per challenge", async () => {
    await f.db
      .update(s.labChallenges)
      .set({ xpReward: 0 })
      .where(eq(s.labChallenges.id, labId(20)));
    const [c] = await f.db
      .select()
      .from(s.labChallenges)
      .where(eq(s.labChallenges.id, labId(20)));
    for (let n = 0; n < 2; n++)
      await submitAssessment(f.db, user, child, {
        challengeId: c.id,
        answerIndex: c.configuration.correctIndex,
      });
    expect(
      await f.db
        .select()
        .from(s.analytics)
        .where(eq(s.analytics.event, "detective_challenge_completed")),
    ).toHaveLength(1);
  });
  it("owns game state, rejects invented choices and enforces the original turn limit", async () => {
    const p = await saveProject(f.db, user, child, {
      feature: "games",
      title: "Три хода",
      configuration: { ...defaults.games, maxTurns: 3 },
    });
    const first = await run("games", { projectId: p.id, input: { choice: "" } });
    expect(first.result).toMatchObject({ turn: 1, missionStatus: "active" });
    expect(
      (await labView(f.db, user, child)).projects.find((item) => item.id === p.id)?.state,
    ).toBe("draft");
    await expect(
      run("games", { projectId: p.id, input: { choice: "Измислен ход" } }),
    ).rejects.toThrow();
    await expect(
      saveProject(f.db, user, child, {
        id: p.id,
        expectedVersion: p.version,
        feature: "games",
        title: p.title,
        configuration: { ...p.configuration, maxTurns: 10 },
      }),
    ).rejects.toMatchObject({ code: "game_started" });
    await run("games", { projectId: p.id, input: { choice: "Отвори книгата" } });
    const last = await run("games", { projectId: p.id, input: { choice: "Отвори книгата" } });
    expect(last.result).toMatchObject({ turn: 3, missionStatus: "completed", choices: [] });
    expect(
      (await labView(f.db, user, child)).projects.find((item) => item.id === p.id)?.state,
    ).toBe("completed");
    await expect(
      run("games", { projectId: p.id, input: { choice: "Отвори книгата" } }),
    ).rejects.toMatchObject({ code: "game_finished" });
  });
  it("rejects invalid structured output and refunds", async () => {
    const p = await project("games");
    provider.respond = () => JSON.stringify({ narration: "Липсват избори" });
    await expect(run("games", { projectId: p.id, input: { choice: "" } })).rejects.toMatchObject({
      code: "ai_failed",
    });
    expect((await energySummary(f.db, user)).balance).toBe(1000);
  });
  it("enforces Escape Room step ordering and composes a reusable Detective engine", async () => {
    const room = await startEscapeRoom(f.db, user, child, labId(50));
    await expect(
      submitAssessment(f.db, user, child, {
        challengeId: labId(20),
        answerIndex: 0,
        escapeRunId: room.id,
      }),
    ).rejects.toMatchObject({ code: "locked" });
    provider.respond = () => "1. Провери\n2. Свържи\n3. Тествай";
    await run("prompt-battles", {
      challengeId: labId(2),
      escapeRunId: room.id,
      input: { prompt: "Три точки: проверка, ремонт, тест." },
    });
    const [state] = await f.db.select().from(s.escapeRoomRuns);
    expect(state.step).toBe(1);
    const [c] = await f.db
      .select()
      .from(s.labChallenges)
      .where(eq(s.labChallenges.id, labId(20)));
    await submitAssessment(f.db, user, child, {
      challengeId: c.id,
      answerIndex: c.configuration.correctIndex,
      escapeRunId: room.id,
    });
    expect((await f.db.select().from(s.escapeRoomRuns))[0].step).toBe(2);
  });
  it("publishes missions without deployment and awards featured rewards once", async () => {
    const mission = await saveFeaturedMission(f.db, admin, {
      title: "Нова детективска мисия",
      description: "Провери фактите днес.",
      challengeId: labId(20),
      startsAt: start().toISOString(),
      endsAt: end().toISOString(),
      xpReward: 30,
      achievementId: null,
      status: "published",
    });
    expect((await labView(f.db, user, child)).missions.some((m) => m.id === mission.id)).toBe(true);
    const [c] = await f.db
      .select()
      .from(s.labChallenges)
      .where(eq(s.labChallenges.id, labId(20)));
    for (let n = 0; n < 2; n++)
      await submitAssessment(f.db, user, child, {
        challengeId: c.id,
        answerIndex: c.configuration.correctIndex,
        missionId: mission.id,
      });
    expect(await f.db.select().from(s.missionCompletions)).toHaveLength(1);
    await f.db
      .update(s.featuredMissions)
      .set({ endsAt: new Date(Date.now() - 1) })
      .where(eq(s.featuredMissions.id, mission.id));
    await expect(
      submitAssessment(f.db, user, child, {
        challengeId: c.id,
        answerIndex: 0,
        missionId: mission.id,
      }),
    ).rejects.toMatchObject({ code: "mission_expired" });
  });
  it("protects admin settings and applies optimistic version checks", async () => {
    await expect(saveAISettings(f.db, user, defaultAIConfig(), 1)).rejects.toMatchObject({
      code: "forbidden",
    });
    await saveAISettings(f.db, admin, defaultAIConfig(), 1);
    await expect(saveAISettings(f.db, admin, defaultAIConfig(), 1)).rejects.toMatchObject({
      code: "conflict",
    });
    const key = randomUUID();
    await grantEnergy(f.db, admin, user, 10, key);
    await grantEnergy(f.db, admin, user, 10, key);
    expect((await energySummary(f.db, user)).balance).toBe(1010);
  });
  it("refunds in-flight work before child deletion and removes private data", async () => {
    await reserveEnergy(f.db, user, input() as never, "fixture", prepared);
    await deleteLabChild(f.db, user, child);
    expect(await f.db.select().from(s.aiRuns)).toHaveLength(0);
    const state = await energySummary(f.db, user);
    expect(state.balance).toBe(1000);
    expect(await f.db.select().from(s.aiEnergyEvents)).toHaveLength(3);
  });
  it("prunes raw histories without losing project or XP records", async () => {
    const p = await project("prompts");
    await run("prompts", { projectId: p.id });
    await f.db.update(s.aiRuns).set({ startedAt: new Date(Date.now() - 40 * 86400000) });
    await maintainLab(f.db);
    expect((await f.db.select().from(s.aiRuns))[0].result).toEqual({ expired: true });
    expect(await f.db.select().from(s.labProjects)).toHaveLength(1);
    await deleteProject(f.db, user, child, p.id);
    expect(await f.db.select().from(s.aiRuns)).toHaveLength(0);
  });
  it("gives each featured mission an independent attempt budget while preserving completion XP", async () => {
    const challenge = await saveChallenge(f.db, admin, {
      slug: "recurring-battle",
      type: "prompt-battles",
      title: "Робот",
      description: "Включи робот.",
      configuration: {
        instructions: "Включи робот.",
        requirements: [{ type: "required_terms", terms: ["робот"] }],
        maxAttempts: 1,
      },
      status: "published",
      xpReward: 50,
    });
    const attempt = { challengeId: challenge.id, input: { prompt: "Напиши за робот." } };
    await run("prompt-battles", attempt);
    await expect(run("prompt-battles", attempt)).rejects.toMatchObject({ code: "attempt_limit" });
    for (let i = 0; i < 2; i++) {
      const mission = await saveFeaturedMission(f.db, admin, {
        title: `Мисия ${i}`,
        description: "Нов период на мисията.",
        challengeId: challenge.id,
        startsAt: start().toISOString(),
        endsAt: end().toISOString(),
        xpReward: 10,
        achievementId: null,
        status: "published",
      });
      await run("prompt-battles", { ...attempt, missionId: mission.id });
    }
    expect(
      (await f.db.select().from(s.xpEvents)).filter(
        (e) => e.eventType === "prompt_battle_completed",
      ),
    ).toHaveLength(1);
    expect(await f.db.select().from(s.missionCompletions)).toHaveLength(2);
  });
  it("does not erase successful challenge counters when its project is deleted", async () => {
    const p = await project("knowledge");
    await saveCard(f.db, user, child, {
      projectId: p.id,
      title: "Орбита",
      content: "Орбита има соларен панел.",
    });
    provider.respond = () => "Орбита има соларен панел.";
    await run("knowledge", {
      projectId: p.id,
      challengeId: labId(30),
      input: { message: "Орбита има ли панел?" },
    });
    await deleteProject(f.db, user, child, p.id);
    const [attempt] = await f.db.select().from(s.labAttempts);
    expect(attempt).toMatchObject({ passed: true, runId: null, input: {}, output: {} });
  });
});
