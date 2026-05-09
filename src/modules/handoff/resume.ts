import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";
import { GitStorageAdapter } from "../../adapters/git-storage.js";
import {
  loadHandoffManifest,
  type HandoffManifest,
} from "../../manifest/handoff-schema.js";

export interface ResumeHandoffOptions {
  /** Git URL, owner/repo shorthand, or local path to a handoff bundle directory. */
  source: string;
  /** Bob's working git repo where the patch should be applied. */
  repoDir: string;
  /** Apply the patch (default true). When false, the bundle is fetched + validated only. */
  apply?: boolean;
  /** Checkout Alice's branch (default true). When false, Bob stays on his current branch. */
  checkout?: boolean;
  /** Allow proceeding when Bob's working tree is dirty (default false). */
  allowDirty?: boolean;
  /**
   * Optional confirmation hook called immediately before applying the patch.
   * When provided and it returns false, the apply is skipped and applied=false
   * in the result. The CLI installs a TTY-aware readline prompt; tests pass
   * a deterministic function. When omitted, no confirmation is requested.
   */
  confirmApply?: () => Promise<boolean>;
  /** Optional warning sink for non-fatal messages (e.g. baseCommit-missing fallback). */
  onWarn?: (message: string) => void;
  /**
   * Optional informational sink. Receives the diff stat banner (output of
   * `git apply --stat <patch>`) and similar context lines.
   */
  onInfo?: (message: string) => void;
}

export interface ResumeHandoffResult {
  manifest: HandoffManifest;
  bundleDir: string;
  applied: boolean;
  /** Name of the branch Bob is now on, if a checkout happened. */
  branchSwitched?: string;
  /** Whether `manifest.baseCommit` was found in Bob's local history. */
  baseCommitAvailable: boolean;
}

async function isLocalBundle(source: string): Promise<boolean> {
  try {
    const s = await stat(source);
    if (!s.isDirectory()) return false;
    const m = await stat(join(source, "handoff.json")).catch(() => null);
    return !!m && m.isFile();
  } catch {
    return false;
  }
}

async function isWorkingTreeClean(git: SimpleGit): Promise<boolean> {
  const status = await git.status();
  return status.isClean();
}

async function hasCommit(repoDir: string, sha: string): Promise<boolean> {
  // simple-git's `raw()` swallows non-zero exits for `cat-file -e`, so we
  // shell out directly and read the exit code.
  return await new Promise((resolve) => {
    const child = spawn("git", ["cat-file", "-e", sha], {
      cwd: repoDir,
      stdio: "ignore",
    });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

async function localBranchExists(git: SimpleGit, name: string): Promise<boolean> {
  try {
    await git.raw(["rev-parse", "--verify", `refs/heads/${name}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resume an Alice → Bob handoff: fetch the bundle, validate, optionally
 * checkout Alice's branch, and apply her uncommitted diff to Bob's tree.
 */
export async function resumeHandoff(
  opts: ResumeHandoffOptions,
): Promise<ResumeHandoffResult> {
  const apply = opts.apply ?? true;
  const checkout = opts.checkout ?? true;
  const allowDirty = opts.allowDirty ?? false;
  const warn = opts.onWarn ?? (() => {});

  // Step 1 — fetch the bundle (or use it in place when source is a local dir).
  let bundleDir: string;
  let storageCleanup: (() => Promise<void>) | undefined;
  if (await isLocalBundle(opts.source)) {
    bundleDir = opts.source;
  } else {
    const adapter = new GitStorageAdapter();
    const fetched = await adapter.fetch(opts.source);
    bundleDir = fetched.localPath;
    storageCleanup = () => adapter.cleanup(fetched.localPath);
  }

  try {
    // Step 2 — validate manifest.
    const manifestPath = join(bundleDir, "handoff.json");
    const validated = await loadHandoffManifest(manifestPath);
    if (!validated.ok) {
      throw new Error(
        `invalid handoff manifest: ${validated.errors.join("; ")}`,
      );
    }
    const manifest = validated.manifest;

    // Step 3 — work against Bob's repo.
    const git = simpleGit(opts.repoDir);
    const isRepo = await git.checkIsRepo().catch(() => false);
    if (!isRepo) {
      throw new Error(`not a git repository: ${opts.repoDir}`);
    }

    if (!allowDirty && !(await isWorkingTreeClean(git))) {
      throw new Error(
        `Bob's working tree is dirty. Commit or stash, or pass --allow-dirty.`,
      );
    }

    const baseCommitAvailable = await hasCommit(opts.repoDir, manifest.baseCommit);
    if (!baseCommitAvailable) {
      warn(
        `baseCommit ${manifest.baseCommit} is not present in this repo; ` +
          `falling back to plain git apply (no 3-way merge).`,
      );
    }

    // Step 4 — optional branch checkout.
    let branchSwitched: string | undefined;
    if (checkout) {
      const targetBranch = manifest.branch;
      const exists = await localBranchExists(git, targetBranch);
      if (exists) {
        await git.checkout(targetBranch);
      } else if (baseCommitAvailable) {
        await git.checkoutBranch(targetBranch, manifest.baseCommit);
      } else {
        // No baseCommit locally — branch off current HEAD.
        await git.checkoutLocalBranch(targetBranch);
      }
      branchSwitched = targetBranch;
    }

    // Step 5 — diff stat preview + optional confirm + apply.
    let applied = false;
    if (manifest.diffFile) {
      const patchPath = join(bundleDir, manifest.diffFile);

      // Always render the diff stat — it's the primary "scope at a glance"
      // signal, useful even in review-only (`--no-apply`) mode.
      try {
        const stat = (await git.raw(["apply", "--stat", patchPath])).trim();
        if (stat && opts.onInfo) opts.onInfo(stat);
      } catch {
        // Stat failures shouldn't block the apply prompt; the apply itself
        // will surface a clearer error if the patch is unusable.
      }

      if (apply) {
        const proceed = opts.confirmApply ? await opts.confirmApply() : true;
        if (proceed) {
          const args = baseCommitAvailable
            ? ["apply", "--3way", patchPath]
            : ["apply", patchPath];
          await git.raw(args);
          applied = true;
        }
      }
    }

    return {
      manifest,
      bundleDir,
      applied,
      ...(branchSwitched && { branchSwitched }),
      baseCommitAvailable,
    };
  } finally {
    if (storageCleanup) {
      await storageCleanup().catch(() => {});
    }
  }
}
