import { readFile, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";
import fastGlob from "fast-glob";
export const HIGH_CONFIDENCE_PATTERNS = [
    {
        rule: "aws-access-key",
        pattern: /AKIA[0-9A-Z]{16}/g,
        severity: "high",
        suggestion: "redact",
    },
    {
        rule: "github-pat",
        pattern: /ghp_[A-Za-z0-9]{36,}/g,
        severity: "high",
        suggestion: "redact",
    },
    {
        rule: "anthropic-key",
        pattern: /sk-ant-[A-Za-z0-9_-]{40,}/g,
        severity: "high",
        suggestion: "redact",
    },
    {
        rule: "openai-key",
        pattern: /sk-[A-Za-z0-9]{32,}/g,
        severity: "high",
        suggestion: "redact",
    },
];
const ABSOLUTE_HOME_PATH = /\/(?:Users|home)\/[A-Za-z0-9._-]+(?:\/[^\s"')]*)?/g;
const ENV_ASSIGNMENT = /\b([A-Z][A-Z0-9_]*(?:_KEY|_TOKEN|_SECRET|_PASSWORD|_PASSWD|_API_KEY))\s*=\s*([^\s"']+)/g;
const TEXT_EXTENSIONS = new Set([
    ".md",
    ".markdown",
    ".txt",
    ".json",
    ".yml",
    ".yaml",
    ".toml",
    ".sh",
    ".bash",
    ".zsh",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".mts",
    ".cts",
    ".tsx",
    ".jsx",
    ".py",
    ".rb",
    ".rs",
    ".go",
    ".java",
    ".kt",
    ".swift",
    ".cfg",
    ".conf",
    ".ini",
    ".env",
    ".example",
    ".lock",
]);
function looksLikeText(path, sample) {
    const lower = path.toLowerCase();
    const dot = lower.lastIndexOf(".");
    if (dot >= 0 && TEXT_EXTENSIONS.has(lower.slice(dot)))
        return true;
    // Heuristic: no NUL bytes in first 8KB
    for (let i = 0; i < Math.min(sample.length, 8192); i++) {
        if (sample[i] === 0)
            return false;
    }
    return true;
}
function toPosix(p) {
    return p.split(sep).join("/");
}
function compileDeny(patterns) {
    return patterns.map((src, i) => ({
        rule: `deny:${i}`,
        pattern: new RegExp(src, "g"),
        severity: "high",
        suggestion: "redact",
    }));
}
function findMatches(content, pattern) {
    const out = [];
    // Re-instantiate for safety in case regex was used elsewhere with stateful lastIndex
    const re = new RegExp(pattern.pattern.source, pattern.pattern.flags);
    let m;
    while ((m = re.exec(content)) !== null) {
        const before = content.slice(0, m.index);
        const lineNum = before.split("\n").length;
        const lastNl = before.lastIndexOf("\n");
        const col = lastNl < 0 ? m.index + 1 : m.index - lastNl;
        out.push({
            match: m[0],
            line: lineNum,
            column: col,
            index: m.index,
        });
        if (m[0].length === 0)
            re.lastIndex++; // guard against zero-width
    }
    return out;
}
function scanContent(relPath, content, patterns, options) {
    const findings = [];
    for (const def of patterns) {
        for (const hit of findMatches(content, def)) {
            if (options.allow.some((a) => hit.match.includes(a)))
                continue;
            findings.push({
                file: relPath,
                line: hit.line,
                column: hit.column,
                rule: def.rule,
                match: hit.match,
                severity: def.severity,
                suggestion: def.suggestion,
            });
        }
    }
    return findings;
}
export async function sanitizeBundle(bundleDir, options) {
    const denyPatterns = compileDeny(options.deny);
    const allPatterns = [...HIGH_CONFIDENCE_PATTERNS, ...denyPatterns];
    if (options.redactAbsolutePaths) {
        allPatterns.push({
            rule: "absolute-home-path",
            pattern: ABSOLUTE_HOME_PATH,
            severity: "medium",
            suggestion: "review",
        });
    }
    if (options.redactEnvAssignments) {
        allPatterns.push({
            rule: "env-assignment",
            pattern: ENV_ASSIGNMENT,
            severity: "medium",
            suggestion: "review",
        });
    }
    const files = await fastGlob(["**/*"], {
        cwd: bundleDir,
        onlyFiles: true,
        dot: false,
    });
    const findings = [];
    let scannedFiles = 0;
    for (const rel of files) {
        const abs = join(bundleDir, rel);
        const buf = await readFile(abs);
        if (!looksLikeText(rel, buf))
            continue;
        scannedFiles++;
        const content = buf.toString("utf8");
        findings.push(...scanContent(toPosix(rel), content, allPatterns, options));
    }
    // Stable sort: file, line, column, rule
    findings.sort((a, b) => {
        if (a.file !== b.file)
            return a.file < b.file ? -1 : 1;
        if (a.line !== b.line)
            return a.line - b.line;
        if (a.column !== b.column)
            return a.column - b.column;
        return a.rule < b.rule ? -1 : 1;
    });
    return { findings, scannedFiles };
}
/**
 * Apply redactions in-place. Group findings by file and rewrite from end-to-start
 * to keep earlier offsets stable. Each finding is replaced by `[REDACTED:<rule>]`.
 */
export async function applyRedactions(bundleDir, findings) {
    const byFile = new Map();
    for (const f of findings) {
        const list = byFile.get(f.file) ?? [];
        list.push(f);
        byFile.set(f.file, list);
    }
    for (const [file, list] of byFile) {
        const abs = join(bundleDir, file);
        let content = await readFile(abs, "utf8");
        // Sort by line desc, column desc so replacements don't shift earlier indices.
        const sorted = [...list].sort((a, b) => {
            if (a.line !== b.line)
                return b.line - a.line;
            return b.column - a.column;
        });
        for (const finding of sorted) {
            const replacement = `[REDACTED:${finding.rule}]`;
            const idx = content.lastIndexOf(finding.match);
            if (idx === -1)
                continue;
            content = content.slice(0, idx) + replacement + content.slice(idx + finding.match.length);
        }
        await writeFile(abs, content, "utf8");
    }
}
//# sourceMappingURL=index.js.map