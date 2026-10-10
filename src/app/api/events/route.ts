import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { analytics } from "@/db/schema";
import { requireApiUser } from "@/lib/auth/session";
import { ownedChild } from "@/lib/learning/service";
import { verifyOrigin, rateLimit } from "@/lib/security";
import { readJson, errorResponse } from "@/lib/http";
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const user = await requireApiUser();
    await rateLimit(user.id, "events", 60);
    const input = z
      .object({
        event: z.enum(["world_viewed", "premium_gate_viewed"]),
        worldId: z.uuid(),
        childId: z.uuid(),
      })
      .parse(await readJson(request));
    await ownedChild(db(), user.id, input.childId);
    await db()
      .insert(analytics)
      .values({
        userId: user.id,
        childId: input.childId,
        event: input.event,
        properties: { world_id: input.worldId },
      });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
