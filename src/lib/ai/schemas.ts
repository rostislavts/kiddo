import { z } from "zod";
export const featureSchema = z.enum([
  "prompts",
  "prompt-battles",
  "bots",
  "agents",
  "agent-missions",
  "knowledge",
  "detective",
  "images",
  "vision",
  "games",
]);
export type AIFeature = z.infer<typeof featureSchema>;
export const toolNames = [
  "read_clue",
  "ask_character",
  "inspect_item",
  "search_knowledge",
  "check_answer",
  "calculate",
  "roll_dice",
  "get_game_state",
] as const;
export const toolNameSchema = z.enum(toolNames);
const short = z.string().trim().max(240);
const paragraph = z.string().trim().max(1200);
export const promptBuilderSchema = z
  .object({
    role: short.default(""),
    goal: paragraph.min(2),
    context: paragraph.default(""),
    audience: short.default("деца на 8–11 години"),
    constraints: paragraph.default(""),
    format: short.default("кратък текст"),
    example: paragraph.default(""),
  })
  .strict();
export const botSchema = z
  .object({
    name: short.min(2),
    avatar: z.enum(["robot", "cat", "fox", "rocket"]).default("robot"),
    role: short.min(2),
    personality: short,
    goal: paragraph.min(2),
    topic: paragraph,
    rules: paragraph,
    responseStyle: short,
    knowledgeProjectId: z.uuid().nullable().default(null),
  })
  .strict();
export const agentSchema = z
  .object({
    mission: paragraph.min(2),
    brain: short.default("Планирай кратко и провери резултата."),
    tools: z.array(toolNameSchema).min(1).max(8),
    knowledge: paragraph.default(""),
    memory: z.enum(["run_only", "last_result"]).default("run_only"),
    rules: paragraph.default(""),
    finishCondition: short.min(2),
    scenario: z.enum(["secret-animal", "museum-mystery", "space-repair"]).default("secret-animal"),
    maxSteps: z.number().int().min(1).max(8).default(5),
    maxToolCalls: z.number().int().min(1).max(8).default(5),
    maxEnergy: z.number().int().min(1).max(50).default(15),
  })
  .strict();
export const imageBuilderSchema = z
  .object({
    subject: short.min(2),
    setting: short.min(2),
    style: z.enum(["cartoon", "watercolor", "pixel-art", "paper-cut"]),
    composition: short.default(""),
    details: paragraph.default(""),
    restrictions: short.default("Без хора, надписи и лични данни."),
  })
  .strict();
export const gameSchema = z
  .object({
    world: short.min(2),
    hero: short.min(2),
    goal: short.min(2),
    characters: paragraph,
    rules: paragraph,
    tone: z.enum(["funny", "curious", "calm"]).default("curious"),
    maxTurns: z.number().int().min(3).max(20).default(8),
  })
  .strict();
export const knowledgeSchema = z
  .object({ goal: paragraph.default("Отговаряй само с помощта на моите карти.") })
  .strict();
export const creatorSchema = z
  .object({
    template: z.enum(["tutor", "space-agent", "story-game", "museum-guide"]),
    projectIds: z.array(z.uuid()).max(6),
    visualIds: z
      .array(z.enum(["library", "space"]))
      .max(2)
      .default([]),
    notes: paragraph.default(""),
  })
  .strict();
export const projectFeatureSchema = z.enum([
  "prompts",
  "bots",
  "agents",
  "knowledge",
  "images",
  "games",
  "projects",
]);
export type ProjectFeature = z.infer<typeof projectFeatureSchema>;
export const projectSchemas = {
  prompts: promptBuilderSchema,
  bots: botSchema,
  agents: agentSchema,
  knowledge: knowledgeSchema,
  images: imageBuilderSchema,
  games: gameSchema,
  projects: creatorSchema,
} as const;
export const projectInput = z
  .object({
    id: z.uuid().optional(),
    feature: projectFeatureSchema,
    title: z.string().trim().min(2).max(80),
    configuration: z.record(z.string(), z.unknown()),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export const cardInput = z
  .object({
    id: z.uuid().optional(),
    projectId: z.uuid(),
    title: z.string().trim().min(2).max(100),
    content: z.string().trim().min(2).max(1600),
  })
  .strict();
export const runInput = z
  .object({
    requestId: z.uuid(),
    childId: z.uuid(),
    feature: featureSchema,
    projectId: z.uuid().optional(),
    challengeId: z.uuid().optional(),
    missionId: z.uuid().optional(),
    escapeRunId: z.uuid().optional(),
    input: z.record(z.string(), z.unknown()),
  })
  .strict();
export type RunInput = z.infer<typeof runInput>;
export const requirementSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("required_terms"), terms: z.array(short.min(1)).min(1).max(20) }),
  z.object({ type: z.literal("forbidden_terms"), terms: z.array(short.min(1)).min(1).max(20) }),
  z
    .object({
      type: z.literal("word_count"),
      min: z.number().int().min(0).max(800),
      max: z.number().int().min(1).max(800),
    })
    .refine((v) => v.max >= v.min),
  z.object({ type: z.literal("item_count"), count: z.number().int().min(1).max(20) }),
  z.object({ type: z.literal("headings"), headings: z.array(short.min(1)).min(1).max(10) }),
  z.object({ type: z.literal("json_keys"), keys: z.array(short.min(1)).min(1).max(10) }),
  z.object({ type: z.literal("semantic"), criterion: paragraph.min(5) }),
]);
export const battleSchema = z
  .object({
    instructions: paragraph.min(2),
    requirements: z.array(requirementSchema).min(1).max(12),
    forbiddenElements: z.array(short.min(1)).max(20).default([]),
    maxAttempts: z.number().int().min(1).max(10).default(3),
    difficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
    energyCost: z.number().int().min(1).max(30).default(3),
  })
  .strict();
export const detectiveSchema = z
  .object({
    mode: z.enum(["mistake", "better", "evidence", "fix"]),
    question: paragraph.min(2),
    claims: z.array(paragraph.min(1)).min(2).max(5),
    correctIndex: z.number().int().min(0).max(4),
    fact: paragraph.min(2),
    source: z.string().url().max(500),
    explanation: paragraph.min(2),
    dynamic: z.boolean().default(false),
  })
  .strict()
  .refine((v) => v.correctIndex < v.claims.length);
export const agentMissionSchema = z
  .object({
    scenario: z.enum(["secret-animal", "museum-mystery", "space-repair"]),
    maxSteps: z.number().int().min(2).max(8).default(6),
    requiredTools: z.array(toolNameSchema).min(1).max(8).default(["read_clue", "check_answer"]),
  })
  .strict();
export const knowledgeChallengeSchema = z
  .object({
    question: paragraph.min(2),
    requiredTerms: z.array(short.min(1)).min(1).max(10),
    starterCards: z
      .array(z.object({ title: short.min(2), content: paragraph.min(2) }))
      .max(8)
      .default([]),
  })
  .strict();
export const imageChallengeSchema = z
  .object({
    instructions: paragraph.min(2),
    requiredTerms: z.array(short.min(1)).min(1).max(10),
    visionCriterion: paragraph.default(""),
  })
  .strict();
export const escapeSchema = z
  .object({ instructions: paragraph.min(2), challengeIds: z.array(z.uuid()).min(2).max(8) })
  .strict();
export const creatorChallengeSchema = z
  .object({
    template: creatorSchema.shape.template,
    requiredFeatures: z.array(projectFeatureSchema).min(1).max(4),
  })
  .strict();
export const challengeSchemas = {
  "prompt-battles": battleSchema,
  "agent-missions": agentMissionSchema,
  detective: detectiveSchema,
  knowledge: knowledgeChallengeSchema,
  images: imageChallengeSchema,
  "escape-rooms": escapeSchema,
  projects: creatorChallengeSchema,
} as const;
export const challengeTypeSchema = z.enum([
  "prompt-battles",
  "agent-missions",
  "detective",
  "knowledge",
  "images",
  "escape-rooms",
  "projects",
]);
export type ChallengeType = z.infer<typeof challengeTypeSchema>;
export const challengeInput = z
  .object({
    id: z.uuid().optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    type: challengeTypeSchema,
    title: short.min(2),
    description: paragraph.min(2),
    configuration: z.record(z.string(), z.unknown()),
    status: z.enum(["draft", "published", "archived"]),
    xpReward: z.number().int().min(0).max(1000),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export const missionInput = z
  .object({
    id: z.uuid().optional(),
    title: short.min(2),
    description: paragraph.min(2),
    challengeId: z.uuid(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    xpReward: z.number().int().min(0).max(1000),
    achievementId: z.uuid().nullable(),
    status: z.enum(["draft", "published", "archived"]),
  })
  .strict()
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt));
