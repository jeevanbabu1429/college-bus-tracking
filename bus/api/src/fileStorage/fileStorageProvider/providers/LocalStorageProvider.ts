import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

import type {
  GetOptionsLocal,
  ILocalStorageProvider,
  LocalStorageConfig,
} from "../interfaces/LocalStorageTypes.js";
import type { UpdateOptions, UploadOptions } from "../interfaces/StorageTypes.js";
import { LocalStorageHelper } from "../utils/LocalStorageHelper.js";
import { STORAGE_MESSAGES } from "../constants/storageMessages.js";
import { getErrorMessage } from "../utils/Utils.js";

function toReadable(input: Buffer | Readable | Uint8Array | string): Readable {
  if (input instanceof Readable) return input;
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) return Readable.from(input);
  throw new Error(STORAGE_MESSAGES.ERRORS.MISSING_FILE_OR_FILENAME);
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export class LocalStorageProvider implements ILocalStorageProvider {
  private readonly helper: LocalStorageHelper;

  constructor(config: LocalStorageConfig) {
    this.helper = new LocalStorageHelper(config.rootDir, config.baseUrl);
  }

  async upload({ file, filename, folderPath = "" }: UploadOptions) {
    try {
      if (!file || !filename) {
        return this.helper.buildResponse(false, STORAGE_MESSAGES.ERRORS.MISSING_FILE_OR_FILENAME, "");
      }

      const relativePath = path.join(folderPath, filename);
      const fullPath = this.helper.getFullPath(relativePath);

      await this.helper.ensureDirExists(fullPath);
      await pipeline(toReadable(file), fs.createWriteStream(fullPath));

      return this.helper.buildResponse(true, STORAGE_MESSAGES.SUCCESS.FILE_UPLOADED, relativePath);
    } catch (err: unknown) {
      return this.helper.buildResponse(
        false,
        `${STORAGE_MESSAGES.ACTIONS.UPLOAD}: ${getErrorMessage(err)}`,
        ""
      );
    }
  }

  async get({ filePath }: GetOptionsLocal) {
    try {
      if (!filePath) {
        return this.helper.buildResponse(false, STORAGE_MESSAGES.ERRORS.FILE_PATH_REQUIRED, "");
      }
      await fsPromises.access(this.helper.getFullPath(filePath));
      return this.helper.buildResponse(true, STORAGE_MESSAGES.SUCCESS.FILE_RETRIEVED, filePath);
    } catch (err: unknown) {
      return this.helper.buildResponse(
        false,
        `${STORAGE_MESSAGES.ACTIONS.GET}: ${getErrorMessage(err)}`,
        ""
      );
    }
  }

  async update({ oldFilePath, newFile, newFilename }: UpdateOptions) {
    try {
      if (!oldFilePath || !newFile || !newFilename) {
        return this.helper.buildResponse(false, STORAGE_MESSAGES.ERRORS.MISSING_UPDATE_PARAMS, "");
      }
      await this.delete(oldFilePath);
      return this.upload({
        file: newFile,
        filename: newFilename,
        folderPath: path.dirname(oldFilePath),
        mimeType: "", // ignored
      });
    } catch (err: unknown) {
      return this.helper.buildResponse(
        false,
        `${STORAGE_MESSAGES.ACTIONS.UPDATE}: ${getErrorMessage(err)}`,
        ""
      );
    }
  }

  async delete(filePath: string) {
    try {
      if (!filePath) {
        return this.helper.buildResponse(false, STORAGE_MESSAGES.ERRORS.FILE_PATH_REQUIRED, "");
      }
      await fsPromises.unlink(this.helper.getFullPath(filePath));
      return this.helper.buildResponse(true, STORAGE_MESSAGES.SUCCESS.FILE_DELETED, filePath);
    } catch (err: unknown) {
      return this.helper.buildResponse(
        false,
        `${STORAGE_MESSAGES.ACTIONS.DELETE}: ${getErrorMessage(err)}`,
        ""
      );
    }
  }

  async read(filePath: string) {
    try {
      const buffer = await fsPromises.readFile(this.helper.getFullPath(filePath));
      const contentType =
        CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
      return { contentType, buffer };
    } catch {
      return null;
    }
  }
}
