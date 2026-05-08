import { showProfile } from "../../modules/manage/index.js";
import type { Config } from "../../config/loader.js";
import type { ParsedFlags } from "../parse-args.js";

export async function runShow(
  parsed: ParsedFlags,
  config: Config,
): Promise<number> {
  const alias = parsed.positional[0];
  if (!alias) {
    process.stderr.write("usage: claude-loadout show <alias>\n");
    return 1;
  }
  const profilesDir =
    (parsed.flags["profiles-dir"] as string | undefined) ??
    config.install.profilesDir;
  const profile = await showProfile(profilesDir, alias);
  process.stdout.write(JSON.stringify(profile.manifest, null, 2) + "\n");
  return 0;
}
