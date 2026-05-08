import { readdir, readFile, rm, stat } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { installProfile } from "../install/index.js";
import { loadManifest } from "../../manifest/validator.js";
const InstallMetadataSchema = z.object({
    alias: z.string(),
    source: z.string(),
    resolvedRef: z.string(),
    installedAt: z.string(),
    manifestVersion: z.string(),
});
function assertSafeAlias(profilesDir, alias) {
    if (!alias || alias.includes("\0")) {
        throw new Error(`Invalid alias: ${JSON.stringify(alias)}`);
    }
    if (isAbsolute(alias) || alias.includes(sep) || alias.includes("/")) {
        throw new Error(`Invalid alias "${alias}": aliases must be a single path segment.`);
    }
    const target = resolve(profilesDir, alias);
    const root = resolve(profilesDir);
    const rel = relative(root, target);
    if (rel.startsWith("..") || isAbsolute(rel) || rel === "") {
        throw new Error(`Invalid alias "${alias}": resolves outside profilesDir.`);
    }
    return target;
}
async function readInstalledProfile(profilesDir, alias) {
    const localPath = join(profilesDir, alias);
    const manifestPath = join(localPath, "profile.json");
    const metaPath = join(localPath, ".install.json");
    let s;
    try {
        s = await stat(manifestPath);
    }
    catch {
        return null;
    }
    if (!s.isFile())
        return null;
    const validation = await loadManifest(manifestPath);
    if (!validation.ok)
        return null;
    let installedAt = "";
    let installedRef = "";
    let source = "";
    try {
        const raw = await readFile(metaPath, "utf8");
        const parsed = InstallMetadataSchema.safeParse(JSON.parse(raw));
        if (parsed.success) {
            installedAt = parsed.data.installedAt;
            installedRef = parsed.data.resolvedRef;
            source = parsed.data.source;
        }
    }
    catch {
        // No metadata is tolerable for forward compatibility.
    }
    return {
        manifest: validation.manifest,
        alias,
        installedAt,
        installedRef,
        source,
        localPath,
    };
}
export async function listProfiles(profilesDir) {
    let entries;
    try {
        entries = await readdir(profilesDir);
    }
    catch (err) {
        if (err.code === "ENOENT")
            return [];
        throw err;
    }
    const profiles = [];
    for (const entry of entries) {
        const profile = await readInstalledProfile(profilesDir, entry);
        if (profile)
            profiles.push(profile);
    }
    profiles.sort((a, b) => (a.alias < b.alias ? -1 : a.alias > b.alias ? 1 : 0));
    return profiles;
}
export async function showProfile(profilesDir, alias) {
    assertSafeAlias(profilesDir, alias);
    const profile = await readInstalledProfile(profilesDir, alias);
    if (!profile) {
        throw new Error(`Profile "${alias}" is not installed in ${profilesDir}.`);
    }
    return profile;
}
export async function removeProfile(profilesDir, alias) {
    const target = assertSafeAlias(profilesDir, alias);
    const profile = await readInstalledProfile(profilesDir, alias);
    if (!profile) {
        throw new Error(`Profile "${alias}" is not installed in ${profilesDir}.`);
    }
    // Re-confirm target stays inside profilesDir before unlinking.
    const safeRoot = resolve(profilesDir) + sep;
    if (!normalize(target + sep).startsWith(safeRoot)) {
        throw new Error(`Refusing to remove ${target}: outside profilesDir.`);
    }
    await rm(target, { recursive: true, force: true });
}
/**
 * Re-fetches the profile from its recorded source and re-installs in place.
 * Removes the existing install root only after the new bundle has been
 * validated, so a failed update never corrupts the existing install.
 */
export async function updateProfile(profilesDir, alias, options) {
    assertSafeAlias(profilesDir, alias);
    const existing = await readInstalledProfile(profilesDir, alias);
    if (!existing) {
        throw new Error(`Profile "${alias}" is not installed in ${profilesDir}.`);
    }
    if (!existing.source) {
        throw new Error(`Profile "${alias}" has no recorded source (.install.json missing or stale). ` +
            `Reinstall manually with /profile install <source>.`);
    }
    // Stage to a sibling directory so we can swap atomically.
    const stagingAlias = `${alias}.update-staging`;
    const stagingPath = join(profilesDir, stagingAlias);
    await rm(stagingPath, { recursive: true, force: true });
    await installProfile({
        source: existing.source,
        storage: options.storage,
        profilesDir,
        alias: stagingAlias,
        namespacePrefix: "@",
        allowHookImport: options.allowHookImport ?? false,
        yes: true,
        ...(options.ref && { ref: options.ref }),
        ...(options.claudeCodeVersion && {
            claudeCodeVersion: options.claudeCodeVersion,
        }),
    });
    // Swap: remove existing, rename staging into place.
    await rm(existing.localPath, { recursive: true, force: true });
    const { rename } = await import("node:fs/promises");
    await rename(stagingPath, existing.localPath);
    const refreshed = await readInstalledProfile(profilesDir, alias);
    if (!refreshed) {
        throw new Error(`Update completed but profile "${alias}" failed to reload.`);
    }
    return refreshed;
}
//# sourceMappingURL=index.js.map