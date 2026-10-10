export type WorldRule = {
  id: string;
  published: boolean;
  isFree: boolean;
  requiredWorldId: string | null;
};
export type LessonRule = { id: string; published: boolean; sortOrder: number };
export function worldAccess(
  world: WorldRule,
  completedWorlds: Set<string>,
): "available" | "locked" | "unpublished" {
  if (!world.published) return "unpublished";
  if (world.requiredWorldId && !completedWorlds.has(world.requiredWorldId)) return "locked";
  return "available";
}
export function lessonUnlocked(
  lessonId: string,
  lessons: LessonRule[],
  completed: Set<string>,
  sequential = true,
): boolean {
  const ordered = lessons
    .filter((l) => l.published)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const index = ordered.findIndex((l) => l.id === lessonId);
  return (
    index >= 0 &&
    (!sequential ||
      completed.has(lessonId) ||
      ordered.slice(0, index).every((l) => completed.has(l.id)))
  );
}
export function completedWorldIds(
  worlds: { id: string }[],
  lessons: { id: string; worldId: string; published: boolean }[],
  completed: Set<string>,
) {
  return new Set(
    worlds
      .filter((w) => {
        const items = lessons.filter((l) => l.worldId === w.id && l.published);
        return items.length > 0 && items.every((l) => completed.has(l.id));
      })
      .map((w) => w.id),
  );
}
