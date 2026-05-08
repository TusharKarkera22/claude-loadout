export interface SanitizeFinding {
  file: string;
  line: number;
  column: number;
  rule: string;
  match: string;
  severity: "high" | "medium" | "low";
  suggestion: "redact" | "keep" | "review";
}

export interface SanitizeOptions {
  allow: string[];
  deny: string[];
  redactAbsolutePaths: boolean;
  redactEnvAssignments: boolean;
}

export interface SanitizeResult {
  findings: SanitizeFinding[];
  scannedFiles: number;
}

const HIGH_CONFIDENCE_PATTERNS: Array<{ rule: string; pattern: RegExp }> = [
  { rule: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/g },
  { rule: "github-pat", pattern: /ghp_[A-Za-z0-9]{36,}/g },
  { rule: "anthropic-key", pattern: /sk-ant-[A-Za-z0-9_-]{40,}/g },
  { rule: "openai-key", pattern: /sk-[A-Za-z0-9]{32,}/g },
];

/**
 * Module B — Profile Sanitize.
 *
 * TODO(v0.1):
 *   1. Walk bundleDir, scan text files (skip binaries) line-by-line.
 *   2. For each line, apply HIGH_CONFIDENCE_PATTERNS + options.deny regexes.
 *   3. If redactAbsolutePaths, flag /Users/<name>/ and /home/<name>/ paths.
 *   4. If redactEnvAssignments, flag *_KEY=, *_TOKEN=, *_SECRET=.
 *   5. Skip findings matching options.allow.
 *   6. Return findings; CLI presents an interactive review (keep/redact/replace).
 */
export async function sanitizeBundle(
  _bundleDir: string,
  _options: SanitizeOptions,
): Promise<SanitizeResult> {
  void HIGH_CONFIDENCE_PATTERNS;
  throw new Error("sanitizeBundle: not implemented in v0.1 scaffold");
}
