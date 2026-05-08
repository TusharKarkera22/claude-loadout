import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export interface ProvenanceInfo {
  marketplace: string;
  plugin: string;
}

async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function listDirs(parent: string): Promise<string[]> {
  try {
    const entries = await readdir(parent, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function recordSkills(
  skillsDir: string,
  marketplace: string,
  plugin: string,
  map: Map<string, ProvenanceInfo>,
): Promise<void> {
  if (!(await isDir(skillsDir))) return;
  for (const skill of await listDirs(skillsDir)) {
    if (!map.has(skill)) map.set(skill, { marketplace, plugin });
  }
}

/**
 * Index every plugin-installed skill discoverable under `<claudeRoot>/plugins/`.
 *
 * Two layouts are walked:
 *   1. Marketplace source clones:
 *        <root>/plugins/marketplaces/<m>/plugins/<p>/skills/<skill>/
 *        <root>/plugins/marketplaces/<m>/external_plugins/<p>/skills/<skill>/
 *   2. Active plugin caches (where Claude Code actually loads from):
 *        <root>/plugins/cache/<m>/<p>/<version>/skills/<skill>/
 *
 * Both are needed because some plugins (notably "inline"-style ones whose
 * skills sit in cache only) never appear under marketplaces/. If the same
 * skill name is found in multiple sources, the first match wins; that is
 * sufficient for the "fyi" annotation v0.1.3 ships.
 */
export async function detectPluginProvenance(
  claudeRoot: string,
): Promise<Map<string, ProvenanceInfo>> {
  const map = new Map<string, ProvenanceInfo>();

  // Layout 1 — marketplace source clones.
  const marketplacesDir = join(claudeRoot, "plugins", "marketplaces");
  if (await isDir(marketplacesDir)) {
    for (const marketplace of await listDirs(marketplacesDir)) {
      for (const bucket of ["plugins", "external_plugins"] as const) {
        const bucketDir = join(marketplacesDir, marketplace, bucket);
        if (!(await isDir(bucketDir))) continue;
        for (const plugin of await listDirs(bucketDir)) {
          await recordSkills(
            join(bucketDir, plugin, "skills"),
            marketplace,
            plugin,
            map,
          );
        }
      }
    }
  }

  // Layout 2 — active plugin caches: cache/<m>/<p>/<version>/skills/<skill>.
  const cacheDir = join(claudeRoot, "plugins", "cache");
  if (await isDir(cacheDir)) {
    for (const marketplace of await listDirs(cacheDir)) {
      const marketplaceDir = join(cacheDir, marketplace);
      for (const plugin of await listDirs(marketplaceDir)) {
        const pluginDir = join(marketplaceDir, plugin);
        for (const version of await listDirs(pluginDir)) {
          await recordSkills(
            join(pluginDir, version, "skills"),
            marketplace,
            plugin,
            map,
          );
        }
      }
    }
  }

  return map;
}
