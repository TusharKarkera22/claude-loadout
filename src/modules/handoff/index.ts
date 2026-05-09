import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  HandoffManifestSchema,
  type HandoffManifest,
} from "../../manifest/handoff-schema.js";
import {
  sanitizeBundle,
  type SanitizeFinding,
  type SanitizeOptions,
} from "../sanitize/index.js";
import { captureDiff, getGitState } from "./git-state.js";

export interface CreateHandoffOptions {
  source: string;
  summaryPath: string;
  outDir: string;
  authorHandle: string;
  authorDisplayName?: string;
  authorUrl?: string;
  id?: string;
  todos?: { text: string; done?: boolean }[];
  claudeCodeMinVersion?: string;
  /** When true, sanitize findings are reported in the result instead of throwing. */
  allowFindings?: boolean;
  /** Override sanitize options. Defaults to redactAbsolutePaths/EnvAssignments off. */
  sanitize?: Partial<SanitizeOptions>;
}

export interface CreateHandoffResult {
  bundleDir: string;
  manifest: HandoffManifest;
  findings: SanitizeFinding[];
  hasUncommittedChanges: boolean;
}

async function isDirEmptyOrAbsent(path: string): Promise<boolean> {
  try {
    const entries = await readdir(path);
    return entries.length === 0;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw err;
  }
}

async function fileNonEmpty(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

function defaultId(handle: string, when: Date): string {
  const yyyy = when.getUTCFullYear();
  const mm = String(when.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(when.getUTCDate()).padStart(2, "0");
  const hh = String(when.getUTCHours()).padStart(2, "0");
  const mi = String(when.getUTCMinutes()).padStart(2, "0");
  return `${handle.toLowerCase()}-${yyyy}${mm}${dd}-${hh}${mi}`;
}

/**
 * Create a team handoff bundle: summary + git diff + manifest, scanned for secrets.
 */
export async function createHandoff(
  opts: CreateHandoffOptions,
): Promise<CreateHandoffResult> {
  // Pre-flight checks
  if (!(await isDirEmptyOrAbsent(opts.outDir))) {
    throw new Error(
      `Output directory ${opts.outDir} exists and is not empty. ` +
        `Refusing to overwrite. Pick a fresh path or remove the existing one.`,
    );
  }

  const summaryStat = await stat(opts.summaryPath).catch(() => null);
  if (!summaryStat || !summaryStat.isFile()) {
    throw new Error(`summary file not found: ${opts.summaryPath}`);
  }
  if (!(await fileNonEmpty(opts.summaryPath))) {
    throw new Error(`summary file is empty: ${opts.summaryPath}`);
  }

  // Capture git state and diff
  const gitState = await getGitState(opts.source);
  const diff = await captureDiff(opts.source);
  const hasDiff = diff.trim().length > 0;

  // Write bundle
  await mkdir(opts.outDir, { recursive: true });
  await copyFile(opts.summaryPath, join(opts.outDir, "handoff.md"));
  if (hasDiff) {
    await writeFile(join(opts.outDir, "changes.patch"), diff, "utf8");
  }

  // Build manifest
  const createdAt = new Date();
  const id = opts.id ?? defaultId(opts.authorHandle, createdAt);
  const baseManifest: HandoffManifest = {
    schemaVersion: 1,
    id,
    author: {
      handle: opts.authorHandle,
      ...(opts.authorDisplayName && { displayName: opts.authorDisplayName }),
      ...(opts.authorUrl && { url: opts.authorUrl }),
    },
    createdAt: createdAt.toISOString(),
    branch: gitState.branch,
    baseCommit: gitState.baseCommit,
    ...(gitState.repoUrl && { repoUrl: gitState.repoUrl }),
    summaryFile: "handoff.md",
    ...(hasDiff && { diffFile: "changes.patch" as const }),
    ...(opts.todos &&
      opts.todos.length > 0 && {
        todos: opts.todos.map((t) => ({ text: t.text, done: t.done ?? false })),
      }),
    ...(opts.claudeCodeMinVersion && {
      claudeCodeMinVersion: opts.claudeCodeMinVersion,
    }),
  };

  // Sanitize the bundle
  const sanitizeOpts: SanitizeOptions = {
    allow: opts.sanitize?.allow ?? [],
    deny: opts.sanitize?.deny ?? [],
    redactAbsolutePaths: opts.sanitize?.redactAbsolutePaths ?? false,
    redactEnvAssignments: opts.sanitize?.redactEnvAssignments ?? false,
  };
  const sanitizeResult = await sanitizeBundle(opts.outDir, sanitizeOpts);

  const highSeverity = sanitizeResult.findings.filter(
    (f) => f.severity === "high",
  );
  if (highSeverity.length > 0 && !opts.allowFindings) {
    throw new Error(
      `sanitize blocked handoff: ${highSeverity.length} high-severity finding(s). ` +
        `First match: ${highSeverity[0]!.rule} at ${highSeverity[0]!.file}:${highSeverity[0]!.line}. ` +
        `Re-run with --allow-findings if you have already reviewed.`,
    );
  }

  const manifest: HandoffManifest = {
    ...baseManifest,
    sanitized: {
      findings: sanitizeResult.findings.length,
      lastScanAt: new Date().toISOString(),
    },
  };

  // Write the manifest after sanitize so it carries findings count.
  // Re-validate as a final guarantee.
  const validated = HandoffManifestSchema.parse(manifest);
  await writeFile(
    join(opts.outDir, "handoff.json"),
    `${JSON.stringify(validated, null, 2)}\n`,
    "utf8",
  );

  return {
    bundleDir: opts.outDir,
    manifest: validated,
    findings: sanitizeResult.findings,
    hasUncommittedChanges: hasDiff,
  };
}

// Re-export for callers that want lower-level access.
export { captureDiff, getGitState };
