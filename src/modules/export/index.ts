import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import fastGlob from "fast-glob";
import {
  ProfileManifestSchema,
  type ProfileItem,
  type ProfileManifest,
} from "../../manifest/schema.js";

export interface ExportOptions {
  sourceDir: string;
  outputDir: string;
  include: {
    claudeMd: boolean;
    skills: boolean;
    commands: boolean;
    agents: boolean;
    hooks: boolean;
  };
  author: { handle: string; displayName?: string; url?: string };
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

interface DiscoveredItem {
  type: ProfileItem["type"];
  /** path relative to sourceDir */
  sourceRelPath: string;
  /** path relative to outputDir */
  bundleRelPath: string;
}

const ITEM_TYPE_DIRS: Array<{
  type: Exclude<ProfileItem["type"], "claude-md">;
  sourceDir: string;
  bundleDir: string;
  globs: string[];
  toggle: keyof ExportOptions["include"];
}> = [
  {
    type: "skill",
    sourceDir: ".claude/skills",
    bundleDir: "skills",
    globs: ["**/*"],
    toggle: "skills",
  },
  {
    type: "command",
    sourceDir: ".claude/commands",
    bundleDir: "commands",
    globs: ["**/*.md"],
    toggle: "commands",
  },
  {
    type: "agent",
    sourceDir: ".claude/agents",
    bundleDir: "agents",
    globs: ["**/*.md"],
    toggle: "agents",
  },
  {
    type: "hook",
    sourceDir: ".claude/hooks",
    bundleDir: "hooks",
    globs: ["**/*"],
    toggle: "hooks",
  },
];

async function isDirEmptyOrAbsent(path: string): Promise<boolean> {
  try {
    const entries = await readdir(path);
    return entries.length === 0;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw err;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

async function discoverItems(
  options: ExportOptions,
): Promise<DiscoveredItem[]> {
  const items: DiscoveredItem[] = [];

  if (options.include.claudeMd) {
    const claudeMd = join(options.sourceDir, "CLAUDE.md");
    if (await fileExists(claudeMd)) {
      items.push({
        type: "claude-md",
        sourceRelPath: "CLAUDE.md",
        bundleRelPath: "CLAUDE.md",
      });
    }
  }

  for (const def of ITEM_TYPE_DIRS) {
    if (!options.include[def.toggle]) continue;
    const absDir = join(options.sourceDir, def.sourceDir);
    const matches = await fastGlob(def.globs, {
      cwd: absDir,
      onlyFiles: true,
      dot: false,
    });
    matches.sort();
    for (const rel of matches) {
      items.push({
        type: def.type,
        sourceRelPath: toPosix(join(def.sourceDir, rel)),
        bundleRelPath: toPosix(join(def.bundleDir, rel)),
      });
    }
  }

  return items;
}

async function copyItems(
  items: DiscoveredItem[],
  options: ExportOptions,
): Promise<void> {
  await mkdir(options.outputDir, { recursive: true });
  for (const item of items) {
    const src = join(options.sourceDir, item.sourceRelPath);
    const dst = join(options.outputDir, item.bundleRelPath);
    await mkdir(dirname(dst), { recursive: true });
    await copyFile(src, dst);
  }
}

function buildManifest(
  items: DiscoveredItem[],
  options: ExportOptions,
): ProfileManifest {
  const manifest: ProfileManifest = {
    schemaVersion: 1,
    name: options.name,
    author: {
      handle: options.author.handle,
      ...(options.author.displayName && {
        displayName: options.author.displayName,
      }),
      ...(options.author.url && { url: options.author.url }),
    },
    version: options.version,
    description: options.description,
    ...(options.claudeCodeMinVersion && {
      claudeCodeMinVersion: options.claudeCodeMinVersion,
    }),
    items: items.map((i) => ({ type: i.type, path: i.bundleRelPath })),
    createdAt: new Date().toISOString(),
    ...(options.tags && options.tags.length > 0 && { tags: options.tags }),
  };
  // Final guarantee that we never write an invalid manifest:
  return ProfileManifestSchema.parse(manifest);
}

/**
 * Module A — Profile Export.
 *
 * Discovers items in the user's Claude Code config (project-level by default,
 * or whichever directory is passed as sourceDir) and bundles them into
 * outputDir along with a validated profile.json.
 */
export async function exportProfile(
  options: ExportOptions,
): Promise<ExportResult> {
  if (!(await isDirEmptyOrAbsent(options.outputDir))) {
    throw new Error(
      `Output directory ${options.outputDir} exists and is not empty. ` +
        `Refusing to overwrite. Pick a fresh path or remove the existing one.`,
    );
  }
  const items = await discoverItems(options);
  await copyItems(items, options);
  const manifest = buildManifest(items, options);
  await writeFile(
    join(options.outputDir, "profile.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return {
    manifest,
    outputDir: options.outputDir,
    itemCount: items.length,
  };
}

/** Helper exported for tests / future re-use; converts an OS path to manifest form. */
export function relativePosix(from: string, to: string): string {
  return toPosix(relative(from, to));
}
