import { showProfile } from "../../modules/manage/index.js";
export async function runShow(parsed, config) {
    const alias = parsed.positional[0];
    if (!alias) {
        process.stderr.write("usage: claude-loadout show <alias>\n");
        return 1;
    }
    const profilesDir = parsed.flags["profiles-dir"] ??
        config.install.profilesDir;
    const profile = await showProfile(profilesDir, alias);
    process.stdout.write(JSON.stringify(profile.manifest, null, 2) + "\n");
    return 0;
}
//# sourceMappingURL=show.js.map