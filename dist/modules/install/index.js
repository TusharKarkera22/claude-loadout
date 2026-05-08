import { copyFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ProfileItemSchema, } from "../../manifest/schema.js";
import { loadManifest } from "../../manifest/validator.js";
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[A-Za-z0-9.-]+)?$/;
function compareSemver(a, b) {
    const ma = SEMVER.exec(a);
    const mb = SEMVER.exec(b);
    if (!ma || !mb) {
        throw new Error(`Cannot compare versions: "${a}" vs "${b}"`);
    }
    for (let i = 1; i <= 3; i++) {
        const ai = Number(ma[i]);
        const bi = Number(mb[i]);
        if (ai !== bi)
            return ai < bi ? -1 : 1;
    }
    return 0;
}
function defaultAlias(manifest) {
    return `${manifest.author.handle}-${manifest.name}`;
}
async function pathExists(path) {
    try {
        await stat(path);
        return true;
    }
    catch {
        return false;
    }
}
async function copyTree(src, dst) {
    const s = await stat(src);
    if (s.isDirectory()) {
        await mkdir(dst, { recursive: true });
        for (const entry of await readdir(src)) {
            await copyTree(join(src, entry), join(dst, entry));
        }
    }
    else if (s.isFile()) {
        await mkdir(dirname(dst), { recursive: true });
        await copyFile(src, dst);
    }
}
function partitionItems(items, allowHookImport) {
    const imported = [];
    const skipped = [];
    for (const item of items) {
        // Defensive validation in case manifest came from untrusted source.
        const parsed = ProfileItemSchema.parse(item);
        if (parsed.type === "hook" && !allowHookImport) {
            skipped.push(parsed);
        }
        else {
            imported.push(parsed);
        }
    }
    return { imported, skipped };
}
/**
 * Module C — Profile Install.
 *
 * v0.1 safety boundary: declarative items only. Hook items are skipped unless
 * allowHookImport is explicitly true. Imported CLAUDE.md is copied into the
 * install root but is NOT merged into the user's own CLAUDE.md — the namespace
 * is preserved by directory location (.claude-loadout/<alias>/CLAUDE.md).
 */
export async function installProfile(options) {
    let fetched;
    try {
        fetched = await options.storage.fetch(options.source, {
            shallow: true,
            ...(options.ref && { ref: options.ref }),
        });
        const manifestPath = join(fetched.localPath, "profile.json");
        const validation = await loadManifest(manifestPath);
        if (!validation.ok) {
            throw new Error(`Invalid profile.json at ${options.source}: ${validation.errors.join("; ")}`);
        }
        const manifest = validation.manifest;
        if (manifest.claudeCodeMinVersion &&
            options.claudeCodeVersion &&
            compareSemver(options.claudeCodeVersion, manifest.claudeCodeMinVersion) < 0) {
            throw new Error(`Profile requires Claude Code >= ${manifest.claudeCodeMinVersion}; ` +
                `host reports ${options.claudeCodeVersion}. Upgrade and retry.`);
        }
        const alias = options.alias ?? defaultAlias(manifest);
        const installRoot = join(options.profilesDir, alias);
        if (await pathExists(installRoot)) {
            throw new Error(`Profile alias "${alias}" already installed at ${installRoot}. ` +
                `Use --as <alias> to install side-by-side, or remove the existing one first.`);
        }
        const { imported, skipped } = partitionItems(manifest.items, options.allowHookImport);
        await mkdir(installRoot, { recursive: true });
        // Copy declared items (validated paths only — never copy whole bundle blindly).
        for (const item of imported) {
            const src = join(fetched.localPath, item.path);
            const dst = join(installRoot, item.path);
            if (!(await pathExists(src))) {
                throw new Error(`Manifest references missing file: ${item.path}. Refusing partial install.`);
            }
            const s = await stat(src);
            if (s.isDirectory()) {
                await copyTree(src, dst);
            }
            else {
                await mkdir(dirname(dst), { recursive: true });
                await copyFile(src, dst);
            }
        }
        // Persist the manifest itself so manage commands don't need to re-fetch.
        await copyFile(manifestPath, join(installRoot, "profile.json"));
        const installedAt = new Date().toISOString();
        const meta = {
            alias,
            source: options.source,
            resolvedRef: fetched.resolvedRef,
            installedAt,
            manifestVersion: manifest.version,
        };
        await writeFile(join(installRoot, ".install.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
        return {
            manifest,
            alias,
            installedAt,
            resolvedRef: fetched.resolvedRef,
            importedItems: imported.length,
            skippedItems: skipped.length,
            installRoot,
        };
    }
    finally {
        // Best-effort cleanup of the fetch tmp dir. Adapter's own cleanup is
        // optional; we own the tmp once it's been handed back.
        if (fetched) {
            const adapter = options.storage;
            if (typeof adapter.cleanup === "function") {
                await adapter.cleanup(fetched.localPath).catch(() => { });
            }
            else {
                await rm(fetched.localPath, { recursive: true, force: true }).catch(() => { });
            }
        }
    }
}
//# sourceMappingURL=index.js.map