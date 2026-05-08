import { describe, expect, test } from "vitest";
import { detectPluginProvenance } from "../../src/modules/export/provenance.js";
import { tmp, writeTree } from "../helpers/tmp.js";

describe("detectPluginProvenance", () => {
  test("returns empty map when plugins/marketplaces does not exist", async () => {
    const dir = await tmp();
    const map = await detectPluginProvenance(dir);
    expect(map.size).toBe(0);
  });

  test("indexes skills under marketplaces/<m>/plugins/<p>/skills/<skill>", async () => {
    const claudeRoot = await tmp();
    await writeTree(claudeRoot, {
      "plugins/marketplaces/official/plugins/frontend-design/skills/frontend-design/SKILL.md": "x",
      "plugins/marketplaces/official/plugins/brainstorming/skills/brainstorming/SKILL.md": "x",
    });

    const map = await detectPluginProvenance(claudeRoot);
    expect(map.size).toBe(2);
    expect(map.get("frontend-design")).toEqual({
      marketplace: "official",
      plugin: "frontend-design",
    });
    expect(map.get("brainstorming")).toEqual({
      marketplace: "official",
      plugin: "brainstorming",
    });
  });

  test("indexes skills under marketplaces/<m>/external_plugins/<p>/skills/<skill>", async () => {
    const claudeRoot = await tmp();
    await writeTree(claudeRoot, {
      "plugins/marketplaces/official/external_plugins/discord/skills/access/SKILL.md": "x",
    });

    const map = await detectPluginProvenance(claudeRoot);
    expect(map.get("access")).toEqual({
      marketplace: "official",
      plugin: "discord",
    });
  });

  test("collects across multiple marketplaces", async () => {
    const claudeRoot = await tmp();
    await writeTree(claudeRoot, {
      "plugins/marketplaces/official/plugins/a/skills/skill-a/SKILL.md": "x",
      "plugins/marketplaces/community/plugins/b/skills/skill-b/SKILL.md": "x",
    });

    const map = await detectPluginProvenance(claudeRoot);
    expect(map.size).toBe(2);
    expect(map.get("skill-a")?.marketplace).toBe("official");
    expect(map.get("skill-b")?.marketplace).toBe("community");
  });

  test("indexes skills under plugins/cache/<m>/<p>/<version>/skills/", async () => {
    const claudeRoot = await tmp();
    await writeTree(claudeRoot, {
      "plugins/cache/official/superpowers/5.1.0/skills/brainstorming/SKILL.md": "x",
      "plugins/cache/official/superpowers/5.1.0/skills/test-driven/SKILL.md": "x",
    });

    const map = await detectPluginProvenance(claudeRoot);
    expect(map.get("brainstorming")).toEqual({
      marketplace: "official",
      plugin: "superpowers",
    });
    expect(map.get("test-driven")).toEqual({
      marketplace: "official",
      plugin: "superpowers",
    });
  });

  test("dedupes across multiple cached versions of the same plugin", async () => {
    const claudeRoot = await tmp();
    await writeTree(claudeRoot, {
      "plugins/cache/official/superpowers/5.0.7/skills/brainstorming/SKILL.md": "x",
      "plugins/cache/official/superpowers/5.1.0/skills/brainstorming/SKILL.md": "x",
    });

    const map = await detectPluginProvenance(claudeRoot);
    expect(map.size).toBe(1);
    expect(map.get("brainstorming")?.plugin).toBe("superpowers");
  });

  test("merges marketplace + cache sources without losing entries", async () => {
    const claudeRoot = await tmp();
    await writeTree(claudeRoot, {
      "plugins/marketplaces/official/plugins/frontend-design/skills/frontend-design/SKILL.md": "x",
      "plugins/cache/official/superpowers/5.1.0/skills/brainstorming/SKILL.md": "x",
    });

    const map = await detectPluginProvenance(claudeRoot);
    expect(map.size).toBe(2);
    expect(map.get("frontend-design")?.plugin).toBe("frontend-design");
    expect(map.get("brainstorming")?.plugin).toBe("superpowers");
  });

  test("ignores empty/malformed plugin directories", async () => {
    const claudeRoot = await tmp();
    await writeTree(claudeRoot, {
      "plugins/marketplaces/official/plugins/empty/.gitkeep": "",
      "plugins/marketplaces/official/plugins/real/skills/real-skill/SKILL.md": "x",
    });

    const map = await detectPluginProvenance(claudeRoot);
    expect(map.size).toBe(1);
    expect(map.has("real-skill")).toBe(true);
  });
});
