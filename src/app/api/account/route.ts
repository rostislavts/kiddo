import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireApiUser } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/auth/supabase";
import { assert } from "@/lib/errors";
import { childSchema, createChild, updateChild } from "@/lib/children/service";
import { verifyOrigin, rateLimit } from "@/lib/security";
import { errorResponse, readJson } from "@/lib/http";
import { deleteLabChild } from "@/lib/lab/maintenance";
import { parentLabSummary } from "@/lib/lab/view";
import { paddle } from "@/lib/billing/paddle";
import { parentSchoolView } from "@/lib/schools/view";
import { cancelChildRuns } from "@/lib/ai/energy";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_child"),
    requestId: z.uuid(),
    guardianConsent: z.boolean().optional(),
    ...childSchema.shape,
  }),
  z.object({ action: z.literal("update_child"), id: z.uuid(), ...childSchema.shape }),
  z.object({ action: z.literal("select_child"), id: z.uuid() }),
  z.object({ action: z.literal("delete_child"), id: z.uuid(), confirmation: z.string() }),
  z.object({
    action: z.literal("delete_account"),
    confirmation: z.literal("ИЗТРИЙ"),
    password: z.string().min(8).max(128),
  }),
]);
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const user = await requireApiUser(true);
    await rateLimit(user.id, "account", 30);
    const input = schema.parse(await readJson(request));
    assert(
      !user.deletingAt || input.action === "delete_account",
      "Изтриването на акаунта се обработва.",
      "deleting",
      409,
    );
    const jar = await cookies();
    if (input.action === "create_child") {
      assert(
        user.consentAt || input.guardianConsent,
        "Потвърди, че си родител или настойник на детето.",
        "consent",
        400,
      );
      if (!user.consentAt)
        await db().update(s.users).set({ consentAt: new Date() }).where(eq(s.users.id, user.id));
      const child = await createChild(db(), user.id, input.requestId, input);
      return NextResponse.json({ id: child.id });
    }
    if (input.action === "update_child") {
      await updateChild(db(), user.id, input.id, input);
      return NextResponse.json({ ok: true });
    }
    if (input.action === "select_child" || input.action === "delete_child") {
      const [child] = await db()
        .select()
        .from(s.children)
        .where(and(eq(s.children.id, input.id), eq(s.children.parentId, user.id)));
      assert(child, "Профилът не е намерен.", "not_found", 404);
      if (input.action === "select_child") {
        jar.set("academy-child", child.id, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
        });
        await db()
          .insert(s.analytics)
          .values({ userId: user.id, childId: child.id, event: "child_profile_selected" });
      } else {
        assert(input.confirmation === child.nickname, "Напиши точно псевдонима за потвърждение.");
        await deleteLabChild(db(), user.id, child.id);
        if (jar.get("academy-child")?.value === child.id) jar.delete("academy-child");
      }
      return NextResponse.json({ ok: true });
    }
    assert(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Изтриването на акаунти още не е настроено.",
      "config",
      503,
    );
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: input.password,
    });
    assert(!error, "Паролата е невалидна.", "unauthorized", 401);
    await db().transaction(async (tx) => {
      const [owner] = await tx.select().from(s.users).where(eq(s.users.id, user.id)).for("update");
      assert(
        owner && (!owner.deletingAt || owner.deletingAt.getTime() < Date.now() - 5 * 60_000),
        "Изтриването вече се обработва. Опитай след няколко минути.",
        "deleting",
        409,
      );
      await tx.update(s.users).set({ deletingAt: new Date() }).where(eq(s.users.id, user.id));
    });
    try {
      const subscriptions = await db()
        .select()
        .from(s.subscriptions)
        .where(eq(s.subscriptions.userId, user.id));
      for (const sub of subscriptions) {
        const live = await paddle().subscriptions.get(sub.paddleSubscriptionId);
        assert(
          live.status === "canceled",
          "Първо прекрати абонамента в страницата за плащания. При отложено прекратяване изчакай края на периода.",
          "subscription_exists",
          409,
        );
      }
      const pending = await db()
        .select()
        .from(s.checkoutSessions)
        .where(eq(s.checkoutSessions.userId, user.id));
      for (const checkout of pending) {
        if (!checkout.transactionId) continue;
        const live = await paddle().transactions.get(checkout.transactionId);
        assert(
          live.status !== "paid",
          "Изчакай обработката на плащането, преди да изтриеш акаунта.",
          "pending",
          409,
        );
        if (
          live.subscriptionId &&
          !subscriptions.some((sub) => sub.paddleSubscriptionId === live.subscriptionId)
        )
          assert(
            false,
            "Изчакай синхронизирането на плащането, преди да изтриеш акаунта.",
            "pending",
            409,
          );
        if (["draft", "ready"].includes(live.status))
          await paddle().transactions.update(live.id, { status: "canceled" });
      }
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const deleted = await admin.auth.admin.deleteUser(user.id);
      assert(!deleted.error, "Не успяхме да изтрием акаунта. Опитай отново.");
      await db().transaction(async (tx) => {
        await tx.select().from(s.users).where(eq(s.users.id, user.id)).for("update");
        const profiles = await tx
          .select({ id: s.children.id })
          .from(s.children)
          .where(eq(s.children.parentId, user.id));
        for (const profile of profiles) await cancelChildRuns(tx, user.id, profile.id);
        await tx.delete(s.users).where(eq(s.users.id, user.id));
      });
      await supabase.auth.signOut();
      jar.delete("academy-child");
      return NextResponse.json({ ok: true });
    } catch (error) {
      await db().update(s.users).set({ deletingAt: null }).where(eq(s.users.id, user.id));
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
export async function GET() {
  try {
    const user = await requireApiUser();
    await rateLimit(user.id, "export", 5, 3600);
    const profiles = await db().select().from(s.children).where(eq(s.children.parentId, user.id));
    const ids = profiles.map((p) => p.id);
    const quizAttempts = ids.length
      ? await db().select().from(s.attempts).where(inArray(s.attempts.childId, ids))
      : [];
    const data = {
      account: user,
      lab: await parentLabSummary(db(), user.id),
      schools: await parentSchoolView(db(), user.id),
      schoolEnrollments: ids.length
        ? await db()
            .select()
            .from(s.schoolEnrollments)
            .where(inArray(s.schoolEnrollments.childId, ids))
        : [],
      schoolMemberships: await db()
        .select()
        .from(s.schoolMemberships)
        .where(eq(s.schoolMemberships.email, user.email.toLowerCase())),
      children: profiles,
      progress: ids.length
        ? await db().select().from(s.progress).where(inArray(s.progress.childId, ids))
        : [],
      quizAttempts,
      quizAnswers: quizAttempts.length
        ? await db()
            .select()
            .from(s.answers)
            .where(
              inArray(
                s.answers.attemptId,
                quizAttempts.map((a) => a.id),
              ),
            )
        : [],
      xpEvents: ids.length
        ? await db().select().from(s.xpEvents).where(inArray(s.xpEvents.childId, ids))
        : [],
      achievements: ids.length
        ? await db()
            .select()
            .from(s.childAchievements)
            .where(inArray(s.childAchievements.childId, ids))
        : [],
      completedWorlds: ids.length
        ? await db()
            .select()
            .from(s.worldCompletions)
            .where(inArray(s.worldCompletions.childId, ids))
        : [],
      subscriptions: await db()
        .select()
        .from(s.subscriptions)
        .where(eq(s.subscriptions.userId, user.id)),
      analytics: await db().select().from(s.analytics).where(eq(s.analytics.userId, user.id)),
    };
    return NextResponse.json(data, {
      headers: {
        "Content-Disposition": "attachment; filename=ai-academy-data.json",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
