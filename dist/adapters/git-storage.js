import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
const SHORTHAND = /^([\w.-]+)\/([\w.-]+)$/;
function resolveSource(source) {
    if (SHORTHAND.test(source))
        return `https://github.com/${source}.git`;
    return source;
}
export class GitStorageAdapter {
    id = "git";
    async fetch(source, options = {}) {
        const url = resolveSource(source);
        const dir = await mkdtemp(join(tmpdir(), "claude-loadout-"));
        const git = simpleGit();
        const cloneArgs = options.shallow ? ["--depth", "1"] : [];
        if (options.ref)
            cloneArgs.push("--branch", options.ref);
        await git.clone(url, dir, cloneArgs);
        const head = await simpleGit(dir).revparse(["HEAD"]);
        return { localPath: dir, resolvedRef: head.trim() };
    }
    async publish(_localPath, _target, _options) {
        // TODO(v0.1): init repo if absent, stage, commit with options.message,
        // optionally push to target remote. See plan: Module A "optional Git init".
        throw new Error("GitStorageAdapter.publish: not implemented in v0.1 scaffold");
    }
    async cleanup(localPath) {
        await rm(localPath, { recursive: true, force: true });
    }
}
//# sourceMappingURL=git-storage.js.map