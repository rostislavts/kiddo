// Basic missions use curated questions and server-side assessment only.
// Live AI calls always pass through the Premium + Energy reservation checks.
// Featured missions and Escape Rooms retain their Premium context.
export function isBasicMission(
  challenge: { type: string } | undefined,
  context: { missionId?: string; escapeRunId?: string } = {},
) {
  return challenge?.type === "detective" && !context.missionId && !context.escapeRunId;
}
