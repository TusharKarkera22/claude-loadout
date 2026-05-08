import type { ProfileManifest } from "../../manifest/schema.js";

export interface ExportOptions {
  outputDir: string;
  include: {
    claudeMd: boolean;
    skills: boolean;
    commands: boolean;
    agents: boolean;
    hooks: boolean;
  };
  author: { handle: string; displayName?: string };
  name: string;
  version: string;
  description: string;
  gitInit?: boolean;
  skipSanitize?: boolean;
}

export interface ExportResult {
  manifest: ProfileManifest;
  outputDir: string;
  itemCount: number;
}

/**
 * Module A — Profile Export.
 *
 * TODO(v0.1):
 *   1. Discover items in user's Claude Code config (project + ~/.claude).
 *      Use fast-glob over: CLAUDE.md, .claude/skills/**, .claude/commands/**,
 *      .claude/agents/**. Honor `include` toggles.
 *   2. Run sanitize pass unless skipSanitize === true.
 *   3. Copy items into outputDir under matching subpaths.
 *   4. Build ProfileManifest, write outputDir/profile.json.
 *   5. If gitInit, run `git init && git add . && git commit -m "Initial profile"`.
 */
export async function exportProfile(_options: ExportOptions): Promise<ExportResult> {
  throw new Error("exportProfile: not implemented in v0.1 scaffold");
}
