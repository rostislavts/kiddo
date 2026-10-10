import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { Answer, Criteria, LessonContent } from "@/lib/content/schema";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    role: text("role", { enum: ["parent", "admin"] })
      .default("parent")
      .notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    deletingAt: timestamp("deleting_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [check("user_role", sql`${t.role} in ('parent','admin')`)],
);
export const children = pgTable(
  "child_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    energyPreference: text("energy_preference", { enum: ["auto", "family"] })
      .notNull()
      .default("auto"),
    avatar: text("avatar_key").notNull().default("robot"),
    ageBand: text("age_band"),
    createdAt: createdAt(),
  },
  (t) => [index("child_parent_idx").on(t.parentId)],
);
export const tracks = pgTable("tracks", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  ageMin: integer("age_min").notNull().default(8),
  ageMax: integer("age_max").notNull().default(11),
  locale: text("locale").notNull().default("bg-BG"),
  published: boolean("published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});
export const worlds = pgTable(
  "worlds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    visual: text("image_key").notNull().default("robot"),
    color: text("color").notNull().default("violet"),
    sortOrder: integer("sort_order").notNull().default(0),
    isFree: boolean("is_free").notNull().default(false),
    published: boolean("published").notNull().default(false),
    requiredWorldId: uuid("required_world_id").references((): AnyPgColumn => worlds.id),
    sequentialLessons: boolean("sequential_lessons").notNull().default(true),
    xpReward: integer("xp_reward").notNull().default(100),
  },
  (t) => [check("world_xp_nonnegative", sql`${t.xpReward} >= 0`)],
);
export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    estimatedMinutes: integer("estimated_minutes").notNull().default(7),
    xpReward: integer("xp_reward").notNull().default(50),
    published: boolean("published").notNull().default(false),
    contentVersion: integer("content_version").notNull().default(1),
  },
  (t) => [
    index("lesson_world_idx").on(t.worldId),
    check(
      "lesson_positive_values",
      sql`${t.xpReward} >= 0 and ${t.estimatedMinutes} > 0 and ${t.contentVersion} > 0`,
    ),
  ],
);
export const lessonVersions = pgTable(
  "lesson_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id),
    version: integer("version").notNull(),
    content: jsonb("content_json").$type<LessonContent>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("lesson_version_unique").on(t.lessonId, t.version)],
);
export const progress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: uuid("child_profile_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id),
    version: integer("content_version").notNull(),
    status: text("status", { enum: ["in_progress", "completed"] })
      .notNull()
      .default("in_progress"),
    currentStep: integer("current_step").notNull().default(0),
    bestScore: integer("best_quiz_score").notNull().default(0),
    startedAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("child_lesson_unique").on(t.childId, t.lessonId),
    check("progress_values", sql`${t.currentStep} >= 0 and ${t.bestScore} between 0 and 100`),
  ],
);
export const attempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: uuid("child_profile_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id),
    version: integer("content_version").notNull(),
    number: integer("attempt_number").notNull(),
    status: text("status", { enum: ["in_progress", "completed", "abandoned"] })
      .notNull()
      .default("in_progress"),
    score: integer("score"),
    maxScore: integer("max_score"),
    percentage: integer("percentage"),
    startedAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("attempt_number_unique").on(t.childId, t.lessonId, t.number),
    uniqueIndex("one_active_attempt")
      .on(t.childId, t.lessonId)
      .where(sql`${t.status} = 'in_progress'`),
  ],
);
export const worldCompletions = pgTable(
  "world_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: uuid("child_profile_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("child_world_completion_unique").on(t.childId, t.worldId)],
);
export const answers = pgTable(
  "quiz_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("quiz_attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    answer: jsonb("answer_json").$type<Answer>().notNull(),
    isCorrect: boolean("is_correct").notNull(),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    answeredAt: createdAt(),
  },
  (t) => [uniqueIndex("attempt_question_unique").on(t.attemptId, t.questionId)],
);
export const xpEvents = pgTable(
  "xp_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: uuid("child_profile_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    referenceId: text("reference_id").notNull(),
    xp: integer("xp").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("xp_event_idempotency").on(t.childId, t.eventType, t.referenceId),
    check("positive_xp", sql`${t.xp} >= 0`),
  ],
);
export const levels = pgTable("levels", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  minXp: integer("min_xp").notNull().unique(),
});
export const achievements = pgTable("achievements", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon_key").notNull(),
  criteria: jsonb("criteria_json").$type<Criteria>().notNull(),
  published: boolean("published").notNull().default(true),
});
export const childAchievements = pgTable(
  "child_achievements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: uuid("child_profile_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id),
    earnedAt: createdAt(),
  },
  (t) => [uniqueIndex("child_achievement_unique").on(t.childId, t.achievementId)],
);
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    paddleCustomerId: text("paddle_customer_id").notNull(),
    paddleSubscriptionId: text("paddle_subscription_id").notNull().unique(),
    paddlePriceId: text("paddle_price_id").notNull(),
    status: text("status", {
      enum: ["trialing", "active", "past_due", "paused", "canceled"],
    }).notNull(),
    periodStart: timestamp("current_period_start", { withTimezone: true }),
    periodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    lastEventAt: timestamp("last_event_occurred_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("subscription_user_idx").on(t.userId)],
);
export const checkoutSessions = pgTable("checkout_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  transactionId: text("paddle_transaction_id").unique(),
  createdAt: createdAt(),
});
export const webhookEvents = pgTable("payment_webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: text("provider_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  status: text("processing_status", { enum: ["processed", "ignored"] }).notNull(),
  processedAt: createdAt(),
});
export const analytics = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    childId: uuid("child_profile_id").references(() => children.id, { onDelete: "cascade" }),
    event: text("event_name").notNull(),
    properties: jsonb("properties_json")
      .$type<Record<string, string | number | boolean>>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
  },
  (t) => [index("analytics_event_idx").on(t.event, t.createdAt)],
);
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    hits: integer("hits").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limits_expiry_idx").on(t.expiresAt)],
);

export * from "./lab-schema";
export * from "./school-schema";
