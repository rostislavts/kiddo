import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { testDatabase } from "../helpers/database";
import { TestAI } from "../helpers/ai";
import * as s from "@/db/schema";
import { seedDatabase } from "@/db/seed";
import { createChild } from "@/lib/children/service";
import * as school from "@/lib/schools/service";
import { schoolView, schoolList, parentSchoolView } from "@/lib/schools/view";
import { resolveLabAccess } from "@/lib/ai/entitlement";
import { energySummary, ensureEnergyPeriod, reserveEnergy, failRun } from "@/lib/ai/energy";
import { defaultAIConfig } from "@/lib/ai/models";
import { executeAIRun } from "@/lib/lab/runtime";
import { saveProject } from "@/lib/lab/projects";
import { deleteLabChild } from "@/lib/lab/maintenance";
import { defaults } from "@/components/lab/builders";
let f: Awaited<ReturnType<typeof testDatabase>>;
const admin = randomUUID(),
  manager = randomUUID(),
  teacher = randomUUID(),
  parent = randomUUID(),
  other = randomUUID(),
  child = randomUUID(),
  sibling = randomUUID(),
  otherChild = randomUUID();
const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
async function setup(seats = 10, energy = 20) {
  const org = await school.saveSchool(f.db, admin, {
    name: "Тестово училище",
    contactName: "Отговорник",
    contactEmail: "school@example.test",
  });
  const contract = await school.createContract(f.db, admin, {
    schoolId: org.id,
    reference: "Договор 2026",
    startsAt: month,
    endsAt: new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 3, 1)),
    seats,
    monthlyEnergy: energy,
  });
  await school.setContractStatus(f.db, admin, org.id, contract.id, "active");
  await school.saveStaff(f.db, admin, {
    schoolId: org.id,
    email: "manager@example.test",
    role: "manager",
  });
  const staff = await school.saveStaff(f.db, manager, {
    schoolId: org.id,
    email: "teacher@example.test",
    role: "teacher",
  });
  const room = await school.saveClass(f.db, manager, {
    schoolId: org.id,
    name: "3 А",
    teacherId: staff.id,
  });
  return { org, contract, room, staff };
}
async function invite(target: Awaited<ReturnType<typeof setup>>, count = 1) {
  return school.createInvites(f.db, manager, {
    schoolId: target.org.id,
    classId: target.room.id,
    count,
    days: 7,
    batchId: randomUUID(),
  });
}
async function enroll(target: Awaited<ReturnType<typeof setup>>, owner = parent, pupil = child) {
  const batch = await invite(target);
  return school.redeemInvite(f.db, owner, pupil, batch.invites[0].code);
}
async function family() {
  await f.db.insert(s.subscriptions).values({
    userId: parent,
    paddleSubscriptionId: "sub_school_parent",
    paddleCustomerId: "ctm_school_parent",
    paddlePriceId: "pri_school_test",
    status: "active",
    periodStart: month,
    periodEnd: new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)),
    lastEventAt: new Date(),
  });
}
async function run(
  owner = parent,
  pupil = child,
  provider = new TestAI(),
  requestId = randomUUID(),
) {
  return executeAIRun(
    f.db,
    owner,
    { childId: pupil, requestId, feature: "prompts", input: { builder: defaults.prompts } },
    provider,
  );
}
describe("School licenses, ownership and Energy funding", () => {
  beforeAll(async () => {
    vi.stubEnv("PADDLE_MONTHLY_PRICE_ID", "pri_school_test");
    f = await testDatabase();
  });
  afterAll(async () => {
    await f.client.close();
    vi.unstubAllEnvs();
  });
  beforeEach(async () => {
    await f.db.execute(
      sql`TRUNCATE users,schools,tracks,achievements,levels,ai_settings,lab_challenges CASCADE`,
    );
    await seedDatabase(f.db);
    await f.db.insert(s.users).values([
      { id: admin, email: "admin@example.test", role: "admin" },
      { id: manager, email: "manager@example.test" },
      { id: teacher, email: "teacher@example.test" },
      { id: parent, email: "parent@example.test" },
      { id: other, email: "other@example.test" },
    ]);
    for (const [owner, id, name] of [
      [parent, child, "Звезда"],
      [parent, sibling, "Луна"],
      [other, otherChild, "Марс"],
    ])
      await createChild(f.db, owner, id, { nickname: name, avatar: "robot", ageBand: "8-9" });
  });
  it("only platform admins create schools/contracts or appoint managers", async () => {
    await expect(
      school.saveSchool(f.db, parent, {
        name: "Училище",
        contactName: "Учител",
        contactEmail: "x@example.test",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const t = await setup();
    await expect(
      school.createContract(f.db, manager, {
        schoolId: t.org.id,
        reference: "Опит",
        startsAt: month,
        endsAt: new Date(Date.now() + 86400000),
        seats: 1,
        monthlyEnergy: 1,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      school.saveStaff(f.db, manager, {
        schoolId: t.org.id,
        email: "other@example.test",
        role: "manager",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      school.setContractStatus(f.db, teacher, t.org.id, t.contract.id, "suspended"),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
  it("reserves licensed seats atomically and rejects duplicate batches", async () => {
    const t = await setup(2);
    const request = {
      schoolId: t.org.id,
      classId: t.room.id,
      count: 2,
      days: 7,
      batchId: randomUUID(),
    };
    await school.createInvites(f.db, manager, request);
    await expect(school.createInvites(f.db, manager, request)).rejects.toMatchObject({
      code: "duplicate_batch",
    });
    await expect(invite(t)).rejects.toMatchObject({ code: "seat_limit" });
    expect(await school.seatUsage(f.db, t.org.id)).toEqual({ enrolled: 0, reserved: 2 });
  });
  it("redeems once for one owned child, replays safely and never grants siblings", async () => {
    const t = await setup(1),
      batch = await invite(t),
      code = batch.invites[0].code;
    await expect(school.redeemInvite(f.db, other, child, code)).rejects.toThrow();
    const enrolled = await school.redeemInvite(f.db, parent, child, code);
    expect((await school.redeemInvite(f.db, parent, child, code)).id).toBe(enrolled.id);
    await expect(school.redeemInvite(f.db, parent, sibling, code)).rejects.toMatchObject({
      code: "invite_invalid",
    });
    expect((await resolveLabAccess(f.db, parent, child)).source).toBe("school");
    expect((await resolveLabAccess(f.db, parent, sibling)).source).toBeNull();
    expect(await school.seatUsage(f.db, t.org.id)).toEqual({ enrolled: 1, reserved: 0 });
    const [stored] = await f.db.select().from(s.schoolInvites);
    expect(JSON.stringify(stored)).not.toContain(code);
  });
  it("rejects expired/revoked invitations and releases their reservations", async () => {
    const t = await setup(1),
      a = await invite(t);
    await school.revokeInvite(f.db, manager, t.org.id, a.invites[0].id);
    await expect(school.redeemInvite(f.db, parent, child, a.invites[0].code)).rejects.toMatchObject(
      { code: "invite_invalid" },
    );
    const b = await invite(t);
    await f.db
      .update(s.schoolInvites)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(s.schoolInvites.id, b.invites[0].id));
    await expect(school.redeemInvite(f.db, parent, child, b.invites[0].code)).rejects.toMatchObject(
      { code: "invite_invalid" },
    );
    expect((await school.seatUsage(f.db, t.org.id)).reserved).toBe(0);
  });
  it("keeps teacher queries/mutations inside assigned classes and current roles", async () => {
    const a = await setup(),
      b = await setup();
    await enroll(a);
    await school.saveStaff(f.db, admin, {
      schoolId: b.org.id,
      email: "teacher@example.test",
      role: "teacher",
      active: 0,
    });
    await expect(schoolView(f.db, teacher, b.org.id)).rejects.toMatchObject({ code: "forbidden" });
    const privateClass = await school.saveClass(f.db, manager, { schoolId: a.org.id, name: "3 Б" });
    await expect(
      school.createInvites(f.db, teacher, {
        schoolId: a.org.id,
        classId: privateClass.id,
        count: 1,
        batchId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const view = await schoolView(f.db, teacher, a.org.id);
    expect(view.classes.map((c) => c.id)).toEqual([a.room.id]);
    expect(view.pupils).toHaveLength(1);
    expect(view.staff).toEqual([]);
    expect(view.contracts).toEqual([]);
    expect(view.cost).toBeNull();
    await school.saveStaff(f.db, manager, {
      schoolId: a.org.id,
      email: "teacher@example.test",
      role: "teacher",
      active: 0,
    });
    await expect(schoolView(f.db, teacher, a.org.id)).rejects.toMatchObject({ code: "forbidden" });
  });
  it("rejects foreign school teacher assignments and enrollment moves", async () => {
    const a = await setup(),
      b = await setup(),
      e = await enroll(a);
    await expect(
      school.saveClass(f.db, manager, {
        schoolId: a.org.id,
        name: "Чужд учител",
        teacherId: b.staff.id,
      }),
    ).rejects.toThrow();
    await expect(
      school.updateEnrollment(f.db, manager, a.org.id, e.id, b.room.id),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(schoolView(f.db, manager, a.org.id, b.room.id)).rejects.toMatchObject({
      code: "forbidden",
    });
  });
  it("prevents overlapping active contracts and licenses smaller than reserved seats", async () => {
    const t = await setup(2);
    await invite(t, 2);
    const c = await school.createContract(f.db, admin, {
      schoolId: t.org.id,
      reference: "Втори договор",
      startsAt: month,
      endsAt: new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)),
      seats: 1,
      monthlyEnergy: 20,
    });
    await expect(
      school.setContractStatus(f.db, admin, t.org.id, c.id, "active"),
    ).rejects.toMatchObject({ code: "contract_overlap" });
    await school.setContractStatus(f.db, admin, t.org.id, t.contract.id, "suspended");
    await expect(
      school.setContractStatus(f.db, admin, t.org.id, c.id, "active"),
    ).rejects.toMatchObject({ code: "seat_limit" });
  });
  it("uses independent pupil budgets, grants once and refunds to the original source", async () => {
    const t = await setup();
    await enroll(t);
    await enroll(t, parent, sibling);
    expect((await energySummary(f.db, parent, child)).balance).toBe(20);
    expect((await energySummary(f.db, parent, child)).balance).toBe(20);
    await run();
    expect((await energySummary(f.db, parent, child)).balance).toBe(18);
    expect((await energySummary(f.db, parent, sibling)).balance).toBe(20);
    const broken = new TestAI();
    broken.failure = true;
    await expect(run(parent, child, broken)).rejects.toThrow();
    expect((await energySummary(f.db, parent, child)).balance).toBe(18);
    const grants = await f.db
      .select()
      .from(s.aiEnergyEvents)
      .where(eq(s.aiEnergyEvents.eventType, "monthly_grant"));
    expect(grants).toHaveLength(2);
  });
  it("defaults to school without draining a paid family budget; preference is explicit", async () => {
    const t = await setup(2, 2);
    await enroll(t);
    await family();
    await run();
    expect((await energySummary(f.db, parent, child)).balance).toBe(0);
    expect((await energySummary(f.db, parent)).balance).toBe(1000);
    await expect(run()).rejects.toMatchObject({ code: "energy_exhausted" });
    expect((await energySummary(f.db, parent)).balance).toBe(1000);
    await f.db
      .update(s.children)
      .set({ energyPreference: "family" })
      .where(eq(s.children.id, child));
    await run();
    expect((await energySummary(f.db, parent)).balance).toBe(998);
    expect((await energySummary(f.db, parent, child)).source).toBe("family");
  });
  it("retains saved projects after expiry and resumes through an available family license", async () => {
    const t = await setup();
    await enroll(t);
    const p = await saveProject(f.db, parent, child, {
      feature: "bots",
      title: "Моят бот",
      configuration: defaults.bots,
    });
    await school.setContractStatus(f.db, admin, t.org.id, t.contract.id, "suspended");
    await expect(run()).rejects.toMatchObject({ code: "premium" });
    expect(
      (await f.db.select().from(s.labProjects).where(eq(s.labProjects.id, p.id)))[0],
    ).toBeDefined();
    await family();
    expect((await resolveLabAccess(f.db, parent, child)).source).toBe("family");
    await run();
    expect((await energySummary(f.db, parent)).balance).toBe(998);
  });
  it("school suspension blocks invites, edits and runs", async () => {
    const t = await setup();
    await enroll(t);
    await school.saveSchool(f.db, admin, {
      id: t.org.id,
      name: t.org.name,
      contactName: t.org.contactName,
      contactEmail: t.org.contactEmail,
      status: "suspended",
    });
    await expect(invite(t)).rejects.toMatchObject({ code: "school_inactive" });
    await expect(run()).rejects.toMatchObject({ code: "premium" });
    await expect(
      saveProject(f.db, parent, child, {
        feature: "bots",
        title: "Спрян достъп",
        configuration: defaults.bots,
      }),
    ).rejects.toMatchObject({ code: "premium" });
  });
  it("monthly renewal has no rollover and pause/resume does not grant twice", async () => {
    const t = await setup();
    await enroll(t);
    await run();
    await school.setContractStatus(f.db, admin, t.org.id, t.contract.id, "suspended");
    await school.setContractStatus(f.db, admin, t.org.id, t.contract.id, "active");
    expect((await energySummary(f.db, parent, child)).balance).toBe(18);
    const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    const p = await f.db.transaction((tx) =>
      ensureEnergyPeriod(tx, parent, defaultAIConfig(), next, child),
    );
    expect(p.startsAt).toEqual(next);
    const rows = await f.db
      .select()
      .from(s.aiEnergyEvents)
      .where(eq(s.aiEnergyEvents.eventType, "monthly_grant"));
    expect(rows.map((r) => r.amount)).toEqual([20, 20]);
  });
  it("rejoining the same school cannot refresh the monthly quota", async () => {
    const t = await setup();
    await enroll(t);
    await run();
    await school.leaveSchool(f.db, parent, child);
    await enroll(t);
    expect((await energySummary(f.db, parent, child)).balance).toBe(18);
  });
  it("caps school consumption when a seat is recycled to another pupil", async () => {
    const t = await setup(1, 2);
    await enroll(t);
    await run();
    await school.leaveSchool(f.db, parent, child);
    await enroll(t, other, otherChild);
    expect((await energySummary(f.db, other, otherChild)).balance).toBe(0);
    await expect(run(other, otherChild)).rejects.toMatchObject({ code: "school_energy_exhausted" });
  });
  it("preserves anonymous school usage after child/account deletion", async () => {
    const t = await setup(1, 4);
    await enroll(t);
    await run();
    await deleteLabChild(f.db, parent, child);
    expect((await school.seatUsage(f.db, t.org.id)).enrolled).toBe(0);
    const [account] = await f.db.select().from(s.energyAccounts);
    expect(account.childId).toBeNull();
    await f.db.delete(s.users).where(eq(s.users.id, parent));
    const events = await f.db.select().from(s.aiEnergyEvents);
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.userId === null && e.childId === null)).toBe(true);
    const view = await schoolView(f.db, admin, t.org.id);
    expect(view.pupils).toEqual([]);
    expect(Number(view.cost!.estimated)).toBeGreaterThan(0);
    await enroll(t, other, otherChild);
    expect((await energySummary(f.db, other, otherChild)).balance).toBe(2);
  });
  it("returns only learning aggregates to staff, never private prompts or bot messages", async () => {
    const t = await setup();
    await enroll(t);
    const p = await saveProject(f.db, parent, child, {
      feature: "bots",
      title: "Частен проект",
      configuration: defaults.bots,
    });
    await executeAIRun(
      f.db,
      parent,
      {
        childId: child,
        requestId: randomUUID(),
        feature: "bots",
        projectId: p.id,
        input: { message: "Моята тайна измислена история" },
      },
      new TestAI(),
    );
    const view = await schoolView(f.db, manager, t.org.id);
    expect(view.pupils[0].energy).toBe(2);
    expect(JSON.stringify(view)).not.toMatch(
      /Частен проект|тайна измислена|botMessages|tokenHash|inputMetadata/,
    );
    expect((await parentSchoolView(f.db, parent))[0].school?.name).toBe(t.org.name);
    expect(await schoolList(f.db, parent)).toEqual([]);
  });
  it("prevents one child using two simultaneous school licenses", async () => {
    const a = await setup(),
      b = await setup();
    await enroll(a);
    await expect(enroll(b)).rejects.toMatchObject({ code: "already_enrolled" });
  });
  it("refunds the original school period after the parent changes funding source", async () => {
    const t = await setup();
    await enroll(t);
    await family();
    const reservation = await reserveEnergy(
      f.db,
      parent,
      {
        childId: child,
        requestId: randomUUID(),
        feature: "prompts",
        input: { builder: defaults.prompts },
      },
      "fixture",
      async () => ({ metadata: {}, context: {}, cost: 2 }),
    );
    await f.db
      .update(s.children)
      .set({ energyPreference: "family" })
      .where(eq(s.children.id, child));
    await failRun(f.db, parent, reservation.run.id, new Error("provider offline"));
    await failRun(f.db, parent, reservation.run.id, new Error("duplicate callback"));
    expect((await energySummary(f.db, parent, child)).balance).toBe(1000);
    await f.db.update(s.children).set({ energyPreference: "auto" }).where(eq(s.children.id, child));
    expect((await energySummary(f.db, parent, child)).balance).toBe(20);
    expect(
      await f.db.select().from(s.aiEnergyEvents).where(eq(s.aiEnergyEvents.eventType, "refund")),
    ).toHaveLength(1);
  });
  it("expires access at the exact contract end without losing enrollment history", async () => {
    const t = await setup();
    await enroll(t);
    expect(
      (
        await resolveLabAccess(
          f.db,
          parent,
          child,
          false,
          new Date(t.contract.endsAt.getTime() - 1),
        )
      ).source,
    ).toBe("school");
    expect(
      (await resolveLabAccess(f.db, parent, child, false, t.contract.endsAt)).source,
    ).toBeNull();
    expect(await f.db.select().from(s.schoolEnrollments)).toHaveLength(1);
  });
  it("keeps new reservations within a smaller already activated renewal", async () => {
    const t = await setup(10);
    const renewal = await school.createContract(f.db, admin, {
      schoolId: t.org.id,
      reference: "Подновяване",
      startsAt: t.contract.endsAt,
      endsAt: new Date(t.contract.endsAt.getTime() + 86400000),
      seats: 1,
      monthlyEnergy: 20,
    });
    await school.setContractStatus(f.db, admin, t.org.id, renewal.id, "active");
    await invite(t);
    await expect(invite(t)).rejects.toMatchObject({ code: "seat_limit" });
    expect((await schoolView(f.db, manager, t.org.id)).license?.seatLimit).toBe(1);
  });
  it("revokes an invitation batch without affecting already enrolled pupils", async () => {
    const t = await setup(3),
      batchId = randomUUID();
    const batch = await school.createInvites(f.db, manager, {
      schoolId: t.org.id,
      classId: t.room.id,
      batchId,
      count: 3,
      days: 7,
    });
    await school.redeemInvite(f.db, parent, child, batch.invites[0].code);
    await expect(school.revokeInviteBatch(f.db, other, t.org.id, batchId)).rejects.toMatchObject({
      code: "forbidden",
    });
    expect((await school.revokeInviteBatch(f.db, teacher, t.org.id, batchId)).count).toBe(2);
    expect((await school.revokeInviteBatch(f.db, teacher, t.org.id, batchId)).count).toBe(0);
    expect(await school.seatUsage(f.db, t.org.id)).toEqual({ enrolled: 1, reserved: 0 });
    expect((await resolveLabAccess(f.db, parent, child)).source).toBe("school");
    await expect(
      school.redeemInvite(f.db, other, otherChild, batch.invites[1].code),
    ).rejects.toMatchObject({ code: "invite_invalid" });
  });
});
