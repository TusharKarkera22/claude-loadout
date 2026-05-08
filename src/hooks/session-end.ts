/**
 * v0.2 extension point — Team Handoff Archive.
 *
 * On Stop / SessionEnd, capture transcript summary, changed-file diff,
 * and todo state. Write to <profilesDir>/_handoffs/<session-id>.json.
 * Optionally commit + push to a configured handoff branch.
 *
 * Wire-up: register this script as a `Stop` hook in plugin.json once
 * implemented. Currently exported as a stub so the plan's roadmap entry
 * has a concrete file location.
 */
export async function captureHandoff(): Promise<void> {
  throw new Error("captureHandoff: deferred to v0.2");
}
