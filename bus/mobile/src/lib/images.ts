import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

// Mobile counterpart of the website's `lib/images.ts`. Profile photos are
// stored inside the driver document as a base64 data URL, so the client is
// responsible for getting them small before upload — a raw phone camera shot
// is several MB and would blow past the API's 400,000-character cap.
//
// 256px square at compress 0.82 lands around 10-20 KB, same as the website.
export const AVATAR_SIZE = 256;

// Matches MAX_IMAGE_CHARS in the API's src/lib/images.ts. Checked here too so
// the user gets a clear message instead of an opaque 400 from the server.
const MAX_IMAGE_CHARS = 400_000;

// Opens the OS photo library, lets the user crop to a square, then downscales
// and re-encodes to a JPEG data URL.
//
// Resolves to null when the user backs out — callers should treat that as a
// no-op, not an error. Throws with a user-facing message on real failures
// (permission denied, unreadable image).
export async function pickSquareAvatar(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      "Photo library access is needed to choose a picture. You can enable it in Settings."
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: true,
    // Square crop up front, so the resize below never distorts the photo.
    aspect: [1, 1],
    // Keep full quality here — the compression that matters happens after the
    // resize, where it costs far less detail.
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) return null;

  const source = result.assets[0].uri;

  const rendered = await ImageManipulator.manipulate(source)
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE })
    .renderAsync();

  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.82,
    base64: true,
  });

  if (!saved.base64) {
    throw new Error("Could not process that image. Please try another one.");
  }

  const dataUrl = `data:image/jpeg;base64,${saved.base64}`;
  if (dataUrl.length > MAX_IMAGE_CHARS) {
    throw new Error("That image is too large. Please pick a smaller one.");
  }
  return dataUrl;
}

// Longest edge of an uploaded screenshot. Big enough that UI text in the shot
// stays readable to whoever reads the complaint, small enough that a JPEG of it
// lands well inside MAX_IMAGE_CHARS.
export const SCREENSHOT_MAX_EDGE = 1080;

// Companion to pickSquareAvatar for complaint screenshots.
//
// Two differences, both deliberate. There is no `aspect` — forcing a square
// crop on a screenshot would cut off the very part of the screen the person is
// trying to show. And the resize constrains the longest edge rather than
// forcing dimensions, so a portrait phone screenshot keeps its shape.
//
// Resolves to null when the user backs out. Throws with a user-facing message
// on a real failure.
export async function pickScreenshot(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      "Photo library access is needed to attach a screenshot. You can enable it in Settings."
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];

  // Only scale down. Enlarging a small screenshot would cost bytes and add
  // nothing to read.
  const longest = Math.max(asset.width ?? 0, asset.height ?? 0);
  const scale = longest > SCREENSHOT_MAX_EDGE ? SCREENSHOT_MAX_EDGE / longest : 1;

  const context = ImageManipulator.manipulate(asset.uri);
  if (scale < 1) {
    context.resize({
      width: Math.round((asset.width ?? SCREENSHOT_MAX_EDGE) * scale),
      height: Math.round((asset.height ?? SCREENSHOT_MAX_EDGE) * scale),
    });
  }
  const rendered = await context.renderAsync();

  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.6,
    base64: true,
  });

  if (!saved.base64) {
    throw new Error("Could not process that image. Please try another one.");
  }

  const dataUrl = `data:image/jpeg;base64,${saved.base64}`;
  if (dataUrl.length > MAX_IMAGE_CHARS) {
    throw new Error(
      "That screenshot is too large. Please crop it or pick a smaller one."
    );
  }
  return dataUrl;
}
