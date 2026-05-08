import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { exportProfile } from "../../modules/export/index.js";
import { detectPluginProvenance } from "../../modules/export/provenance.js";
import { sanitizeBundle } from "../../modules/sanitize/index.js";
import type { Config } from "../../config/loader.js";
import type { ParsedFlags } from "../parse-args.js";

const Schema = z.object({
  source: z.string().optional(),
  out: z.string().optional(),
  name: z.string().min(1),
  version: z.string().default("0.1.0"),
  description: z.string().min(1),
  author: z.string().optional(),
  "display-name": z.string().optional(),
  scope: z.enum(["project", "user"]).default("project"),
  "claude-md": z.union([z.boolean(), z.string()]).optional(),
  skills: z.union([z.boolean(), z.string()]).optional(),
  commands: z.union([z.boolean(), z.string()]).optional(),
  agents: z.union([z.boolean(), z.string()]).optional(),
  "include-hooks": z.union([z.boolean(), z.string()]).optional(),
  "skip-sanitize": z.union([z.boolean(), z.string()]).optional(),
});

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === undefined) return fallback;
  return v !== "false" && v !== "0";
}

export async function runExport(
  parsed: ParsedFlags,
  config: Config,
): Promise<number> {
  const flags = Schema.parse(parsed.flags);

  const handle = flags.author ?? config.author?.handle;
  if (!handle) {
    process.stderr.write(
      "error: --author <handle> is required (or set author.handle in claude-loadout.config.json)\n",
    );
    return 1;
  }

  const include = {
    claudeMd: bool(flags["claude-md"], config.export.include.claudeMd),
    skills: bool(flags.skills, config.export.include.skills),
    commands: bool(flags.commands, config.export.include.commands),
    agents: bool(flags.agents, config.export.include.agents),
    hooks: bool(flags["include-hooks"], config.export.include.hooks),
  };

  // Source defaults: scope=user → ~/.claude (the user-level config root);
  // scope=project → cwd. Explicit --source always wins.
  const defaultSource =
    flags.scope === "user"
      ? join(homedir(), ".claude")
      : ".";
  const sourceDir = flags.source ?? defaultSource;

  // Under user scope, index plugin-installed skills so each manifest item
  // gets a provenance tag. Recipients can see what came from which plugin.
  const pluginProvenance =
    flags.scope === "user"
      ? await detectPluginProvenance(sourceDir)
      : undefined;

  const result = await exportProfile({
    sourceDir,
    outputDir: flags.out ?? config.export.outputDir,
    scope: flags.scope,
    ...(pluginProvenance && { pluginProvenance }),
    include,
    author: {
      handle,
      ...(flags["display-name"] && { displayName: flags["display-name"] }),
      ...(config.author?.displayName &&
        !flags["display-name"] && { displayName: config.author.displayName }),
      ...(config.author?.url && { url: config.author.url }),
    },
    name: flags.name,
    version: flags.version,
    description: flags.description,
  });

  if (flags.scope === "user" && result.pluginDerivedCount > 0) {
    const plugins = new Set<string>();
    for (const item of result.manifest.items) {
      if (item.provenance?.source === "plugin" && item.provenance.plugin) {
        plugins.add(item.provenance.plugin);
      }
    }
    process.stderr.write(
      `\nfyi: ${result.userAuthoredCount} user-authored + ${result.pluginDerivedCount} plugin-derived item(s).\n` +
        `Sharing this loadout will give recipients your full lineup, including these plugins:\n` +
        `  ${[...plugins].sort().join(", ")}\n` +
        `Recipients see the source of each item via 'claude-loadout show <alias>'.\n`,
    );
  }

  if (!bool(flags["skip-sanitize"], false)) {
    const findings = await sanitizeBundle(result.outputDir, config.sanitize);
    if (findings.findings.length > 0) {
      process.stderr.write(
        `\nsanitize: found ${findings.findings.length} potential issue(s) across ${findings.scannedFiles} file(s).\n`,
      );
      for (const f of findings.findings.slice(0, 20)) {
        process.stderr.write(
          `  ${f.severity.padEnd(6)} ${f.file}:${f.line}  ${f.rule}  ${f.match}\n`,
        );
      }
      if (findings.findings.length > 20) {
        process.stderr.write(
          `  ... and ${findings.findings.length - 20} more.\n`,
        );
      }
      process.stderr.write(
        `\nReview before publishing. Run: claude-loadout sanitize ${result.outputDir}\n`,
      );
    }
  }

  process.stdout.write(
    `Exported ${result.itemCount} item(s) to ${result.outputDir}\n`,
  );
  return 0;
}
