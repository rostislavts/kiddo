import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db";
import * as s from "@/db/schema";
import { lessonContentSchema } from "@/lib/content/schema";
import { assert } from "@/lib/errors";
const slug = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const base = {
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(1000),
  slug,
  sortOrder: z.number().int().min(0).max(10000),
  published: z.boolean(),
  xpReward: z.number().int().min(0).max(10000),
};
export const worldInput = z.object({
  ...base,
  id: z.uuid().optional(),
  trackId: z.uuid(),
  isFree: z
    .boolean()
    .default(true)
    .transform(() => true),
  requiredWorldId: z.uuid().nullable(),
  sequentialLessons: z.boolean(),
  visual: z.enum(["robot", "brain", "data", "detective", "shield", "sparkles"]),
  color: z.enum(["violet", "mint", "peach", "blue", "yellow", "pink"]),
});
export const lessonInput = z.object({
  ...base,
  id: z.uuid().optional(),
  worldId: z.uuid(),
  estimatedMinutes: z.number().int().min(1).max(60),
  expectedVersion: z.number().int().positive().optional(),
  content: lessonContentSchema,
});
async function admin(tx: Parameters<Parameters<Database["transaction"]>[0]>[0], userId: string) {
  const [user] = await tx.select().from(s.users).where(eq(s.users.id, userId));
  assert(user?.role === "admin", "Нямаш достъп до администрацията.", "forbidden", 403);
}
export async function saveWorld(
  database: Database,
  userId: string,
  data: z.infer<typeof worldInput>,
) {
  const { id, ...input } = worldInput.parse(data);
  return database.transaction(async (tx) => {
    await admin(tx, userId);
    // Serialize graph edits per track so concurrent changes cannot create a prerequisite cycle.
    const [track] = await tx
      .select()
      .from(s.tracks)
      .where(eq(s.tracks.id, input.trackId))
      .for("update");
    assert(track, "Невалидна учебна пътека.");
    const worlds = await tx.select().from(s.worlds);
    const original = worlds.find((w) => w.id === id);
    if (id) {
      assert(original, "Светът не е намерен.", "not_found", 404);
      assert(original.trackId === input.trackId, "Промяната на учебната пътека не се поддържа.");
    }
    assert(
      !worlds.some((w) => w.slug === input.slug && w.id !== id),
      "Този адрес вече се използва.",
    );
    let current = input.requiredWorldId;
    const seen = new Set(id ? [id] : []);
    while (current) {
      assert(!seen.has(current), "Предишните светове не могат да образуват цикъл.");
      seen.add(current);
      const parent = worlds.find((w) => w.id === current);
      assert(
        parent && parent.trackId === input.trackId,
        "Предишният свят трябва да е от същата пътека.",
      );
      current = parent.requiredWorldId;
    }
    if (id) {
      const [world] = await tx.update(s.worlds).set(input).where(eq(s.worlds.id, id)).returning();
      return world;
    }
    const [world] = await tx.insert(s.worlds).values(input).returning();
    return world;
  });
}
export async function saveLesson(
  database: Database,
  userId: string,
  data: z.infer<typeof lessonInput>,
) {
  const { id, content, expectedVersion, ...input } = lessonInput.parse(data);
  return database.transaction(async (tx) => {
    await admin(tx, userId);
    const [world] = await tx.select().from(s.worlds).where(eq(s.worlds.id, input.worldId));
    assert(world, "Невалиден свят.");
    const [duplicate] = await tx.select().from(s.lessons).where(eq(s.lessons.slug, input.slug));
    assert(!duplicate || duplicate.id === id, "Този адрес вече се използва.");
    if (id) {
      const [current] = await tx.select().from(s.lessons).where(eq(s.lessons.id, id)).for("update");
      assert(current, "Урокът не е намерен.", "not_found", 404);
      assert(
        current.contentVersion === expectedVersion,
        "Урокът е променен в друг прозорец. Презареди страницата преди редакция.",
        "conflict",
        409,
      );
      assert(
        current.worldId === input.worldId,
        "Преместването на съществуващи уроци между светове не се поддържа.",
      );
      const version = current.contentVersion + 1;
      await tx.insert(s.lessonVersions).values({ lessonId: id, version, content });
      const [lesson] = await tx
        .update(s.lessons)
        .set({ ...input, contentVersion: version })
        .where(and(eq(s.lessons.id, id), eq(s.lessons.contentVersion, expectedVersion!)))
        .returning();
      return lesson;
    }
    const [lesson] = await tx
      .insert(s.lessons)
      .values({ ...input, contentVersion: 1 })
      .returning();
    await tx.insert(s.lessonVersions).values({ lessonId: lesson.id, version: 1, content });
    return lesson;
  });
}
