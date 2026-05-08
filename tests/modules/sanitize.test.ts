import { describe, expect, test } from "vitest";
import {
  sanitizeBundle,
  applyRedactions,
  HIGH_CONFIDENCE_PATTERNS,
} from "../../src/modules/sanitize/index.js";
import { tmp, writeTree } from "../helpers/tmp.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_OPTIONS = {
  allow: [],
  deny: [],
  redactAbsolutePaths: true,
  redactEnvAssignments: true,
};

describe("sanitizeBundle", () => {
  test("flags an AWS access key", async () => {
    const dir = await tmp();
    await writeTree(dir, {
      "skills/x/SKILL.md": "config:\n  aws: AKIAIOSFODNN7EXAMPLE\n",
    });
    const result = await sanitizeBundle(dir, DEFAULT_OPTIONS);
    expect(result.scannedFiles).toBe(1);
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    const aws = result.findings.find((f) => f.rule === "aws-access-key");
    expect(aws).toBeDefined();
    expect(aws?.severity).toBe("high");
    expect(aws?.suggestion).toBe("redact");
    expect(aws?.match).toContain("AKIA");
    expect(aws?.line).toBe(2);
  });

  test("flags GitHub PAT, Anthropic, and OpenAI keys", async () => {
    const dir = await tmp();
    await writeTree(dir, {
      "a.md": `ghp_${"a".repeat(36)}`,
      "b.md": `sk-ant-${"a".repeat(40)}`,
      "c.md": `sk-${"a".repeat(48)}`,
    });
    const result = await sanitizeBundle(dir, DEFAULT_OPTIONS);
    const rules = new Set(result.findings.map((f) => f.rule));
    expect(rules.has("github-pat")).toBe(true);
    expect(rules.has("anthropic-key")).toBe(true);
    expect(rules.has("openai-key")).toBe(true);
  });

  test("flags absolute home paths when redactAbsolutePaths is true", async () => {
    const dir = await tmp();
    await writeTree(dir, {
      "CLAUDE.md": "use /Users/tushar/secret/notes for context",
    });
    const result = await sanitizeBundle(dir, DEFAULT_OPTIONS);
    const path = result.findings.find((f) => f.rule === "absolute-home-path");
    expect(path).toBeDefined();
    expect(path?.severity).toBe("medium");
    expect(path?.match).toContain("/Users/");
  });

  test("does NOT flag absolute home paths when toggle is false", async () => {
    const dir = await tmp();
    await writeTree(dir, {
      "CLAUDE.md": "/Users/tushar/path",
    });
    const result = await sanitizeBundle(dir, {
      ...DEFAULT_OPTIONS,
      redactAbsolutePaths: false,
    });
    expect(
      result.findings.find((f) => f.rule === "absolute-home-path"),
    ).toBeUndefined();
  });

  test("flags suspicious env-style assignments", async () => {
    const dir = await tmp();
    await writeTree(dir, {
      "CLAUDE.md":
        "MY_API_KEY=abcdef123\nSOME_TOKEN=zzz\nPUBLIC_VAR=ok\nMY_SECRET=hunter2\n",
    });
    const result = await sanitizeBundle(dir, DEFAULT_OPTIONS);
    const envFindings = result.findings.filter(
      (f) => f.rule === "env-assignment",
    );
    expect(envFindings.length).toBe(3);
    expect(envFindings.map((f) => f.match.split("=")[0])).toEqual(
      expect.arrayContaining(["MY_API_KEY", "SOME_TOKEN", "MY_SECRET"]),
    );
  });

  test("respects custom deny list", async () => {
    const dir = await tmp();
    await writeTree(dir, {
      "x.md": "internal-server.acme.local matters",
    });
    const result = await sanitizeBundle(dir, {
      ...DEFAULT_OPTIONS,
      deny: ["[a-z-]+\\.acme\\.local"],
    });
    const custom = result.findings.find((f) => f.rule === "deny:0");
    expect(custom).toBeDefined();
    expect(custom?.match).toBe("internal-server.acme.local");
  });

  test("allow list suppresses matching findings", async () => {
    const dir = await tmp();
    await writeTree(dir, {
      "x.md": "AKIAIOSFODNN7EXAMPLE",
    });
    const result = await sanitizeBundle(dir, {
      ...DEFAULT_OPTIONS,
      allow: ["AKIAIOSFODNN7EXAMPLE"],
    });
    expect(
      result.findings.find((f) => f.rule === "aws-access-key"),
    ).toBeUndefined();
  });

  test("skips obvious binaries", async () => {
    const dir = await tmp();
    await writeTree(dir, {
      "skills/text.md": "fine",
    });
    // Add a "binary" via raw bytes
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      join(dir, "skills/blob.png"),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00]),
    );
    const result = await sanitizeBundle(dir, DEFAULT_OPTIONS);
    expect(result.scannedFiles).toBe(1);
  });

  test("HIGH_CONFIDENCE_PATTERNS export is non-empty", () => {
    expect(HIGH_CONFIDENCE_PATTERNS.length).toBeGreaterThan(0);
  });
});

describe("applyRedactions", () => {
  test("replaces matched bytes with [REDACTED]", async () => {
    const dir = await tmp();
    await writeTree(dir, {
      "x.md": "key=AKIAIOSFODNN7EXAMPLE end",
    });
    const result = await sanitizeBundle(dir, DEFAULT_OPTIONS);
    const aws = result.findings.find((f) => f.rule === "aws-access-key");
    if (!aws) throw new Error("expected aws finding");
    await applyRedactions(dir, [aws]);
    const after = await readFile(join(dir, "x.md"), "utf8");
    expect(after).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(after).toContain("[REDACTED:aws-access-key]");
  });
});
