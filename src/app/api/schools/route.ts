import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { children, users } from "@/db/schema";
import { requireApiUser } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/auth/supabase";
import { verifyOrigin, rateLimit } from "@/lib/security";
import { readJson, errorResponse } from "@/lib/http";
import { assert } from "@/lib/errors";
import { ownedChild } from "@/lib/learning/service";
import { getPremiumEntitlement } from "@/lib/ai/entitlement";
import * as schools from "@/lib/schools/service";
import { schoolList, schoolView, parentSchoolView } from "@/lib/schools/view";
export const runtime = "nodejs";
const response = (value: unknown) =>
  NextResponse.json(value, { headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: Request) {
  try {
    const user = await requireApiUser(),
      q = new URL(request.url).searchParams;
    if (q.get("parent") === "true") return response(await parentSchoolView(db(), user.id));
    const id = q.get("schoolId");
    return response(
      id
        ? await schoolView(
            db(),
            user.id,
            z.uuid().parse(id),
            q.get("classId") ? z.uuid().parse(q.get("classId")) : undefined,
            z.coerce
              .number()
              .int()
              .min(1)
              .max(10000)
              .parse(q.get("page") || 1),
            z.coerce
              .number()
              .int()
              .min(1)
              .max(10000)
              .parse(q.get("invitePage") || 1),
          )
        : await schoolList(db(), user.id),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const user = await requireApiUser();
    await rateLimit(user.id, "school_actions", 40);
    const { action, data } = z
      .object({
        action: z.enum([
          "school",
          "contract",
          "contract_status",
          "staff",
          "class",
          "invites",
          "revoke_invite",
          "revoke_batch",
          "enrollment",
          "redeem",
          "leave",
          "funding",
        ]),
        data: z.record(z.string(), z.unknown()),
      })
      .strict()
      .parse(await readJson(request));
    const database = db();
    let result: unknown;
    switch (action) {
      case "school":
        result = await schools.saveSchool(database, user.id, data);
        break;
      case "contract":
        result = await schools.createContract(database, user.id, data);
        break;
      case "contract_status":
        result = await schools.setContractStatus(
          database,
          user.id,
          z.uuid().parse(data.schoolId),
          z.uuid().parse(data.id),
          z.enum(["active", "suspended"]).parse(data.status),
        );
        break;
      case "staff":
        result = await schools.saveStaff(database, user.id, data);
        break;
      case "class":
        result = await schools.saveClass(database, user.id, data);
        break;
      case "invites":
        result = await schools.createInvites(database, user.id, data);
        break;
      case "revoke_invite":
        result = await schools.revokeInvite(
          database,
          user.id,
          z.uuid().parse(data.schoolId),
          z.uuid().parse(data.id),
        );
        break;
      case "enrollment":
        result = await schools.updateEnrollment(
          database,
          user.id,
          z.uuid().parse(data.schoolId),
          z.uuid().parse(data.id),
          data.classId ? z.uuid().parse(data.classId) : undefined,
        );
        break;
      case "revoke_batch":
        result = await schools.revokeInviteBatch(
          database,
          user.id,
          z.uuid().parse(data.schoolId),
          z.uuid().parse(data.batchId),
        );
        break;
      case "redeem":
        await rateLimit(user.id, "school_redeem", 10, 900);
        result = await schools.redeemInvite(
          database,
          user.id,
          z.uuid().parse(data.childId),
          z.string().trim().max(48).parse(data.code),
        );
        break;
      case "leave":
      case "funding": {
        await rateLimit(user.id, "school_parent_confirmation", 5, 300);
        const childId = z.uuid().parse(data.childId);
        await ownedChild(database, user.id, childId);
        const password = z.string().min(8).max(128).parse(data.password),
          supabase = await supabaseServer();
        const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
        assert(!error, "Паролата е невалидна.", "unauthorized", 401);
        if (action === "leave") result = await schools.leaveSchool(database, user.id, childId);
        else {
          const preference = z.enum(["auto", "family"]).parse(data.preference);
          result = await database.transaction(async (tx) => {
            await tx.select().from(users).where(eq(users.id, user.id)).for("update");
            const child = await ownedChild(tx, user.id, childId, true);
            if (preference === "family")
              assert(
                await getPremiumEntitlement(tx, user.id),
                "Нямаш активен семеен абонамент.",
                "premium",
                403,
              );
            await tx
              .update(children)
              .set({ energyPreference: preference })
              .where(eq(children.id, child.id));
            return { ok: true };
          });
        }
        break;
      }
    }
    return response(result);
  } catch (error) {
    return errorResponse(error);
  }
}
