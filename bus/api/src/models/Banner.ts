import { Schema, model, type InferSchemaType } from "mongoose";

// Product-wide banner shown to every user when the app opens. Singleton by
// convention — the super admin console only ever writes/reads one document.
// Image is stored as a data URL so we don't need blob storage or a static
// file server. Body size on the API is bumped to 10 MB in index.ts to allow
// reasonable poster sizes.
const bannerSchema = new Schema(
  {
    // Despite the name, new banners store a file path here (in S3 or on this
    // server's disk, per STORAGE_DRIVER); only banners from before file storage
    // hold a data URL. Kept under this name so no migration was needed — see
    // lib/images.ts.
    imageDataUrl: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type Banner = InferSchemaType<typeof bannerSchema>;
export const BannerModel = model("Banner", bannerSchema);
