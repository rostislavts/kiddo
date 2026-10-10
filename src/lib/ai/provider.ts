import { z } from "zod";
import { DomainError } from "@/lib/errors";
export type AIUsage = {
  inputTokens: number;
  outputTokens: number;
  images: number;
  reported?: boolean;
  byModel?: Record<
    string,
    { inputTokens: number; outputTokens: number; images: number; reported?: boolean }
  >;
};
export type AIMessage = { role: "user" | "assistant"; content: string };
export type TextRequest = {
  model: string;
  system: string;
  messages: AIMessage[];
  maxOutputTokens: number;
  signal: AbortSignal;
  schema?: Record<string, unknown>;
  image?: string;
};
export type AIResult = { text: string; usage: AIUsage };
export interface AIProvider {
  readonly name: string;
  text(request: TextRequest): Promise<AIResult>;
  image(request: {
    model: string;
    prompt: string;
    signal: AbortSignal;
  }): Promise<{ base64: string; mime: "image/jpeg"; usage: AIUsage }>;
  moderate(request: { text?: string; image?: string; signal: AbortSignal }): Promise<boolean>;
}
async function boundedJson(response: Response, maxBytes: number) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new DomainError(
      response.status === 429 ? "provider_rate_limit" : "provider_error",
      "AI услугата временно не отговаря. Energy ще бъде възстановена.",
      502,
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new DomainError("provider_empty", "AI не върна отговор.", 502);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new DomainError("provider_size", "AI отговорът е прекалено голям.", 502);
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
const usageSchema = z
  .object({
    input_tokens: z.number().nonnegative().optional(),
    output_tokens: z.number().nonnegative().optional(),
  })
  .passthrough();
const responseSchema = z.object({
  status: z.string(),
  output: z.array(
    z.object({
      type: z.string(),
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
    }),
  ),
  usage: usageSchema.optional(),
});
// OpenAI supports nested anyOf; Zod discriminated unions emit oneOf.
// Distinct literal tool tags keep the alternatives mutually exclusive.
export function openAISchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(openAISchema);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, v]) =>
      key === "oneOf"
        ? ["anyOf", openAISchema(v)]
        : key === "const"
          ? ["enum", [v]]
          : [key, openAISchema(v)],
    ),
  );
}
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  constructor(
    private readonly key: string,
    private readonly transport: typeof fetch = fetch,
  ) {}
  private async request(path: string, body: unknown, signal: AbortSignal, maxBytes = 100_000) {
    return boundedJson(
      await this.transport(`https://api.openai.com/v1/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
        redirect: "error",
      }),
      maxBytes,
    );
  }
  async text(request: TextRequest): Promise<AIResult> {
    const input: unknown[] = request.messages.map((m) => ({ role: m.role, content: m.content }));
    if (request.image)
      input.push({
        role: "user",
        content: [{ type: "input_image", image_url: request.image, detail: "low" }],
      });
    const raw = responseSchema.parse(
      await this.request(
        "responses",
        {
          model: request.model,
          store: false,
          instructions: request.system,
          input,
          max_output_tokens: request.maxOutputTokens,
          ...(request.schema
            ? {
                text: {
                  format: {
                    type: "json_schema",
                    name: "lab_result",
                    strict: true,
                    schema: openAISchema(request.schema),
                  },
                },
              }
            : {}),
        },
        request.signal,
      ),
    );
    if (raw.status !== "completed")
      throw new DomainError(
        "provider_incomplete",
        "AI не завърши отговора. Опитай с по-кратка задача.",
        502,
      );
    const parts = raw.output.filter((o) => o.type === "message").flatMap((o) => o.content || []);
    if (parts.some((p) => p.type === "refusal"))
      throw new DomainError("moderated", "Нека изберем безопасна учебна задача.", 422);
    const text = parts
      .filter((p) => p.type === "output_text")
      .map((p) => p.text || "")
      .join("\n");
    if (!text.trim()) throw new DomainError("provider_empty", "AI не върна отговор.", 502);
    return {
      text,
      usage: {
        reported: !!raw.usage,
        inputTokens: raw.usage?.input_tokens ?? 0,
        outputTokens: raw.usage?.output_tokens ?? 0,
        images: 0,
      },
    };
  }
  async image(request: { model: string; prompt: string; signal: AbortSignal }) {
    const raw = z
      .object({
        data: z.array(z.object({ b64_json: z.string().max(6_000_000) })).length(1),
        usage: usageSchema.optional(),
      })
      .parse(
        await this.request(
          "images/generations",
          {
            model: request.model,
            prompt: request.prompt,
            n: 1,
            size: "1024x1024",
            quality: "low",
            output_format: "jpeg",
            moderation: "auto",
          },
          request.signal,
          8_000_000,
        ),
      );
    const bytes = Buffer.from(raw.data[0].b64_json, "base64");
    if (bytes.length > 4_000_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
      throw new DomainError("image_invalid", "Изображението не може да се запази.", 502);
    return {
      base64: raw.data[0].b64_json,
      mime: "image/jpeg" as const,
      usage: {
        reported: !!raw.usage,
        inputTokens: raw.usage?.input_tokens ?? 0,
        outputTokens: raw.usage?.output_tokens ?? 0,
        images: 1,
      },
    };
  }
  async moderate(request: { text?: string; image?: string; signal: AbortSignal }) {
    const input = [
      ...(request.text ? [{ type: "text", text: request.text }] : []),
      ...(request.image ? [{ type: "image_url", image_url: { url: request.image } }] : []),
    ];
    const raw = z
      .object({
        results: z
          .array(
            z.object({
              flagged: z.boolean(),
              category_scores: z.record(z.string(), z.number()).optional(),
            }),
          )
          .min(1),
      })
      .parse(
        await this.request(
          "moderations",
          { model: "omni-moderation-latest", input },
          request.signal,
        ),
      );
    return raw.results.every(
      (r) =>
        !r.flagged &&
        Object.entries(r.category_scores || {}).every(
          ([category, score]) =>
            !["sexual", "sexual/minors", "violence/graphic", "self-harm/instructions"].includes(
              category,
            ) || score < 0.1,
        ),
    );
  }
}
export function aiProvider(): AIProvider {
  if (process.env.AI_PROVIDER !== "openai" || !process.env.AI_API_KEY)
    throw new DomainError(
      "ai_configuration",
      "Лабораторията очаква настройка на AI услугата. Запазените творби са достъпни.",
      503,
    );
  if (process.env.AI_LAB_ENABLED === "false")
    throw new DomainError("ai_paused", "AI лабораторията е временно в почивка.", 503);
  return new OpenAIProvider(process.env.AI_API_KEY);
}
