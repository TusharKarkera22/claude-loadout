#!/usr/bin/env node
import { exportProfile } from "./modules/export/index.js";
import { sanitizeBundle } from "./modules/sanitize/index.js";
import { installProfile } from "./modules/install/index.js";
import {
  listProfiles,
  removeProfile,
  showProfile,
  updateProfile,
} from "./modules/manage/index.js";

type Subcommand =
  | "export"
  | "sanitize"
  | "install"
  | "list"
  | "update"
  | "remove"
  | "show";

const KNOWN: Subcommand[] = [
  "export",
  "sanitize",
  "install",
  "list",
  "update",
  "remove",
  "show",
];

async function main(argv: string[]): Promise<number> {
  const sub = argv[0] as Subcommand | undefined;
  if (!sub || !KNOWN.includes(sub)) {
    console.error(
      `usage: claude-profiles <${KNOWN.join("|")}> [args]\n` +
        `(v0.1 scaffold — module bodies are stubs; see TODO comments)`,
    );
    return 1;
  }

  // TODO(v0.1): proper arg parsing (e.g., zod-based) and config loading from
  // claude-profiles.config.json, with sensible defaults when absent.
  switch (sub) {
    case "export":
      await exportProfile({} as never);
      return 0;
    case "sanitize":
      await sanitizeBundle("", {} as never);
      return 0;
    case "install":
      await installProfile({} as never);
      return 0;
    case "list":
      await listProfiles("");
      return 0;
    case "update":
      await updateProfile("", "");
      return 0;
    case "remove":
      await removeProfile("", "");
      return 0;
    case "show":
      await showProfile("", "");
      return 0;
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
