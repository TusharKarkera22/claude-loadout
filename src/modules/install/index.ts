import type { StorageAdapter } from "../../adapters/storage.interface.js";
import type { ProfileManifest } from "../../manifest/schema.js";

export interface InstallOptions {
  source: string;
  storage: StorageAdapter;
  profilesDir: string;
  namespacePrefix: string;
  allowHookImport: boolean;
  alias?: string;
  ref?: string;
  yes?: boolean;
}

export interface InstallResult {
  manifest: ProfileManifest;
  installedAt: string;
  resolvedRef: string;
  importedItems: number;
  skippedItems: number;
}

/**
 * Module C — Profile Install.
 *
 * TODO(v0.1):
 *   1. storage.fetch(source, { shallow: true, ref }) -> tmp dir.
 *   2. loadManifest(<tmp>/profile.json); validate Claude Code version compat.
 *   3. Detect collisions in profilesDir; prompt for --as <alias> if needed.
 *   4. Show plan (added items, namespaced names) and confirm unless yes === true.
 *   5. Move bundle to profilesDir/<author-handle>-<name>/.
 *   6. Register namespaced aliases (skills/commands/agents) in active config.
 *   7. SAFETY: skip items[].type === "hook" unless allowHookImport === true.
 *   8. Surface CLAUDE.md as @author/CLAUDE.md, do NOT auto-merge.
 */
export async function installProfile(_options: InstallOptions): Promise<InstallResult> {
  throw new Error("installProfile: not implemented in v0.1 scaffold");
}
