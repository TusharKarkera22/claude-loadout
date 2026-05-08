/**
 * Minimal argv flag parser. Supports:
 *   --key=value
 *   --key value (when next token doesn't start with --)
 *   --flag (sets to true)
 *   --no-flag (sets `flag` to false)
 *   -- (terminator; remaining tokens are positional)
 */
export function parseFlags(argv) {
    const flags = {};
    const positional = [];
    let i = 0;
    while (i < argv.length) {
        const token = argv[i];
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
//# sourceMappingURL=parse-args.js.map