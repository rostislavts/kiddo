// Each published mission/escape run has its own attempt budget. Editing a
// challenge creates a new version; existing rewards remain keyed to challenge ID.
export function attemptContext(
  input: { missionId?: string; escapeRunId?: string },
  version: number,
) {
  return `${input.escapeRunId ? `escape:${input.escapeRunId}` : input.missionId ? `mission:${input.missionId}` : "challenge"}:v${version}`;
}
