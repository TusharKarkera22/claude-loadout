import { type ProfileManifest } from "../../manifest/schema.js";
/**
 * Source layout the export module walks.
 * - "project": looks under `<source>/.claude/skills/`, etc. — the layout every
 *   Claude Code project repo uses.
 * - "user":    looks under `<source>/skills/`, etc. — the layout of the
 *   user-level config at `~/.claude/`.
 */
export type ExportScope = "project" | "user";
export interface ExportOptions {
    sourceDir: string;
    outputDir: string;
    scope?: ExportScope;
    include: {
        claudeMd: boolean;
        skills: boolean;
        commands: boolean;
        agents: boolean;
        hooks: boolean;
    };
    author: {
        handle: string;
        displayName?: string;
        url?: string;
    };
    name: string;
    version: string;
    description: string;
    claudeCodeMinVersion?: string;
    tags?: string[];
}
export interface ExportResult {
    manifest: ProfileManifest;
    outputDir: string;
    itemCount: number;
}
/**
 * Module A — Profile Export.
 *
 * Discovers items in the user's Claude Code config (project-level by default,
 * or whichever directory is passed as sourceDir) and bundles them into
 * outputDir along with a validated profile.json.
 */
export declare function exportProfile(options: ExportOptions): Promise<ExportResult>;
/** Helper exported for tests / future re-use; converts an OS path to manifest form. */
export declare function relativePosix(from: string, to: string): string;
