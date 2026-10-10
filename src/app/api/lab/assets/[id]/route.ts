import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { labAssets, children } from "@/db/schema";
import { requireApiUser } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { assert } from "@/lib/errors";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const id = z.uuid().parse((await context.params).id);
    const [row] = await db()
      .select({ asset: labAssets })
      .from(labAssets)
      .innerJoin(children, eq(children.id, labAssets.childId))
      .where(
        and(
          eq(labAssets.id, id),
          eq(children.parentId, user.id),
          gt(labAssets.expiresAt, new Date()),
        ),
      );
    assert(row, "Изображението е изтрито или срокът му изтече.", "not_found", 404);
    return new Response(Buffer.from(row.asset.base64, "base64"), {
      headers: {
        "Content-Type": row.asset.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline; filename=ai-lab-creation.jpg",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
