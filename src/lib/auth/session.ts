import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, children, analytics } from "@/db/schema";
import { supabaseServer } from "./supabase";
import { isConfigured } from "@/lib/config";
import { DomainError } from "@/lib/errors";

export const getUser = cache(async () => {
  if (!isConfigured()) return null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  const auth = data.user;
  const [existing] = await db().select().from(users).where(eq(users.id, auth.id));
  if (existing) {
    const email = auth.email!.toLowerCase();
    if (existing.email !== email) {
      const [updated] = await db()
        .update(users)
        .set({ email })
        .where(eq(users.id, auth.id))
        .returning();
      return updated;
    }
    return existing;
  }
  // Role always comes from the database; user-editable auth metadata cannot grant admin.
  return db().transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        id: auth.id,
        email: auth.email!.toLowerCase(),
        consentAt: auth.user_metadata.parent_consent === true ? new Date() : null,
      })
      .onConflictDoNothing()
      .returning();
    if (created) {
      await tx.insert(analytics).values({ userId: created.id, event: "signup_completed" });
      return created;
    }
    const [found] = await tx.select().from(users).where(eq(users.id, auth.id));
    return found;
  });
});
export async function requireUser() {
  if (!isConfigured()) redirect("/setup");
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireApiUser(allowDeleting = false) {
  const user = await getUser();
  if (!user) throw new DomainError("unauthorized", "Влез в родителския си акаунт.", 401);
  if (user.deletingAt && !allowDeleting)
    throw new DomainError("deleting", "Изтриването на акаунта се обработва.", 409);
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/parent");
  return user;
}
export const selectedChild = cache(async () => {
  const user = await requireUser();
  const id = (await cookies()).get("academy-child")?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) redirect("/select-child");
  const [child] = await db()
    .select()
    .from(children)
    .where(and(eq(children.id, id), eq(children.parentId, user.id)));
  if (!child) redirect("/select-child");
  return { user, child };
});
