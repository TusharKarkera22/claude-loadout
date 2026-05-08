import type { StorageAdapter } from "../../adapters/storage.interface.js";
import { type ProfileManifest } from "../../manifest/schema.js";
export interface InstallOptions {
    source: string;
    storage: StorageAdapter;
    profilesDir: string;
    namespacePrefix: string;
    allowHookImport: boolean;
    alias?: string;
    ref?: string;
    yes?: boolean;
    /**
     * Optional Claude Code version of the host. When provided, install fails
     * if the manifest's claudeCodeMinVersion is greater than this value.
     */
    claudeCodeVersion?: string;
}
export interface InstallResult {
    manifest: ProfileManifest;
    alias: string;
    installedAt: string;
    resolvedRef: string;
    importedItems: number;
    skippedItems: number;
    installRoot: string;
}
export interface InstallMetadata {
    alias: string;
    source: string;
    resolvedRef: string;
    installedAt: string;
    manifestVersion: string;
}
/**
 * Module C — Profile Install.
 *
 * v0.1 safety boundary: declarative items only. Hook items are skipped unless
 * allowHookImport is explicitly true. Imported CLAUDE.md is copied into the
 * install root but is NOT merged into the user's own CLAUDE.md — the namespace
 * is preserved by directory location (.claude-loadout/<alias>/CLAUDE.md).
 */
export declare function installProfile(options: InstallOptions): Promise<InstallResult>;
