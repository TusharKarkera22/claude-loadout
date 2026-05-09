import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";
import { tmp } from "./tmp.js";

export interface GitFixtureFile {
  path: string;
  content: string;
}

export interface GitFixtureOptions {
  branch?: string;
  commits?: GitFixtureFile[][];
  uncommitted?: GitFixtureFile[];
  remoteUrl?: string;
  user?: { name: string; email: string };
}

export interface GitFixture {
  dir: string;
  git: SimpleGit;
  initialCommit: string;
  headCommit: string;
}

const DEFAULT_USER = { name: "Fixture Author", email: "fixture@example.com" };

async function writeFixtureFiles(
  root: string,
  files: GitFixtureFile[],
): Promise<void> {
  for (const f of files) {
    const abs = join(root, f.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, f.content, "utf8");
  }
}

/**
 * Build a temp git repo for tests. Cleans up via the `tmp` helper's afterEach.
 *
 * - `commits`: an array of commit batches; each batch is a set of files written
 *   in order and committed together. The first batch becomes the initial commit.
 *   If `commits` is empty/omitted, an empty initial commit is created so HEAD exists.
 * - `uncommitted`: files written after the last commit, left in the working tree.
 * - `remoteUrl`: set as `origin`. Pass a path to a bare repo for push tests.
 */
export async function makeGitFixture(
  opts: GitFixtureOptions = {},
): Promise<GitFixture> {
  const dir = await tmp("claude-loadout-git-");
  const git = simpleGit(dir);

  const branch = opts.branch ?? "main";
  await git.init(["--initial-branch", branch]);
  const user = opts.user ?? DEFAULT_USER;
  await git.addConfig("user.name", user.name);
  await git.addConfig("user.email", user.email);
  await git.addConfig("commit.gpgsign", "false");

  let initialCommit = "";
  let headCommit = "";

  const commits = opts.commits ?? [];
  if (commits.length === 0) {
    await git.commit("initial empty", [], { "--allow-empty": null });
    headCommit = (await git.revparse(["HEAD"])).trim();
    initialCommit = headCommit;
  } else {
    for (let i = 0; i < commits.length; i++) {
      const batch = commits[i]!;
      await writeFixtureFiles(dir, batch);
      await git.add(".");
      await git.commit(`commit ${i + 1}`);
      headCommit = (await git.revparse(["HEAD"])).trim();
      if (i === 0) initialCommit = headCommit;
    }
  }

  if (opts.uncommitted && opts.uncommitted.length > 0) {
    await writeFixtureFiles(dir, opts.uncommitted);
  }

  if (opts.remoteUrl) {
    await git.addRemote("origin", opts.remoteUrl);
  }

  return { dir, git, initialCommit, headCommit };
}

/**
 * Build a bare repo on disk to act as a push target for publish tests.
 * Defaults its HEAD to `main` so a fresh clone after a `main` push checks out
 * cleanly without a "remote HEAD refers to nonexistent ref" warning.
 */
export async function makeBareRepo(): Promise<string> {
  const dir = await tmp("claude-loadout-bare-");
  await simpleGit(dir).init(["--bare", "--initial-branch", "main"]);
  return dir;
}
