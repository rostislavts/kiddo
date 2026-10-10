import { notFound, redirect } from "next/navigation";
import { selectedChild } from "@/lib/auth/session";
import { db } from "@/db";
import { snapshot } from "@/lib/learning/service";
import { worldAccess, lessonUnlocked } from "@/lib/learning/unlocks";
import { LessonPlayer } from "@/components/learning/lesson-player";
export default async function LessonPage({ params }: { params: Promise<{ lessonSlug: string }> }) {
  const { lessonSlug } = await params;
  const { user, child } = await selectedChild();
  const state = await snapshot(db(), user.id, child.id);
  const lesson = state.lessons.find((l) => l.slug === lessonSlug);
  if (!lesson) notFound();
  const world = state.worlds.find((w) => w.id === lesson.worldId)!;
  if (
    worldAccess(world, state.completedWorlds) !== "available" ||
    !lessonUnlocked(
      lesson.id,
      state.lessons.filter((l) => l.worldId === world.id),
      state.completed,
      world.sequentialLessons,
    )
  )
    redirect(`/app/world/${world.slug}`);
  return (
    <LessonPlayer
      childId={child.id}
      lessonId={lesson.id}
      title={lesson.title}
      worldSlug={world.slug}
    />
  );
}
