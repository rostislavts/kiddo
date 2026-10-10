import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from "lucide-react";
import { selectedChild } from "@/lib/auth/session";
import { db } from "@/db";
import { snapshot } from "@/lib/learning/service";
import { worldAccess, lessonUnlocked } from "@/lib/learning/unlocks";
import { bg } from "@/i18n/bg";
import { WorldArt } from "@/components/illustration";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { EventTracker } from "@/components/event-tracker";

export default async function WorldPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const { user, child } = await selectedChild();
  const state = await snapshot(db(), user.id, child.id);
  const world = state.worlds.find((w) => w.slug === worldSlug);
  if (!world) notFound();
  const access = worldAccess(world, state.completedWorlds);
  if (access !== "available")
    return (
      <section className="gate">
        <EventTracker event={"world_viewed"} worldId={world.id} childId={child.id} />
        <WorldArt visual={world.visual} color={world.color} />
        <Badge>
          <LockKeyhole size={12} />
          {bg.dashboard.locked}
        </Badge>
        <h1 style={{ marginTop: 20 }}>{bg.world.lockedTitle}</h1>
        <p className="muted">{bg.world.lockedText}</p>
        <Button asChild>
          <Link href={"/app"}>
            {bg.nav.map}
            <ArrowRight size={17} />
          </Link>
        </Button>
      </section>
    );
  const lessons = state.lessons.filter((l) => l.worldId === world.id);
  return (
    <>
      <EventTracker event="world_viewed" worldId={world.id} childId={child.id} />
      <Link className="text-link" href="/app">
        <ArrowLeft size={17} />
        {bg.nav.map}
      </Link>
      <section className={`world-hero tone-${world.color}`}>
        <div>
          <Badge>
            {bg.world.eyebrow} {state.worlds.indexOf(world) + 1}
          </Badge>
          <h1>{world.title}</h1>
          <p>{world.description}</p>
        </div>
        <WorldArt visual={world.visual} color={world.color} />
      </section>
      <h2 style={{ fontSize: 25 }}>{bg.world.missions}</h2>
      <div className="lesson-list">
        {lessons.length === 0 && <p className="notice">{bg.world.noLessons}</p>}
        {lessons.map((lesson, index) => {
          const unlocked = lessonUnlocked(
            lesson.id,
            lessons,
            state.completed,
            world.sequentialLessons,
          );
          const p = state.progress.find((p) => p.lessonId === lesson.id);
          return (
            <article key={lesson.id} className={`lesson-row ${unlocked ? "" : "locked"}`}>
              <span className="lesson-number">
                {p?.status === "completed" ? (
                  <Check size={23} />
                ) : unlocked ? (
                  index + 1
                ) : (
                  <LockKeyhole size={20} />
                )}
              </span>
              <div>
                <h3>{lesson.title}</h3>
                <p>
                  {lesson.estimatedMinutes} {bg.common.minutes} · {lesson.xpReward} XP{" "}
                  {p?.status === "completed" && `· ${p.bestScore}%`}
                </p>
              </div>
              {unlocked ? (
                <Button
                  asChild
                  variant={p?.status === "completed" ? "secondary" : "default"}
                  size="small"
                >
                  <Link href={`/app/lesson/${lesson.slug}`}>
                    {p?.status === "completed"
                      ? bg.world.review
                      : p
                        ? bg.world.resume
                        : bg.world.begin}
                    <ArrowRight size={15} />
                  </Link>
                </Button>
              ) : (
                <Badge className="badge-neutral">{bg.world.lockedLesson}</Badge>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
