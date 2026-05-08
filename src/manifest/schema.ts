import { z } from "zod";

export const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$/, "must be semver");

export const ProfileItemSchema = z.object({
  type: z.enum(["skill", "command", "agent", "claude-md", "hook"]),
  path: z.string(),
  description: z.string().optional(),
});

export const ProfileManifestSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1).max(64),
  author: z.object({
    handle: z.string().min(1),
    displayName: z.string().optional(),
    url: z.string().url().optional(),
  }),
  version: SemverSchema,
  description: z.string().max(280),
  claudeCodeMinVersion: SemverSchema.optional(),
  items: z.array(ProfileItemSchema),
  dependencies: z
    .object({
      mcpServers: z.array(z.string()).optional(),
    })
    .optional(),
  createdAt: z.string().datetime(),
  tags: z.array(z.string()).optional(),
});

export type ProfileManifest = z.infer<typeof ProfileManifestSchema>;
export type ProfileItem = z.infer<typeof ProfileItemSchema>;
