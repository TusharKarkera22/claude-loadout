import { describe, expect, test } from "vitest";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { exportProfile } from "../../src/modules/export/index.js";
import { loadManifest } from "../../src/manifest/validator.js";
import { tmp, writeTree } from "../helpers/tmp.js";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("exportProfile", () => {
  test("bundles CLAUDE.md, skills, commands, agents into outputDir", async () => {
    const sourceDir = await tmp();
    await writeTree(sourceDir, {
      "CLAUDE.md": "# Project rules",
      ".claude/skills/python/SKILL.md": "---\nname: python\ndescription: x\n---\nbody",
      ".claude/commands/lint.md": "---\ndescription: y\n---\nrun lint",
      ".claude/agents/reviewer.md": "---\nname: reviewer\n---\nbody",
    });
    const outputDir = join(await tmp(), "bundle");

    const result = await exportProfile({
      sourceDir,
      outputDir,
      include: {
        claudeMd: true,
        skills: true,
        commands: true,
        agents: true,
        hooks: false,
      },
      author: { handle: "tushar" },
      name: "my-profile",
      version: "0.1.0",
      description: "Test profile.",
    });

    expect(result.itemCount).toBe(4);
    expect(await exists(join(outputDir, "CLAUDE.md"))).toBe(true);
    expect(await exists(join(outputDir, "skills/python/SKILL.md"))).toBe(true);
    expect(await exists(join(outputDir, "commands/lint.md"))).toBe(true);
    expect(await exists(join(outputDir, "agents/reviewer.md"))).toBe(true);
    expect(await exists(join(outputDir, "profile.json"))).toBe(true);
  });

  test("writes a valid profile.json manifest", async () => {
    const sourceDir = await tmp();
    await writeTree(sourceDir, {
      ".claude/skills/python/SKILL.md": "---\nname: python\n---\nbody",
    });
    const outputDir = join(await tmp(), "bundle");

    await exportProfile({
      sourceDir,
      outputDir,
      include: {
        claudeMd: false,
        skills: true,
        commands: false,
        agents: false,
        hooks: false,
      },
      author: { handle: "tushar", displayName: "Tushar" },
      name: "py-profile",
      version: "0.2.1",
      description: "Python setup.",
    });

    const manifest = await loadManifest(join(outputDir, "profile.json"));
    expect(manifest.ok).toBe(true);
    if (!manifest.ok) return;
    expect(manifest.manifest.name).toBe("py-profile");
    expect(manifest.manifest.version).toBe("0.2.1");
    expect(manifest.manifest.author.handle).toBe("tushar");
    expect(manifest.manifest.items).toHaveLength(1);
    expect(manifest.manifest.items[0]?.type).toBe("skill");
    expect(manifest.manifest.items[0]?.path).toBe("skills/python/SKILL.md");
  });

  test("honors include toggles — hooks excluded by default", async () => {
    const sourceDir = await tmp();
    await writeTree(sourceDir, {
      "CLAUDE.md": "rules",
      ".claude/skills/x/SKILL.md": "x",
      ".claude/hooks/notify.sh": "#!/bin/sh\necho hi",
    });
    const outputDir = join(await tmp(), "bundle");

    const result = await exportProfile({
      sourceDir,
      outputDir,
      include: {
        claudeMd: true,
        skills: true,
        commands: false,
        agents: false,
        hooks: false,
      },
      author: { handle: "h" },
      name: "n",
      version: "0.0.1",
      description: "d",
    });

    expect(result.itemCount).toBe(2);
    expect(await exists(join(outputDir, "hooks/notify.sh"))).toBe(false);
  });

  test("refuses to overwrite an existing non-empty outputDir", async () => {
    const sourceDir = await tmp();
    await writeTree(sourceDir, {
      ".claude/skills/x/SKILL.md": "x",
    });
    const outputDir = await tmp();
    await writeTree(outputDir, { "existing.txt": "stuff" });

    await expect(
      exportProfile({
        sourceDir,
        outputDir,
        include: {
          claudeMd: false,
          skills: true,
          commands: false,
          agents: false,
          hooks: false,
        },
        author: { handle: "h" },
        name: "n",
        version: "0.0.1",
        description: "d",
      }),
    ).rejects.toThrow(/not empty|exists/i);
  });

  test("scope='user' looks for items at <source>/skills (not <source>/.claude/skills)", async () => {
    const sourceDir = await tmp();
    await writeTree(sourceDir, {
      "CLAUDE.md": "user-level instructions",
      "skills/python/SKILL.md": "---\nname: python\n---\nbody",
      "commands/lint.md": "---\ndescription: lint\n---\nrun",
      "agents/reviewer.md": "---\nname: reviewer\n---\nbody",
    });
    const outputDir = join(await tmp(), "bundle");

    const result = await exportProfile({
      sourceDir,
      outputDir,
      scope: "user",
      include: {
        claudeMd: true,
        skills: true,
        commands: true,
        agents: true,
        hooks: false,
      },
      author: { handle: "tushar" },
      name: "user-profile",
      version: "0.1.0",
      description: "User-scope export.",
    });

    expect(result.itemCount).toBe(4);
    expect(await exists(join(outputDir, "CLAUDE.md"))).toBe(true);
    expect(await exists(join(outputDir, "skills/python/SKILL.md"))).toBe(true);
    expect(await exists(join(outputDir, "commands/lint.md"))).toBe(true);
    expect(await exists(join(outputDir, "agents/reviewer.md"))).toBe(true);
  });

  test("scope='user' ignores any nested .claude/ directory", async () => {
    const sourceDir = await tmp();
    await writeTree(sourceDir, {
      "skills/real/SKILL.md": "real",
      ".claude/skills/wrong/SKILL.md": "ignored under user scope",
    });
    const outputDir = join(await tmp(), "bundle");

    const result = await exportProfile({
      sourceDir,
      outputDir,
      scope: "user",
      include: {
        claudeMd: false,
        skills: true,
        commands: false,
        agents: false,
        hooks: false,
      },
      author: { handle: "h" },
      name: "n",
      version: "0.0.1",
      description: "d",
    });

    expect(result.itemCount).toBe(1);
    expect(await exists(join(outputDir, "skills/real/SKILL.md"))).toBe(true);
    expect(await exists(join(outputDir, "skills/wrong/SKILL.md"))).toBe(false);
  });

  test("default scope behaves identically to scope='project'", async () => {
    const sourceDir = await tmp();
    await writeTree(sourceDir, {
      ".claude/skills/x/SKILL.md": "x",
    });
    const outputDir = join(await tmp(), "bundle");

    const result = await exportProfile({
      sourceDir,
      outputDir,
      include: {
        claudeMd: false,
        skills: true,
        commands: false,
        agents: false,
        hooks: false,
      },
      author: { handle: "h" },
      name: "n",
      version: "0.0.1",
      description: "d",
    });

    expect(result.itemCount).toBe(1);
    expect(await exists(join(outputDir, "skills/x/SKILL.md"))).toBe(true);
  });

  test("creates manifest with empty items[] when nothing matches", async () => {
    const sourceDir = await tmp();
    const outputDir = join(await tmp(), "bundle");

    const result = await exportProfile({
      sourceDir,
      outputDir,
      include: {
        claudeMd: true,
        skills: true,
        commands: true,
        agents: true,
        hooks: false,
      },
      author: { handle: "h" },
      name: "empty-profile",
      version: "0.0.1",
      description: "d",
    });

    expect(result.itemCount).toBe(0);
    const raw = await readFile(join(outputDir, "profile.json"), "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.items).toEqual([]);
  });
});
