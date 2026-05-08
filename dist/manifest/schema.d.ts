import { z } from "zod";
export declare const SemverSchema: z.ZodString;
export declare const ProfileItemSchema: z.ZodObject<{
    type: z.ZodEnum<["skill", "command", "agent", "claude-md", "hook"]>;
    path: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    type: "skill" | "command" | "agent" | "claude-md" | "hook";
    description?: string | undefined;
}, {
    path: string;
    type: "skill" | "command" | "agent" | "claude-md" | "hook";
    description?: string | undefined;
}>;
export declare const ProfileManifestSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    name: z.ZodString;
    author: z.ZodObject<{
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
    }>;
    version: z.ZodString;
    description: z.ZodString;
    claudeCodeMinVersion: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["skill", "command", "agent", "claude-md", "hook"]>;
        path: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "skill" | "command" | "agent" | "claude-md" | "hook";
        description?: string | undefined;
    }, {
        path: string;
        type: "skill" | "command" | "agent" | "claude-md" | "hook";
        description?: string | undefined;
    }>, "many">;
    dependencies: z.ZodOptional<z.ZodObject<{
        mcpServers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        mcpServers?: string[] | undefined;
    }, {
        mcpServers?: string[] | undefined;
    }>>;
    createdAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    author: {
        handle: string;
        displayName?: string | undefined;
        url?: string | undefined;
    };
    description: string;
    schemaVersion: 1;
    name: string;
    version: string;
    items: {
        path: string;
        type: "skill" | "command" | "agent" | "claude-md" | "hook";
        description?: string | undefined;
    }[];
    createdAt: string;
    claudeCodeMinVersion?: string | undefined;
    dependencies?: {
        mcpServers?: string[] | undefined;
    } | undefined;
    tags?: string[] | undefined;
}, {
    author: {
        handle: string;
        displayName?: string | undefined;
        url?: string | undefined;
    };
    description: string;
    schemaVersion: 1;
    name: string;
    version: string;
    items: {
        path: string;
        type: "skill" | "command" | "agent" | "claude-md" | "hook";
        description?: string | undefined;
    }[];
    createdAt: string;
    claudeCodeMinVersion?: string | undefined;
    dependencies?: {
        mcpServers?: string[] | undefined;
    } | undefined;
    tags?: string[] | undefined;
}>;
export type ProfileManifest = z.infer<typeof ProfileManifestSchema>;
export type ProfileItem = z.infer<typeof ProfileItemSchema>;
