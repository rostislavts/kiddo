import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db";
import { analytics, children, users } from "@/db/schema";
import { assert } from "@/lib/errors";
export const childSchema = z.object({
  nickname: z.string().trim().min(2).max(24),
  avatar: z.enum(["robot", "rocket", "cat", "planet", "fox", "star"]),
  ageBand: z.enum(["", "8-9", "10-11"]).default(""),
});
export async function createChild(
  database: Database,
  userId: string,
  requestId: string,
  input: z.infer<typeof childSchema>,
) {
  const data = childSchema.parse(input);
  return database.transaction(async (tx) => {
    const [owner] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    assert(owner, "Акаунтът не е намерен.", "not_found", 404);
    assert(!owner.deletingAt, "Изтриването на акаунта се обработва.", "deleting", 409);
    const [existing] = await tx.select().from(children).where(eq(children.id, requestId));
    if (existing) {
      assert(existing.parentId === userId, "Невалидна заявка.", "forbidden", 403);
      return existing;
    }
    const [child] = await tx
      .insert(children)
      .values({ id: requestId, parentId: userId, ...data, ageBand: data.ageBand || null })
      .returning();
    await tx.insert(analytics).values({
      userId,
      childId: child.id,
      event: "child_profile_created",
      properties: data.ageBand ? { child_age_band: data.ageBand } : {},
    });
    return child;
  });
}
export async function updateChild(
  database: Database,
  userId: string,
  id: string,
  input: z.infer<typeof childSchema>,
) {
  const data = childSchema.parse(input);
  const [child] = await database
    .update(children)
    .set({ ...data, ageBand: data.ageBand || null })
    .where(and(eq(children.id, id), eq(children.parentId, userId)))
    .returning();
  assert(child, "Профилът не е намерен.", "not_found", 404);
  return child;
}
