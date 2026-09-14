export const STORAGE_MESSAGES = {
  ERRORS: {
    S3_BUCKET_REQUIRED: "S3 bucket name is required",
    ROOT_DIR_REQUIRED: "Configuration error: The root directory (rootDir) is required.",
    BASE_URL_REQUIRED: "Configuration error: The base URL (baseUrl) is required.",
    MISSING_FILE_OR_FILENAME: "Upload failed: The file data or filename is missing.",
    FILE_PATH_REQUIRED: "Operation failed: A valid file path must be provided.",
    PATH_OUTSIDE_ROOT: "Operation failed: The file path is outside the storage root.",
    MISSING_UPDATE_PARAMS:
      "Update failed: Old file path, new file data, and new filename are all required.",
    FILE_NOT_FOUND: "File not found: The specified file does not exist on the storage server.",
    FILE_NOT_FOUND_OR_DELETE_FAILED:
      "Delete failed: The file was not found or could not be removed from storage.",
  },
  SUCCESS: {
    FILE_UPLOADED: "Success: The file has been uploaded.",
    FILE_RETRIEVED: "Success: The file has been located.",
    FILE_DELETED: "Success: The file has been deleted.",
  },
  ACTIONS: {
    UPLOAD: "File Upload",
    GET: "File Retrieve",
    UPDATE: "File Update",
    DELETE: "File Delete",
    READ: "File Read",
  },
};
