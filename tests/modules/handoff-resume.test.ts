import { describe, expect, test } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import { createHandoff } from "../../src/modules/handoff/index.js";
import { resumeHandoff } from "../../src/modules/handoff/resume.js";
import { makeGitFixture } from "../helpers/git-fixture.js";
import { tmp } from "../helpers/tmp.js";

const baseSummary = `# What I was working on
Test handoff.

# What's pending
- [ ] item one
`;

async function writeSummary(content = baseSummary): Promise<string> {
  const dir = await tmp("claude-loadout-summary-");
  const path = join(dir, "summary.md");
  await writeFile(path, content, "utf8");
  return path;
}

describe("resumeHandoff — happy path", () => {
  test("clones Alice's bundle, validates manifest, applies patch on Bob's repo", async () => {
    const aliceWork = await makeGitFixture({
      branch: "feature/x",
      commits: [[{ path: "src/a.ts", content: "export const x = 1;\n" }]],
      uncommitted: [{ path: "src/a.ts", content: "export const x = 2;\n" }],
    });

    // Bob = fresh clone of Alice's repo → shared history (so baseCommit lands).
    const bob = await tmp("bob-");
    await simpleGit().clone(aliceWork.dir, bob);
    await simpleGit(bob).addConfig("user.name", "Bob");
    await simpleGit(bob).addConfig("user.email", "b@e.com");
    await simpleGit(bob).addConfig("commit.gpgsign", "false");

    const summaryPath = await writeSummary();
    const bundle = join(await tmp(), "hb");
    await createHandoff({
      source: aliceWork.dir,
      summaryPath,
      outDir: bundle,
      authorHandle: "alice",
    });

    const result = await resumeHandoff({ source: bundle, repoDir: bob });

    expect(result.applied).toBe(true);
    expect(result.baseCommitAvailable).toBe(true);
    expect(result.manifest.branch).toBe("feature/x");

    const content = await readFile(join(bob, "src/a.ts"), "utf8");
    expect(content).toContain("export const x = 2");
  });
});

describe("resumeHandoff — checkout default", () => {
  test("checks out Alice's branch by default, creating it if absent", async () => {
    const aliceWork = await makeGitFixture({
      branch: "feature/x",
      commits: [[{ path: "src/a.ts", content: "x\n" }]],
      uncommitted: [{ path: "src/a.ts", content: "y\n" }],
    });
    const bob = await tmp("bob-");
    await simpleGit().clone(aliceWork.dir, bob);
    await simpleGit(bob).addConfig("user.name", "Bob");
    await simpleGit(bob).addConfig("user.email", "b@e.com");
    await simpleGit(bob).addConfig("commit.gpgsign", "false");
    // Bob is currently on "feature/x" because he cloned a repo whose default
    // is feature/x. Move him to a fresh local "main" branch first.
    await simpleGit(bob).checkoutBranch("main", "HEAD");

    const summaryPath = await writeSummary();
    const bundle = join(await tmp(), "hb");
    await createHandoff({
      source: aliceWork.dir,
      summaryPath,
      outDir: bundle,
      authorHandle: "alice",
    });

    const result = await resumeHandoff({ source: bundle, repoDir: bob });

    expect(result.branchSwitched).toBe("feature/x");
    const currentBranch = (await simpleGit(bob).revparse(["--abbrev-ref", "HEAD"])).trim();
    expect(currentBranch).toBe("feature/x");
    expect(result.applied).toBe(true);
  });

  test("--no-checkout keeps Bob on his current branch", async () => {
    const aliceWork = await makeGitFixture({
      branch: "feature/x",
      commits: [[{ path: "src/a.ts", content: "x\n" }]],
      uncommitted: [{ path: "src/a.ts", content: "y\n" }],
    });
    const bob = await tmp("bob-");
    await simpleGit().clone(aliceWork.dir, bob);
    await simpleGit(bob).addConfig("user.name", "Bob");
    await simpleGit(bob).addConfig("user.email", "b@e.com");
    await simpleGit(bob).addConfig("commit.gpgsign", "false");
    await simpleGit(bob).checkoutBranch("main", "HEAD");

    const summaryPath = await writeSummary();
    const bundle = join(await tmp(), "hb");
    await createHandoff({
      source: aliceWork.dir,
      summaryPath,
      outDir: bundle,
      authorHandle: "alice",
    });

    const result = await resumeHandoff({
      source: bundle,
      repoDir: bob,
      checkout: false,
    });

    expect(result.branchSwitched).toBeUndefined();
    const currentBranch = (await simpleGit(bob).revparse(["--abbrev-ref", "HEAD"])).trim();
    expect(currentBranch).toBe("main");
    expect(result.applied).toBe(true);
  });
});

describe("resumeHandoff — base commit fallback", () => {
  test("warns and falls back to plain apply when baseCommit is missing locally", async () => {
    // Alice's uncommitted change creates a NEW file — so the patch applies
    // cleanly even when Bob's history doesn't contain Alice's baseCommit.
    const aliceWork = await makeGitFixture({
      branch: "feature/x",
      commits: [[{ path: "src/existing.ts", content: "ok\n" }]],
      uncommitted: [{ path: "src/new-file.ts", content: "fresh content\n" }],
    });
    const bob = await makeGitFixture({
      branch: "main",
      commits: [[{ path: "unrelated.ts", content: "bob-only\n" }]],
      user: { name: "Bob Tester", email: "bob@example.com" },
    });

    const summaryPath = await writeSummary();
    const bundle = join(await tmp(), "hb");
    await createHandoff({
      source: aliceWork.dir,
      summaryPath,
      outDir: bundle,
      authorHandle: "alice",
    });

    const warnings: string[] = [];
    const result = await resumeHandoff({
      source: bundle,
      repoDir: bob.dir,
      checkout: false,
      onWarn: (msg) => warnings.push(msg),
    });

    expect(result.baseCommitAvailable).toBe(false);
    expect(warnings.some((w) => /falling back/i.test(w))).toBe(true);
    expect(result.applied).toBe(true);
    const content = await readFile(join(bob.dir, "src/new-file.ts"), "utf8");
    expect(content).toContain("fresh content");
  });
});

describe("resumeHandoff — dirty tree", () => {
  test("refuses by default when Bob's working tree is dirty", async () => {
    const aliceWork = await makeGitFixture({
      branch: "feature/x",
      commits: [[{ path: "src/a.ts", content: "x\n" }]],
      uncommitted: [{ path: "src/a.ts", content: "y\n" }],
    });
    const bob = await tmp("bob-");
    await simpleGit().clone(aliceWork.dir, bob);
    await simpleGit(bob).addConfig("user.name", "Bob");
    await simpleGit(bob).addConfig("user.email", "b@e.com");
    await simpleGit(bob).addConfig("commit.gpgsign", "false");
    await simpleGit(bob).checkoutBranch("main", "HEAD");
    // Make Bob's tree dirty
    await writeFile(join(bob, "src/a.ts"), "bob-edit\n", "utf8");

    const summaryPath = await writeSummary();
    const bundle = join(await tmp(), "hb");
    await createHandoff({
      source: aliceWork.dir,
      summaryPath,
      outDir: bundle,
      authorHandle: "alice",
    });

    await expect(
      resumeHandoff({ source: bundle, repoDir: bob }),
    ).rejects.toThrow(/dirty|uncommitted/i);
  });

  test("--allow-dirty proceeds despite a dirty tree", async () => {
    const aliceWork = await makeGitFixture({
      branch: "feature/x",
      commits: [[{ path: "other.ts", content: "0\n" }]],
      uncommitted: [{ path: "other.ts", content: "1\n" }],
    });
    const bob = await tmp("bob-");
    await simpleGit().clone(aliceWork.dir, bob);
    await simpleGit(bob).addConfig("user.name", "Bob");
    await simpleGit(bob).addConfig("user.email", "b@e.com");
    await simpleGit(bob).addConfig("commit.gpgsign", "false");
    await simpleGit(bob).checkoutBranch("main", "HEAD");
    // Bob has an unrelated dirty change
    await writeFile(join(bob, "bob-only.ts"), "alpha\n", "utf8");

    const summaryPath = await writeSummary();
    const bundle = join(await tmp(), "hb");
    await createHandoff({
      source: aliceWork.dir,
      summaryPath,
      outDir: bundle,
      authorHandle: "alice",
    });

    const result = await resumeHandoff({
      source: bundle,
      repoDir: bob,
      allowDirty: true,
      checkout: false,
    });

    expect(result.applied).toBe(true);
    const content = await readFile(join(bob, "other.ts"), "utf8");
    expect(content).toContain("1");
  });
});

describe("resumeHandoff — review only", () => {
  test("--no-apply returns manifest without modifying Bob's tree", async () => {
    const aliceWork = await makeGitFixture({
      branch: "feature/x",
      commits: [[{ path: "src/a.ts", content: "x\n" }]],
      uncommitted: [{ path: "src/a.ts", content: "y\n" }],
    });
    const bob = await tmp("bob-");
    await simpleGit().clone(aliceWork.dir, bob);
    await simpleGit(bob).addConfig("user.name", "Bob");
    await simpleGit(bob).addConfig("user.email", "b@e.com");
    await simpleGit(bob).addConfig("commit.gpgsign", "false");

    const summaryPath = await writeSummary();
    const bundle = join(await tmp(), "hb");
    await createHandoff({
      source: aliceWork.dir,
      summaryPath,
      outDir: bundle,
      authorHandle: "alice",
    });

    const result = await resumeHandoff({
      source: bundle,
      repoDir: bob,
      apply: false,
      checkout: false,
    });

    expect(result.applied).toBe(false);
    const content = await readFile(join(bob, "src/a.ts"), "utf8");
    expect(content).toBe("x\n");
  });
});

describe("resumeHandoff — confirm + diff stat", () => {
  test("calls confirmApply before applying and skips when it returns false", async () => {
    const aliceWork = await makeGitFixture({
      branch: "feature/x",
      commits: [[{ path: "src/a.ts", content: "x\n" }]],
      uncommitted: [{ path: "src/a.ts", content: "y\n" }],
    });
    const bob = await tmp("bob-");
    await simpleGit().clone(aliceWork.dir, bob);
    await simpleGit(bob).addConfig("user.name", "Bob");
    await simpleGit(bob).addConfig("user.email", "b@e.com");
    await simpleGit(bob).addConfig("commit.gpgsign", "false");

    const summaryPath = await writeSummary();
    const bundle = join(await tmp(), "hb");
    await createHandoff({
      source: aliceWork.dir,
      summaryPath,
      outDir: bundle,
      authorHandle: "alice",
    });

    let confirmCalled = 0;
    const result = await resumeHandoff({
      source: bundle,
      repoDir: bob,
      checkout: false,
      confirmApply: async () => {
        confirmCalled++;
        return false;
      },
    });

    expect(confirmCalled).toBe(1);
    expect(result.applied).toBe(false);
    const content = await readFile(join(bob, "src/a.ts"), "utf8");
    expect(content).toBe("x\n"); // unchanged
  });

  test("calls confirmApply and applies when it returns true", async () => {
    const aliceWork = await makeGitFixture({
      branch: "feature/x",
      commits: [[{ path: "src/a.ts", content: "x\n" }]],
      uncommitted: [{ path: "src/a.ts", content: "y\n" }],
    });
    const bob = await tmp("bob-");
    await simpleGit().clone(aliceWork.dir, bob);
    await simpleGit(bob).addConfig("user.name", "Bob");
    await simpleGit(bob).addConfig("user.email", "b@e.com");
    await simpleGit(bob).addConfig("commit.gpgsign", "false");

    const summaryPath = await writeSummary();
    const bundle = join(await tmp(), "hb");
    await createHandoff({
      source: aliceWork.dir,
      summaryPath,
      outDir: bundle,
      authorHandle: "alice",
    });

    const result = await resumeHandoff({
      source: bundle,
      repoDir: bob,
      checkout: false,
      confirmApply: async () => true,
    });

    expect(result.applied).toBe(true);
  });

  test("emits a diff stat to onInfo before applying", async () => {
    const aliceWork = await makeGitFixture({
      branch: "feature/x",
      commits: [[{ path: "src/a.ts", content: "x\n" }]],
      uncommitted: [{ path: "src/a.ts", content: "y\n" }],
    });
    const bob = await tmp("bob-");
    await simpleGit().clone(aliceWork.dir, bob);
    await simpleGit(bob).addConfig("user.name", "Bob");
    await simpleGit(bob).addConfig("user.email", "b@e.com");
    await simpleGit(bob).addConfig("commit.gpgsign", "false");

    const summaryPath = await writeSummary();
    const bundle = join(await tmp(), "hb");
    await createHandoff({
      source: aliceWork.dir,
      summaryPath,
      outDir: bundle,
      authorHandle: "alice",
    });

    const infos: string[] = [];
    await resumeHandoff({
      source: bundle,
      repoDir: bob,
      checkout: false,
      onInfo: (msg) => infos.push(msg),
    });

    const joined = infos.join("\n");
    expect(joined).toMatch(/src\/a\.ts/);
    // `git apply --stat` output contains "1 file changed" or similar.
    expect(joined.toLowerCase()).toMatch(/file|insertion|deletion|\+|-/);
  });
});

describe("resumeHandoff — manifest validation", () => {
  test("rejects a bundle with an invalid manifest", async () => {
    const dir = await tmp();
    const bundle = join(dir, "hb");
    const fs = await import("node:fs/promises");
    await fs.mkdir(bundle, { recursive: true });
    await fs.writeFile(join(bundle, "handoff.json"), JSON.stringify({ schemaVersion: 2 }));
    await fs.writeFile(join(bundle, "handoff.md"), "x");

    const bob = await makeGitFixture({});
    await expect(
      resumeHandoff({ source: bundle, repoDir: bob.dir }),
    ).rejects.toThrow(/manifest|schema/i);
  });
});
