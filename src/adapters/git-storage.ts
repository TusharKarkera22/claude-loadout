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
    const dir = await mkdtemp(join(tmpdir(), "claude-profiles-"));
    const git = simpleGit();
    const cloneArgs = options.shallow ? ["--depth", "1"] : [];
    if (options.ref) cloneArgs.push("--branch", options.ref);
    await git.clone(url, dir, cloneArgs);
    const head = await simpleGit(dir).revparse(["HEAD"]);
    return { localPath: dir, resolvedRef: head.trim() };
  }

  async publish(
    _localPath: string,
    _target: string,
    _options: PublishOptions,
  ): Promise<void> {
    // TODO(v0.1): init repo if absent, stage, commit with options.message,
    // optionally push to target remote. See plan: Module A "optional Git init".
    throw new Error("GitStorageAdapter.publish: not implemented in v0.1 scaffold");
  }

  async cleanup(localPath: string): Promise<void> {
    await rm(localPath, { recursive: true, force: true });
  }
}
