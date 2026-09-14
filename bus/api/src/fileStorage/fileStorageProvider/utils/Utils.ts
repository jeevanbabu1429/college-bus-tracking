import type { StorageResponse } from "../interfaces/StorageTypes.js";

export function extractFolderPath(filePath: string): string {
  const lastSlashIndex = filePath.lastIndexOf("/");
  return lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex) : "";
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export function handleStorageError(
  action: string,
  error: unknown,
  filePath: string
): StorageResponse {
  const message = getErrorMessage(error);
  // kareez logs through its common logger; this API logs to the console.
  console.error(`[${action}] Error for file '${filePath}': ${message}`, error);
  return {
    success: false,
    message: `Error during ${action}: ${message}`,
    path: filePath,
  };
}
