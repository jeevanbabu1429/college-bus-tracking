import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "stream";
import type { S3StorageConfig } from "../interfaces/S3StorageTypes.js";
import type { ReadResult, StorageResponse } from "../interfaces/StorageTypes.js";
import { S3_CONFIG } from "../constants/storageConfig.js";
import { STORAGE_MESSAGES } from "../constants/storageMessages.js";
import { handleStorageError } from "./Utils.js";

export class S3StorageHelper {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(config: S3StorageConfig) {
    if (!config.bucket) {
      throw new Error(STORAGE_MESSAGES.ERRORS.S3_BUCKET_REQUIRED);
    }
    this.bucket = config.bucket;
    this.s3Client = new S3Client({
      region: config.region,
      credentials: config.credentials,
    });
  }

  // kareez uploads through @aws-sdk/lib-storage's multipart Upload. Every image
  // here is a few hundred KB at most, far under the single-PUT limit, so a
  // plain PutObject does the same job without the extra dependency.
  async uploadFile(
    key: string,
    file: Buffer | Uint8Array | string | Readable,
    contentType?: string
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      })
    );
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async readFile(key: string): Promise<ReadResult | null> {
    try {
      const out = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      if (!out.Body) return null;
      return {
        contentType: out.ContentType ?? "application/octet-stream",
        buffer: Buffer.from(await out.Body.transformToByteArray()),
      };
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }

  async getSignedUrl(
    key: string,
    expiresIn = S3_CONFIG.DEFAULT.EXPIRESIN,
    download?: boolean,
    downloadFilename?: string
  ): Promise<string> {
    const params: GetObjectCommandInput = { Bucket: this.bucket, Key: key };
    if (download) {
      params.ResponseContentDisposition = `attachment; filename="${downloadFilename || key}"`;
    }
    // Signed as of the top of the hour rather than "now", so every read in
    // the same hour produces the same URL. Signing with "now" hands the app a
    // different query string on each list fetch and every photo re-downloads.
    const window = S3_CONFIG.DEFAULT.SIGNING_WINDOW_MS;
    const signingDate = new Date(Math.floor(Date.now() / window) * window);
    return getSignedUrl(this.s3Client, new GetObjectCommand(params), {
      expiresIn,
      signingDate,
    });
  }

  buildResponse(success: boolean, message: string, path: string, url?: string): StorageResponse {
    return { success, message, path, url };
  }

  handleError(action: string, error: unknown, filePath: string): StorageResponse {
    return handleStorageError(action, error, filePath);
  }
}
