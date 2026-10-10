import "./load-env";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { aiProvider } from "../src/lib/ai/provider";
import { childSystem } from "../src/lib/ai/prompts";
import { generateStructured } from "../src/lib/ai/structured";
import { generateImage } from "../src/lib/ai/images";
import { moderateText } from "../src/lib/ai/moderation";
import { runAgent } from "../src/lib/lab/agents";
import { scenarioFor } from "../src/content/lab/scenarios";
import { agentSchema } from "../src/lib/ai/schemas";
import { DomainError } from "../src/lib/errors";
// Real provider smoke using fictional data only; no auth, billing or Energy bypass.
try {
  const provider = aiProvider();
  const signal = AbortSignal.timeout(180000);
  const model = process.env.AI_TEXT_MODEL || "gpt-5.4-mini";
  const request = {
    model,
    system: childSystem,
    messages: [
      { role: "user" as const, content: "Напиши две изречения за измислен робот в библиотека." },
    ],
    maxOutputTokens: 1500,
    signal,
  };
  await moderateText(provider, request.messages[0].content, signal, 8000);
  const text = await provider.text(request);
  await moderateText(provider, text.text, signal, 8000);
  console.log("Text and input/output moderation OK", {
    characters: text.text.length,
    usage: text.usage,
  });
  const scene = await readFile("public/lab/space.png");
  const vision = await generateStructured(
    provider,
    {
      ...request,
      image: `data:image/png;base64,${scene.toString("base64")}`,
      messages: [{ role: "user", content: "Преброй ракетите и звездите в сцената." }],
    },
    z.object({ rockets: z.number().int(), stars: z.number().int() }).strict(),
  );
  console.log("Structured vision OK", {
    counts: vision.value,
    knownFacts: { rockets: 2, stars: 3 },
  });
  const agent = await runAgent(
    provider,
    agentSchema.parse({
      mission: "Открий животното. Първо прочети body, после провери отговора.",
      tools: ["read_clue", "check_answer"],
      finishCondition: "Правилно проверено животно",
      maxSteps: 4,
      maxToolCalls: 4,
    }),
    scenarioFor("secret-animal", 0),
    { model, maxOutputTokens: 1200, maxSteps: 4, maxToolCalls: 4, signal, seed: 0 },
  );
  console.log("Agent structured tools", { solved: agent.solved, steps: agent.steps.length });
  if (!agent.solved) throw new DomainError("agent_smoke", "Агентът не реши тестовата задача.");
  if (!process.argv.includes("--text-only")) {
    const generated = await generateImage(provider, {
      model: process.env.AI_IMAGE_MODEL || "gpt-image-2",
      prompt:
        "Child-safe cartoon of a small fictional purple robot holding a red book in a library. No people, no text.",
      signal,
    });
    await mkdir(".test-data/ai-smoke", { recursive: true });
    await writeFile(".test-data/ai-smoke/image.jpg", Buffer.from(generated.base64, "base64"), {
      mode: 0o600,
    });
    console.log("Image and image moderation OK; private local artifact saved.");
  }
} catch (error) {
  console.error(
    error instanceof DomainError
      ? `${error.code}: ${error.message}`
      : `AI smoke failed (${error instanceof Error ? error.name : "unknown"}).`,
  );
  process.exitCode = 1;
}
