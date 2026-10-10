import Link from "next/link";
import { date } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { Plus, Users } from "lucide-react";
import { db } from "@/db";
import { children } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { recentActivity, snapshot } from "@/lib/learning/service";
import { bg, avatars, type AvatarKey } from "@/i18n/bg";
import { PageTitle, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SelectChild } from "@/components/child-forms";
import { Stats, TopicProgress, RecentActivity } from "@/components/progress-summary";
import { thresholds } from "@/lib/config";
import { energySummary } from "@/lib/ai/energy";
import { parentLabSummary } from "@/lib/lab/view";
import { EnergyMeter } from "@/components/lab/overview";
import { labTiles } from "@/content/lab/catalog";
export default async function Parent() {
  const user = await requireUser();
  const lab = await parentLabSummary(db(), user.id);
  const profiles = await db().select().from(children).where(eq(children.parentId, user.id));
  const summaries = await Promise.all(
    profiles.map(async (child) => ({
      state: await snapshot(db(), user.id, child.id),
      activity: await recentActivity(db(), child.id),
      energy: await energySummary(db(), user.id, child.id),
    })),
  );
  return (
    <>
      <PageTitle
        eyebrow={bg.parent.eyebrow}
        title={bg.parent.title}
        description={bg.parent.description}
        action={
          <Button asChild variant="secondary">
            <Link href="/parent/children">
              <Plus size={17} />
              {bg.parent.manage}
            </Link>
          </Button>
        }
      />
      <section className="content-card">
        <div className="lab-section-heading">
          <div>
            <h2>Семеен AI Lab</h2>
            <p>
              {lab.energy.premium
                ? "Premium е активен"
                : "Няма активен семеен абонамент. Училищният достъп е показан при всяко дете."}
            </p>
          </div>
          <EnergyMeter energy={lab.energy} />
        </div>
        {lab.energy.premium ? (
          <p>
            Месечен бюджет: {lab.energy.monthly} Energy общо.{" "}
            {lab.energy.rollover
              ? "Неизползваната Energy се прехвърля до зададения лимит."
              : "Неизползваната Energy не се прехвърля."}
          </p>
        ) : (
          <p>Всички уроци, тестове и базови AI мисии са безплатни завинаги и не изискват Energy.</p>
        )}
        <Link href="/parent/billing">Управление на абонамента →</Link>
      </section>
      {!profiles.length && (
        <EmptyState
          icon={<Users size={42} />}
          title={bg.children.empty}
          description={bg.children.emptyDescription}
        >
          <Button asChild>
            <Link href="/parent/children">
              {bg.children.add}
              <Plus size={16} />
            </Link>
          </Button>
        </EmptyState>
      )}
      {summaries.map(({ state, activity, energy }) => (
        <section key={state.child.id} className="content-card">
          <div className="parent-child-heading">
            <span className="large-avatar">
              {avatars[state.child.avatar as AvatarKey] || avatars.robot}
            </span>
            <div>
              <h2>{state.child.nickname}</h2>
              <p>
                {state.level?.title} · {bg.common.level} {state.level?.id ?? 1}
              </p>
            </div>
            <SelectChild id={state.child.id} label={bg.parent.enter} />
          </div>
          <EnergyMeter energy={energy} />
          <p>
            <Link href="/parent/school">Училищен достъп и избор на бюджет →</Link>
          </p>
          <Stats state={state} />
          <div className="lab-section-heading">
            <h3>Създаване в AI Lab</h3>
            <span>
              {energy.perChild.find((c) => c.childId === state.child.id)?.spent ?? 0} Energy
              използвани · {lab.missions.filter((m) => m.childId === state.child.id).length}{" "}
              завършени Featured мисии
            </span>
          </div>
          <div className="lab-grid">
            {lab.creations
              .filter((p) => p.childId === state.child.id)
              .map((p) => (
                <article key={p.id} className="lab-mini-card">
                  <h3>{p.title}</h3>
                  <p>
                    {labTiles.find((t) => t.slug === p.feature)?.title ?? p.feature} ·{" "}
                    {p.state === "completed" ? "Завършен" : "В процес"}
                  </p>
                  <small>{date(p.updatedAt)}</small>
                </article>
              ))}
          </div>
          <p className="muted">
            Прегледът показва творби и обща активност. Личните разговори и инструкции на детето не
            се показват тук.
          </p>
          <ul>
            {lab.activity
              .filter((a) => a.childId === state.child.id)
              .slice(0, 5)
              .map((a, i) => (
                <li key={i}>
                  {labTiles.find((t) => t.slug === a.feature)?.title ?? a.feature} · {a.energy}{" "}
                  Energy · {date(a.createdAt)}
                </li>
              ))}
          </ul>
          <div className="two-columns">
            <div>
              <h3>{bg.progress.byTopic}</h3>
              <TopicProgress state={state} completionThreshold={thresholds().mastered} />
            </div>
            <div>
              <h3>{bg.parent.recent}</h3>
              <RecentActivity items={activity} />
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
