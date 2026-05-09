import { describe, expect, test } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHandoff } from "../../src/modules/handoff/index.js";
import { HandoffManifestSchema } from "../../src/manifest/handoff-schema.js";
import { makeGitFixture } from "../helpers/git-fixture.js";
import { tmp } from "../helpers/tmp.js";

async function writeSummary(content: string): Promise<string> {
  const dir = await tmp("claude-loadout-summary-");
  const path = join(dir, "summary.md");
  await writeFile(path, content, "utf8");
  return path;
}

const baseSummary = `# What I was working on
Refactoring the auth middleware to use the new session token format.

# What's pending
- [ ] Migrate /api/login
- [ ] Update tests
`;

describe("createHandoff", () => {
  test("captures branch, baseCommit, summary, and diff into a bundle", async () => {
    const fixture = await makeGitFixture({
      branch: "feature/auth",
      commits: [[{ path: "src/auth.ts", content: "export const x = 1;\n" }]],
      uncommitted: [{ path: "src/auth.ts", content: "export const x = 2;\n" }],
    });
    const summaryPath = await writeSummary(baseSummary);
    const out = join(await tmp(), "hb");

    const result = await createHandoff({
      source: fixture.dir,
      summaryPath,
      outDir: out,
      authorHandle: "alice",
    });

    expect(result.bundleDir).toBe(out);
    expect(result.manifest.branch).toBe("feature/auth");
    expect(result.manifest.baseCommit).toBe(fixture.headCommit);
    expect(result.manifest.author.handle).toBe("alice");
    expect(result.manifest.summaryFile).toBe("handoff.md");
    expect(result.manifest.diffFile).toBe("changes.patch");
    expect(result.hasUncommittedChanges).toBe(true);

    // Files exist
    const manifestRaw = await readFile(join(out, "handoff.json"), "utf8");
    const parsed = HandoffManifestSchema.safeParse(JSON.parse(manifestRaw));
    expect(parsed.success).toBe(true);

    const summary = await readFile(join(out, "handoff.md"), "utf8");
    expect(summary).toContain("Refactoring the auth middleware");

    const patch = await readFile(join(out, "changes.patch"), "utf8");
    expect(patch).toContain("export const x = 2");
  });

  test("omits diffFile when working tree is clean", async () => {
    const fixture = await makeGitFixture({
      commits: [[{ path: "a.ts", content: "x\n" }]],
    });
    const summaryPath = await writeSummary(baseSummary);
    const out = join(await tmp(), "hb");

    const result = await createHandoff({
      source: fixture.dir,
      summaryPath,
      outDir: out,
      authorHandle: "alice",
    });

    expect(result.hasUncommittedChanges).toBe(false);
    expect(result.manifest.diffFile).toBeUndefined();
    await expect(readFile(join(out, "changes.patch"))).rejects.toThrow();
  });

  test("captures repoUrl when origin is configured", async () => {
    const fixture = await makeGitFixture({
      commits: [[{ path: "a.ts", content: "x\n" }]],
      remoteUrl: "git@github.com:org/repo.git",
    });
    const summaryPath = await writeSummary(baseSummary);
    const out = join(await tmp(), "hb");

    const result = await createHandoff({
      source: fixture.dir,
      summaryPath,
      outDir: out,
      authorHandle: "alice",
    });

    expect(result.manifest.repoUrl).toBe("git@github.com:org/repo.git");
  });

  test("omits repoUrl when no origin is set", async () => {
    const fixture = await makeGitFixture({
      commits: [[{ path: "a.ts", content: "x\n" }]],
    });
    const summaryPath = await writeSummary(baseSummary);
    const out = join(await tmp(), "hb");

    const result = await createHandoff({
      source: fixture.dir,
      summaryPath,
      outDir: out,
      authorHandle: "alice",
    });

    expect(result.manifest.repoUrl).toBeUndefined();
  });

  test("throws when summary file is missing", async () => {
    const fixture = await makeGitFixture({
      commits: [[{ path: "a.ts", content: "x\n" }]],
    });
    const out = join(await tmp(), "hb");

    await expect(
      createHandoff({
        source: fixture.dir,
        summaryPath: "/no/such/file.md",
        outDir: out,
        authorHandle: "alice",
      }),
    ).rejects.toThrow(/summary/i);
  });

  test("throws when summary file is empty", async () => {
    const fixture = await makeGitFixture({
      commits: [[{ path: "a.ts", content: "x\n" }]],
    });
    const summaryPath = await writeSummary("");
    const out = join(await tmp(), "hb");

    await expect(
      createHandoff({
        source: fixture.dir,
        summaryPath,
        outDir: out,
        authorHandle: "alice",
      }),
    ).rejects.toThrow(/empty/i);
  });

  test("refuses to clobber a non-empty outDir", async () => {
    const fixture = await makeGitFixture({
      commits: [[{ path: "a.ts", content: "x\n" }]],
    });
    const summaryPath = await writeSummary(baseSummary);
    const out = join(await tmp(), "hb");
    await mkdir(out, { recursive: true });
    await writeFile(join(out, "stale.txt"), "old", "utf8");

    await expect(
      createHandoff({
        source: fixture.dir,
        summaryPath,
        outDir: out,
        authorHandle: "alice",
      }),
    ).rejects.toThrow(/exists and is not empty/i);
  });

  test("blocks high-severity sanitize findings by default", async () => {
    const fixture = await makeGitFixture({
      commits: [[{ path: "a.ts", content: "x\n" }]],
    });
    const summaryPath = await writeSummary(
      `${baseSummary}\nAWS_KEY=AKIAIOSFODNN7EXAMPLE\n`,
    );
    const out = join(await tmp(), "hb");

    await expect(
      createHandoff({
        source: fixture.dir,
        summaryPath,
        outDir: out,
        authorHandle: "alice",
      }),
    ).rejects.toThrow(/sanitize|finding/i);
  });

  test("allowFindings returns result with findings populated", async () => {
    const fixture = await makeGitFixture({
      commits: [[{ path: "a.ts", content: "x\n" }]],
    });
    const summaryPath = await writeSummary(
      `${baseSummary}\nAWS_KEY=AKIAIOSFODNN7EXAMPLE\n`,
    );
    const out = join(await tmp(), "hb");

    const result = await createHandoff({
      source: fixture.dir,
      summaryPath,
      outDir: out,
      authorHandle: "alice",
      allowFindings: true,
    });

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.some((f) => f.rule === "aws-access-key")).toBe(true);
    expect(result.manifest.sanitized?.findings).toBe(result.findings.length);
  });

  test("generated id matches the manifest schema regex", async () => {
    const fixture = await makeGitFixture({
      commits: [[{ path: "a.ts", content: "x\n" }]],
    });
    const summaryPath = await writeSummary(baseSummary);
    const out = join(await tmp(), "hb");

    const result = await createHandoff({
      source: fixture.dir,
      summaryPath,
      outDir: out,
      authorHandle: "alice",
    });

    expect(result.manifest.id).toMatch(/^[a-z0-9][a-z0-9-]+$/);
    expect(result.manifest.id.startsWith("alice-")).toBe(true);
  });

  test("respects an explicit id override", async () => {
    const fixture = await makeGitFixture({
      commits: [[{ path: "a.ts", content: "x\n" }]],
    });
    const summaryPath = await writeSummary(baseSummary);
    const out = join(await tmp(), "hb");

    const result = await createHandoff({
      source: fixture.dir,
      summaryPath,
      outDir: out,
      authorHandle: "alice",
      id: "alice-custom-id",
    });

    expect(result.manifest.id).toBe("alice-custom-id");
  });
});
