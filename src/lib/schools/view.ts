import { and, eq, inArray, desc, count, sum, sql, isNotNull, gte } from "drizzle-orm";
import type { Database } from "@/db";
import * as s from "@/db/schema";
import { assert } from "@/lib/errors";
import { schoolActor, currentSchoolContract } from "./access";
import { seatUsage, licensedSeatLimit } from "./service";
import { energySummary, schoolBudgetRemaining } from "@/lib/ai/energy";
export async function schoolList(db: Database, userId: string) {
  const [user] = await db.select().from(s.users).where(eq(s.users.id, userId));
  assert(user, "Влез в акаунта си.", "unauthorized", 401);
  if (user.role === "admin") return db.select().from(s.schools).orderBy(s.schools.name);
  return db
    .select({
      id: s.schools.id,
      name: s.schools.name,
      status: s.schools.status,
      contactName: s.schools.contactName,
      contactEmail: s.schools.contactEmail,
      createdAt: s.schools.createdAt,
    })
    .from(s.schools)
    .innerJoin(s.schoolMemberships, eq(s.schoolMemberships.schoolId, s.schools.id))
    .where(
      and(
        eq(s.schoolMemberships.email, user.email.toLowerCase()),
        eq(s.schoolMemberships.active, 1),
      ),
    )
    .orderBy(s.schools.name);
}
export async function schoolView(
  db: Database,
  userId: string,
  schoolId: string,
  classId?: string,
  page = 1,
  invitePage = 1,
) {
  const actor = await schoolActor(db, userId, schoolId);
  const [school] = await db.select().from(s.schools).where(eq(s.schools.id, schoolId));
  assert(school, "Училището не е намерено.", "not_found", 404);
  const classes = await db
    .select()
    .from(s.schoolClasses)
    .where(
      and(
        eq(s.schoolClasses.schoolId, schoolId),
        actor.role === "teacher" ? eq(s.schoolClasses.teacherId, actor.id!) : undefined,
      ),
    )
    .orderBy(s.schoolClasses.name);
  if (classId)
    assert(
      classes.some((c) => c.id === classId),
      "Нямаш достъп до класа.",
      "forbidden",
      403,
    );
  const classIds = classId ? [classId] : classes.map((c) => c.id);
  const visible = and(
    eq(s.schoolEnrollments.schoolId, schoolId),
    inArray(s.schoolEnrollments.classId, classIds),
    eq(s.schoolEnrollments.status, "active"),
    isNotNull(s.schoolEnrollments.childId),
  );
  const [total] = await db.select({ n: count() }).from(s.schoolEnrollments).where(visible);
  const enrollments = await db
    .select({
      id: s.schoolEnrollments.id,
      childId: s.schoolEnrollments.childId,
      classId: s.schoolEnrollments.classId,
      joinedAt: s.schoolEnrollments.joinedAt,
      nickname: s.children.nickname,
    })
    .from(s.schoolEnrollments)
    .innerJoin(s.children, eq(s.children.id, s.schoolEnrollments.childId))
    .where(visible)
    .orderBy(s.schoolEnrollments.joinedAt, s.schoolEnrollments.id)
    .limit(50)
    .offset((page - 1) * 50);
  const ids = enrollments.map((e) => e.childId!);
  const lessons = ids.length
    ? await db
        .select({ childId: s.progress.childId, total: count() })
        .from(s.progress)
        .where(and(inArray(s.progress.childId, ids), eq(s.progress.status, "completed")))
        .groupBy(s.progress.childId)
    : [];
  const xp = ids.length
    ? await db
        .select({ childId: s.xpEvents.childId, total: sum(s.xpEvents.xp) })
        .from(s.xpEvents)
        .where(inArray(s.xpEvents.childId, ids))
        .groupBy(s.xpEvents.childId)
    : [];
  const missions = ids.length
    ? await db
        .select({ childId: s.missionCompletions.childId, title: s.featuredMissions.title })
        .from(s.missionCompletions)
        .innerJoin(s.featuredMissions, eq(s.featuredMissions.id, s.missionCompletions.missionId))
        .where(inArray(s.missionCompletions.childId, ids))
    : [];
  const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const spending = ids.length
    ? await db
        .select({
          childId: s.energyAccounts.childId,
          spent: sql<number>`coalesce(-sum(${s.aiEnergyEvents.amount}),0)::integer`,
        })
        .from(s.aiEnergyEvents)
        .innerJoin(s.aiEnergyPeriods, eq(s.aiEnergyPeriods.id, s.aiEnergyEvents.periodId))
        .innerJoin(s.energyAccounts, eq(s.energyAccounts.id, s.aiEnergyPeriods.accountId))
        .where(
          and(
            eq(s.energyAccounts.schoolId, schoolId),
            inArray(s.energyAccounts.childId, ids),
            inArray(s.aiEnergyEvents.eventType, ["usage_reservation", "refund"]),
            gte(s.aiEnergyEvents.createdAt, month),
          ),
        )
        .groupBy(s.energyAccounts.childId)
    : [];
  const pupils = enrollments.map((e) => ({
    id: e.id,
    classId: e.classId,
    nickname: e.nickname,
    joinedAt: e.joinedAt,
    lessons: lessons.find((x) => x.childId === e.childId)?.total ?? 0,
    xp: Number(xp.find((x) => x.childId === e.childId)?.total ?? 0),
    missions: missions.filter((x) => x.childId === e.childId).map((x) => x.title),
    energy: spending.find((x) => x.childId === e.childId)?.spent ?? 0,
  }));
  const visibleInvites = and(
    eq(s.schoolInvites.schoolId, schoolId),
    inArray(s.schoolInvites.classId, classIds),
    eq(s.schoolInvites.status, "pending"),
  );
  const [inviteTotal] = await db.select({ n: count() }).from(s.schoolInvites).where(visibleInvites);
  const invites = await db
    .select({
      id: s.schoolInvites.id,
      classId: s.schoolInvites.classId,
      batchId: s.schoolInvites.batchId,
      status: s.schoolInvites.status,
      expiresAt: s.schoolInvites.expiresAt,
    })
    .from(s.schoolInvites)
    .where(visibleInvites)
    .orderBy(desc(s.schoolInvites.createdAt), s.schoolInvites.id)
    .limit(50)
    .offset((invitePage - 1) * 50);
  const contracts =
    actor.role === "manager"
      ? await db
          .select()
          .from(s.schoolContracts)
          .where(eq(s.schoolContracts.schoolId, schoolId))
          .orderBy(desc(s.schoolContracts.startsAt))
      : [];
  const staff =
    actor.role === "manager"
      ? await db
          .select()
          .from(s.schoolMemberships)
          .where(eq(s.schoolMemberships.schoolId, schoolId))
          .orderBy(s.schoolMemberships.email)
      : [];
  const audit =
    actor.role === "manager"
      ? await db
          .select({
            action: s.schoolAudit.action,
            createdAt: s.schoolAudit.createdAt,
            details: s.schoolAudit.details,
          })
          .from(s.schoolAudit)
          .where(eq(s.schoolAudit.schoolId, schoolId))
          .orderBy(desc(s.schoolAudit.createdAt))
          .limit(30)
      : [];
  const [cost] = actor.platformAdmin
    ? await db
        .select({
          estimated: sql<string>`coalesce(sum((${s.aiEnergyEvents.providerUsage}->>'estimatedCostUsd')::numeric),0)::text`,
          unknown: sql<number>`count(*) filter (where ${s.aiEnergyEvents.providerUsage}->>'estimatedCostUsd' is null)::integer`,
        })
        .from(s.aiEnergyEvents)
        .innerJoin(s.aiEnergyPeriods, eq(s.aiEnergyPeriods.id, s.aiEnergyEvents.periodId))
        .innerJoin(s.energyAccounts, eq(s.energyAccounts.id, s.aiEnergyPeriods.accountId))
        .where(
          and(
            eq(s.energyAccounts.schoolId, schoolId),
            inArray(s.aiEnergyEvents.eventType, ["usage_finalized", "refund"]),
            gte(s.aiEnergyEvents.createdAt, month),
          ),
        )
    : [];
  const access = await currentSchoolContract(db, schoolId);
  return {
    school,
    actor,
    classes,
    pupils,
    total: total.n,
    page,
    classId: classId ?? null,
    invites,
    inviteTotal: inviteTotal.n,
    invitePage,
    contracts,
    staff,
    audit,
    cost: cost ?? null,
    usage: actor.role === "manager" ? await seatUsage(db, schoolId) : null,
    energyBudget:
      actor.role === "manager" && access
        ? {
            total: access.contract.seats * access.contract.monthlyEnergy,
            remaining: await schoolBudgetRemaining(db, {
              schoolContractId: access.contract.id,
              startsAt: new Date(Math.max(month.getTime(), access.contract.startsAt.getTime())),
            }),
          }
        : null,
    license: access
      ? {
          endsAt: access.contract.endsAt,
          monthlyEnergy: access.contract.monthlyEnergy,
          seats: access.contract.seats,
          seatLimit: await licensedSeatLimit(db, schoolId),
        }
      : null,
  };
}
export type SchoolView = Awaited<ReturnType<typeof schoolView>>;
export async function parentSchoolView(db: Database, userId: string) {
  const children = await db.select().from(s.children).where(eq(s.children.parentId, userId));
  return Promise.all(
    children.map(async (child) => {
      const [school] = await db
        .select({
          name: s.schools.name,
          className: s.schoolClasses.name,
          joinedAt: s.schoolEnrollments.joinedAt,
        })
        .from(s.schoolEnrollments)
        .innerJoin(s.schools, eq(s.schools.id, s.schoolEnrollments.schoolId))
        .innerJoin(s.schoolClasses, eq(s.schoolClasses.id, s.schoolEnrollments.classId))
        .where(
          and(eq(s.schoolEnrollments.childId, child.id), eq(s.schoolEnrollments.status, "active")),
        );
      return {
        id: child.id,
        nickname: child.nickname,
        preference: child.energyPreference,
        school: school ?? null,
        energy: await energySummary(db, userId, child.id),
      };
    }),
  );
}
