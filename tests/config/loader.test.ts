import { describe, expect, test } from "vitest";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { loadConfig, DEFAULT_CONFIG } from "../../src/config/loader.js";
import { tmp } from "../helpers/tmp.js";

describe("loadConfig", () => {
  test("returns defaults when no config file is present", async () => {
    const dir = await tmp();
    const cfg = await loadConfig(dir);
    expect(cfg.export.outputDir).toBe(DEFAULT_CONFIG.export.outputDir);
    expect(cfg.install.profilesDir).toBe(DEFAULT_CONFIG.install.profilesDir);
    expect(cfg.install.allowHookImport).toBe(false);
  });

  test("merges user values over defaults", async () => {
    const dir = await tmp();
    await writeFile(
      join(dir, "claude-loadout.config.json"),
      JSON.stringify({
        export: { outputDir: "./bundle" },
        author: { handle: "jane" },
      }),
      "utf8",
    );
    const cfg = await loadConfig(dir);
    expect(cfg.export.outputDir).toBe("./bundle");
    expect(cfg.author?.handle).toBe("jane");
    // Untouched defaults still present:
    expect(cfg.export.include.skills).toBe(true);
    expect(cfg.install.namespacePrefix).toBe("@");
  });

  test("rejects invalid config (wrong type)", async () => {
    const dir = await tmp();
    await writeFile(
      join(dir, "claude-loadout.config.json"),
      JSON.stringify({ install: { allowHookImport: "yes-please" } }),
      "utf8",
    );
    await expect(loadConfig(dir)).rejects.toThrow(/install\.allowHookImport/);
  });

  test("throws on malformed JSON with helpful error", async () => {
    const dir = await tmp();
    await writeFile(
      join(dir, "claude-loadout.config.json"),
      "{ not: valid json",
      "utf8",
    );
    await expect(loadConfig(dir)).rejects.toThrow(/JSON/);
  });
});
