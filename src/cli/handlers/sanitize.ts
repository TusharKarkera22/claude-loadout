import { sanitizeBundle } from "../../modules/sanitize/index.js";
import type { Config } from "../../config/loader.js";
import type { ParsedFlags } from "../parse-args.js";

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === undefined) return fallback;
  return v !== "false" && v !== "0";
}

export async function runSanitize(
  parsed: ParsedFlags,
  config: Config,
): Promise<number> {
  const bundleDir = parsed.positional[0];
  if (!bundleDir) {
    process.stderr.write("usage: claude-loadout sanitize <bundleDir>\n");
    return 1;
  }
  const result = await sanitizeBundle(bundleDir, {
    allow: config.sanitize.allow,
    deny: config.sanitize.deny,
    redactAbsolutePaths: bool(
      parsed.flags["redact-paths"],
      config.sanitize.redactAbsolutePaths,
    ),
    redactEnvAssignments: bool(
      parsed.flags["redact-env"],
      config.sanitize.redactEnvAssignments,
    ),
  });

  process.stdout.write(
    `Scanned ${result.scannedFiles} file(s); ${result.findings.length} finding(s).\n`,
  );
  for (const f of result.findings) {
    process.stdout.write(
      `  ${f.severity.padEnd(6)} ${f.file}:${f.line}:${f.column}  ${f.rule}  ${f.match}\n`,
    );
  }

  const hasHigh = result.findings.some((f) => f.severity === "high");
  return hasHigh ? 2 : 0;
}
