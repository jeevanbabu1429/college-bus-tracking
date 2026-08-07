// Turn a picked file into a small square JPEG data URL.
//
// Driver photos live inside the driver document (same approach as the banner),
// so they travel with every drivers list request. Downscaling here keeps each
// one at roughly 10-20 KB instead of the several MB a phone camera produces.

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export const AVATAR_SIZE = 256;

export async function fileToSquareDataUrl(
  file: File,
  size: number = AVATAR_SIZE,
  quality = 0.82
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (PNG, JPG or WebP).");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("That image is too large. Please pick one under 10 MB.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    // Centre-crop to a square so portrait and landscape photos both work.
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process that image.");

    // JPEG has no alpha — paint white first so transparent PNGs don't go black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bitmap.close();
  }
}
