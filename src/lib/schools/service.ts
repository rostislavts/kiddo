import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, lt, ne, count, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { Database, QueryDb } from "@/db";
import * as s from "@/db/schema";
import { assert } from "@/lib/errors";
import { ownedChild } from "@/lib/learning/service";
import { schoolActor, schoolClass, currentSchoolContract } from "./access";
const title = z.string().trim().min(2).max(120),
  email = z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase());
export const schoolInput = z
  .object({
    id: z.uuid().optional(),
    name: title,
    contactName: title,
    contactEmail: email,
    status: z.enum(["active", "suspended"]).default("active"),
  })
  .strict();
export const contractInput = z
  .object({
    schoolId: z.uuid(),
    reference: title,
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    seats: z.number().int().min(1).max(10000),
    monthlyEnergy: z.number().int().min(1).max(10000),
  })
  .strict()
  .refine((v) => v.endsAt > v.startsAt, "Краят трябва да е след началото.");
const tokenHash = (value: string) =>
  createHash("sha256").update(value.trim().toUpperCase().replaceAll("-", "")).digest("hex");
async function platformAdmin(tx: QueryDb, userId: string) {
  const [u] = await tx.select().from(s.users).where(eq(s.users.id, userId));
  assert(u?.role === "admin" && !u.deletingAt, "Нямаш достъп.", "forbidden", 403);
}
async function lockSchool(tx: QueryDb, schoolId: string) {
  const [school] = await tx
    .select()
    .from(s.schools)
    .where(eq(s.schools.id, schoolId))
    .for("update");
  assert(school, "Училището не е намерено.", "not_found", 404);
  return school;
}
async function audit(
  tx: QueryDb,
  actorId: string,
  schoolId: string,
  action: string,
  referenceId?: string,
  details: Record<string, string | number> = {},
) {
  await tx.insert(s.schoolAudit).values({ actorId, schoolId, action, referenceId, details });
}
export async function seatUsage(tx: QueryDb, schoolId: string, now = new Date()) {
  const [enrolled] = await tx
    .select({ n: count() })
    .from(s.schoolEnrollments)
    .where(
      and(
        eq(s.schoolEnrollments.schoolId, schoolId),
        eq(s.schoolEnrollments.status, "active"),
        isNotNull(s.schoolEnrollments.childId),
      ),
    );
  const [reserved] = await tx
    .select({ n: count() })
    .from(s.schoolInvites)
    .where(
      and(
        eq(s.schoolInvites.schoolId, schoolId),
        eq(s.schoolInvites.status, "pending"),
        gt(s.schoolInvites.expiresAt, now),
      ),
    );
  return { enrolled: enrolled.n, reserved: reserved.n };
}
// Enrollments persist through renewals. Reserve against an already activated
// smaller future contract too, so the renewal cannot start above its seat cap.
export async function licensedSeatLimit(tx: QueryDb, schoolId: string, now = new Date()) {
  const contracts = await tx
    .select({ seats: s.schoolContracts.seats })
    .from(s.schoolContracts)
    .where(
      and(
        eq(s.schoolContracts.schoolId, schoolId),
        eq(s.schoolContracts.status, "active"),
        gt(s.schoolContracts.endsAt, now),
      ),
    );
  return contracts.length ? Math.min(...contracts.map((c) => c.seats)) : 0;
}
export async function saveSchool(db: Database, userId: string, raw: unknown) {
  const input = schoolInput.parse(raw);
  return db.transaction(async (tx) => {
    await platformAdmin(tx, userId);
    if (input.id) await lockSchool(tx, input.id);
    const [row] = input.id
      ? await tx.update(s.schools).set(input).where(eq(s.schools.id, input.id)).returning()
      : await tx.insert(s.schools).values(input).returning();
    await audit(tx, userId, row.id, "school_saved", row.id);
    return row;
  });
}
export async function createContract(db: Database, userId: string, raw: unknown) {
  const input = contractInput.parse(raw);
  return db.transaction(async (tx) => {
    await platformAdmin(tx, userId);
    await lockSchool(tx, input.schoolId);
    const [row] = await tx.insert(s.schoolContracts).values(input).returning();
    await audit(tx, userId, input.schoolId, "contract_created", row.id);
    return row;
  });
}
export async function setContractStatus(
  db: Database,
  userId: string,
  schoolId: string,
  id: string,
  status: "active" | "suspended",
) {
  return db.transaction(async (tx) => {
    await platformAdmin(tx, userId);
    await lockSchool(tx, schoolId);
    const [row] = await tx
      .select()
      .from(s.schoolContracts)
      .where(and(eq(s.schoolContracts.id, id), eq(s.schoolContracts.schoolId, schoolId)))
      .for("update");
    assert(row, "Договорът не е намерен.", "not_found", 404);
    if (status === "active") {
      assert(row.endsAt > new Date(), "Договорът вече е изтекъл.");
      const [overlap] = await tx
        .select({ id: s.schoolContracts.id })
        .from(s.schoolContracts)
        .where(
          and(
            eq(s.schoolContracts.schoolId, schoolId),
            ne(s.schoolContracts.id, id),
            eq(s.schoolContracts.status, "active"),
            lt(s.schoolContracts.startsAt, row.endsAt),
            gt(s.schoolContracts.endsAt, row.startsAt),
          ),
        );
      assert(!overlap, "Има активен договор за този период.", "contract_overlap", 409);
      const seats = await seatUsage(tx, schoolId);
      assert(
        seats.enrolled + seats.reserved <= row.seats,
        "Местата са по-малко от записаните ученици и валидните покани.",
        "seat_limit",
        409,
      );
    }
    await tx.update(s.schoolContracts).set({ status }).where(eq(s.schoolContracts.id, id));
    await audit(tx, userId, schoolId, `contract_${status}`, id);
    return { ok: true };
  });
}
export async function saveStaff(db: Database, userId: string, raw: unknown) {
  const input = z
    .object({
      schoolId: z.uuid(),
      email,
      role: z.enum(["manager", "teacher"]),
      active: z.number().int().min(0).max(1).default(1),
    })
    .strict()
    .parse(raw);
  return db.transaction(async (tx) => {
    await lockSchool(tx, input.schoolId);
    const actor = await schoolActor(tx, userId, input.schoolId, true);
    const [old] = await tx
      .select()
      .from(s.schoolMemberships)
      .where(
        and(
          eq(s.schoolMemberships.schoolId, input.schoolId),
          eq(s.schoolMemberships.email, input.email),
        ),
      );
    assert(
      actor.platformAdmin || (input.role === "teacher" && old?.role !== "manager"),
      "Отговорниците се управляват от администрацията.",
      "forbidden",
      403,
    );
    const [row] = await tx
      .insert(s.schoolMemberships)
      .values(input)
      .onConflictDoUpdate({
        target: [s.schoolMemberships.schoolId, s.schoolMemberships.email],
        set: { role: input.role, active: input.active },
      })
      .returning();
    await audit(tx, userId, input.schoolId, "staff_saved", row.id, {
      role: input.role,
      active: input.active,
    });
    return row;
  });
}
export async function saveClass(db: Database, userId: string, raw: unknown) {
  const input = z
    .object({
      id: z.uuid().optional(),
      schoolId: z.uuid(),
      name: title,
      teacherId: z.uuid().nullable().default(null),
    })
    .strict()
    .parse(raw);
  return db.transaction(async (tx) => {
    await lockSchool(tx, input.schoolId);
    await schoolActor(tx, userId, input.schoolId, true);
    if (input.teacherId) {
      const [t] = await tx
        .select()
        .from(s.schoolMemberships)
        .where(
          and(
            eq(s.schoolMemberships.id, input.teacherId),
            eq(s.schoolMemberships.schoolId, input.schoolId),
            eq(s.schoolMemberships.active, 1),
          ),
        );
      assert(t, "Избери активен преподавател от училището.");
    }
    if (input.id) await schoolClass(tx, userId, input.schoolId, input.id);
    const [duplicate] = await tx
      .select()
      .from(s.schoolClasses)
      .where(
        and(
          eq(s.schoolClasses.schoolId, input.schoolId),
          eq(s.schoolClasses.name, input.name),
          input.id ? ne(s.schoolClasses.id, input.id) : undefined,
        ),
      );
    assert(!duplicate, "Вече има клас с това име.", "duplicate", 409);
    const [row] = input.id
      ? await tx
          .update(s.schoolClasses)
          .set(input)
          .where(eq(s.schoolClasses.id, input.id))
          .returning()
      : await tx.insert(s.schoolClasses).values(input).returning();
    await audit(tx, userId, input.schoolId, "class_saved", row.id);
    return row;
  });
}
export async function createInvites(db: Database, userId: string, raw: unknown) {
  const input = z
    .object({
      schoolId: z.uuid(),
      classId: z.uuid(),
      count: z.number().int().min(1).max(100),
      days: z.number().int().min(1).max(14).default(7),
      batchId: z.uuid(),
    })
    .strict()
    .parse(raw);
  return db.transaction(async (tx) => {
    await lockSchool(tx, input.schoolId);
    await schoolClass(tx, userId, input.schoolId, input.classId);
    const now = new Date(),
      access = await currentSchoolContract(tx, input.schoolId, now);
    assert(access, "Нужен е активен училищен договор.", "school_inactive", 403);
    const [batch] = await tx
      .select({ id: s.schoolInvites.id })
      .from(s.schoolInvites)
      .where(eq(s.schoolInvites.batchId, input.batchId));
    assert(
      !batch,
      "Тази група покани вече е създадена. Ако не запази кодовете, отмени поканите и създай нови.",
      "duplicate_batch",
      409,
    );
    const usage = await seatUsage(tx, input.schoolId, now);
    assert(
      usage.enrolled + usage.reserved + input.count <=
        (await licensedSeatLimit(tx, input.schoolId, now)),
      "Няма достатъчно свободни места според активните и предстоящите договори. Отмени неизползвани покани или увеличи лиценза чрез администрацията.",
      "seat_limit",
      409,
    );
    const expiresAt = new Date(
      Math.min(now.getTime() + input.days * 86400000, access.contract.endsAt.getTime()),
    );
    const records = Array.from({ length: input.count }, () => {
      const code = randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g)!.join("-");
      return { id: randomUUID(), code };
    });
    await tx.insert(s.schoolInvites).values(
      records.map((r) => ({
        id: r.id,
        tokenHash: tokenHash(r.code),
        schoolId: input.schoolId,
        classId: input.classId,
        batchId: input.batchId,
        expiresAt,
      })),
    );
    await audit(tx, userId, input.schoolId, "invites_created", input.batchId, {
      count: input.count,
    });
    return { expiresAt: expiresAt.toISOString(), invites: records };
  });
}
export async function revokeInvite(db: Database, userId: string, schoolId: string, id: string) {
  return db.transaction(async (tx) => {
    await lockSchool(tx, schoolId);
    const [row] = await tx
      .select()
      .from(s.schoolInvites)
      .where(and(eq(s.schoolInvites.id, id), eq(s.schoolInvites.schoolId, schoolId)));
    assert(row, "Поканата не е намерена.", "not_found", 404);
    await schoolClass(tx, userId, schoolId, row.classId);
    assert(
      row.status !== "redeemed",
      "Поканата вече е използвана. Управлявай ученическото място.",
      "conflict",
      409,
    );
    await tx.update(s.schoolInvites).set({ status: "revoked" }).where(eq(s.schoolInvites.id, id));
    await audit(tx, userId, schoolId, "invite_revoked", id);
    return { ok: true };
  });
}
export async function revokeInviteBatch(
  db: Database,
  userId: string,
  schoolId: string,
  batchId: string,
) {
  return db.transaction(async (tx) => {
    await lockSchool(tx, schoolId);
    const rows = await tx
      .select()
      .from(s.schoolInvites)
      .where(and(eq(s.schoolInvites.schoolId, schoolId), eq(s.schoolInvites.batchId, batchId)));
    assert(rows.length, "Групата покани не е намерена.", "not_found", 404);
    for (const classId of new Set(rows.map((row) => row.classId))) {
      await schoolClass(tx, userId, schoolId, classId);
    }
    const revoked = await tx
      .update(s.schoolInvites)
      .set({ status: "revoked" })
      .where(
        and(
          eq(s.schoolInvites.schoolId, schoolId),
          eq(s.schoolInvites.batchId, batchId),
          eq(s.schoolInvites.status, "pending"),
        ),
      )
      .returning({ id: s.schoolInvites.id });
    await audit(tx, userId, schoolId, "invite_batch_revoked", batchId, { count: revoked.length });
    return { ok: true, count: revoked.length };
  });
}
export async function redeemInvite(db: Database, userId: string, childId: string, code: string) {
  z.string()
    .regex(/^[A-Fa-f0-9-]{32,48}$/)
    .parse(code);
  return db.transaction(async (tx) => {
    await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    await ownedChild(tx, userId, childId, true);
    const [hint] = await tx
      .select()
      .from(s.schoolInvites)
      .where(eq(s.schoolInvites.tokenHash, tokenHash(code)));
    assert(hint, "Поканата е невалидна или изтекла.", "invite_invalid", 400);
    await lockSchool(tx, hint.schoolId);
    const [invite] = await tx
      .select()
      .from(s.schoolInvites)
      .where(eq(s.schoolInvites.id, hint.id))
      .for("update");
    if (invite.status === "redeemed" && invite.enrollmentId) {
      const [old] = await tx
        .select()
        .from(s.schoolEnrollments)
        .where(eq(s.schoolEnrollments.id, invite.enrollmentId));
      assert(
        old?.childId === childId && old.status === "active",
        "Поканата вече е използвана.",
        "invite_invalid",
        409,
      );
      return old;
    }
    const now = new Date(),
      access = await currentSchoolContract(tx, invite.schoolId, now);
    assert(
      invite.status === "pending" && invite.expiresAt > now && access,
      "Поканата е невалидна или изтекла.",
      "invite_invalid",
      400,
    );
    const [existing] = await tx
      .select()
      .from(s.schoolEnrollments)
      .where(
        and(eq(s.schoolEnrollments.childId, childId), eq(s.schoolEnrollments.status, "active")),
      );
    assert(
      !existing,
      "Детето вече има активна училищна регистрация. Първо прекрати старата връзка.",
      "already_enrolled",
      409,
    );
    const usage = await seatUsage(tx, invite.schoolId, now);
    assert(
      usage.enrolled + usage.reserved <= access.contract.seats,
      "Лицензът няма свободно място.",
      "seat_limit",
      409,
    );
    const [row] = await tx
      .insert(s.schoolEnrollments)
      .values({ schoolId: invite.schoolId, classId: invite.classId, childId })
      .onConflictDoUpdate({
        target: [s.schoolEnrollments.schoolId, s.schoolEnrollments.childId],
        set: { classId: invite.classId, status: "active", joinedAt: now, leftAt: null },
      })
      .returning();
    await tx
      .update(s.schoolInvites)
      .set({ status: "redeemed", enrollmentId: row.id, redeemedAt: now })
      .where(eq(s.schoolInvites.id, invite.id));
    await audit(tx, userId, invite.schoolId, "enrollment_activated", row.id);
    return row;
  });
}
export async function updateEnrollment(
  db: Database,
  userId: string,
  schoolId: string,
  id: string,
  classId?: string,
) {
  return db.transaction(async (tx) => {
    await lockSchool(tx, schoolId);
    const [row] = await tx
      .select()
      .from(s.schoolEnrollments)
      .where(and(eq(s.schoolEnrollments.id, id), eq(s.schoolEnrollments.schoolId, schoolId)))
      .for("update");
    assert(row, "Ученикът не е намерен.", "not_found", 404);
    await schoolClass(tx, userId, schoolId, row.classId);
    if (classId) {
      await schoolActor(tx, userId, schoolId, true);
      await schoolClass(tx, userId, schoolId, classId);
    }
    await tx
      .update(s.schoolEnrollments)
      .set(classId ? { classId } : { status: "left", leftAt: new Date() })
      .where(eq(s.schoolEnrollments.id, id));
    await audit(tx, userId, schoolId, classId ? "enrollment_moved" : "enrollment_left", id);
    return { ok: true };
  });
}
export async function leaveSchool(db: Database, userId: string, childId: string) {
  return db.transaction(async (tx) => {
    await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    await ownedChild(tx, userId, childId, true);
    const [row] = await tx
      .select()
      .from(s.schoolEnrollments)
      .where(
        and(eq(s.schoolEnrollments.childId, childId), eq(s.schoolEnrollments.status, "active")),
      );
    if (!row) return { ok: true };
    await lockSchool(tx, row.schoolId);
    await tx
      .update(s.schoolEnrollments)
      .set({ status: "left", leftAt: new Date() })
      .where(eq(s.schoolEnrollments.id, row.id));
    await audit(tx, userId, row.schoolId, "parent_left_school", row.id);
    return { ok: true };
  });
}
