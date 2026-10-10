"use client";
import { useEffect } from "react";
export function EventTracker({
  event,
  worldId,
  childId,
}: {
  event: "world_viewed" | "premium_gate_viewed";
  worldId: string;
  childId: string;
}) {
  useEffect(() => {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, worldId, childId }),
    }).catch(() => {});
  }, [event, worldId, childId]);
  return null;
}
