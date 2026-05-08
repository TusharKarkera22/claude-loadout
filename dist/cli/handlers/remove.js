import { removeProfile } from "../../modules/manage/index.js";
export async function runRemove(parsed, config) {
    const alias = parsed.positional[0];
    if (!alias) {
        process.stderr.write("usage: claude-loadout remove <alias>\n");
        return 1;
    }
    const profilesDir = parsed.flags["profiles-dir"] ??
        config.install.profilesDir;
    await removeProfile(profilesDir, alias);
    process.stdout.write(`Removed "${alias}" from ${profilesDir}.\n`);
    return 0;
}
//# sourceMappingURL=remove.js.map