import { and, eq, gt, inArray, desc, lte, or, isNull } from "drizzle-orm";
import type { QueryDb } from "@/db";
import { subscriptions } from "@/db/schema";
import { ownedChild } from "@/lib/learning/service";
import { schoolAccess } from "@/lib/schools/access";
export async function getPremiumEntitlement(database: QueryDb, userId: string, now = new Date()) {
  const priceId = process.env.PADDLE_MONTHLY_PRICE_ID;
  if (!priceId) return null;
  const [row] = await database
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.paddlePriceId, priceId),
        inArray(subscriptions.status, ["active", "trialing"]),
        gt(subscriptions.periodEnd, now),
        or(isNull(subscriptions.periodStart), lte(subscriptions.periodStart, now)),
      ),
    )
    .orderBy(desc(subscriptions.periodEnd))
    .limit(1);
  return row ?? null;
}
export async function resolveLabAccess(
  database: QueryDb,
  userId: string,
  childId: string,
  lock = false,
  now = new Date(),
  reserve = false,
) {
  const child = await ownedChild(database, userId, childId);
  const family = await getPremiumEntitlement(database, userId, now);
  const school = await schoolAccess(database, childId, lock, now, reserve);
  const source: "school" | "family" | null =
    child.energyPreference === "family" && family
      ? "family"
      : school
        ? "school"
        : family
          ? "family"
          : null;
  return { source, family, school };
}
export async function canUseAILab(database: QueryDb, userId: string, childId: string) {
  return !!(await resolveLabAccess(database, userId, childId, true)).source;
}
