import type { ReadResult, StorageResponse, UpdateOptions, UploadOptions } from "./StorageTypes.js";

export interface GetOptionsLocal {
  filePath: string;
}

export interface LocalStorageConfig {
  rootDir: string;
  baseUrl: string;
}

export interface ILocalStorageProvider {
  upload: (options: UploadOptions) => Promise<StorageResponse>;
  get: (options: GetOptionsLocal) => Promise<StorageResponse>;
  update: (options: UpdateOptions) => Promise<StorageResponse>;
  delete: (filePath: string) => Promise<StorageResponse>;
  read: (filePath: string) => Promise<ReadResult | null>;
}
