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
export function parseFlags(argv: string[]): ParsedFlags {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const token = argv[i] as string;
    if (token === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq > -1) {
        flags[token.slice(2, eq)] = token.slice(eq + 1);
        i++;
        continue;
      }
      const key = token.slice(2);
      if (key.startsWith("no-")) {
        flags[key.slice(3)] = false;
        i++;
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
        continue;
      }
      flags[key] = true;
      i++;
      continue;
    }
    positional.push(token);
    i++;
  }
  return { flags, positional };
}
