import { describe, expect, test } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  HandoffManifestSchema,
  loadHandoffManifest,
} from "../../src/manifest/handoff-schema.js";
import { tmp } from "../helpers/tmp.js";

const validManifest = {
  schemaVersion: 1,
  id: "alice-2026-05-09-1432",
  author: { handle: "alice" },
  createdAt: "2026-05-09T14:32:00Z",
  branch: "feature/auth-rewrite",
  baseCommit: "a3f12bcd",
  summaryFile: "handoff.md",
};

describe("HandoffManifestSchema", () => {
  test("accepts a minimal valid manifest", () => {
    const result = HandoffManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  test("accepts a full manifest with optional fields", () => {
    const result = HandoffManifestSchema.safeParse({
      ...validManifest,
      author: {
        handle: "alice",
        displayName: "Alice Example",
        url: "https://github.com/alice",
      },
      repoUrl: "git@github.com:org/repo.git",
      diffFile: "changes.patch",
      todos: [
        { text: "migrate /api/login", done: false },
        { text: "update tests", done: true },
      ],
      claudeCodeMinVersion: "1.0.0",
      sanitized: { findings: 0, lastScanAt: "2026-05-09T14:33:00Z" },
    });
    expect(result.success).toBe(true);
  });

  test("rejects schemaVersion other than 1", () => {
    const result = HandoffManifestSchema.safeParse({
      ...validManifest,
      schemaVersion: 2,
    });
    expect(result.success).toBe(false);
  });

  test("rejects malformed id", () => {
    const result = HandoffManifestSchema.safeParse({
      ...validManifest,
      id: "Has Spaces",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty branch", () => {
    const result = HandoffManifestSchema.safeParse({
      ...validManifest,
      branch: "",
    });
    expect(result.success).toBe(false);
  });

  test("rejects baseCommit that is not a hex SHA", () => {
    const result = HandoffManifestSchema.safeParse({
      ...validManifest,
      baseCommit: "zzzz",
    });
    expect(result.success).toBe(false);
  });

  test("rejects summaryFile other than handoff.md", () => {
    const result = HandoffManifestSchema.safeParse({
      ...validManifest,
      summaryFile: "summary.txt",
    });
    expect(result.success).toBe(false);
  });

  test("rejects bad createdAt", () => {
    const result = HandoffManifestSchema.safeParse({
      ...validManifest,
      createdAt: "yesterday",
    });
    expect(result.success).toBe(false);
  });
});

describe("loadHandoffManifest", () => {
  test("returns ok with parsed manifest for valid file", async () => {
    const dir = await tmp();
    const path = join(dir, "handoff.json");
    await writeFile(path, JSON.stringify(validManifest));

    const result = await loadHandoffManifest(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.id).toBe("alice-2026-05-09-1432");
      expect(result.manifest.branch).toBe("feature/auth-rewrite");
    }
  });

  test("returns errors on invalid JSON", async () => {
    const dir = await tmp();
    const path = join(dir, "handoff.json");
    await writeFile(path, "{ not json");

    const result = await loadHandoffManifest(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain("invalid JSON");
    }
  });

  test("returns field-level errors on schema mismatch", async () => {
    const dir = await tmp();
    const path = join(dir, "handoff.json");
    await writeFile(
      path,
      JSON.stringify({ ...validManifest, baseCommit: "zzz" }),
    );

    const result = await loadHandoffManifest(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("baseCommit"))).toBe(true);
    }
  });
});
