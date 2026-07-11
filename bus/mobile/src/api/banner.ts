import { apiFetch } from "./client";

export type PublicBanner = {
  _id: string;
  imageDataUrl: string;
  active: boolean;
  updatedAt: string;
};

// Public — no auth. Server returns null when no banner exists OR the super
// admin has toggled it off.
export const bannerApi = {
  getPublic: () => apiFetch<PublicBanner | null>("/api/banner"),
};
