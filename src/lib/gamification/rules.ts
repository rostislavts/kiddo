import type { Criteria } from "@/lib/content/schema";
export type AchievementStats = {
  lessons: number;
  worlds: number;
  xp: number;
  perfectQuiz: boolean;
  worldSlugs: string[];
};
export function earnedAchievement(criteria: Criteria, stats: AchievementStats): boolean {
  switch (criteria.type) {
    case "lab":
      return false; // Lab rewards use their own server-side event counts.
    case "lessons":
      return stats.lessons >= criteria.count;
    case "worlds":
      return stats.worlds >= criteria.count;
    case "xp":
      return stats.xp >= criteria.count;
    case "perfect_quiz":
      return stats.perfectQuiz;
    case "world":
      return stats.worldSlugs.includes(criteria.slug);
  }
}
export function levelForXp<T extends { minXp: number }>(xp: number, levels: T[]): T | undefined {
  return [...levels].sort((a, b) => b.minXp - a.minXp).find((level) => xp >= level.minXp);
}
export function xpKey(childId: string, type: string, referenceId: string) {
  return `${childId}:${type}:${referenceId}`;
}
