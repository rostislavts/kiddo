import { eq } from "drizzle-orm";
import { Award, LockKeyhole, Trophy } from "lucide-react";
import { db } from "@/db";
import { achievements, childAchievements } from "@/db/schema";
import { selectedChild } from "@/lib/auth/session";
import { PageTitle, Badge } from "@/components/ui/primitives";
import { bg } from "@/i18n/bg";
import { date } from "@/lib/utils";
export default async function Achievements() {
  const { child } = await selectedChild();
  const all = await db().select().from(achievements).where(eq(achievements.published, true));
  const earned = await db()
    .select()
    .from(childAchievements)
    .where(eq(childAchievements.childId, child.id));
  return (
    <>
      <PageTitle title={bg.achievements.title} description={bg.achievements.description} />
      <div className="badge-grid">
        {all.map((a) => {
          const entry = earned.find((e) => e.achievementId === a.id);
          return (
            <article key={a.id} className={`achievement-card ${entry ? "" : "locked"}`}>
              <div className="achievement-icon">
                {entry ? <Trophy size={35} /> : <Award size={35} />}
              </div>
              <h3>{a.title}</h3>
              <p>{a.description}</p>
              <Badge className={entry ? "badge-green" : "badge-neutral"}>
                {entry ? (
                  `${bg.achievements.earned} · ${date(entry.earnedAt)}`
                ) : (
                  <>
                    <LockKeyhole size={12} />
                    {bg.achievements.locked}
                  </>
                )}
              </Badge>
            </article>
          );
        })}
      </div>
      {!all.length && <p className="notice">{bg.achievements.empty}</p>}
    </>
  );
}
