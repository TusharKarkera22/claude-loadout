export interface ParsedFlags {
    flags: Record<string, string | boolean>;
    positional: string[];
}
/**
 * Minimal argv flag parser. Supports:
 *   --key=value
 *   --key value (when next token doesn't start with --)
 *   --flag (sets to true)
 *   --no-flag (sets `flag` to false)
 *   -- (terminator; remaining tokens are positional)
 */
export declare function parseFlags(argv: string[]): ParsedFlags;
