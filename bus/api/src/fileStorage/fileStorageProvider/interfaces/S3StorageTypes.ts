import type { ReadResult, StorageResponse, UpdateOptions, UploadOptions } from "./StorageTypes.js";

export interface GetOptionsS3 {
  filePath: string;
  expiresIn?: number;
  download?: boolean;
  downloadFilename?: string;
}

export interface S3StorageConfig {
  region: string;
  bucket: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
}

export interface IS3StorageProvider {
  upload: (options: UploadOptions) => Promise<StorageResponse>;
  get: (options: GetOptionsS3) => Promise<StorageResponse>;
  update: (options: UpdateOptions) => Promise<StorageResponse>;
  delete: (filePath: string) => Promise<StorageResponse>;
  read: (filePath: string) => Promise<ReadResult | null>;
}
