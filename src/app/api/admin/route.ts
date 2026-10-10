import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { requireApiUser } from "@/lib/auth/session";
import { assert } from "@/lib/errors";
import { verifyOrigin, rateLimit } from "@/lib/security";
import { readJson, errorResponse } from "@/lib/http";
import { lessonInput, saveLesson, saveWorld, worldInput } from "@/lib/admin/service";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("world"), data: worldInput }),
  z.object({ action: z.literal("lesson"), data: lessonInput }),
]);
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const user = await requireApiUser();
    assert(user.role === "admin", "Нямаш достъп.", "forbidden", 403);
    await rateLimit(user.id, "admin", 30);
    const input = schema.parse(await readJson(request, 500_000));
    const result =
      input.action === "world"
        ? await saveWorld(db(), user.id, input.data)
        : await saveLesson(db(), user.id, input.data);
    return NextResponse.json({ id: result.id });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: error.issues
            .slice(0, 8)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("\n"),
        },
        { status: 400 },
      );
    return errorResponse(error);
  }
}
