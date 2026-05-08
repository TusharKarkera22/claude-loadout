import { describe, expect, test } from "vitest";
import { stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runCli } from "../../src/cli/run.js";
import { tmp, writeTree } from "../helpers/tmp.js";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("runCli", () => {
  test("export round-trip: writes a valid bundle", async () => {
    const sourceDir = await tmp();
    await writeTree(sourceDir, {
      ".claude/skills/x/SKILL.md": "---\nname: x\ndescription: x\n---\nbody",
      ".claude/commands/lint.md": "---\ndescription: lint\n---\nrun",
    });
    const outDir = join(await tmp(), "bundle");

    const code = await runCli([
      "export",
      "--source",
      sourceDir,
      "--out",
      outDir,
      "--name",
      "test-profile",
      "--version",
      "0.1.0",
      "--description",
      "round-trip test profile",
      "--author",
      "tushar",
      "--no-claude-md",
    ]);

    expect(code).toBe(0);
    expect(await exists(join(outDir, "profile.json"))).toBe(true);
    expect(await exists(join(outDir, "skills/x/SKILL.md"))).toBe(true);
    const manifest = JSON.parse(
      await readFile(join(outDir, "profile.json"), "utf8"),
    );
    expect(manifest.name).toBe("test-profile");
    expect(manifest.author.handle).toBe("tushar");
  });

  test("sanitize CLI prints findings and exits non-zero on high-severity hits", async () => {
    const dir = await tmp();
    await writeTree(dir, {
      "x.md": "key=AKIAIOSFODNN7EXAMPLE",
    });
    const code = await runCli(["sanitize", dir]);
    // Non-zero because high-severity finding is present.
    expect(code).toBe(2);
  });

  test("sanitize CLI exits 0 when no findings", async () => {
    const dir = await tmp();
    await writeTree(dir, { "clean.md": "nothing to see here" });
    const code = await runCli([
      "sanitize",
      dir,
      "--no-redact-paths",
      "--no-redact-env",
    ]);
    expect(code).toBe(0);
  });

  test("unknown subcommand returns non-zero with usage", async () => {
    const code = await runCli(["nonsense"]);
    expect(code).not.toBe(0);
  });

  test("missing required flag fails with helpful error", async () => {
    const code = await runCli(["export", "--source", "."]);
    expect(code).not.toBe(0);
  });
});
