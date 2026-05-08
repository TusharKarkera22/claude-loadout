import { cp } from "node:fs/promises";
import type {
  FetchOptions,
  FetchResult,
  PublishOptions,
  StorageAdapter,
} from "../../src/adapters/storage.interface.js";
import { tmp } from "./tmp.js";

/**
 * Test-only adapter: "fetches" from a local directory by copying it to a tmp dir.
 * Used in install tests to avoid network/git dependency.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly id = "local-test";

  async fetch(source: string, _options: FetchOptions = {}): Promise<FetchResult> {
    const dir = await tmp("claude-loadout-fetch-");
    await cp(source, dir, { recursive: true });
    return { localPath: dir, resolvedRef: "local" };
  }

  async publish(
    _localPath: string,
    _target: string,
    _options: PublishOptions,
  ): Promise<void> {
    throw new Error("LocalStorageAdapter.publish not implemented");
  }
}
