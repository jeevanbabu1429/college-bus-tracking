import type { Readable } from "stream";

export interface StorageResponse {
  success: boolean;
  message: string;
  url?: string;
  path?: string;
}

export interface UploadOptions {
  file: Buffer | Readable | Uint8Array | string;
  filename: string;
  folderPath: string;
  mimeType: string;
}

export interface UpdateOptions {
  oldFilePath: string;
  newFile: Buffer | Readable | Uint8Array | string;
  newFilename: string;
  mimeType: string;
}

// Not in kareez. The app's authenticated image routes (a driver's photo, a
// complaint's screenshot) serve the bytes themselves so their URL and ETag
// stay stable for shipped app builds — so both providers can also read a file
// back.
export interface ReadResult {
  contentType: string;
  buffer: Buffer;
}
