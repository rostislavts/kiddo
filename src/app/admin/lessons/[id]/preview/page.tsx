import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { lessonContentSchema } from "@/lib/content/schema";
import { LessonPlayer } from "@/components/learning/lesson-player";
export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
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
    <LessonPlayer
      lessonId={id}
      title={lesson.title}
      worldSlug=""
      preview={lessonContentSchema.parse(version.content)}
    />
  );
}
