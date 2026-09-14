import { LocalStorageProvider } from "../fileStorageProvider/providers/LocalStorageProvider.js";
import { S3StorageProvider } from "../fileStorageProvider/providers/S3StorageProvider.js";

export type StorageProvider = LocalStorageProvider | S3StorageProvider;

// Same two factories and the same env switch as kareez:
//
//   STORAGE_DRIVER=s3   AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID,
//                       AWS_SECRET_ACCESS_KEY
//   anything else       files on this server's disk under IMAGE_SERVER_PATH,
//                       served publicly at IMAGE_SERVER_URL (see fileRoute)
//
// The one difference: kareez builds a new provider — and with it a new S3
// client — on every call. These are built once per driver and reused.

export function getlocalProvider() {
  return new LocalStorageProvider({
    rootDir: process.env.IMAGE_SERVER_PATH!,
    baseUrl: process.env.IMAGE_SERVER_URL!,
  });
}

export function getS3Provider() {
  return new S3StorageProvider({
    region: process.env.AWS_REGION!,
    bucket: process.env.AWS_S3_BUCKET!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

let cached: { key: string; provider: StorageProvider } | null = null;

export function chooseStorage(): StorageProvider {
  const driver = process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
  // Keyed on the values that shape the provider, so a test that points
  // IMAGE_SERVER_PATH somewhere else gets a provider for that place.
  const key = [driver, process.env.IMAGE_SERVER_PATH, process.env.AWS_S3_BUCKET].join("|");
  if (cached?.key === key) return cached.provider;
  const provider = driver === "s3" ? getS3Provider() : getlocalProvider();
  cached = { key, provider };
  return provider;
}
