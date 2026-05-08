import { describe, expect, test } from "vitest";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
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

async function makeProfile(opts: {
  name?: string;
  handle?: string;
  withHook?: boolean;
  withClaudeMd?: boolean;
  claudeCodeMinVersion?: string;
}): Promise<string> {
  const dir = await tmp("claude-loadout-bundle-");
  const items: Array<{ type: string; path: string }> = [
    { type: "skill", path: "skills/example/SKILL.md" },
    { type: "command", path: "commands/lint.md" },
  ];
  if (opts.withClaudeMd) items.push({ type: "claude-md", path: "CLAUDE.md" });
  if (opts.withHook) items.push({ type: "hook", path: "hooks/notify.sh" });

  const tree: Record<string, string> = {
    "skills/example/SKILL.md": "---\nname: example\ndescription: x\n---\nbody",
    "commands/lint.md": "---\ndescription: y\n---\nrun lint",
  };
  if (opts.withClaudeMd) tree["CLAUDE.md"] = "rules";
  if (opts.withHook) tree["hooks/notify.sh"] = "#!/bin/sh\necho hi";

  const manifest = {
    schemaVersion: 1,
    name: opts.name ?? "example-profile",
    author: { handle: opts.handle ?? "jane" },
    version: "0.1.0",
    description: "Test profile.",
    ...(opts.claudeCodeMinVersion && {
      claudeCodeMinVersion: opts.claudeCodeMinVersion,
    }),
    items,
    createdAt: "2026-05-08T00:00:00Z",
  };
  tree["profile.json"] = JSON.stringify(manifest, null, 2);
  await writeTree(dir, tree);
  return dir;
}

const baseOptions = (overrides: {
  source: string;
  profilesDir: string;
  storage: LocalStorageAdapter;
}) => ({
  storage: overrides.storage,
  source: overrides.source,
  profilesDir: overrides.profilesDir,
  namespacePrefix: "@",
  allowHookImport: false,
  yes: true,
  claudeCodeVersion: "1.0.0",
});

describe("installProfile", () => {
  test("installs a profile into profilesDir/<handle>-<name>/", async () => {
    const profile = await makeProfile({ handle: "jane", name: "py-eng" });
    const profilesDir = await tmp();
    const result = await installProfile(
      baseOptions({
        source: profile,
        profilesDir,
        storage: new LocalStorageAdapter(),
      }),
    );

    expect(result.alias).toBe("jane-py-eng");
    expect(result.importedItems).toBe(2);
    expect(result.skippedItems).toBe(0);

    const installRoot = join(profilesDir, "jane-py-eng");
    expect(await exists(join(installRoot, "skills/example/SKILL.md"))).toBe(true);
    expect(await exists(join(installRoot, "commands/lint.md"))).toBe(true);
    expect(await exists(join(installRoot, "profile.json"))).toBe(true);
    expect(await exists(join(installRoot, ".install.json"))).toBe(true);
  });

  test("skips hook items unless allowHookImport is true", async () => {
    const profile = await makeProfile({ withHook: true });
    const profilesDir = await tmp();
    const result = await installProfile(
      baseOptions({
        source: profile,
        profilesDir,
        storage: new LocalStorageAdapter(),
      }),
    );

    expect(result.skippedItems).toBe(1);
    const installRoot = join(profilesDir, "jane-example-profile");
    expect(await exists(join(installRoot, "hooks/notify.sh"))).toBe(false);
  });

  test("imports hooks when allowHookImport is true", async () => {
    const profile = await makeProfile({ withHook: true });
    const profilesDir = await tmp();
    const result = await installProfile({
      ...baseOptions({
        source: profile,
        profilesDir,
        storage: new LocalStorageAdapter(),
      }),
      allowHookImport: true,
    });

    expect(result.skippedItems).toBe(0);
    expect(result.importedItems).toBe(3);
    const installRoot = join(profilesDir, "jane-example-profile");
    expect(await exists(join(installRoot, "hooks/notify.sh"))).toBe(true);
  });

  test("CLAUDE.md is copied (surfaced) but not auto-merged", async () => {
    const profile = await makeProfile({ withClaudeMd: true });
    const profilesDir = await tmp();
    const result = await installProfile(
      baseOptions({
        source: profile,
        profilesDir,
        storage: new LocalStorageAdapter(),
      }),
    );

    const installRoot = join(profilesDir, "jane-example-profile");
    // The user's own CLAUDE.md (in profilesDir's parent) is untouched — we
    // just store the imported one in the installRoot, namespaced by directory.
    expect(await exists(join(installRoot, "CLAUDE.md"))).toBe(true);
    expect(result.importedItems).toBe(3);
  });

  test("rejects install when alias collides and no override given", async () => {
    const profile = await makeProfile({});
    const profilesDir = await tmp();
    const storage = new LocalStorageAdapter();
    await installProfile(baseOptions({ source: profile, profilesDir, storage }));

    await expect(
      installProfile(baseOptions({ source: profile, profilesDir, storage })),
    ).rejects.toThrow(/already installed|exists/i);
  });

  test("uses --as alias to resolve collision", async () => {
    const profile = await makeProfile({});
    const profilesDir = await tmp();
    const storage = new LocalStorageAdapter();
    await installProfile(baseOptions({ source: profile, profilesDir, storage }));

    const second = await installProfile({
      ...baseOptions({ source: profile, profilesDir, storage }),
      alias: "jane-example-profile-v2",
    });
    expect(second.alias).toBe("jane-example-profile-v2");
  });

  test("rejects installation with invalid manifest", async () => {
    const dir = await tmp();
    await writeTree(dir, {
      "profile.json": JSON.stringify({ not: "valid" }),
    });
    const profilesDir = await tmp();
    await expect(
      installProfile(
        baseOptions({
          source: dir,
          profilesDir,
          storage: new LocalStorageAdapter(),
        }),
      ),
    ).rejects.toThrow(/invalid|profile\.json|schemaVersion/i);
  });

  test("enforces claudeCodeMinVersion when claudeCodeVersion is provided", async () => {
    const profile = await makeProfile({ claudeCodeMinVersion: "9.99.0" });
    const profilesDir = await tmp();
    await expect(
      installProfile({
        ...baseOptions({
          source: profile,
          profilesDir,
          storage: new LocalStorageAdapter(),
        }),
        claudeCodeVersion: "1.0.0",
      }),
    ).rejects.toThrow(/claude code|version/i);
  });

  test("writes install metadata with resolvedRef and installedAt", async () => {
    const profile = await makeProfile({});
    const profilesDir = await tmp();
    await installProfile(
      baseOptions({
        source: profile,
        profilesDir,
        storage: new LocalStorageAdapter(),
      }),
    );

    const meta = JSON.parse(
      await readFile(
        join(profilesDir, "jane-example-profile", ".install.json"),
        "utf8",
      ),
    );
    expect(meta.resolvedRef).toBe("local");
    expect(typeof meta.installedAt).toBe("string");
    expect(meta.source).toBe(profile);
    expect(meta.alias).toBe("jane-example-profile");
  });
});
