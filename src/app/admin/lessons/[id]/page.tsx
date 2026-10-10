import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { PageTitle } from "@/components/ui/primitives";
import { LessonForm } from "@/components/admin-forms";
import { lessonContentSchema } from "@/lib/content/schema";
import { lessonSeeds } from "@/content/seed/curriculum";
import { bg } from "@/i18n/bg";
export default async function LessonEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ world?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (id === "new") {
    const { world } = await searchParams;
    if (!z.uuid().safeParse(world).success) notFound();
    const [parent] = await db().select().from(s.worlds).where(eq(s.worlds.id, world!));
    if (!parent) notFound();
    return (
      <>
        <PageTitle title={bg.admin.newLesson} description={bg.admin.template} />
        <section className="content-card">
          <LessonForm content={lessonSeeds[0].content} worldId={parent.id} />
        </section>
      </>
    );
  }
  if (!z.uuid().safeParse(id).success) notFound();
  const [lesson] = await db().select().from(s.lessons).where(eq(s.lessons.id, id));
  if (!lesson) notFound();
  const [version] = await db()
    .select()
    .from(s.lessonVersions)
    .where(
      and(eq(s.lessonVersions.lessonId, id), eq(s.lessonVersions.version, lesson.contentVersion)),
    );
  if (!version) notFound();
  return (
    <>
      <PageTitle
        title={lesson.title}
        description={`${bg.admin.version} ${lesson.contentVersion}`}
      />
      <section className="content-card">
        <LessonForm
          key={lesson.contentVersion}
          lesson={lesson}
          content={lessonContentSchema.parse(version.content)}
          worldId={lesson.worldId}
        />
      </section>
    </>
  );
}
