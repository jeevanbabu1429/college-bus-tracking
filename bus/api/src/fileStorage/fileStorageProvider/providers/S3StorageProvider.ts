import { S3StorageHelper } from "../utils/S3StorageHelper.js";
import type { UpdateOptions, UploadOptions } from "../interfaces/StorageTypes.js";
import type {
  GetOptionsS3,
  IS3StorageProvider,
  S3StorageConfig,
} from "../interfaces/S3StorageTypes.js";
import { extractFolderPath, getErrorMessage } from "../utils/Utils.js";
import { STORAGE_MESSAGES } from "../constants/storageMessages.js";

export class S3StorageProvider implements IS3StorageProvider {
  private readonly helper: S3StorageHelper;

  constructor(config: S3StorageConfig) {
    this.helper = new S3StorageHelper(config);
  }

  async upload(options: UploadOptions) {
    try {
      const { file, filename, folderPath = "", mimeType } = options;
      if (!file || !filename) {
        return this.helper.buildResponse(false, STORAGE_MESSAGES.ERRORS.MISSING_FILE_OR_FILENAME, "");
      }

      const key = folderPath ? `${folderPath}/${filename}` : filename;
      await this.helper.uploadFile(key, file, mimeType);
      const signedUrl = await this.helper.getSignedUrl(key);

      return this.helper.buildResponse(true, STORAGE_MESSAGES.SUCCESS.FILE_UPLOADED, key, signedUrl);
    } catch (err: unknown) {
      return this.helper.buildResponse(
        false,
        `${STORAGE_MESSAGES.ACTIONS.UPLOAD}: ${getErrorMessage(err)}`,
        ""
      );
    }
  }

  async get(options: GetOptionsS3) {
    try {
      const { filePath, expiresIn, download, downloadFilename } = options;
      if (!filePath) {
        return this.helper.buildResponse(false, STORAGE_MESSAGES.ERRORS.FILE_PATH_REQUIRED, "");
      }
      const signedUrl = await this.helper.getSignedUrl(filePath, expiresIn, download, downloadFilename);
      return this.helper.buildResponse(true, STORAGE_MESSAGES.SUCCESS.FILE_RETRIEVED, filePath, signedUrl);
    } catch (err: unknown) {
      return this.helper.buildResponse(
        false,
        `${STORAGE_MESSAGES.ACTIONS.GET}: ${getErrorMessage(err)}`,
        ""
      );
    }
  }

  async update(options: UpdateOptions) {
    try {
      const { oldFilePath, newFile, newFilename, mimeType } = options;
      if (!oldFilePath || !newFile || !newFilename) {
        return this.helper.buildResponse(false, STORAGE_MESSAGES.ERRORS.MISSING_UPDATE_PARAMS, "");
      }
      try {
        await this.helper.deleteFile(oldFilePath);
      } catch {
        // ignore delete errors to allow overwrite
      }
      return this.upload({
        file: newFile,
        filename: newFilename,
        folderPath: extractFolderPath(oldFilePath),
        mimeType,
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
      await this.helper.deleteFile(filePath);
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
      return await this.helper.readFile(filePath);
    } catch (err: unknown) {
      this.helper.handleError(STORAGE_MESSAGES.ACTIONS.READ, err, filePath);
      return null;
    }
  }
}
