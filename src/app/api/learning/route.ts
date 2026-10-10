import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { requireApiUser } from "@/lib/auth/session";
import { verifyOrigin, rateLimit } from "@/lib/security";
import { answerSchema } from "@/lib/content/schema";
import {
  answerQuestion,
  completeStep,
  finishQuiz,
  startLesson,
  startQuiz,
} from "@/lib/learning/service";
import { errorResponse, readJson } from "@/lib/http";

const base = { childId: z.uuid() };
const schema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("start"), lessonId: z.uuid() }),
  z.object({
    ...base,
    action: z.literal("step"),
    lessonId: z.uuid(),
    step: z.number().int().min(0),
    version: z.number().int().positive(),
    answer: answerSchema.optional(),
  }),
  z.object({ ...base, action: z.literal("quiz"), lessonId: z.uuid() }),
  z.object({
    ...base,
    action: z.literal("answer"),
    attemptId: z.uuid(),
    questionId: z.string().max(80),
    answer: answerSchema,
  }),
  z.object({ ...base, action: z.literal("finish"), attemptId: z.uuid() }),
]);
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const user = await requireApiUser();
    await rateLimit(user.id, "learning", 120);
    const input = schema.parse(await readJson(request));
    let result;
    switch (input.action) {
      case "start":
        result = await startLesson(db(), user.id, input.childId, input.lessonId);
        break;
      case "step":
        result = await completeStep(
          db(),
          user.id,
          input.childId,
          input.lessonId,
          input.step,
          input.version,
          input.answer,
        );
        break;
      case "quiz":
        result = await startQuiz(db(), user.id, input.childId, input.lessonId);
        break;
      case "answer":
        result = await answerQuestion(
          db(),
          user.id,
          input.childId,
          input.attemptId,
          input.questionId,
          input.answer,
        );
        break;
      case "finish":
        result = await finishQuiz(db(), user.id, input.childId, input.attemptId);
        break;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
