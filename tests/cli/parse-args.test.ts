import { describe, expect, test } from "vitest";
import { parseFlags } from "../../src/cli/parse-args.js";

describe("parseFlags", () => {
  test("parses --key=value pairs", () => {
    const r = parseFlags(["--name=py-eng", "--version=0.1.0"]);
    expect(r.flags).toEqual({ name: "py-eng", version: "0.1.0" });
    expect(r.positional).toEqual([]);
  });

  test("parses --key value pairs", () => {
    const r = parseFlags(["--name", "py-eng", "--version", "0.1.0"]);
    expect(r.flags).toEqual({ name: "py-eng", version: "0.1.0" });
  });

  test("parses bare boolean flags as true", () => {
    const r = parseFlags(["--git-init", "--yes"]);
    expect(r.flags).toEqual({ "git-init": true, yes: true });
  });

  test("parses --no-flag as false", () => {
    const r = parseFlags(["--no-skills", "--no-claude-md"]);
    expect(r.flags).toEqual({ skills: false, "claude-md": false });
  });

  test("collects positional args before and after flags", () => {
    const r = parseFlags(["jane/repo", "--ref=main", "extra"]);
    expect(r.positional).toEqual(["jane/repo", "extra"]);
    expect(r.flags).toEqual({ ref: "main" });
  });

  test("treats -- as terminator and keeps the rest as positional", () => {
    const r = parseFlags(["--ref=main", "--", "--keep-this-literal"]);
    expect(r.positional).toEqual(["--keep-this-literal"]);
    expect(r.flags).toEqual({ ref: "main" });
  });

  test("repeated flags overwrite (last wins)", () => {
    const r = parseFlags(["--ref=foo", "--ref=bar"]);
    expect(r.flags).toEqual({ ref: "bar" });
  });
});
