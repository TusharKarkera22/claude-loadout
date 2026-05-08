import { describe, expect, test } from "vitest";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import {
  listProfiles,
  removeProfile,
  showProfile,
  updateProfile,
} from "../../src/modules/manage/index.js";
import { installProfile } from "../../src/modules/install/index.js";
import { tmp, writeTree } from "../helpers/tmp.js";
import { LocalStorageAdapter } from "../helpers/local-storage.js";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function makeAndInstall(
  profilesDir: string,
  opts: { handle: string; name: string },
): Promise<{ alias: string; bundleDir: string }> {
  const bundleDir = await tmp("claude-loadout-bundle-");
  await writeTree(bundleDir, {
    "skills/x/SKILL.md": "---\nname: x\ndescription: x\n---\nbody",
    "profile.json": JSON.stringify({
      schemaVersion: 1,
      name: opts.name,
      author: { handle: opts.handle },
      version: "0.1.0",
      description: "test",
      items: [{ type: "skill", path: "skills/x/SKILL.md" }],
      createdAt: "2026-05-08T00:00:00Z",
    }),
  });
  const result = await installProfile({
    source: bundleDir,
    storage: new LocalStorageAdapter(),
    profilesDir,
    namespacePrefix: "@",
    allowHookImport: false,
    yes: true,
  });
  return { alias: result.alias, bundleDir };
}

describe("listProfiles", () => {
  test("returns empty list when profilesDir does not exist", async () => {
    const dir = join(await tmp(), "nonexistent");
    const profiles = await listProfiles(dir);
    expect(profiles).toEqual([]);
  });

  test("returns empty list when profilesDir is empty", async () => {
    const dir = await tmp();
    const profiles = await listProfiles(dir);
    expect(profiles).toEqual([]);
  });

  test("lists installed profiles with manifest + install metadata", async () => {
    const profilesDir = await tmp();
    await makeAndInstall(profilesDir, { handle: "jane", name: "py" });
    await makeAndInstall(profilesDir, { handle: "alex", name: "rust" });

    const profiles = await listProfiles(profilesDir);
    expect(profiles).toHaveLength(2);
    const aliases = profiles.map((p) => p.alias).sort();
    expect(aliases).toEqual(["alex-rust", "jane-py"]);
    const py = profiles.find((p) => p.alias === "jane-py");
    expect(py?.manifest.name).toBe("py");
    expect(py?.installedRef).toBe("local");
    expect(typeof py?.installedAt).toBe("string");
  });

  test("ignores directories that lack a profile.json", async () => {
    const profilesDir = await tmp();
    await makeAndInstall(profilesDir, { handle: "jane", name: "py" });
    await writeTree(profilesDir, { "stale/note.txt": "ignore me" });

    const profiles = await listProfiles(profilesDir);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.alias).toBe("jane-py");
  });
});

describe("showProfile", () => {
  test("returns the manifest + metadata for an installed profile", async () => {
    const profilesDir = await tmp();
    const { alias } = await makeAndInstall(profilesDir, {
      handle: "jane",
      name: "py",
    });
    const profile = await showProfile(profilesDir, alias);
    expect(profile.alias).toBe(alias);
    expect(profile.manifest.author.handle).toBe("jane");
    expect(profile.manifest.items).toHaveLength(1);
  });

  test("throws when alias is not installed", async () => {
    const profilesDir = await tmp();
    await expect(showProfile(profilesDir, "nope")).rejects.toThrow(/not installed/i);
  });
});

describe("removeProfile", () => {
  test("deletes the install root", async () => {
    const profilesDir = await tmp();
    const { alias } = await makeAndInstall(profilesDir, {
      handle: "jane",
      name: "py",
    });
    expect(await exists(join(profilesDir, alias))).toBe(true);
    await removeProfile(profilesDir, alias);
    expect(await exists(join(profilesDir, alias))).toBe(false);
  });

  test("throws when alias is not installed", async () => {
    const profilesDir = await tmp();
    await expect(removeProfile(profilesDir, "nope")).rejects.toThrow(/not installed/i);
  });

  test("refuses to remove paths that escape profilesDir", async () => {
    const profilesDir = await tmp();
    await expect(
      removeProfile(profilesDir, "../../../etc/passwd-attempt"),
    ).rejects.toThrow(/invalid alias|outside/i);
  });
});

describe("updateProfile", () => {
  test("re-fetches and re-installs from the recorded source", async () => {
    const profilesDir = await tmp();
    const { alias, bundleDir } = await makeAndInstall(profilesDir, {
      handle: "jane",
      name: "py",
    });

    // Bump the manifest version on disk to simulate an upstream update.
    const { writeFile, readFile } = await import("node:fs/promises");
    const raw = await readFile(join(bundleDir, "profile.json"), "utf8");
    const manifest = JSON.parse(raw);
    manifest.version = "0.2.0";
    await writeFile(
      join(bundleDir, "profile.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );

    const result = await updateProfile(profilesDir, alias, {
      storage: new LocalStorageAdapter(),
    });
    expect(result.manifest.version).toBe("0.2.0");
    expect(result.alias).toBe(alias);
  });

  test("throws when alias is not installed", async () => {
    const profilesDir = await tmp();
    await expect(
      updateProfile(profilesDir, "nope", { storage: new LocalStorageAdapter() }),
    ).rejects.toThrow(/not installed/i);
  });
});
