import { and, eq, gt, lte } from "drizzle-orm";
import type { QueryDb } from "@/db";
import * as s from "@/db/schema";
import { assert } from "@/lib/errors";
export async function schoolActor(tx: QueryDb, userId: string, schoolId: string, manager = false) {
  const [user] = await tx.select().from(s.users).where(eq(s.users.id, userId));
  assert(user && !user.deletingAt, "Влез в акаунта си.", "unauthorized", 401);
  if (user.role === "admin") return { role: "manager" as const, id: null, platformAdmin: true };
  const [member] = await tx
    .select()
    .from(s.schoolMemberships)
    .where(
      and(
        eq(s.schoolMemberships.schoolId, schoolId),
        eq(s.schoolMemberships.email, user.email.toLowerCase()),
        eq(s.schoolMemberships.active, 1),
      ),
    );
  assert(
    member && (!manager || member.role === "manager"),
    "Нямаш достъп до това училище.",
    "forbidden",
    403,
  );
  return { role: member.role, id: member.id, platformAdmin: false };
}
export async function schoolClass(tx: QueryDb, userId: string, schoolId: string, classId: string) {
  const actor = await schoolActor(tx, userId, schoolId);
  const [row] = await tx
    .select()
    .from(s.schoolClasses)
    .where(and(eq(s.schoolClasses.schoolId, schoolId), eq(s.schoolClasses.id, classId)));
  assert(
    row && (actor.role === "manager" || row.teacherId === actor.id),
    "Нямаш достъп до този клас.",
    "forbidden",
    403,
  );
  return row;
}
export async function currentSchoolContract(tx: QueryDb, schoolId: string, now = new Date()) {
  const [school] = await tx.select().from(s.schools).where(eq(s.schools.id, schoolId));
  if (school?.status !== "active") return null;
  const [contract] = await tx
    .select()
    .from(s.schoolContracts)
    .where(
      and(
        eq(s.schoolContracts.schoolId, schoolId),
        eq(s.schoolContracts.status, "active"),
        lte(s.schoolContracts.startsAt, now),
        gt(s.schoolContracts.endsAt, now),
      ),
    );
  return contract ? { school, contract } : null;
}
// Lock order for funding: parent → child → school → contract → enrollment → account.
// School revocation waits for reservations; the contract lock serializes its spending ceiling.
export async function schoolAccess(
  tx: QueryDb,
  childId: string,
  lock = false,
  now = new Date(),
  reserve = false,
) {
  let [enrollment] = await tx
    .select()
    .from(s.schoolEnrollments)
    .where(and(eq(s.schoolEnrollments.childId, childId), eq(s.schoolEnrollments.status, "active")));
  if (!enrollment) return null;
  if (lock)
    await tx
      .select({ id: s.schools.id })
      .from(s.schools)
      .where(eq(s.schools.id, enrollment.schoolId))
      .for("share");
  const access = await currentSchoolContract(tx, enrollment.schoolId, now);
  if (!access) return null;
  if (lock) {
    await tx
      .select({ id: s.schoolContracts.id })
      .from(s.schoolContracts)
      .where(eq(s.schoolContracts.id, access.contract.id))
      .for(reserve ? "update" : "share");
    [enrollment] = await tx
      .select()
      .from(s.schoolEnrollments)
      .where(
        and(eq(s.schoolEnrollments.id, enrollment.id), eq(s.schoolEnrollments.status, "active")),
      )
      .for("share");
    if (!enrollment) return null;
    // Re-read status after waiting on the contract lock.
    if (!(await currentSchoolContract(tx, enrollment.schoolId, now))) return null;
  }
  return { ...access, enrollment };
}
