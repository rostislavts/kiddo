import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { requireApiUser } from "@/lib/auth/session";
import { verifyOrigin } from "@/lib/security";
import { errorResponse, readJson } from "@/lib/http";
import {
  saveAISettings,
  saveChallenge,
  saveFeaturedMission,
  saveLabAchievement,
  labAdmin,
} from "@/lib/lab/admin";
import { grantEnergy } from "@/lib/ai/energy";
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const user = await requireApiUser();
    await labAdmin(db(), user.id);
    const { action, data } = z
      .object({
        action: z.enum(["settings", "challenge", "mission", "achievement", "grant"]),
        data: z.record(z.string(), z.unknown()),
      })
      .strict()
      .parse(await readJson(request));
    let result: unknown;
    if (action === "settings")
      result = await saveAISettings(
        db(),
        user.id,
        data.configuration,
        z.number().int().parse(data.version),
      );
    if (action === "challenge") result = await saveChallenge(db(), user.id, data);
    if (action === "mission") result = await saveFeaturedMission(db(), user.id, data);
    if (action === "achievement") result = await saveLabAchievement(db(), user.id, data);
    if (action === "grant")
      result = await grantEnergy(
        db(),
        user.id,
        z.uuid().parse(data.userId),
        z.number().int().parse(data.amount),
        z.uuid().parse(data.requestId),
      );
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
