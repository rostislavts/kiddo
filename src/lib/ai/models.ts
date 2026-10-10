import { z } from "zod";
import { featureSchema, type AIFeature } from "./schemas";
const featureConfigSchema = z
  .object({
    enabled: z.boolean(),
    cost: z.number().int().min(1).max(100),
    model: z.string().regex(/^[a-zA-Z0-9._-]{2,100}$/),
    maxOutputTokens: z.number().int().min(200).max(6000),
    maxOutputChars: z.number().int().min(200).max(8000),
  })
  .strict();
export const aiConfigSchema = z
  .object({
    enabled: z.boolean(),
    monthlyEnergy: z.number().int().min(1).max(10000),
    rollover: z.boolean(),
    maxRollover: z.number().int().min(0).max(10000),
    childRunsPerMinute: z.number().int().min(1).max(30),
    accountRunsPerMinute: z.number().int().min(1).max(60),
    maxConcurrentRuns: z.number().int().min(1).max(4),
    maxInputChars: z.number().int().min(500).max(16000),
    maxHistory: z.number().int().min(2).max(30),
    maxProjects: z.number().int().min(1).max(100),
    maxCards: z.number().int().min(1).max(100),
    maxAgentSteps: z.number().int().min(1).max(8),
    maxToolCalls: z.number().int().min(1).max(8),
    maxGameTurns: z.number().int().min(3).max(20),
    maxImagesPerPeriod: z.number().int().min(1).max(50),
    imageRetentionDays: z.number().int().min(1).max(90),
    historyRetentionDays: z.number().int().min(1).max(90),
    timeoutSeconds: z.number().int().min(10).max(120),
    features: z.record(featureSchema, featureConfigSchema),
    prices: z.record(
      z.string(),
      z
        .object({
          inputPerMillion: z.number().nonnegative().max(1000),
          outputPerMillion: z.number().nonnegative().max(1000),
          perImage: z.number().nonnegative().max(10),
        })
        .strict(),
    ),
  })
  .strict();
export type AIConfig = z.infer<typeof aiConfigSchema>;
const costs: Record<AIFeature, number> = {
  prompts: 2,
  "prompt-battles": 3,
  bots: 2,
  knowledge: 3,
  detective: 3,
  vision: 5,
  images: 20,
  agents: 10,
  "agent-missions": 15,
  games: 3,
};
export function defaultAIConfig(): AIConfig {
  return aiConfigSchema.parse({
    enabled: true,
    monthlyEnergy: 1000,
    rollover: false,
    maxRollover: 1000,
    childRunsPerMinute: 8,
    accountRunsPerMinute: 15,
    maxConcurrentRuns: 2,
    maxInputChars: 8000,
    maxHistory: 12,
    maxProjects: 30,
    maxCards: 40,
    maxAgentSteps: 6,
    maxToolCalls: 6,
    maxGameTurns: 12,
    maxImagesPerPeriod: 20,
    imageRetentionDays: 30,
    historyRetentionDays: 30,
    timeoutSeconds: 90,
    features: Object.fromEntries(
      featureSchema.options.map((f) => [
        f,
        {
          enabled: true,
          cost: costs[f],
          model:
            f === "images"
              ? process.env.AI_IMAGE_MODEL || "gpt-image-2"
              : process.env.AI_TEXT_MODEL || "gpt-5.4-mini",
          maxOutputTokens: 2000,
          maxOutputChars: 4500,
        },
      ]),
    ),
    // Standard published rates, checked 2026-09-26; estimates omit discounts/taxes.
    // Generation uses text input only; output tokens include generated-image tokens.
    prices: {
      "gpt-5.4-mini": { inputPerMillion: 0.75, outputPerMillion: 4.5, perImage: 0 },
      "gpt-image-2": { inputPerMillion: 2.5, outputPerMillion: 15, perImage: 0 },
    },
  });
}
export const featureLabels: Record<AIFeature, string> = {
  prompts: "Prompt Playground",
  "prompt-battles": "Prompt Battles",
  bots: "Моят бот",
  agents: "Мини агенти",
  "agent-missions": "Агентски мисии",
  knowledge: "Knowledge Lab",
  detective: "AI детектив",
  images: "Image Lab",
  vision: "Vision Lab",
  games: "AI Game Master",
};
