import { z } from "zod";
import { GitStorageAdapter } from "../../adapters/git-storage.js";
import { installProfile } from "../../modules/install/index.js";
const Schema = z.object({
    as: z.string().optional(),
    ref: z.string().optional(),
    "profiles-dir": z.string().optional(),
    yes: z.union([z.boolean(), z.string()]).optional(),
    "allow-hook-import": z.union([z.boolean(), z.string()]).optional(),
});
function bool(v, fallback) {
    if (typeof v === "boolean")
        return v;
    if (v === undefined)
        return fallback;
    return v !== "false" && v !== "0";
}
export async function runInstall(parsed, config) {
    const source = parsed.positional[0];
    if (!source) {
        process.stderr.write("usage: claude-loadout install <source> [--as <alias>] [--ref <ref>]\n");
        return 1;
    }
    const flags = Schema.parse(parsed.flags);
    const result = await installProfile({
        source,
        storage: new GitStorageAdapter(),
        profilesDir: flags["profiles-dir"] ?? config.install.profilesDir,
        namespacePrefix: config.install.namespacePrefix,
        allowHookImport: bool(flags["allow-hook-import"], config.install.allowHookImport),
        ...(flags.as && { alias: flags.as }),
        ...(flags.ref && { ref: flags.ref }),
        yes: bool(flags.yes, true),
    });
    process.stdout.write(`Installed "${result.alias}" (v${result.manifest.version}) — ` +
        `${result.importedItems} imported, ${result.skippedItems} skipped, ref=${result.resolvedRef}\n` +
        `Path: ${result.installRoot}\n`);
    return 0;
}
//# sourceMappingURL=install.js.map