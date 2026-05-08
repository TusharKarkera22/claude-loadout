export interface SanitizeFinding {
    /** path relative to bundleDir, posix-form */
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
interface PatternDef {
    rule: string;
    pattern: RegExp;
    severity: SanitizeFinding["severity"];
    suggestion: SanitizeFinding["suggestion"];
}
export declare const HIGH_CONFIDENCE_PATTERNS: PatternDef[];
export declare function sanitizeBundle(bundleDir: string, options: SanitizeOptions): Promise<SanitizeResult>;
/**
 * Apply redactions in-place. Group findings by file and rewrite from end-to-start
 * to keep earlier offsets stable. Each finding is replaced by `[REDACTED:<rule>]`.
 */
export declare function applyRedactions(bundleDir: string, findings: SanitizeFinding[]): Promise<void>;
export {};
