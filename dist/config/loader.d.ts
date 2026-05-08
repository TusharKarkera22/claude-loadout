import { z } from "zod";
export declare const ConfigSchema: z.ZodObject<{
    modules: z.ZodDefault<z.ZodObject<{
        export: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
        }, {
            enabled: boolean;
        }>>;
        sanitize: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
        }, {
            enabled: boolean;
        }>>;
        install: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
        }, {
            enabled: boolean;
        }>>;
        manage: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
        }, {
            enabled: boolean;
        }>>;
    }, "strip", z.ZodTypeAny, {
        export: {
            enabled: boolean;
        };
        sanitize: {
            enabled: boolean;
        };
        install: {
            enabled: boolean;
        };
        manage: {
            enabled: boolean;
        };
    }, {
        export?: {
            enabled: boolean;
        } | undefined;
        sanitize?: {
            enabled: boolean;
        } | undefined;
        install?: {
            enabled: boolean;
        } | undefined;
        manage?: {
            enabled: boolean;
        } | undefined;
    }>>;
    export: z.ZodDefault<z.ZodObject<{
        outputDir: z.ZodDefault<z.ZodString>;
        include: z.ZodDefault<z.ZodObject<{
            claudeMd: z.ZodDefault<z.ZodBoolean>;
            skills: z.ZodDefault<z.ZodBoolean>;
            commands: z.ZodDefault<z.ZodBoolean>;
            agents: z.ZodDefault<z.ZodBoolean>;
            hooks: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            claudeMd: boolean;
            skills: boolean;
            commands: boolean;
            agents: boolean;
            hooks: boolean;
        }, {
            claudeMd?: boolean | undefined;
            skills?: boolean | undefined;
            commands?: boolean | undefined;
            agents?: boolean | undefined;
            hooks?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        outputDir: string;
        include: {
            claudeMd: boolean;
            skills: boolean;
            commands: boolean;
            agents: boolean;
            hooks: boolean;
        };
    }, {
        outputDir?: string | undefined;
        include?: {
            claudeMd?: boolean | undefined;
            skills?: boolean | undefined;
            commands?: boolean | undefined;
            agents?: boolean | undefined;
            hooks?: boolean | undefined;
        } | undefined;
    }>>;
    sanitize: z.ZodDefault<z.ZodObject<{
        allow: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        deny: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        redactAbsolutePaths: z.ZodDefault<z.ZodBoolean>;
        redactEnvAssignments: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        allow: string[];
        deny: string[];
        redactAbsolutePaths: boolean;
        redactEnvAssignments: boolean;
    }, {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        redactAbsolutePaths?: boolean | undefined;
        redactEnvAssignments?: boolean | undefined;
    }>>;
    install: z.ZodDefault<z.ZodObject<{
        profilesDir: z.ZodDefault<z.ZodString>;
        namespacePrefix: z.ZodDefault<z.ZodString>;
        allowHookImport: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        profilesDir: string;
        namespacePrefix: string;
        allowHookImport: boolean;
    }, {
        profilesDir?: string | undefined;
        namespacePrefix?: string | undefined;
        allowHookImport?: boolean | undefined;
    }>>;
    author: z.ZodOptional<z.ZodObject<{
        handle: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        handle: string;
        displayName?: string | undefined;
        url?: string | undefined;
    }, {
        handle: string;
        displayName?: string | undefined;
        url?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    export: {
        outputDir: string;
        include: {
            claudeMd: boolean;
            skills: boolean;
            commands: boolean;
            agents: boolean;
            hooks: boolean;
        };
    };
    sanitize: {
        allow: string[];
        deny: string[];
        redactAbsolutePaths: boolean;
        redactEnvAssignments: boolean;
    };
    install: {
        profilesDir: string;
        namespacePrefix: string;
        allowHookImport: boolean;
    };
    modules: {
        export: {
            enabled: boolean;
        };
        sanitize: {
            enabled: boolean;
        };
        install: {
            enabled: boolean;
        };
        manage: {
            enabled: boolean;
        };
    };
    author?: {
        handle: string;
        displayName?: string | undefined;
        url?: string | undefined;
    } | undefined;
}, {
    export?: {
        outputDir?: string | undefined;
        include?: {
            claudeMd?: boolean | undefined;
            skills?: boolean | undefined;
            commands?: boolean | undefined;
            agents?: boolean | undefined;
            hooks?: boolean | undefined;
        } | undefined;
    } | undefined;
    sanitize?: {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        redactAbsolutePaths?: boolean | undefined;
        redactEnvAssignments?: boolean | undefined;
    } | undefined;
    install?: {
        profilesDir?: string | undefined;
        namespacePrefix?: string | undefined;
        allowHookImport?: boolean | undefined;
    } | undefined;
    modules?: {
        export?: {
            enabled: boolean;
        } | undefined;
        sanitize?: {
            enabled: boolean;
        } | undefined;
        install?: {
            enabled: boolean;
        } | undefined;
        manage?: {
            enabled: boolean;
        } | undefined;
    } | undefined;
    author?: {
        handle: string;
        displayName?: string | undefined;
        url?: string | undefined;
    } | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
export declare const DEFAULT_CONFIG: Config;
export declare const CONFIG_FILENAME = "claude-loadout.config.json";
export declare function loadConfig(workDir: string): Promise<Config>;
