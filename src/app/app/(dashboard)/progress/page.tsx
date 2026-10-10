import { db } from "@/db";
import { selectedChild } from "@/lib/auth/session";
import { snapshot, recentActivity } from "@/lib/learning/service";
import { bg } from "@/i18n/bg";
import { PageTitle } from "@/components/ui/primitives";
import { Stats, TopicProgress, RecentActivity } from "@/components/progress-summary";
import { thresholds } from "@/lib/config";
export default async function Progress() {
  const { user, child } = await selectedChild();
  const state = await snapshot(db(), user.id, child.id);
  const activity = await recentActivity(db(), child.id);
  return (
    <>
      <PageTitle title={bg.progress.title} description={bg.progress.description} />
      <Stats state={state} />
      <section className="content-card">
        <h2>{bg.progress.byTopic}</h2>
        <TopicProgress state={state} completionThreshold={thresholds().mastered} />
      </section>
      <section className="content-card">
        <h2>{bg.progress.history}</h2>
        <RecentActivity items={activity} />
      </section>
    </>
  );
}
