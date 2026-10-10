import { NextResponse } from "next/server";
import { db } from "@/db";
import { paddle } from "@/lib/billing/paddle";
import { billingEventSchema, processBillingEvent } from "@/lib/billing/webhooks";
import { readText, errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET;
  if (!secret || !process.env.PADDLE_API_KEY)
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  let raw: string;
  try {
    raw = await readText(request, 1_000_000);
  } catch (error) {
    return errorResponse(error);
  }
  let verified;
  try {
    verified = await paddle().webhooks.unmarshal(
      raw,
      secret,
      request.headers.get("paddle-signature") || "",
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const event = billingEventSchema.parse(verified);
    await processBillingEvent(db(), event);
    return NextResponse.json({ received: true });
  } catch {
    // No payload, email, tokens or payment details in logs. Non-2xx asks Paddle to retry.
    console.error("Paddle event processing failed", {
      eventId: verified.eventId,
      eventType: verified.eventType,
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
