import { removeProfile } from "../../modules/manage/index.js";
import type { Config } from "../../config/loader.js";
import type { ParsedFlags } from "../parse-args.js";

export async function runRemove(
  parsed: ParsedFlags,
  config: Config,
): Promise<number> {
  const alias = parsed.positional[0];
  if (!alias) {
    process.stderr.write("usage: claude-loadout remove <alias>\n");
    return 1;
  }
  const profilesDir =
    (parsed.flags["profiles-dir"] as string | undefined) ??
    config.install.profilesDir;
  await removeProfile(profilesDir, alias);
  process.stdout.write(`Removed "${alias}" from ${profilesDir}.\n`);
  return 0;
}
