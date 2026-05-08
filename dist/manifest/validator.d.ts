import { type ProfileManifest } from "./schema.js";
export type ValidationResult = {
    ok: true;
    manifest: ProfileManifest;
} | {
    ok: false;
    errors: string[];
};
export declare function loadManifest(path: string): Promise<ValidationResult>;
