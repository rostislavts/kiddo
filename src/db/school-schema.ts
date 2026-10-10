import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
  check,
  jsonb,
} from "drizzle-orm/pg-core";
import { users, children } from "./schema";
const at = (name: string) => timestamp(name, { withTimezone: true });
const created = () => at("created_at").defaultNow().notNull();
export const schools = pgTable(
  "schools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    status: text("status", { enum: ["active", "suspended"] })
      .notNull()
      .default("active"),
    createdAt: created(),
  },
  (t) => [check("school_status", sql`${t.status} in ('active','suspended')`)],
);
export const schoolContracts = pgTable(
  "school_contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    reference: text("reference").notNull(),
    startsAt: at("starts_at").notNull(),
    endsAt: at("ends_at").notNull(),
    seats: integer("seats").notNull(),
    monthlyEnergy: integer("monthly_energy").notNull(),
    status: text("status", { enum: ["draft", "active", "suspended"] })
      .notNull()
      .default("draft"),
    createdAt: created(),
  },
  (t) => [
    check("school_contract_dates", sql`${t.endsAt} > ${t.startsAt}`),
    check(
      "school_contract_limits",
      sql`${t.seats} between 1 and 10000 and ${t.monthlyEnergy} between 1 and 10000`,
    ),
    check("school_contract_status", sql`${t.status} in ('draft','active','suspended')`),
    index("school_contract_lookup").on(t.schoolId, t.startsAt),
  ],
);
export const schoolMemberships = pgTable(
  "school_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    email: text("email").notNull(),
    role: text("role", { enum: ["manager", "teacher"] }).notNull(),
    active: integer("active").notNull().default(1),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("school_staff_email_once").on(t.schoolId, t.email),
    check("school_staff_role", sql`${t.role} in ('manager','teacher')`),
    check("school_staff_active", sql`${t.active} in (0,1)`),
  ],
);
export const schoolClasses = pgTable(
  "school_classes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    name: text("name").notNull(),
    teacherId: uuid("teacher_membership_id").references(() => schoolMemberships.id, {
      onDelete: "set null",
    }),
    createdAt: created(),
  },
  (t) => [uniqueIndex("school_class_name_once").on(t.schoolId, t.name)],
);
export const schoolEnrollments = pgTable(
  "school_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    classId: uuid("class_id")
      .notNull()
      .references(() => schoolClasses.id),
    childId: uuid("child_profile_id").references(() => children.id, { onDelete: "set null" }),
    status: text("status", { enum: ["active", "left"] })
      .notNull()
      .default("active"),
    joinedAt: created(),
    leftAt: at("left_at"),
  },
  (t) => [
    uniqueIndex("school_child_once").on(t.schoolId, t.childId),
    uniqueIndex("school_child_active_once")
      .on(t.childId)
      .where(sql`${t.status} = 'active'`),
    check("school_enrollment_status", sql`${t.status} in ('active','left')`),
  ],
);
export const schoolInvites = pgTable(
  "school_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    classId: uuid("class_id")
      .notNull()
      .references(() => schoolClasses.id),
    tokenHash: text("token_hash").notNull().unique(),
    batchId: uuid("batch_id").notNull(),
    expiresAt: at("expires_at").notNull(),
    status: text("status", { enum: ["pending", "redeemed", "revoked"] })
      .notNull()
      .default("pending"),
    enrollmentId: uuid("enrollment_id").references(() => schoolEnrollments.id),
    createdAt: created(),
    redeemedAt: at("redeemed_at"),
  },
  (t) => [
    index("school_invite_seats").on(t.schoolId, t.status, t.expiresAt),
    index("school_invite_batch_idx").on(t.batchId),
    check("school_invite_status", sql`${t.status} in ('pending','redeemed','revoked')`),
  ],
);
export const schoolAudit = pgTable("school_audit", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id),
  actorId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  referenceId: uuid("reference_id"),
  details: jsonb("details").$type<Record<string, string | number>>().notNull().default({}),
  createdAt: created(),
});
export const energyAccounts = pgTable(
  "ai_energy_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind", { enum: ["family", "school"] }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id").references(() => schools.id),
    childId: uuid("child_profile_id").references(() => children.id, { onDelete: "set null" }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("family_energy_account_once").on(t.userId),
    uniqueIndex("school_energy_account_once").on(t.schoolId, t.childId),
    check(
      "energy_account_owner",
      sql`(${t.kind}='family' and ${t.userId} is not null and ${t.schoolId} is null and ${t.childId} is null) or (${t.kind}='school' and ${t.userId} is null and ${t.schoolId} is not null)`,
    ),
  ],
);
