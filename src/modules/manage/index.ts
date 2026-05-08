import type { ProfileManifest } from "../../manifest/schema.js";

export interface InstalledProfile {
  manifest: ProfileManifest;
  alias: string;
  installedAt: string;
  installedRef: string;
  localPath: string;
}

/**
 * Module D — Profile Manage.
 *
 * TODO(v0.1): implement against profilesDir convention.
 *   - listProfiles: read profilesDir, parse each profile.json
 *   - updateProfile: git pull in profile dir, re-validate, diff, surface changes
 *   - removeProfile: rm -rf profilesDir/<alias>, remove namespaced aliases
 *   - showProfile: print manifest + list of items
 */
export async function listProfiles(_profilesDir: string): Promise<InstalledProfile[]> {
  throw new Error("listProfiles: not implemented in v0.1 scaffold");
}

export async function updateProfile(
  _profilesDir: string,
  _alias: string,
): Promise<InstalledProfile> {
  throw new Error("updateProfile: not implemented in v0.1 scaffold");
}

export async function removeProfile(
  _profilesDir: string,
  _alias: string,
): Promise<void> {
  throw new Error("removeProfile: not implemented in v0.1 scaffold");
}

export async function showProfile(
  _profilesDir: string,
  _alias: string,
): Promise<InstalledProfile> {
  throw new Error("showProfile: not implemented in v0.1 scaffold");
}
