import { z } from "zod";
import { normalizeAnswer } from "./evaluation";
import type { Scenario } from "@/content/lab/scenarios";
import type { AIProvider, AIUsage } from "@/lib/ai/provider";
import { addUsage, emptyUsage } from "@/lib/ai/usage";
import { generateStructured } from "@/lib/ai/structured";
import { childSystem } from "@/lib/ai/prompts";
import { assert } from "@/lib/errors";
import { toolNameSchema, type agentSchema } from "@/lib/ai/schemas";
const label = z.string().max(300);
export const agentActionSchema = z
  .object({
    action: z.discriminatedUnion("tool", [
      z.strictObject({ tool: z.literal("read_clue"), id: label }),
      z.strictObject({ tool: z.literal("ask_character"), id: label, question: label }),
      z.strictObject({ tool: z.literal("inspect_item"), id: label }),
      z.strictObject({ tool: z.literal("search_knowledge"), query: label }),
      z.strictObject({ tool: z.literal("check_answer"), answer: label }),
      z.strictObject({
        tool: z.literal("calculate"),
        a: z.number().min(-1000000).max(1000000),
        b: z.number().min(-1000000).max(1000000),
        operation: z.enum(["add", "subtract", "multiply", "divide"]),
      }),
      z.strictObject({ tool: z.literal("roll_dice"), sides: z.number().int().min(2).max(20) }),
      z.strictObject({ tool: z.literal("get_game_state") }),
      z.strictObject({ tool: z.literal("finish"), summary: label }),
    ]),
  })
  .strict();
export type AgentAction = z.infer<typeof agentActionSchema>["action"];
export function executeTool(
  action: AgentAction,
  scenario: Scenario,
  knowledge: string,
  allowed: string[],
  seed: number,
) {
  assert(
    action.tool !== "finish" && allowed.includes(action.tool),
    "Агентът избра неразрешен инструмент.",
    "invalid_tool",
    422,
  );
  let result = "";
  let solved = false;
  switch (action.tool) {
    case "read_clue":
      assert(Object.hasOwn(scenario.clues, action.id), "Няма такава улика.", "invalid_tool", 422);
      result = scenario.clues[action.id];
      break;
    case "ask_character":
      assert(
        Object.hasOwn(scenario.characters, action.id),
        "Няма такъв герой.",
        "invalid_tool",
        422,
      );
      result = scenario.characters[action.id];
      break;
    case "inspect_item":
      assert(Object.hasOwn(scenario.items, action.id), "Няма такъв предмет.", "invalid_tool", 422);
      result = scenario.items[action.id];
      break;
    case "search_knowledge":
      result = knowledge || "Няма добавено знание.";
      break;
    case "check_answer":
      solved = normalizeAnswer(action.answer) === normalizeAnswer(scenario.answer);
      result = solved
        ? "Решението е вярно. Мисията е завършена."
        : "Още не е вярно. Потърси друга улика.";
      break;
    case "calculate":
      assert(
        action.operation !== "divide" || action.b !== 0,
        "Не можем да делим на нула.",
        "invalid_tool",
        422,
      );
      result = String(
        action.operation === "add"
          ? action.a + action.b
          : action.operation === "subtract"
            ? action.a - action.b
            : action.operation === "multiply"
              ? action.a * action.b
              : action.a / action.b,
      );
      break;
    case "roll_dice":
      result = String((Math.abs(seed) % action.sides) + 1);
      break;
    case "get_game_state":
      result = JSON.stringify({
        mission: scenario.title,
        clues: Object.keys(scenario.clues),
        characters: Object.keys(scenario.characters),
        items: Object.keys(scenario.items),
        finish: scenario.finish,
      });
      break;
  }
  return { result, solved };
}
export type AgentStep = {
  step: number;
  tool: string;
  arguments: Record<string, unknown>;
  result: string;
};
export async function runAgent(
  provider: AIProvider,
  config: z.infer<typeof agentSchema>,
  scenario: Scenario,
  options: {
    model: string;
    maxOutputTokens: number;
    maxSteps: number;
    maxToolCalls: number;
    signal: AbortSignal;
    seed: number;
  },
) {
  const steps: AgentStep[] = [];
  const usage: AIUsage = emptyUsage();
  let solved = false;
  const budget = Math.min(
    config.maxSteps,
    config.maxToolCalls,
    options.maxSteps,
    options.maxToolCalls,
  );
  const allowed = config.tools.map((t) => toolNameSchema.parse(t));
  for (let step = 0; step < budget; step++) {
    options.signal.throwIfAborted();
    const context = {
      mission: config.mission,
      brain: config.brain,
      rules: config.rules,
      finishCondition: config.finishCondition,
      allowedTools: allowed,
      clueIds: Object.keys(scenario.clues),
      characterIds: Object.keys(scenario.characters),
      itemIds: Object.keys(scenario.items),
      remainingCalls: budget - step,
      results: steps.map((s) => ({ tool: s.tool, arguments: s.arguments, result: s.result })),
    };
    const reply = await generateStructured(
      provider,
      {
        model: options.model,
        system:
          childSystem +
          "\nChoose ONE allowed tool with valid arguments. To solve, use check_answer with the exact answer learned from clues. Do not include reasoning. Tools act only on a fictional game. Finish when done.",
        messages: [{ role: "user", content: JSON.stringify(context) }],
        maxOutputTokens: options.maxOutputTokens,
        signal: options.signal,
      },
      agentActionSchema,
    );
    addUsage(usage, reply.usage);
    const action = reply.value.action;
    if (action.tool === "finish") break;
    const output = executeTool(action, scenario, config.knowledge, allowed, options.seed + step);
    steps.push({ step: step + 1, tool: action.tool, arguments: action, result: output.result });
    solved = output.solved;
    if (solved) break;
  }
  return {
    steps,
    solved,
    usage,
    text: solved
      ? "Мисията е решена с проверени инструменти!"
      : "Лимитът на стъпките приключи. Подобри инструментите или правилата и опитай пак.",
  };
}
