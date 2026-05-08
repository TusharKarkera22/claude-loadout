import { readFile } from "node:fs/promises";
import { ProfileManifestSchema, type ProfileManifest } from "./schema.js";

export type ValidationResult =
  | { ok: true; manifest: ProfileManifest }
  | { ok: false; errors: string[] };

export async function loadManifest(path: string): Promise<ValidationResult> {
  const raw = await readFile(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, errors: [`invalid JSON: ${(err as Error).message}`] };
  }
  const result = ProfileManifestSchema.safeParse(parsed);
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
