import { apiFetch } from "./client";

export type PublicBanner = {
  _id: string;
  imageDataUrl: string;
  active: boolean;
  updatedAt: string;
};

// Public — no auth needed. Server returns null when there's no banner or
// the super admin has toggled it off. We pass `() => null` as the tokenGetter
// so the admin's Bearer isn't attached (banner is world-readable).
export const bannerApi = {
  getPublic: () =>
    apiFetch<PublicBanner | null>("/api/banner", undefined, () => null),
};
