import { listProfiles } from "../../modules/manage/index.js";
export async function runList(parsed, config) {
    const profilesDir = parsed.flags["profiles-dir"] ??
        config.install.profilesDir;
    const profiles = await listProfiles(profilesDir);
    if (profiles.length === 0) {
        process.stdout.write(`No profiles installed in ${profilesDir}.\n`);
        return 0;
    }
    process.stdout.write(`Installed profiles in ${profilesDir}:\n`);
    for (const p of profiles) {
        process.stdout.write(`  ${p.alias.padEnd(40)} v${p.manifest.version}  by @${p.manifest.author.handle}` +
            (p.installedAt ? `  (${p.installedAt.split("T")[0]})` : "") +
            "\n");
    }
    return 0;
}
//# sourceMappingURL=list.js.map