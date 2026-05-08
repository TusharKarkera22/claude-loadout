import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
export const ConfigSchema = z.object({
    modules: z
        .object({
        export: z.object({ enabled: z.boolean() }).default({ enabled: true }),
        sanitize: z.object({ enabled: z.boolean() }).default({ enabled: true }),
        install: z.object({ enabled: z.boolean() }).default({ enabled: true }),
        manage: z.object({ enabled: z.boolean() }).default({ enabled: true }),
    })
        .default({
        export: { enabled: true },
        sanitize: { enabled: true },
        install: { enabled: true },
        manage: { enabled: true },
    }),
    export: z
        .object({
        outputDir: z.string().default("./my-profile"),
        include: z
            .object({
            claudeMd: z.boolean().default(true),
            skills: z.boolean().default(true),
            commands: z.boolean().default(true),
            agents: z.boolean().default(true),
            hooks: z.boolean().default(false),
        })
            .default({
            claudeMd: true,
            skills: true,
            commands: true,
            agents: true,
            hooks: false,
        }),
    })
        .default({
        outputDir: "./my-profile",
        include: {
            claudeMd: true,
            skills: true,
            commands: true,
            agents: true,
            hooks: false,
        },
    }),
    sanitize: z
        .object({
        allow: z.array(z.string()).default([]),
        deny: z.array(z.string()).default([]),
        redactAbsolutePaths: z.boolean().default(true),
        redactEnvAssignments: z.boolean().default(true),
    })
        .default({
        allow: [],
        deny: [],
        redactAbsolutePaths: true,
        redactEnvAssignments: true,
    }),
    install: z
        .object({
        profilesDir: z.string().default(".claude-loadout"),
        namespacePrefix: z.string().default("@"),
        allowHookImport: z.boolean().default(false),
    })
        .default({
        profilesDir: ".claude-loadout",
        namespacePrefix: "@",
        allowHookImport: false,
    }),
    author: z
        .object({
        handle: z.string(),
        displayName: z.string().optional(),
        url: z.string().url().optional(),
    })
        .optional(),
});
export const DEFAULT_CONFIG = ConfigSchema.parse({});
export const CONFIG_FILENAME = "claude-loadout.config.json";
export async function loadConfig(workDir) {
    const path = join(workDir, CONFIG_FILENAME);
    let raw;
    try {
        raw = await readFile(path, "utf8");
    }
    catch (err) {
        if (err.code === "ENOENT") {
            return DEFAULT_CONFIG;
        }
        throw err;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (err) {
        throw new Error(`Invalid JSON in ${CONFIG_FILENAME}: ${err.message}`);
    }
    const result = ConfigSchema.safeParse(parsed);
    if (!result.success) {
        const issues = result.error.issues
            .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
            .join("; ");
        throw new Error(`Invalid ${CONFIG_FILENAME}: ${issues}`);
    }
    return result.data;
}
//# sourceMappingURL=loader.js.map