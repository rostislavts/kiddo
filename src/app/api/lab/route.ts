import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { requireApiUser } from "@/lib/auth/session";
import { verifyOrigin, rateLimit } from "@/lib/security";
import { readJson, errorResponse } from "@/lib/http";
import { executeAIRun } from "@/lib/lab/runtime";
import { saveProject, deleteProject, saveCard, deleteCard } from "@/lib/lab/projects";
import { submitAssessment, startEscapeRoom } from "@/lib/lab/challenges";
import { labView } from "@/lib/lab/view";
import { ownedChild } from "@/lib/learning/service";
import { analytics } from "@/db/schema";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const childId = z.uuid().parse(new URL(request.url).searchParams.get("childId"));
    return NextResponse.json(await labView(db(), user.id, childId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const user = await requireApiUser();
    await rateLimit(user.id, "lab_actions", 80);
    const body = z
      .object({
        action: z.enum([
          "run",
          "save_project",
          "delete_project",
          "save_card",
          "delete_card",
          "assessment",
          "start_escape",
          "opened",
        ]),
        childId: z.uuid(),
        data: z.record(z.string(), z.unknown()),
      })
      .strict()
      .parse(await readJson(request));
    await ownedChild(db(), user.id, body.childId);
    let value: unknown;
    switch (body.action) {
      case "run":
        value = await executeAIRun(db(), user.id, { ...body.data, childId: body.childId });
        break;
      case "save_project":
        value = await saveProject(db(), user.id, body.childId, body.data);
        break;
      case "delete_project":
        await deleteProject(db(), user.id, body.childId, z.uuid().parse(body.data.id));
        value = { ok: true };
        break;
      case "save_card":
        value = await saveCard(db(), user.id, body.childId, body.data);
        break;
      case "delete_card":
        await deleteCard(db(), user.id, body.childId, z.uuid().parse(body.data.id));
        value = { ok: true };
        break;
      case "assessment":
        value = await submitAssessment(db(), user.id, body.childId, body.data);
        break;
      case "start_escape":
        value = await startEscapeRoom(
          db(),
          user.id,
          body.childId,
          z.uuid().parse(body.data.roomId),
        );
        break;
      case "opened":
        await db()
          .insert(analytics)
          .values({
            userId: user.id,
            childId: body.childId,
            event:
              body.data.feature === "detective" ? "basic_mission_opened" : "premium_feature_opened",
            properties: { feature: z.string().max(40).parse(body.data.feature) },
          });
        value = { ok: true };
        break;
    }
    return NextResponse.json(value, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
