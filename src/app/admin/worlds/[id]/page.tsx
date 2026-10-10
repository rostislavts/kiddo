import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { PageTitle, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { WorldForm } from "@/components/admin-forms";
import { bg } from "@/i18n/bg";
export default async function WorldEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [world] = await db().select().from(s.worlds).where(eq(s.worlds.id, id));
  if (!world) notFound();
  const all = await db().select().from(s.worlds);
  const tracks = await db().select().from(s.tracks);
  const lessons = await db()
    .select()
    .from(s.lessons)
    .where(eq(s.lessons.worldId, id))
    .orderBy(asc(s.lessons.sortOrder));
  return (
    <>
      <PageTitle title={world.title} />
      <section className="content-card">
        <WorldForm world={world} worlds={all} tracks={tracks} />
      </section>
      <section className="content-card">
        <div className="section-heading">
          <h2>{bg.admin.lessons}</h2>
          <Button asChild size="small">
            <Link href={`/admin/lessons/new?world=${id}`}>{bg.admin.newLesson}</Link>
          </Button>
        </div>
        {lessons.map((l) => (
          <div className="admin-world-row" key={l.id}>
            <div>
              <h3>
                {l.sortOrder + 1}. {l.title}
              </h3>
              <p>
                {l.estimatedMinutes} {bg.common.minutes} · {l.xpReward} XP · {bg.admin.version}{" "}
                {l.contentVersion}
              </p>
            </div>
            <div className="inline-actions">
              <Badge>{l.published ? bg.admin.published : bg.admin.draft}</Badge>
              <Button asChild variant="secondary" size="small">
                <Link href={`/admin/lessons/${l.id}`}>{bg.common.edit}</Link>
              </Button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
