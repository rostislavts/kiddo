import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { DomainError } from "./errors";
import { appUrl } from "./config";

export function verifyOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(appUrl()).origin)
    throw new DomainError("origin", "Невалиден произход на заявката.", 403);
}
export async function rateLimit(identity: string, action: string, limit = 60, windowSeconds = 60) {
  const now = new Date();
  const bucket = Math.floor(now.getTime() / (windowSeconds * 1000));
  const key = createHash("sha256").update(`${identity}:${action}:${bucket}`).digest("hex");
  const [row] = await db()
    .insert(rateLimits)
    .values({ key, expiresAt: new Date((bucket + 1) * windowSeconds * 1000) })
    .onConflictDoUpdate({ target: rateLimits.key, set: { hits: sql`${rateLimits.hits} + 1` } })
    .returning();
  if (row.hits > limit)
    throw new DomainError("rate_limit", "Нека опитаме отново след минута.", 429);
}
