import { ensureEnergyPeriod } from "@/lib/ai/energy";
import { aiConfiguration } from "@/lib/ai/settings";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db";
import * as s from "@/db/schema";
import { shouldApplySubscriptionEvent } from "./entitlements";

// Normalize the SDK's verified camelCase event, without retaining payment payloads.
export const billingEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string(),
  occurredAt: z.iso.datetime({ offset: true }),
  data: z.object({
    id: z.string(),
    status: z.string().optional(),
    customerId: z.string().nullable().optional(),
    subscriptionId: z.string().nullable().optional(),
    transactionId: z.string().nullable().optional(),
    customData: z.record(z.string(), z.unknown()).nullable().optional(),
    items: z.array(z.object({ price: z.object({ id: z.string() }) })).optional(),
    currentBillingPeriod: z
      .object({ startsAt: z.string(), endsAt: z.string() })
      .nullable()
      .optional(),
    scheduledChange: z.object({ action: z.string() }).nullable().optional(),
  }),
});
export type BillingEvent = z.infer<typeof billingEventSchema>;
const statuses = z.enum(["active", "trialing", "past_due", "paused", "canceled"]);

export async function processBillingEvent(database: Database, input: BillingEvent) {
  const event = billingEventSchema.parse(input);
  return database.transaction(async (tx) => {
    const inserted = await tx
      .insert(s.webhookEvents)
      .values({
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: new Date(event.occurredAt),
        status: "ignored",
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) return { duplicate: true, processed: false };
    const isSubscription = event.eventType.startsWith("subscription.");
    const isTransaction = [
      "transaction.completed",
      "transaction.paid",
      "transaction.payment_failed",
      "transaction.past_due",
    ].includes(event.eventType);
    if (!isSubscription && !isTransaction) return { duplicate: false, processed: false };
    const subscriptionId = isSubscription ? event.data.id : event.data.subscriptionId;
    const [existing] = subscriptionId
      ? await tx
          .select()
          .from(s.subscriptions)
          .where(eq(s.subscriptions.paddleSubscriptionId, subscriptionId))
      : [];
    const token = z.uuid().safeParse(event.data.customData?.checkout_id);
    const [checkout] = token.success
      ? await tx.select().from(s.checkoutSessions).where(eq(s.checkoutSessions.id, token.data))
      : [];
    // A client-provided parent ID or email is never an account binding.
    const userId = existing?.userId ?? checkout?.userId;
    if (!userId) return { duplicate: false, processed: false };
    const [owner] = await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    if (!owner) return { duplicate: false, processed: false };
    if (isTransaction) {
      const [bound] = await tx
        .select()
        .from(s.checkoutSessions)
        .where(
          and(
            eq(s.checkoutSessions.userId, userId),
            eq(s.checkoutSessions.transactionId, event.data.id),
          ),
        );
      if (bound && event.eventType === "transaction.completed")
        await tx.insert(s.analytics).values({ userId, event: "checkout_completed" });
    } else {
      const state = statuses.safeParse(event.data.status);
      if (!state.success || !event.data.customerId || !event.data.items?.length)
        return { duplicate: false, processed: false };
      // Lock/reread after owner lock to serialize events for the same account.
      const [current] = await tx
        .select()
        .from(s.subscriptions)
        .where(eq(s.subscriptions.paddleSubscriptionId, event.data.id));
      if (
        current &&
        !shouldApplySubscriptionEvent(
          new Date(event.occurredAt),
          current.lastEventAt,
          state.data,
          current.status,
        )
      )
        return { duplicate: false, processed: false };
      if (
        !current &&
        event.data.transactionId &&
        checkout?.transactionId !== event.data.transactionId
      )
        return { duplicate: false, processed: false };
      const priceId =
        event.data.items.find((i) => i.price.id === process.env.PADDLE_MONTHLY_PRICE_ID)?.price
          .id ?? event.data.items[0].price.id;
      const values = {
        userId,
        paddleCustomerId: event.data.customerId,
        paddleSubscriptionId: event.data.id,
        paddlePriceId: priceId,
        status: state.data,
        periodStart: event.data.currentBillingPeriod
          ? new Date(event.data.currentBillingPeriod.startsAt)
          : null,
        periodEnd: event.data.currentBillingPeriod
          ? new Date(event.data.currentBillingPeriod.endsAt)
          : null,
        cancelAtPeriodEnd: event.data.scheduledChange?.action === "cancel",
        lastEventAt: new Date(event.occurredAt),
        updatedAt: new Date(),
      };
      await tx
        .insert(s.subscriptions)
        .values(values)
        .onConflictDoUpdate({ target: s.subscriptions.paddleSubscriptionId, set: values });
      if (
        priceId === process.env.PADDLE_MONTHLY_PRICE_ID &&
        ["active", "trialing"].includes(state.data) &&
        values.periodEnd &&
        values.periodEnd > new Date() &&
        (!values.periodStart || values.periodStart <= new Date())
      ) {
        await ensureEnergyPeriod(tx, userId, (await aiConfiguration(tx)).config);
      }
      if (current?.status !== state.data && ["active", "canceled"].includes(state.data))
        await tx.insert(s.analytics).values({
          userId,
          event: state.data === "active" ? "subscription_activated" : "subscription_canceled",
        });
    }
    await tx
      .update(s.webhookEvents)
      .set({ status: "processed" })
      .where(eq(s.webhookEvents.eventId, event.eventId));
    return { duplicate: false, processed: true };
  });
}
