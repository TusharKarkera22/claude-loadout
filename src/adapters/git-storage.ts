import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import type {
  FetchOptions,
  FetchResult,
  PublishOptions,
  StorageAdapter,
} from "./storage.interface.js";

const SHORTHAND = /^([\w.-]+)\/([\w.-]+)$/;

function resolveSource(source: string): string {
  if (SHORTHAND.test(source)) return `https://github.com/${source}.git`;
  return source;
}

export class GitStorageAdapter implements StorageAdapter {
  readonly id = "git";

  async fetch(source: string, options: FetchOptions = {}): Promise<FetchResult> {
    const url = resolveSource(source);
    const dir = await mkdtemp(join(tmpdir(), "claude-loadout-"));
    const git = simpleGit();
    const cloneArgs = options.shallow ? ["--depth", "1"] : [];
    if (options.ref) cloneArgs.push("--branch", options.ref);
    await git.clone(url, dir, cloneArgs);
    const head = await simpleGit(dir).revparse(["HEAD"]);
    return { localPath: dir, resolvedRef: head.trim() };
  }

  async publish(
    localPath: string,
    target: string,
    options: PublishOptions,
  ): Promise<void> {
    const url = resolveSource(target);
    const git = simpleGit(localPath);

    // Init repo if absent.
    const isRepo = await git.checkIsRepo().catch(() => false);
    if (!isRepo) {
      await git.init(["--initial-branch", "main"]);
    }

    // Ensure user identity is set; fall back to a project default so first-time
    // publishers without a global git config don't get a confusing failure.
    const localCfg = await git.listConfig("local");
    const cfg = localCfg.all;
    if (!cfg["user.name"]) await git.addConfig("user.name", "claude-loadout");
    if (!cfg["user.email"]) {
      await git.addConfig("user.email", "claude-loadout@example.com");
    }

    // Stage every file in the bundle and commit.
    await git.add(".");
    const status = await git.status();
    const hasChanges =
      status.staged.length > 0 ||
      status.created.length > 0 ||
      status.modified.length > 0 ||
      status.deleted.length > 0 ||
      status.renamed.length > 0;
    if (hasChanges) {
      await git.commit(options.message);
    }

    // Set up origin remote (replace if it already points elsewhere).
    const remotes = await git.getRemotes(true);
    const existing = remotes.find((r) => r.name === "origin");
    if (!existing) {
      await git.addRemote("origin", url);
    } else if (existing.refs.push !== url && existing.refs.fetch !== url) {
      await git.remote(["set-url", "origin", url]);
    }

    if (options.push !== false) {
      await git.push("origin", "main", ["--force"]);
    }
  }

  async cleanup(localPath: string): Promise<void> {
    await rm(localPath, { recursive: true, force: true });
  }
}
