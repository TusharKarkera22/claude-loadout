import type { StorageAdapter } from "../../adapters/storage.interface.js";
import type { ProfileManifest } from "../../manifest/schema.js";
export interface InstalledProfile {
    manifest: ProfileManifest;
    alias: string;
    installedAt: string;
    installedRef: string;
    source: string;
    localPath: string;
}
export declare function listProfiles(profilesDir: string): Promise<InstalledProfile[]>;
export declare function showProfile(profilesDir: string, alias: string): Promise<InstalledProfile>;
export declare function removeProfile(profilesDir: string, alias: string): Promise<void>;
export interface UpdateOptions {
    storage: StorageAdapter;
    /** Optional ref override (otherwise re-fetch HEAD). */
    ref?: string;
    allowHookImport?: boolean;
    claudeCodeVersion?: string;
}
/**
 * Re-fetches the profile from its recorded source and re-installs in place.
 * Removes the existing install root only after the new bundle has been
 * validated, so a failed update never corrupts the existing install.
 */
export declare function updateProfile(profilesDir: string, alias: string, options: UpdateOptions): Promise<InstalledProfile>;
