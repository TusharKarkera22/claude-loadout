import { listProfiles } from "../../modules/manage/index.js";
import type { Config } from "../../config/loader.js";
import type { ParsedFlags } from "../parse-args.js";

export async function runList(
  parsed: ParsedFlags,
  config: Config,
): Promise<number> {
  const profilesDir =
    (parsed.flags["profiles-dir"] as string | undefined) ??
    config.install.profilesDir;
  const profiles = await listProfiles(profilesDir);
  if (profiles.length === 0) {
    process.stdout.write(`No profiles installed in ${profilesDir}.\n`);
    return 0;
  }
  process.stdout.write(`Installed profiles in ${profilesDir}:\n`);
  for (const p of profiles) {
    process.stdout.write(
      `  ${p.alias.padEnd(40)} v${p.manifest.version}  by @${p.manifest.author.handle}` +
        (p.installedAt ? `  (${p.installedAt.split("T")[0]})` : "") +
        "\n",
    );
  }
  return 0;
}
