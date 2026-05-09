import { readFile } from "node:fs/promises";
import { z } from "zod";
import { SemverSchema } from "./schema.js";

export const HandoffManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
  author: z.object({
    handle: z.string().min(1).max(64),
    displayName: z.string().optional(),
    url: z.string().url().optional(),
  }),
  createdAt: z.string().datetime(),
  branch: z.string().min(1),
  baseCommit: z.string().regex(/^[0-9a-f]{7,40}$/),
  repoUrl: z.string().optional(),
  summaryFile: z.literal("handoff.md"),
  diffFile: z.literal("changes.patch").optional(),
  todos: z
    .array(
      z.object({
        text: z.string(),
        done: z.boolean().default(false),
      }),
    )
    .optional(),
  claudeCodeMinVersion: SemverSchema.optional(),
  sanitized: z
    .object({
      findings: z.number().int().nonnegative(),
      lastScanAt: z.string().datetime(),
    })
    .optional(),
});

export type HandoffManifest = z.infer<typeof HandoffManifestSchema>;

export type HandoffValidationResult =
  | { ok: true; manifest: HandoffManifest }
  | { ok: false; errors: string[] };

export async function loadHandoffManifest(
  path: string,
): Promise<HandoffValidationResult> {
  const raw = await readFile(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, errors: [`invalid JSON: ${(err as Error).message}`] };
  }
  const result = HandoffManifestSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join(".") || "<root>"}: ${i.message}`,
      ),
    };
  }
  return { ok: true, manifest: result.data };
}
