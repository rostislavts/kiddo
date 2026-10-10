import { describe, expect, it } from "vitest";
import { canAccessPremium, isNewerEvent } from "@/lib/billing/entitlements";
import { mastery, quizPercentage, isCorrect } from "@/lib/quiz/scoring";
import { completedWorldIds, lessonUnlocked, worldAccess } from "@/lib/learning/unlocks";
import { earnedAchievement, levelForXp } from "@/lib/gamification/rules";
import { lessonContentSchema, publicBlocks, publicQuestion } from "@/lib/content/schema";
import { lessonSeeds, levelSeeds } from "@/content/seed/curriculum";

describe("mastery and scores", () => {
  it.each([
    [100, "mastered"],
    [80, "mastered"],
    [79, "completed"],
    [60, "completed"],
    [59, "retry"],
    [0, "retry"],
  ])("%i gives %s", (score, status) => expect(mastery(score as number)).toBe(status));
  it("supports policy changes and guards invalid totals", () => {
    expect(mastery(80, { mastered: 90, completed: 70 })).toBe("completed");
    expect(quizPercentage(2, 3)).toBe(67);
    expect(quizPercentage(1, 0)).toBe(0);
    expect(quizPercentage(9, 3)).toBe(100);
  });
  it("scores every supported quiz type, rejecting extra selections", () => {
    for (const q of lessonSeeds.flatMap((l) => l.content.questions)) {
      expect(isCorrect(q, q.correct)).toBe(true);
      expect(isCorrect(q, ["nonexistent"])).toBe(false);
    }
    const multiple = lessonSeeds[0].content.questions[3];
    expect(isCorrect(multiple, ["b", "a"])).toBe(true);
    expect(isCorrect(multiple, ["a", "b", "b"])).toBe(false);
    expect(isCorrect(multiple, ["a", "b", "c"])).toBe(false);
    const ordering = lessonSeeds[2].content.questions[2];
    expect(isCorrect(ordering, ["a", "b", "c"])).toBe(false);
    const matching = lessonSeeds[1].content.questions[3];
    expect(isCorrect(matching, { a: "a", b: "b", c: "c", d: "a" })).toBe(false);
  });
});
describe("premium entitlement", () => {
  const now = new Date("2026-09-25T00:00:00Z");
  const future = new Date("2026-10-25T00:00:00Z");
  it.each(["active", "trialing"])("grants valid %s access", (status) =>
    expect(
      canAccessPremium([{ status, periodEnd: future, paddlePriceId: "pri_1" }], "pri_1", now),
    ).toBe(true),
  );
  it.each(["canceled", "paused", "past_due", "none"])("denies %s", (status) =>
    expect(
      canAccessPremium([{ status, periodEnd: future, paddlePriceId: "pri_1" }], "pri_1", now),
    ).toBe(false),
  );
  it("fails closed on expiry, missing period, missing/foreign price", () => {
    expect(
      canAccessPremium(
        [{ status: "active", periodEnd: now, paddlePriceId: "pri_1" }],
        "pri_1",
        now,
      ),
    ).toBe(false);
    expect(
      canAccessPremium(
        [{ status: "active", periodEnd: null, paddlePriceId: "pri_1" }],
        "pri_1",
        now,
      ),
    ).toBe(false);
    expect(
      canAccessPremium(
        [{ status: "active", periodEnd: future, paddlePriceId: "other" }],
        "pri_1",
        now,
      ),
    ).toBe(false);
    expect(canAccessPremium([], undefined, now)).toBe(false);
  });
  it("accepts only newer subscription events", () => {
    expect(isNewerEvent(future, now)).toBe(true);
    expect(isNewerEvent(now, future)).toBe(false);
    expect(isNewerEvent(now, now)).toBe(false);
  });
});
describe("unlock rules", () => {
  const world = { id: "w", published: true, isFree: false, requiredWorldId: "prior" };
  it("requires prerequisites but never payment", () => {
    expect(worldAccess(world, new Set())).toBe("locked");
    expect(worldAccess(world, new Set(["prior"]))).toBe("available");
    expect(worldAccess({ ...world, published: false }, new Set(["prior"]))).toBe("unpublished");
  });
  it("unlocks sequential lessons without relying on fixed counts", () => {
    const lessons = [
      { id: "a", published: true, sortOrder: 0 },
      { id: "draft", published: false, sortOrder: 1 },
      { id: "b", published: true, sortOrder: 2 },
    ];
    expect(lessonUnlocked("a", lessons, new Set())).toBe(true);
    expect(lessonUnlocked("b", lessons, new Set())).toBe(false);
    expect(lessonUnlocked("b", lessons, new Set(["a"]))).toBe(true);
    expect(lessonUnlocked("b", lessons, new Set(), false)).toBe(true);
    expect(lessonUnlocked("draft", lessons, new Set(), false)).toBe(false);
  });
  it("does not complete empty worlds", () =>
    expect(completedWorldIds([{ id: "w" }], [], new Set()).size).toBe(0));
});
describe("content and achievements", () => {
  it("validates all seed content", () =>
    lessonSeeds.forEach((l) =>
      expect(lessonContentSchema.safeParse(l.content).success).toBe(true),
    ));
  it("rejects duplicate IDs, invalid answers and misplaced quiz blocks", () => {
    const content = structuredClone(lessonSeeds[0].content);
    content.questions[1].id = content.questions[0].id;
    expect(lessonContentSchema.safeParse(content).success).toBe(false);
    const wrong = structuredClone(lessonSeeds[0].content);
    wrong.questions[0].correct = ["missing"];
    expect(lessonContentSchema.safeParse(wrong).success).toBe(false);
    const misplaced = structuredClone(lessonSeeds[0].content);
    misplaced.blocks.reverse();
    expect(lessonContentSchema.safeParse(misplaced).success).toBe(false);
  });
  it("never exposes answers or explanations in public questions/activities", () => {
    const q = publicQuestion(lessonSeeds[0].content.questions[0]);
    expect(q).not.toHaveProperty("correct");
    expect(q).not.toHaveProperty("explanation");
    for (const b of publicBlocks(lessonSeeds[0].content.blocks))
      if ("question" in b) {
        expect(b.question).not.toHaveProperty("correct");
        expect(b.question).not.toHaveProperty("explanation");
      }
  });
  it("awards data-driven criteria and picks the correct level", () => {
    const stats = { lessons: 5, worlds: 1, xp: 500, perfectQuiz: true, worldSlugs: ["what-is-ai"] };
    expect(earnedAchievement({ type: "lessons", count: 5 }, stats)).toBe(true);
    expect(earnedAchievement({ type: "xp", count: 1000 }, stats)).toBe(false);
    expect(earnedAchievement({ type: "perfect_quiz" }, stats)).toBe(true);
    expect(earnedAchievement({ type: "world", slug: "what-is-ai" }, stats)).toBe(true);
    expect(earnedAchievement({ type: "worlds", count: 2 }, stats)).toBe(false);
    expect(levelForXp(150, levelSeeds)?.id).toBe(2);
    expect(levelForXp(149, levelSeeds)?.id).toBe(1);
  });
});
