import { z } from "zod";

const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
const shortText = z.string().trim().min(1).max(500);
const option = z.object({ id, label: shortText });
export const answerSchema = z.union([
  z.array(z.string().max(80)).max(30),
  z.record(z.string().max(80), z.string().max(80)),
]);
export type Answer = z.infer<typeof answerSchema>;

export const questionSchema = z
  .object({
    id,
    type: z.enum(["single_choice", "multiple_choice", "true_false", "ordering", "categorization"]),
    prompt: shortText,
    context: z.string().max(1500).optional(),
    options: z.array(option).min(2).max(12),
    categories: z.array(option).min(2).max(8).optional(),
    correct: answerSchema,
    explanation: shortText,
    hint: shortText,
    difficulty: z.number().int().min(1).max(3).default(1),
    xp: z.number().int().min(0).max(100).default(10),
  })
  .superRefine((q, ctx) => {
    const ids = q.options.map((o) => o.id);
    const invalid = (message: string) => ctx.addIssue({ code: "custom", message });
    if (new Set(ids).size !== ids.length) invalid("Option IDs must be unique");
    if (q.type === "categorization") {
      const categories = q.categories?.map((c) => c.id) ?? [];
      if (
        !categories.length ||
        new Set(categories).size !== categories.length ||
        Array.isArray(q.correct)
      ) {
        invalid("Categorization needs categories and an answer map");
      } else if (
        Object.keys(q.correct).length !== ids.length ||
        ids.some((key) => !categories.includes((q.correct as Record<string, string>)[key]))
      ) {
        invalid("Every option must map to a valid category");
      }
    } else {
      if (!Array.isArray(q.correct)) {
        invalid("Expected an answer array");
        return;
      }
      if (
        !q.correct.length ||
        q.correct.some((key) => !ids.includes(key)) ||
        new Set(q.correct).size !== q.correct.length
      )
        invalid("Invalid correct answer");
      if ((q.type === "single_choice" || q.type === "true_false") && q.correct.length !== 1)
        invalid("Expected one correct answer");
      if (q.type === "true_false" && ids.length !== 2) invalid("True/false requires two choices");
      if (q.type === "ordering" && q.correct.length !== ids.length)
        invalid("Ordering must include every option");
    }
  });
export type Question = z.infer<typeof questionSchema>;
export type PublicQuestion = Omit<Question, "correct" | "explanation">;

const prose = z.object({
  id,
  type: z.enum(["text", "heading", "illustration", "callout", "example"]),
  title: shortText,
  body: z.string().min(1).max(3000),
  visual: z.enum(["robot", "brain", "detective", "data", "sparkles", "shield"]).optional(),
});
const activity = z
  .object({
    id,
    type: z.enum([
      "multiple_choice_activity",
      "sort_activity",
      "categorize_activity",
      "prediction_activity",
    ]),
    title: shortText,
    question: questionSchema,
  })
  .superRefine((block, ctx) => {
    const valid =
      block.type === "sort_activity"
        ? block.question.type === "ordering"
        : block.type === "categorize_activity"
          ? block.question.type === "categorization"
          : ["single_choice", "multiple_choice", "true_false"].includes(block.question.type);
    if (!valid)
      ctx.addIssue({ code: "custom", message: "Activity and question types do not match" });
  });
const quiz = z.object({ id, type: z.literal("quiz"), title: shortText, body: shortText });
export const blockSchema = z.union([prose, activity, quiz]);
export type Block = z.infer<typeof blockSchema>;
export type PublicBlock =
  | Exclude<Block, { question: Question }>
  | (Omit<Extract<Block, { question: Question }>, "question"> & { question: PublicQuestion });
export const lessonContentSchema = z
  .object({
    locale: z.literal("bg-BG"),
    blocks: z.array(blockSchema).min(1).max(40),
    questions: z.array(questionSchema).min(3).max(15),
  })
  .superRefine((content, ctx) => {
    for (const list of [content.blocks, content.questions]) {
      if (new Set(list.map((item) => item.id)).size !== list.length)
        ctx.addIssue({ code: "custom", message: "IDs must be unique within blocks/questions" });
    }
    const quizBlocks = content.blocks.filter((b) => b.type === "quiz");
    if (
      quizBlocks.length > 1 ||
      (quizBlocks.length === 1 && content.blocks.at(-1)?.type !== "quiz")
    )
      ctx.addIssue({ code: "custom", message: "Quiz block must be the final block" });
  });
export type LessonContent = z.infer<typeof lessonContentSchema>;
export function publicQuestion(q: Question): PublicQuestion {
  const { correct: _correct, explanation: _explanation, ...safe } = q;
  void _correct;
  void _explanation;
  return safe;
}
export function publicBlocks(blocks: Block[]): PublicBlock[] {
  return blocks.map((b) => ("question" in b ? { ...b, question: publicQuestion(b.question) } : b));
}

export const criteriaSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("lab"),
    event: z.string().min(1).max(80),
    count: z.number().int().positive().max(1000),
  }),
  z.object({ type: z.literal("lessons"), count: z.number().int().positive() }),
  z.object({ type: z.literal("worlds"), count: z.number().int().positive() }),
  z.object({ type: z.literal("xp"), count: z.number().int().positive() }),
  z.object({ type: z.literal("perfect_quiz") }),
  z.object({ type: z.literal("world"), slug: z.string().min(1) }),
]);
export type Criteria = z.infer<typeof criteriaSchema>;
