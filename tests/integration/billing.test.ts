import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { eq, sql } from "drizzle-orm";
import { testDatabase } from "../helpers/database";
import { processBillingEvent, type BillingEvent } from "@/lib/billing/webhooks";
import { canAccessPremium } from "@/lib/billing/entitlements";
import { seedId } from "@/content/seed/curriculum";
import * as s from "@/db/schema";
let fixture: Awaited<ReturnType<typeof testDatabase>>;
const parentId = seedId(700),
  token = seedId(701);
const event = (
  id: string,
  type = "subscription.created",
  status = "active",
  at = "2026-09-25T10:00:00Z",
): BillingEvent => ({
  eventId: id,
  eventType: type,
  occurredAt: at,
  data: {
    id: "sub_test",
    status,
    customerId: "ctm_test",
    transactionId: type === "subscription.created" ? "txn_test" : undefined,
    customData: { checkout_id: token },
    items: [{ price: { id: "pri_test" } }],
    currentBillingPeriod: { startsAt: "2026-09-25T00:00:00Z", endsAt: "2026-10-25T00:00:00Z" },
    scheduledChange: null,
  },
});
describe("billing synchronization", () => {
  beforeAll(async () => {
    vi.stubEnv("PADDLE_MONTHLY_PRICE_ID", "pri_test");
    fixture = await testDatabase();
  });
  afterAll(async () => {
    await fixture.client.close();
    vi.unstubAllEnvs();
  });
  beforeEach(async () => {
    await fixture.db.execute(sql`TRUNCATE users, payment_webhook_events CASCADE`);
    await fixture.db.insert(s.users).values({ id: parentId, email: "parent@example.test" });
    await fixture.db
      .insert(s.checkoutSessions)
      .values({ id: token, userId: parentId, transactionId: "txn_test" });
  });
  it("activates verified subscriptions and deduplicates delivery", async () => {
    await processBillingEvent(fixture.db, event("evt_1"));
    expect(await processBillingEvent(fixture.db, event("evt_1"))).toMatchObject({
      duplicate: true,
    });
    const subscriptions = await fixture.db.select().from(s.subscriptions);
    expect(subscriptions).toHaveLength(1);
    expect(await fixture.db.select().from(s.webhookEvents)).toHaveLength(1);
    expect(canAccessPremium(subscriptions, "pri_test", new Date("2026-09-26"))).toBe(true);
  });
  it("keeps cancellation when older activation arrives afterwards", async () => {
    await processBillingEvent(
      fixture.db,
      event("evt_new", "subscription.canceled", "canceled", "2026-09-26T10:00:00Z"),
    );
    await processBillingEvent(fixture.db, event("evt_old"));
    const [sub] = await fixture.db.select().from(s.subscriptions);
    expect(sub.status).toBe("canceled");
    expect(sub.lastEventAt.toISOString()).toBe("2026-09-26T10:00:00.000Z");
  });
  it("keeps cancellation for equal timestamps in either delivery order", async () => {
    await processBillingEvent(fixture.db, event("evt_1"));
    await processBillingEvent(fixture.db, event("evt_2", "subscription.canceled", "canceled"));
    await processBillingEvent(fixture.db, event("evt_3", "subscription.activated", "active"));
    const [sub] = await fixture.db.select().from(s.subscriptions);
    expect(sub.status).toBe("canceled");
  });
  it.each(["paused", "past_due", "canceled"])(
    "removes %s access without touching historical progress",
    async (status) => {
      await fixture.db.insert(s.children).values({ id: seedId(702), parentId, nickname: "Ева" });
      await fixture.db.insert(s.progress).values({
        childId: seedId(702),
        lessonId: seedId(200),
        version: 1,
        status: "completed",
        bestScore: 100,
      });
      await processBillingEvent(fixture.db, event("evt_1"));
      await processBillingEvent(
        fixture.db,
        event("evt_2", `subscription.${status}`, status, "2026-09-27T00:00:00Z"),
      );
      expect(
        canAccessPremium(
          await fixture.db.select().from(s.subscriptions),
          "pri_test",
          new Date("2026-09-28"),
        ),
      ).toBe(false);
      expect(await fixture.db.select().from(s.progress)).toHaveLength(1);
      await processBillingEvent(
        fixture.db,
        event("evt_3", "subscription.resumed", "active", "2026-09-28T12:00:00Z"),
      );
      expect(
        canAccessPremium(
          await fixture.db.select().from(s.subscriptions),
          "pri_test",
          new Date("2026-09-29"),
        ),
      ).toBe(true);
    },
  );
  it("rejects unbound custom parent IDs and transaction substitutions", async () => {
    const unbound = event("evt_fake");
    unbound.data.customData = { user_id: parentId };
    await processBillingEvent(fixture.db, unbound);
    expect(await fixture.db.select().from(s.subscriptions)).toHaveLength(0);
    const wrongTransaction = event("evt_fake2");
    wrongTransaction.data.transactionId = "txn_other";
    await processBillingEvent(fixture.db, wrongTransaction);
    expect(await fixture.db.select().from(s.subscriptions)).toHaveLength(0);
  });
  it("does not grant access from transaction.paid/completed alone", async () => {
    const payment = event("evt_tx", "transaction.completed");
    payment.data.id = "txn_test";
    payment.data.subscriptionId = "sub_test";
    await processBillingEvent(fixture.db, payment);
    expect(await fixture.db.select().from(s.subscriptions)).toHaveLength(0);
    expect(
      await fixture.db
        .select()
        .from(s.analytics)
        .where(eq(s.analytics.event, "checkout_completed")),
    ).toHaveLength(1);
  });
  it("rolls back event deduplication when processing fails so Paddle may retry", async () => {
    const invalid = event("evt_retry");
    invalid.data.currentBillingPeriod = { startsAt: "not-a-date", endsAt: "not-a-date" };
    await expect(processBillingEvent(fixture.db, invalid)).rejects.toThrow();
    expect(await fixture.db.select().from(s.webhookEvents)).toHaveLength(0);
    await processBillingEvent(fixture.db, event("evt_retry"));
    expect(await fixture.db.select().from(s.subscriptions)).toHaveLength(1);
  });
});
describe("Paddle signature verification with the official SDK", () => {
  it("accepts a valid raw-body signature and rejects a modified body", async () => {
    const client = new Paddle("test-api-key", { environment: Environment.sandbox });
    const secret = "test-webhook-secret";
    const ts = Math.floor(Date.now() / 1000);
    const raw = JSON.stringify({
      event_id: "evt_test",
      event_type: "customer.created",
      occurred_at: new Date().toISOString(),
      notification_id: "ntf_test",
      data: {
        id: "ctm_test",
        status: "active",
        custom_data: null,
        name: null,
        email: "test@example.test",
        marketing_consent: false,
        locale: "en",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        import_meta: null,
      },
    });
    const signature = `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex")}`;
    expect((await client.webhooks.unmarshal(raw, secret, signature)).eventId).toBe("evt_test");
    await expect(client.webhooks.unmarshal(`${raw} `, secret, signature)).rejects.toThrow();
    await expect(client.webhooks.unmarshal(raw, "wrong", signature)).rejects.toThrow();
  });
});
