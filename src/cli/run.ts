import { ZodError } from "zod";
import { loadConfig } from "../config/loader.js";
import { parseFlags } from "./parse-args.js";
import { runExport } from "./handlers/export.js";
import { runSanitize } from "./handlers/sanitize.js";
import { runInstall } from "./handlers/install.js";
import { runList } from "./handlers/list.js";
import { runShow } from "./handlers/show.js";
import { runRemove } from "./handlers/remove.js";
import { runUpdate } from "./handlers/update.js";
import { runHandoff } from "./handlers/handoff.js";

const SUBCOMMANDS = [
  "export",
  "sanitize",
  "install",
  "list",
  "show",
  "remove",
  "update",
  "handoff",
] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

function isSubcommand(value: string | undefined): value is Subcommand {
  return value !== undefined && (SUBCOMMANDS as readonly string[]).includes(value);
}

const USAGE = `claude-loadout <subcommand> [options]

Subcommands:
  export    Bundle current Claude Code config into a portable profile
  sanitize  Scan a bundle for secrets, paths, and env assignments
  install   Install a profile from a Git source (or shorthand owner/repo)
  list      List installed profiles
  show      Print a profile manifest
  update    Re-fetch and re-install an installed profile
  remove    Uninstall a profile
  handoff   Capture or resume a team handoff (subcommands: create, resume, push)
`;

export async function runCli(argv: string[]): Promise<number> {
  const sub = argv[0];
  if (!isSubcommand(sub)) {
    process.stderr.write(USAGE);
    return 1;
  }

  const parsed = parseFlags(argv.slice(1));
  const config = await loadConfig(process.cwd());

  try {
    switch (sub) {
      case "export":
        return await runExport(parsed, config);
      case "sanitize":
        return await runSanitize(parsed, config);
      case "install":
        return await runInstall(parsed, config);
      case "list":
        return await runList(parsed, config);
      case "show":
        return await runShow(parsed, config);
      case "remove":
        return await runRemove(parsed, config);
      case "update":
        return await runUpdate(parsed, config);
      case "handoff":
        return await runHandoff(parsed, config);
    }
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues
        .map((i) => `--${i.path.join(".") || "<arg>"}: ${i.message}`)
        .join("\n  ");
      process.stderr.write(`error: invalid arguments\n  ${issues}\n`);
      return 1;
    }
    process.stderr.write(
      `error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }
}
