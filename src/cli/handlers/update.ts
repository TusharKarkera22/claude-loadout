import { GitStorageAdapter } from "../../adapters/git-storage.js";
import { updateProfile } from "../../modules/manage/index.js";
import type { Config } from "../../config/loader.js";
import type { ParsedFlags } from "../parse-args.js";

export async function runUpdate(
  parsed: ParsedFlags,
  config: Config,
): Promise<number> {
  const alias = parsed.positional[0];
  if (!alias) {
    process.stderr.write("usage: claude-loadout update <alias> [--ref <ref>]\n");
    return 1;
  }
  const profilesDir =
    (parsed.flags["profiles-dir"] as string | undefined) ??
    config.install.profilesDir;
  const ref = parsed.flags.ref as string | undefined;

  const refreshed = await updateProfile(profilesDir, alias, {
    storage: new GitStorageAdapter(),
    allowHookImport: config.install.allowHookImport,
    ...(ref && { ref }),
  });
  process.stdout.write(
    `Updated "${refreshed.alias}" → v${refreshed.manifest.version} (ref=${refreshed.installedRef}).\n`,
  );
  return 0;
}
