import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";

interface RunGitResult {
  stdout: string;
  stderr: string;
  code: number;
}

function runGit(
  args: string[],
  opts: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<RunGitResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr?.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });
  });
}

export interface GitState {
  branch: string;
  baseCommit: string;
  repoUrl?: string;
}

/**
 * Read the branch / HEAD / origin URL from a working git repo.
 * Throws a clear error if the path is not a git repo.
 */
export async function getGitState(repoDir: string): Promise<GitState> {
  const git = simpleGit(repoDir);
  const isRepo = await git.checkIsRepo().catch(() => false);
  if (!isRepo) {
    throw new Error(`not a git repository: ${repoDir}`);
  }

  const branch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
  const baseCommit = (await git.revparse(["HEAD"])).trim();

  let repoUrl: string | undefined;
  try {
    const url = (await git.raw(["remote", "get-url", "origin"])).trim();
    if (url) repoUrl = url;
  } catch {
    // No origin — leave undefined.
  }

  return { branch, baseCommit, ...(repoUrl ? { repoUrl } : {}) };
}

/**
 * Capture working-tree + index + untracked changes against HEAD as a single
 * binary-safe patch.
 *
 * Uses a throwaway index (via GIT_INDEX_FILE) populated from HEAD via
 * `git read-tree`, then `git add -A` stages everything in the temp index.
 * The real index is untouched and we don't depend on copying its file.
 *
 * Shells out to `git` directly because simple-git's safety plugins block a
 * handful of env vars (EDITOR, GIT_EDITOR, PAGER, ...) that the user's
 * environment commonly carries.
 *
 * Returns the empty string when the tree is clean and no untracked files exist.
 */
export async function captureDiff(repoDir: string): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), "claude-loadout-idx-"));
  const tmpIndex = join(tmpDir, "index");
  try {
    const env = { ...process.env, GIT_INDEX_FILE: tmpIndex };

    // Populate the temp index from HEAD's tree.
    const readTree = await runGit(["read-tree", "HEAD"], { cwd: repoDir, env });
    if (readTree.code !== 0) {
      throw new Error(`git read-tree HEAD failed: ${readTree.stderr.trim()}`);
    }

    // Stage all changes (tracked + untracked + deletions) into the temp index.
    const add = await runGit(["add", "-A"], { cwd: repoDir, env });
    if (add.code !== 0) {
      throw new Error(`git add -A failed: ${add.stderr.trim()}`);
    }

    // Diff the temp index against HEAD with binary chunks.
    const diff = await runGit(["diff", "--cached", "HEAD", "--binary"], {
      cwd: repoDir,
      env,
    });
    if (diff.code !== 0) {
      throw new Error(`git diff failed: ${diff.stderr.trim()}`);
    }
    return diff.stdout;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
