import { describe, expect, test } from "vitest";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import { GitStorageAdapter } from "../../src/adapters/git-storage.js";
import { makeBareRepo } from "../helpers/git-fixture.js";
import { tmp } from "../helpers/tmp.js";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("GitStorageAdapter.publish", () => {
  test("initializes a git repo and commits the bundle", async () => {
    const adapter = new GitStorageAdapter();
    const bundle = await tmp("bundle-");
    await mkdir(bundle, { recursive: true });
    await writeFile(join(bundle, "handoff.md"), "summary\n", "utf8");
    await writeFile(join(bundle, "handoff.json"), `{"x":1}\n`, "utf8");

    const remote = await makeBareRepo();
    await adapter.publish(bundle, remote, { message: "alice handoff 2026-05-09" });

    expect(await exists(join(bundle, ".git"))).toBe(true);
    const log = await simpleGit(bundle).log();
    expect(log.total).toBe(1);
    expect(log.latest?.message).toContain("alice handoff");
  });

  test("pushes to the target remote by default", async () => {
    const adapter = new GitStorageAdapter();
    const bundle = await tmp("bundle-");
    await mkdir(bundle, { recursive: true });
    await writeFile(join(bundle, "handoff.md"), "v1 content\n", "utf8");

    const remote = await makeBareRepo();
    await adapter.publish(bundle, remote, { message: "first" });

    // Verify by cloning the remote.
    const verify = await tmp("verify-");
    await simpleGit().clone(remote, verify);
    const content = await readFile(join(verify, "handoff.md"), "utf8");
    expect(content).toBe("v1 content\n");
  });

  test("respects push: false", async () => {
    const adapter = new GitStorageAdapter();
    const bundle = await tmp("bundle-");
    await mkdir(bundle, { recursive: true });
    await writeFile(join(bundle, "handoff.md"), "x\n", "utf8");

    const remote = await makeBareRepo();
    await adapter.publish(bundle, remote, { message: "no push", push: false });

    // Cloning the remote should yield an empty repo (no commits)
    const verify = await tmp("verify-");
    await simpleGit().clone(remote, verify).catch(() => {
      // simple-git may complain about empty remote — that's also fine
    });
    // Either no clone happened or the cloned dir has no working content.
    const handoff = await exists(join(verify, "handoff.md"));
    expect(handoff).toBe(false);
  });

  test("re-publishing adds a new commit on top", async () => {
    const adapter = new GitStorageAdapter();
    const bundle = await tmp("bundle-");
    await mkdir(bundle, { recursive: true });
    await writeFile(join(bundle, "f.txt"), "v1\n", "utf8");

    const remote = await makeBareRepo();
    await adapter.publish(bundle, remote, { message: "first" });

    await writeFile(join(bundle, "f.txt"), "v2\n", "utf8");
    await adapter.publish(bundle, remote, { message: "second" });

    const log = await simpleGit(bundle).log();
    expect(log.total).toBe(2);
    expect(log.all[0]?.message).toContain("second");
    expect(log.all[1]?.message).toContain("first");
  });
});
