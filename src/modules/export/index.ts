import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import fastGlob from "fast-glob";
import {
  ProfileManifestSchema,
  type ProfileItem,
  type ProfileManifest,
  type Provenance,
} from "../../manifest/schema.js";
import type { ProvenanceInfo } from "./provenance.js";

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
  /**
   * Optional map from skill name → plugin source. When provided (typically
   * built by detectPluginProvenance), each manifest item gets a `provenance`
   * field tagging it as `user` or `plugin` with marketplace/plugin metadata.
   * Behaviour is unchanged otherwise — items are still bundled either way.
   */
  pluginProvenance?: Map<string, ProvenanceInfo>;
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
  userAuthoredCount: number;
  pluginDerivedCount: number;
}

interface DiscoveredItem {
  type: ProfileItem["type"];
  /** path relative to sourceDir */
  sourceRelPath: string;
  /** path relative to outputDir */
  bundleRelPath: string;
  /** filled in for skills when a plugin-provenance map is supplied */
  provenance?: Provenance;
}

function provenanceForSkill(
  bundleRelPath: string,
  map: Map<string, ProvenanceInfo> | undefined,
): Provenance {
  if (!map) return { source: "user" };
  // bundleRelPath is "skills/<skill-name>/..."; the directory immediately
  // after "skills/" is the skill name we look up.
  const segments = bundleRelPath.split("/");
  const skillName = segments[1];
  if (skillName && map.has(skillName)) {
    const info = map.get(skillName);
    if (info) {
      return {
        source: "plugin",
        marketplace: info.marketplace,
        plugin: info.plugin,
      };
    }
  }
  return { source: "user" };
}

interface ItemTypeDef {
  type: Exclude<ProfileItem["type"], "claude-md">;
  /** subdir to scan under "project" scope (relative to sourceDir) */
  projectDir: string;
  /** subdir to scan under "user" scope (relative to sourceDir) */
  userDir: string;
  bundleDir: string;
  globs: string[];
  toggle: keyof ExportOptions["include"];
}

const ITEM_TYPE_DIRS: ItemTypeDef[] = [
  {
    type: "skill",
    projectDir: ".claude/skills",
    userDir: "skills",
    bundleDir: "skills",
    globs: ["**/*"],
    toggle: "skills",
  },
  {
    type: "command",
    projectDir: ".claude/commands",
    userDir: "commands",
    bundleDir: "commands",
    globs: ["**/*.md"],
    toggle: "commands",
  },
  {
    type: "agent",
    projectDir: ".claude/agents",
    userDir: "agents",
    bundleDir: "agents",
    globs: ["**/*.md"],
    toggle: "agents",
  },
  {
    type: "hook",
    projectDir: ".claude/hooks",
    userDir: "hooks",
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
  const scope: ExportScope = options.scope ?? "project";

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
    const sourceSubdir = scope === "user" ? def.userDir : def.projectDir;
    const absDir = join(options.sourceDir, sourceSubdir);
    const matches = await fastGlob(def.globs, {
      cwd: absDir,
      onlyFiles: true,
      dot: false,
    });
    matches.sort();
    for (const rel of matches) {
      const bundleRelPath = toPosix(join(def.bundleDir, rel));
      const item: DiscoveredItem = {
        type: def.type,
        sourceRelPath: toPosix(join(sourceSubdir, rel)),
        bundleRelPath,
      };
      if (def.type === "skill" && options.pluginProvenance) {
        item.provenance = provenanceForSkill(
          bundleRelPath,
          options.pluginProvenance,
        );
      }
      items.push(item);
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
    items: items.map((i) => ({
      type: i.type,
      path: i.bundleRelPath,
      ...(i.provenance && { provenance: i.provenance }),
    })),
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
  let pluginDerivedCount = 0;
  for (const item of items) {
    if (item.provenance?.source === "plugin") pluginDerivedCount++;
  }

  return {
    manifest,
    outputDir: options.outputDir,
    itemCount: items.length,
    userAuthoredCount: items.length - pluginDerivedCount,
    pluginDerivedCount,
  };
}

/** Helper exported for tests / future re-use; converts an OS path to manifest form. */
export function relativePosix(from: string, to: string): string {
  return toPosix(relative(from, to));
}
