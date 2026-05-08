import { describe, expect, test } from "vitest";
import { ProfileManifestSchema } from "../../src/manifest/schema.js";

const validManifest = {
  schemaVersion: 1,
  name: "example-profile",
  author: { handle: "tushar" },
  version: "0.1.0",
  description: "Test profile.",
  items: [{ type: "skill", path: "skills/example-skill/SKILL.md" }],
  createdAt: "2026-05-08T00:00:00Z",
};

describe("ProfileManifestSchema", () => {
  test("accepts a minimal valid manifest", () => {
    const result = ProfileManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  test("rejects non-semver version", () => {
    const result = ProfileManifestSchema.safeParse({
      ...validManifest,
      version: "v1",
    });
    expect(result.success).toBe(false);
  });

  test("rejects unknown item type", () => {
    const result = ProfileManifestSchema.safeParse({
      ...validManifest,
      items: [{ type: "wat", path: "x" }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects schemaVersion other than 1", () => {
    const result = ProfileManifestSchema.safeParse({
      ...validManifest,
      schemaVersion: 2,
    });
    expect(result.success).toBe(false);
  });
});
