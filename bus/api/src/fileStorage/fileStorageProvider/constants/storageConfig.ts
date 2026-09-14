export const S3_CONFIG = {
  DEFAULT: {
    // kareez signs for 300 s. Ours is longer and paired with a signing date
    // floored to the hour (see S3StorageHelper.getSignedUrl), so the same
    // image keeps the same URL for an hour and image caches actually hit.
    EXPIRESIN: 2 * 60 * 60,
    SIGNING_WINDOW_MS: 60 * 60 * 1000,
  },
};
