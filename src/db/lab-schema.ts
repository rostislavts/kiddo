import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { children, users, achievements } from "./schema";
import { energyAccounts, schoolContracts } from "./school-schema";
const time = (name: string) => timestamp(name, { withTimezone: true });
const created = () => time("created_at").defaultNow().notNull();
const child = () =>
  uuid("child_profile_id")
    .notNull()
    .references(() => children.id, { onDelete: "cascade" });
const data = (name: string) => jsonb(name).$type<Record<string, unknown>>().notNull().default({});

export const aiSettings = pgTable("ai_settings", {
  id: text("id").primaryKey(),
  configuration: data("configuration_json"),
  version: integer("version").notNull().default(1),
  updatedAt: time("updated_at").defaultNow().notNull(),
});
export const aiEnergyPeriods = pgTable(
  "ai_energy_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    // This cascade is deferred by migration 0006 for multi-path account deletion.
    accountId: uuid("account_id")
      .notNull()
      .references(() => energyAccounts.id, { onDelete: "cascade" }),
    schoolContractId: uuid("school_contract_id").references(() => schoolContracts.id),
    subscriptionId: text("subscription_id"),
    allowance: integer("allowance").notNull().default(1000),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("energy_period_once").on(t.accountId, t.startsAt),
    index("energy_school_period_idx").on(t.schoolContractId, t.startsAt),
    check("energy_period_dates", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);
export const aiEnergyEvents = pgTable(
  "ai_energy_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    childId: uuid("child_profile_id").references(() => children.id, { onDelete: "set null" }),
    // Deferred by migration 0006: school anonymity + family cascade deletion.
    periodId: uuid("period_id")
      .notNull()
      .references(() => aiEnergyPeriods.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    feature: text("feature").notNull(),
    referenceId: uuid("reference_id"),
    amount: integer("amount").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    providerUsage: data("provider_usage_json"),
    createdAt: created(),
  },
  (t) => [
    index("energy_account_period_idx").on(t.userId, t.periodId),
    index("energy_period_event_idx").on(t.periodId, t.eventType),
  ],
);
export const labProjects = pgTable(
  "lab_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: child(),
    feature: text("feature").notNull(),
    title: text("title").notNull(),
    configuration: data("configuration_json"),
    version: integer("version").notNull().default(1),
    state: text("completion_state").notNull().default("draft"),
    createdAt: created(),
    updatedAt: time("updated_at").defaultNow().notNull(),
  },
  (t) => [index("lab_project_child_idx").on(t.childId, t.updatedAt)],
);
export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: child(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => labProjects.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(),
    requestKey: uuid("request_key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status").notNull().default("running"),
    energyReserved: integer("energy_reserved").notNull(),
    energyUsed: integer("energy_used").notNull().default(0),
    periodId: uuid("period_id")
      .notNull()
      .references(() => aiEnergyPeriods.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputMetadata: data("input_metadata_json"),
    outputMetadata: data("output_metadata_json"),
    result: data("result_json"),
    errorCode: text("error_code"),
    startedAt: time("started_at").defaultNow().notNull(),
    completedAt: time("completed_at"),
    expiresAt: time("expires_at").notNull(),
  },
  (t) => [
    uniqueIndex("ai_request_once").on(t.userId, t.requestKey),
    index("ai_runs_child_idx").on(t.childId, t.startedAt),
    index("ai_runs_recovery_idx").on(t.status, t.expiresAt),
    check("ai_run_energy_nonnegative", sql`${t.energyReserved} >= 0 and ${t.energyUsed} >= 0`),
    check(
      "ai_run_status",
      sql`${t.status} in ('pending','running','completed','failed','moderated','canceled')`,
    ),
  ],
);
export const labChallenges = pgTable(
  "lab_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    type: text("feature_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    configuration: data("configuration_json"),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("draft"),
    xpReward: integer("xp_reward").notNull().default(30),
    createdAt: created(),
    updatedAt: time("updated_at").defaultNow().notNull(),
  },
  (t) => [
    check("lab_challenge_status", sql`${t.status} in ('draft','published','archived')`),
    check("lab_challenge_xp", sql`${t.xpReward} between 0 and 1000`),
  ],
);
export const labAttempts = pgTable(
  "lab_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: child(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => labChallenges.id),
    runId: uuid("run_id").references(() => aiRuns.id, { onDelete: "set null" }),
    contextKey: text("context_key").notNull().default("challenge"),
    attemptNumber: integer("attempt_number").notNull(),
    configurationVersion: integer("configuration_version").notNull(),
    input: data("input_json"),
    output: data("output_json"),
    evaluation: data("evaluation_json"),
    passed: boolean("passed").notNull().default(false),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("lab_attempt_number_once").on(
      t.childId,
      t.challengeId,
      t.contextKey,
      t.attemptNumber,
    ),
  ],
);
export const botConversations = pgTable(
  "bot_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: child(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => labProjects.id, { onDelete: "cascade" }),
    createdAt: created(),
  },
  (t) => [uniqueIndex("one_bot_conversation").on(t.projectId)],
);
export const botMessages = pgTable(
  "bot_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => botConversations.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => aiRuns.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("bot_message_once").on(t.runId, t.role)],
);
export const agentProjectTools = pgTable(
  "agent_project_tools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => labProjects.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
  },
  (t) => [uniqueIndex("agent_tool_once").on(t.projectId, t.tool)],
);
export const agentRunSteps = pgTable(
  "agent_run_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => aiRuns.id, { onDelete: "cascade" }),
    step: integer("step").notNull(),
    tool: text("tool").notNull(),
    arguments: data("arguments_json"),
    result: text("result").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("agent_step_once").on(t.runId, t.step)],
);
export const knowledgeCards = pgTable(
  "knowledge_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => labProjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: created(),
    updatedAt: time("updated_at").defaultNow().notNull(),
  },
  (t) => [index("knowledge_project_idx").on(t.projectId)],
);
export const knowledgeRetrievals = pgTable(
  "knowledge_retrievals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => aiRuns.id, { onDelete: "cascade" }),
    cardId: uuid("card_id").references(() => knowledgeCards.id, { onDelete: "set null" }),
    title: text("card_title").notNull(),
    excerpt: text("excerpt").notNull(),
    rank: integer("rank").notNull(),
  },
  (t) => [index("retrieval_run_idx").on(t.runId)],
);
// Private bytes live in Postgres for this bounded beta: no public bucket/URLs, and cascading deletion is atomic.
export const labAssets = pgTable(
  "lab_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: child(),
    projectId: uuid("project_id").references(() => labProjects.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => aiRuns.id, { onDelete: "cascade" }),
    mime: text("mime").notNull(),
    base64: text("base64").notNull(),
    expiresAt: time("expires_at").notNull(),
    createdAt: created(),
  },
  (t) => [index("lab_asset_expiry_idx").on(t.expiresAt)],
);
export const aiGameSessions = pgTable(
  "ai_game_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: child(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => labProjects.id, { onDelete: "cascade" }),
    turn: integer("turn").notNull().default(0),
    state: data("state_json"),
    status: text("status").notNull().default("active"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("game_session_project").on(t.projectId)],
);
export const aiGameTurns = pgTable(
  "ai_game_turns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => aiGameSessions.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => aiRuns.id, { onDelete: "cascade" }),
    turn: integer("turn").notNull(),
    choice: text("choice").notNull(),
    narration: text("narration").notNull(),
    choices: jsonb("choices_json").$type<string[]>().notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("game_turn_once").on(t.sessionId, t.turn)],
);
export const escapeRoomSteps = pgTable(
  "escape_room_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => labChallenges.id, { onDelete: "cascade" }),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => labChallenges.id),
    position: integer("position").notNull(),
  },
  (t) => [uniqueIndex("escape_step_position").on(t.roomId, t.position)],
);
export const escapeRoomRuns = pgTable(
  "escape_room_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: child(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => labChallenges.id),
    version: integer("version").notNull(),
    step: integer("current_step").notNull().default(0),
    completedAt: time("completed_at"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("escape_child_room_once").on(t.childId, t.roomId)],
);
export const escapeRoomStepAttempts = pgTable(
  "escape_room_step_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("escape_room_run_id")
      .notNull()
      .references(() => escapeRoomRuns.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => escapeRoomSteps.id),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => labAttempts.id, { onDelete: "cascade" }),
    createdAt: created(),
  },
  (t) => [uniqueIndex("escape_step_credit_once").on(t.runId, t.stepId)],
);
export const featuredMissions = pgTable(
  "featured_missions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    featureType: text("feature_type").notNull(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => labChallenges.id),
    configuration: data("configuration_json"),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    xpReward: integer("xp_reward").notNull().default(50),
    achievementId: uuid("achievement_id").references(() => achievements.id),
    status: text("status").notNull().default("draft"),
  },
  (t) => [check("featured_dates", sql`${t.endsAt} > ${t.startsAt}`)],
);
export const missionCompletions = pgTable(
  "mission_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childId: child(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => featuredMissions.id),
    createdAt: created(),
  },
  (t) => [uniqueIndex("mission_completion_once").on(t.childId, t.missionId)],
);
