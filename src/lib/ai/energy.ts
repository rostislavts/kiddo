import { and, eq, gt, inArray, lt, desc, sum, count, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Database, QueryDb } from "@/db";
import * as s from "@/db/schema";
import { assert, DomainError } from "@/lib/errors";
import { ownedChild } from "@/lib/learning/service";
import { getPremiumEntitlement, resolveLabAccess } from "./entitlement";
import { aiConfiguration } from "./settings";
import type { AIConfig } from "./models";
import type { RunInput } from "./schemas";
export async function balanceForPeriod(tx: QueryDb, periodId: string) {
  const [row] = await tx
    .select({ value: sum(s.aiEnergyEvents.amount) })
    .from(s.aiEnergyEvents)
    .where(eq(s.aiEnergyEvents.periodId, periodId));
  return Number(row?.value || 0);
}
// Contract row is locked exclusively before reserving school Energy. The ceiling
// also covers departed/deleted pupils, preventing repeated seat recycling.
export async function schoolBudgetRemaining(
  tx: QueryDb,
  period: Pick<typeof s.aiEnergyPeriods.$inferSelect, "schoolContractId" | "startsAt">,
) {
  if (!period.schoolContractId) return null;
  const [contract] = await tx
    .select()
    .from(s.schoolContracts)
    .where(eq(s.schoolContracts.id, period.schoolContractId));
  const [usage] = await tx
    .select({ spent: sql<number>`coalesce(-sum(${s.aiEnergyEvents.amount}),0)::integer` })
    .from(s.aiEnergyEvents)
    .innerJoin(s.aiEnergyPeriods, eq(s.aiEnergyPeriods.id, s.aiEnergyEvents.periodId))
    .where(
      and(
        eq(s.aiEnergyPeriods.schoolContractId, contract.id),
        eq(s.aiEnergyPeriods.startsAt, period.startsAt),
        inArray(s.aiEnergyEvents.eventType, ["usage_reservation", "refund"]),
      ),
    );
  return Math.max(0, contract.seats * contract.monthlyEnergy - usage.spent);
}
// Caller holds the parent user row lock. All grants/debits/refunds share this lock.
export async function ensureEnergyPeriod(
  tx: QueryDb,
  userId: string,
  config: AIConfig,
  now = new Date(),
  childId?: string,
) {
  const access = childId ? await resolveLabAccess(tx, userId, childId, true, now, true) : null;
  const school = access?.source === "school" ? access.school : null;
  const entitlement = school ? null : await getPremiumEntitlement(tx, userId, now);
  assert(
    school || entitlement?.periodEnd,
    "AI Lab изисква активен семеен или училищен Premium достъп.",
    "premium",
    403,
  );
  const condition = school
    ? and(eq(s.energyAccounts.schoolId, school.school.id), eq(s.energyAccounts.childId, childId!))
    : eq(s.energyAccounts.userId, userId);
  let [account] = await tx.select().from(s.energyAccounts).where(condition);
  if (!account) {
    [account] = await tx
      .insert(s.energyAccounts)
      .values(
        school
          ? { kind: "school", schoolId: school.school.id, childId }
          : { kind: "family", userId },
      )
      .onConflictDoNothing()
      .returning();
    if (!account) [account] = await tx.select().from(s.energyAccounts).where(condition);
  }
  await tx
    .select({ id: s.energyAccounts.id })
    .from(s.energyAccounts)
    .where(eq(s.energyAccounts.id, account.id))
    .for("update");
  const startsAt = school
    ? new Date(
        Math.max(
          school.contract.startsAt.getTime(),
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
        ),
      )
    : (entitlement!.periodStart ?? new Date(entitlement!.periodEnd!.getTime() - 30 * 86400000));
  const endsAt = school
    ? new Date(
        Math.min(
          school.contract.endsAt.getTime(),
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
        ),
      )
    : entitlement!.periodEnd!;
  assert(startsAt <= now, "Достъпът още не е започнал.", "premium", 403);
  let [period] = await tx
    .select()
    .from(s.aiEnergyPeriods)
    .where(
      and(eq(s.aiEnergyPeriods.accountId, account.id), eq(s.aiEnergyPeriods.startsAt, startsAt)),
    );
  if (!period) {
    let carry = 0;
    if (!school && config.rollover) {
      const [previous] = await tx
        .select()
        .from(s.aiEnergyPeriods)
        .where(
          and(
            eq(s.aiEnergyPeriods.accountId, account.id),
            lt(s.aiEnergyPeriods.startsAt, startsAt),
          ),
        )
        .orderBy(desc(s.aiEnergyPeriods.startsAt))
        .limit(1);
      if (previous)
        carry = Math.min(config.maxRollover, Math.max(0, await balanceForPeriod(tx, previous.id)));
    }
    const allowance = school?.contract.monthlyEnergy ?? config.monthlyEnergy;
    [period] = await tx
      .insert(s.aiEnergyPeriods)
      .values({
        userId,
        accountId: account.id,
        schoolContractId: school?.contract.id,
        subscriptionId: entitlement?.paddleSubscriptionId,
        startsAt,
        endsAt,
        allowance,
      })
      .returning();
    await tx
      .insert(s.aiEnergyEvents)
      .values({
        userId,
        childId: school ? childId : undefined,
        periodId: period.id,
        eventType: "monthly_grant",
        feature: "account",
        amount: allowance + carry,
        idempotencyKey: school
          ? `school-monthly:${account.id}:${startsAt.toISOString()}`
          : `monthly:${userId}:${startsAt.toISOString()}`,
      })
      .onConflictDoNothing();
  }
  return period;
}

export async function initializeEnergy(database: Database, userId: string) {
  return database.transaction(async (tx) => {
    await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    const { config } = await aiConfiguration(tx);
    if (!(await getPremiumEntitlement(tx, userId))) return null;
    return ensureEnergyPeriod(tx, userId, config);
  });
}
async function refund(
  tx: QueryDb,
  run: typeof s.aiRuns.$inferSelect,
  status: "failed" | "moderated" | "canceled",
  code: string,
  providerUsage: Record<string, unknown> = {},
) {
  await tx
    .insert(s.aiEnergyEvents)
    .values({
      userId: run.userId,
      childId: run.childId,
      periodId: run.periodId,
      eventType: "refund",
      feature: run.feature,
      referenceId: run.id,
      amount: run.energyReserved,
      idempotencyKey: `refund:${run.id}`,
      providerUsage,
    })
    .onConflictDoNothing();
  await tx
    .update(s.aiRuns)
    .set({ status, errorCode: code, completedAt: new Date(), outputMetadata: providerUsage })
    .where(eq(s.aiRuns.id, run.id));
  await tx.insert(s.analytics).values({
    userId: run.userId,
    childId: run.childId,
    event: "ai_run_failed",
    properties: { feature: run.feature, error_code: code },
  });
}
export async function recoverExpiredRuns(tx: QueryDb, userId: string, now = new Date()) {
  const stale = await tx
    .select()
    .from(s.aiRuns)
    .where(
      and(
        eq(s.aiRuns.userId, userId),
        inArray(s.aiRuns.status, ["pending", "running"]),
        lt(s.aiRuns.expiresAt, now),
      ),
    );
  for (const run of stale) await refund(tx, run, "failed", "timeout");
}
export async function reserveEnergy(
  database: Database,
  userId: string,
  input: RunInput,
  provider: string,
  prepare: (
    tx: QueryDb,
    config: AIConfig,
  ) => Promise<{
    cost?: number;
    metadata: Record<string, unknown>;
    context: Record<string, unknown>;
  }>,
) {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return database.transaction(async (tx) => {
    const [user] = await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    assert(user && !user.deletingAt, "Акаунтът не е достъпен.", "deleting", 409);
    await ownedChild(tx, userId, input.childId);
    const { config } = await aiConfiguration(tx);
    await recoverExpiredRuns(tx, userId);
    const [old] = await tx
      .select()
      .from(s.aiRuns)
      .where(and(eq(s.aiRuns.userId, userId), eq(s.aiRuns.requestKey, input.requestId)));
    if (old) {
      assert(
        old.requestHash === hash,
        "Този идентификатор вече е използван за друга заявка.",
        "idempotency_conflict",
        409,
      );
      return { run: old, config, duplicate: true, context: {} };
    }
    assert(
      config.enabled && config.features[input.feature].enabled,
      "Този AI инструмент е временно в почивка.",
      "ai_paused",
      503,
    );
    const period = await ensureEnergyPeriod(tx, userId, config, new Date(), input.childId);
    const recent = await tx
      .select({ childId: s.aiRuns.childId, status: s.aiRuns.status, projectId: s.aiRuns.projectId })
      .from(s.aiRuns)
      .where(
        and(eq(s.aiRuns.userId, userId), gt(s.aiRuns.startedAt, new Date(Date.now() - 60000))),
      );
    assert(
      recent.length < config.accountRunsPerMinute &&
        recent.filter((r) => r.childId === input.childId).length < config.childRunsPerMinute,
      "Нека направим кратка пауза и опитаме след минута.",
      "rate_limit",
      429,
    );
    const active = await tx
      .select({ projectId: s.aiRuns.projectId })
      .from(s.aiRuns)
      .where(and(eq(s.aiRuns.userId, userId), inArray(s.aiRuns.status, ["pending", "running"])));
    assert(
      active.length < config.maxConcurrentRuns,
      "Изчакай текущите AI задачи да приключат.",
      "busy",
      409,
    );
    assert(
      !input.projectId || !active.some((r) => r.projectId === input.projectId),
      "Този проект вече изпълнява задача.",
      "busy",
      409,
    );
    if (input.feature === "images") {
      const [images] = await tx
        .select({ total: count() })
        .from(s.aiRuns)
        .where(
          and(
            eq(s.aiRuns.userId, userId),
            eq(s.aiRuns.periodId, period.id),
            eq(s.aiRuns.feature, "images"),
            inArray(s.aiRuns.status, ["running", "completed"]),
          ),
        );
      assert(
        images.total < config.maxImagesPerPeriod,
        "Достигнахте месечния лимит за изображения.",
        "image_limit",
        429,
      );
    }
    const prepared = await prepare(tx, config);
    const cost = prepared.cost ?? config.features[input.feature].cost;
    assert(Number.isInteger(cost) && cost > 0 && cost <= 100, "Невалидна Energy настройка.");
    assert(
      (await balanceForPeriod(tx, period.id)) >= cost,
      "Energy за този месец е изчерпана. Академията остава безплатна.",
      "energy_exhausted",
      402,
    );
    const schoolRemaining = await schoolBudgetRemaining(tx, period);
    assert(
      schoolRemaining === null || schoolRemaining >= cost,
      "Общият училищен Energy бюджет за месеца е изчерпан. Обърни се към училищния отговорник.",
      "school_energy_exhausted",
      402,
    );
    const [run] = await tx
      .insert(s.aiRuns)
      .values({
        userId,
        childId: input.childId,
        projectId: input.projectId,
        feature: input.feature,
        requestKey: input.requestId,
        requestHash: hash,
        periodId: period.id,
        energyReserved: cost,
        provider,
        model: config.features[input.feature].model,
        inputMetadata: prepared.metadata,
        expiresAt: new Date(Date.now() + (config.timeoutSeconds + 30) * 1000),
      })
      .returning();
    await tx.insert(s.aiEnergyEvents).values({
      userId,
      childId: input.childId,
      periodId: period.id,
      eventType: "usage_reservation",
      feature: input.feature,
      referenceId: run.id,
      amount: -cost,
      idempotencyKey: `reserve:${run.id}`,
    });
    await tx.insert(s.analytics).values({
      userId,
      childId: input.childId,
      event: "ai_run_started",
      properties: { feature: input.feature },
    });
    if (input.feature === "prompt-battles")
      await tx.insert(s.analytics).values({
        userId,
        childId: input.childId,
        event: "prompt_battle_started",
        properties: { challengeId: input.challengeId ?? "", reference_id: run.id },
      });
    return { run, config, duplicate: false, context: prepared.context };
  });
}
export async function failRun(
  database: Database,
  userId: string,
  runId: string,
  error: unknown,
  providerUsage: Record<string, unknown> = {},
) {
  return database.transaction(async (tx) => {
    await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    const [run] = await tx
      .select()
      .from(s.aiRuns)
      .where(and(eq(s.aiRuns.id, runId), eq(s.aiRuns.userId, userId)));
    if (!run || !["pending", "running"].includes(run.status)) return;
    const code = error instanceof DomainError ? error.code : "provider_failure";
    await refund(tx, run, code === "moderated" ? "moderated" : "failed", code, providerUsage);
  });
}
export async function energySummary(database: Database, userId: string, childId?: string) {
  return database.transaction(async (tx) => {
    await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    await recoverExpiredRuns(tx, userId);
    const { config } = await aiConfiguration(tx);
    const access = childId ? await resolveLabAccess(tx, userId, childId) : null;
    const premium = childId ? !!access?.source : !!(await getPremiumEntitlement(tx, userId));
    let period = premium ? await ensureEnergyPeriod(tx, userId, config, new Date(), childId) : null;
    if (!period)
      [period] = await tx
        .select()
        .from(s.aiEnergyPeriods)
        .where(
          and(
            eq(s.aiEnergyPeriods.userId, userId),
            sql`${s.aiEnergyPeriods.schoolContractId} is null`,
          ),
        )
        .orderBy(desc(s.aiEnergyPeriods.startsAt))
        .limit(1);
    const perChild = period
      ? await tx
          .select({ childId: s.aiEnergyEvents.childId, amount: sum(s.aiEnergyEvents.amount) })
          .from(s.aiEnergyEvents)
          .where(
            and(
              eq(s.aiEnergyEvents.periodId, period.id),
              inArray(s.aiEnergyEvents.eventType, ["usage_reservation", "refund"]),
            ),
          )
          .groupBy(s.aiEnergyEvents.childId)
      : [];
    const individualBalance = period ? await balanceForPeriod(tx, period.id) : 0;
    const schoolRemaining = period ? await schoolBudgetRemaining(tx, period) : null;
    return {
      premium,
      balance: Math.min(individualBalance, schoolRemaining ?? Infinity),
      individualBalance,
      schoolRemaining,
      source: access?.source ?? ("family" as "family" | "school"),
      schoolName: access?.source === "school" ? access.school!.school.name : null,
      familyAvailable: childId ? !!access?.family : premium,
      schoolAvailable: !!access?.school,
      monthly:
        access?.source === "school"
          ? (period?.allowance ?? access.school!.contract.monthlyEnergy)
          : config.monthlyEnergy,
      endsAt: period?.endsAt.toISOString() ?? null,
      rollover: access?.source === "school" ? false : config.rollover,
      perChild: perChild.map((r) => ({ childId: r.childId, spent: -Number(r.amount || 0) })),
    };
  });
}
export async function grantEnergy(
  database: Database,
  adminId: string,
  userId: string,
  amount: number,
  requestId: string,
) {
  assert(
    Number.isInteger(amount) && amount > 0 && amount <= 10000,
    "Grant трябва да е между 1 и 10000.",
  );
  return database.transaction(async (tx) => {
    const [admin] = await tx.select().from(s.users).where(eq(s.users.id, adminId));
    assert(admin?.role === "admin", "Нямаш достъп.", "forbidden", 403);
    await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    const { config } = await aiConfiguration(tx);
    const period = await ensureEnergyPeriod(tx, userId, config);
    await tx
      .insert(s.aiEnergyEvents)
      .values({
        userId,
        periodId: period.id,
        eventType: "admin_grant",
        feature: "account",
        amount,
        idempotencyKey: `admin:${userId}:${requestId}`,
      })
      .onConflictDoNothing();
    return { balance: await balanceForPeriod(tx, period.id) };
  });
}
// Caller holds the parent row lock; deletion and new reservations cannot cross.
export async function cancelChildRuns(tx: QueryDb, userId: string, childId: string) {
  const runs = await tx
    .select()
    .from(s.aiRuns)
    .where(
      and(
        eq(s.aiRuns.userId, userId),
        eq(s.aiRuns.childId, childId),
        inArray(s.aiRuns.status, ["pending", "running"]),
      ),
    );
  for (const run of runs) await refund(tx, run, "canceled", "child_deleted");
}
