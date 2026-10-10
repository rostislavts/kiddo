import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireApiUser } from "@/lib/auth/session";
import { verifyOrigin, rateLimit } from "@/lib/security";
import { errorResponse, readJson } from "@/lib/http";
import { paddle } from "@/lib/billing/paddle";
import { canAccessPremium } from "@/lib/billing/entitlements";
import { assert } from "@/lib/errors";
import { appUrl } from "@/lib/config";

export async function GET() {
  try {
    const user = await requireApiUser();
    const rows = await db()
      .select()
      .from(s.subscriptions)
      .where(eq(s.subscriptions.userId, user.id));
    return NextResponse.json(
      { premium: canAccessPremium(rows, process.env.PADDLE_MONTHLY_PRICE_ID) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const user = await requireApiUser();
    await rateLimit(user.id, "billing", 8);
    const { action } = z
      .object({ action: z.enum(["checkout", "portal"]) })
      .parse(await readJson(request));
    const client = paddle();
    const subscriptions = await db()
      .select()
      .from(s.subscriptions)
      .where(eq(s.subscriptions.userId, user.id))
      .orderBy(desc(s.subscriptions.updatedAt));
    if (action === "portal") {
      const current = subscriptions.find((sub) => sub.status !== "canceled") ?? subscriptions[0];
      assert(current, "Няма абонамент за управление.");
      const session = await client.customerPortalSessions.create(current.paddleCustomerId, []);
      return NextResponse.json({ url: session.urls.general.overview });
    }
    assert(
      process.env.PADDLE_MONTHLY_PRICE_ID && process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      "Плащанията още не са настроени.",
      "billing_config",
      503,
    );
    assert(
      !subscriptions.some((s) => ["active", "trialing", "past_due", "paused"].includes(s.status)),
      "Вече имаш абонамент. Използвай „Управление на абонамента“.",
      "existing_subscription",
      409,
    );
    const transactionId = await db().transaction(async (tx) => {
      const [owner] = await tx.select().from(s.users).where(eq(s.users.id, user.id)).for("update");
      assert(owner && !owner.deletingAt, "Акаунтът не е достъпен за плащания.", "deleting", 409);
      const current = await tx
        .select()
        .from(s.subscriptions)
        .where(eq(s.subscriptions.userId, user.id));
      assert(
        !current.some((sub) => ["active", "trialing", "past_due", "paused"].includes(sub.status)),
        "Вече имаш абонамент. Използвай управлението на абонамента.",
        "existing_subscription",
        409,
      );
      const [recent] = await tx
        .select()
        .from(s.checkoutSessions)
        .where(
          and(
            eq(s.checkoutSessions.userId, user.id),
            gt(s.checkoutSessions.createdAt, new Date(Date.now() - 30 * 60 * 1000)),
          ),
        )
        .orderBy(desc(s.checkoutSessions.createdAt))
        .limit(1);
      if (recent?.transactionId) {
        const existing = await client.transactions.get(recent.transactionId);
        if (["draft", "ready"].includes(existing.status)) return recent.transactionId;
        assert(
          existing.status !== "paid" && existing.status !== "completed",
          "Плащането се обработва. Изчакай потвърждението.",
          "pending",
          409,
        );
      }
      const [session] = await tx.insert(s.checkoutSessions).values({ userId: user.id }).returning();
      const transaction = await client.transactions.create({
        items: [{ priceId: process.env.PADDLE_MONTHLY_PRICE_ID!, quantity: 1 }],
        customData: { checkout_id: session.id },
        collectionMode: "automatic",
        checkout: { url: `${appUrl()}/parent/billing` },
      });
      await tx
        .update(s.checkoutSessions)
        .set({ transactionId: transaction.id })
        .where(eq(s.checkoutSessions.id, session.id));
      await tx.insert(s.analytics).values({ userId: user.id, event: "checkout_started" });
      return transaction.id;
    });
    return NextResponse.json({ transactionId });
  } catch (error) {
    return errorResponse(error);
  }
}
