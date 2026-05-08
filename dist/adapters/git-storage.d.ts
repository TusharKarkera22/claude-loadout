import type { FetchOptions, FetchResult, PublishOptions, StorageAdapter } from "./storage.interface.js";
export declare class GitStorageAdapter implements StorageAdapter {
    readonly id = "git";
    fetch(source: string, options?: FetchOptions): Promise<FetchResult>;
    publish(_localPath: string, _target: string, _options: PublishOptions): Promise<void>;
    cleanup(localPath: string): Promise<void>;
}
