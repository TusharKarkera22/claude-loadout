import { readFile } from "node:fs/promises";
import { ProfileManifestSchema } from "./schema.js";
export async function loadManifest(path) {
    const raw = await readFile(path, "utf8");
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (err) {
        return { ok: false, errors: [`invalid JSON: ${err.message}`] };
    }
    const result = ProfileManifestSchema.safeParse(parsed);
    if (!result.success) {
        return {
            ok: false,
            errors: result.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`),
        };
    }
    return { ok: true, manifest: result.data };
}
//# sourceMappingURL=validator.js.map