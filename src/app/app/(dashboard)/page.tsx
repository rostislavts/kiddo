import Link from "next/link";
import { ArrowRight, Award, LockKeyhole, Sparkles, Trophy } from "lucide-react";
import { db } from "@/db";
import { selectedChild } from "@/lib/auth/session";
import { snapshot } from "@/lib/learning/service";
import { worldAccess, lessonUnlocked } from "@/lib/learning/unlocks";
import { bg, avatars, type AvatarKey } from "@/i18n/bg";
import { PageTitle, Badge, ProgressBar, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Robot, WorldArt } from "@/components/illustration";
import { Stats } from "@/components/progress-summary";
import { date } from "@/lib/utils";

export default async function Dashboard() {
  const { user, child } = await selectedChild();
  const state = await snapshot(db(), user.id, child.id);
  const available = state.worlds.filter(
    (w) => worldAccess(w, state.completedWorlds) === "available",
  );
  const next = available.flatMap((w) =>
    state.lessons.filter(
      (l) =>
        l.worldId === w.id &&
        !state.completed.has(l.id) &&
        lessonUnlocked(
          l.id,
          state.lessons.filter((l) => l.worldId === w.id),
          state.completed,
          w.sequentialLessons,
        ),
    ),
  )[0];
  const nextLevel = state.levels.find((l) => l.minXp > state.totalXp);
  const levelProgress = nextLevel
    ? ((state.totalXp - (state.level?.minXp ?? 0)) /
        (nextLevel.minXp - (state.level?.minXp ?? 0))) *
      100
    : 100;
  return (
    <>
      <PageTitle
        title={`${bg.dashboard.greeting}, ${child.nickname}! 👋`}
        description={bg.dashboard.subheading}
      />
      <div className="dashboard-columns">
        <div>
          <section className="adventure-banner">
            <div>
              <p className="eyebrow">{bg.dashboard.adventure}</p>
              <h2>{next ? bg.dashboard.heroTitle : bg.dashboard.allComplete}</h2>
              <p>{next ? next.title : bg.dashboard.allCompleteText}</p>
              <Button asChild>
                <Link
                  href={
                    next
                      ? `/app/lesson/${next.slug}`
                      : state.worlds[0]
                        ? `/app/world/${state.worlds[0].slug}`
                        : "/app"
                  }
                >
                  {state.progress.length ? bg.dashboard.continue : bg.dashboard.begin}
                  <ArrowRight size={17} />
                </Link>
              </Button>
            </div>
            <Robot />
          </section>
          <Stats state={state} />
          <div className="dashboard-map-heading">
            <div>
              <h2>{bg.dashboard.mapTitle}</h2>
              <p>{bg.dashboard.mapSubtitle}</p>
            </div>
            <Badge>
              {state.worlds.length} {bg.common.worlds}
            </Badge>
          </div>
          {state.worlds.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={42} />}
              title={bg.dashboard.emptyTitle}
              description={bg.dashboard.emptyText}
            />
          ) : (
            <div className="world-grid dashboard-world-grid">
              {state.worlds.map((world, index) => {
                const lessons = state.lessons.filter((l) => l.worldId === world.id);
                const completed = lessons.filter((l) => state.completed.has(l.id)).length;
                const access = worldAccess(world, state.completedWorlds);
                return (
                  <Link key={world.id} href={`/app/world/${world.slug}`} className="world-card">
                    <WorldArt visual={world.visual} color={world.color} />
                    <div className="world-card-content">
                      <p className="eyebrow">
                        {bg.world.eyebrow} {String(index + 1).padStart(2, "0")}
                      </p>
                      <h3>{world.title}</h3>
                      <p>{world.description}</p>
                      <div className="world-progress">
                        <ProgressBar
                          value={lessons.length ? (completed / lessons.length) * 100 : 0}
                          label={world.title}
                        />
                        <span>
                          {completed}/{lessons.length}
                        </span>
                      </div>
                      <div className="world-card-footer">
                        <span>
                          {lessons.length} {bg.common.lessons}
                        </span>
                        {access !== "available" ? (
                          <Badge className="badge-neutral">
                            <LockKeyhole size={10} />
                            {bg.dashboard.locked}
                          </Badge>
                        ) : state.completedWorlds.has(world.id) ? (
                          <Badge className="badge-green">{bg.dashboard.completed}</Badge>
                        ) : (
                          <Badge className="badge-green">{bg.common.free}</Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <aside className="dashboard-aside">
          <div className="aside-card level-card">
            <div className="large-avatar">
              {avatars[child.avatar as AvatarKey] || avatars.robot}
            </div>
            <h3>{child.nickname}</h3>
            <p>{state.level?.title}</p>
            <Badge>
              {bg.common.level} {state.level?.id ?? 1}
            </Badge>
            <ProgressBar value={levelProgress} label={bg.dashboard.nextLevel} />
            <small>
              {nextLevel
                ? `${nextLevel.minXp - state.totalXp} XP · ${bg.dashboard.nextLevel}`
                : bg.dashboard.maxLevel}
            </small>
          </div>
          <div className="aside-card">
            <h3>{bg.dashboard.yourBadges}</h3>
            {state.earned.length ? (
              state.earned
                .slice(-3)
                .reverse()
                .map(({ achievement, earnedAt }) => (
                  <div className="mini-achievement" key={achievement.id}>
                    <span className="mini-achievement-icon">
                      <Trophy size={21} />
                    </span>
                    <div>
                      <strong>{achievement.title}</strong>
                      <small>{date(earnedAt)}</small>
                    </div>
                  </div>
                ))
            ) : (
              <>
                <Award size={43} style={{ color: "#d9c4ef", marginBottom: 15 }} />
                <p className="tiny-copy">{bg.dashboard.noBadges}</p>
              </>
            )}
            <Link href="/app/achievements" className="text-link">
              {bg.dashboard.allBadges}
              <ArrowRight size={15} />
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
