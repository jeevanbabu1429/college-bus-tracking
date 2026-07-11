import { Router } from "express";
import { BannerModel } from "../models/Banner.js";

// Public banner endpoint — no auth required. Every client (web, mobile,
// signed-in or not) hits this on app open to decide whether to show the
// poster overlay. Returns null when no banner is uploaded OR the banner is
// toggled off.
const router = Router();

router.get("/", async (_req, res) => {
  const banner = await BannerModel.findOne().lean();
  if (!banner || !banner.active) {
    res.json(null);
    return;
  }
  res.json({
    _id: banner._id,
    imageDataUrl: banner.imageDataUrl,
    active: banner.active,
    updatedAt: banner.updatedAt,
  });
});

export default router;
