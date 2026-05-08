export interface FetchOptions {
    ref?: string;
    shallow?: boolean;
}
export interface FetchResult {
    localPath: string;
    resolvedRef: string;
}
export interface PublishOptions {
    message: string;
    push?: boolean;
}
/**
 * Storage backend for profile bundles. v0.1 ships GitStorageAdapter only.
 * v0.2+ extension point: S3StorageAdapter, NotionStorageAdapter, PostgresStorageAdapter.
 */
export interface StorageAdapter {
    readonly id: string;
    fetch(source: string, options?: FetchOptions): Promise<FetchResult>;
    publish(localPath: string, target: string, options: PublishOptions): Promise<void>;
}
