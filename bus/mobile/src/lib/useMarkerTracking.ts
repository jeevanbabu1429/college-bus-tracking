import { useEffect, useState } from "react";

/**
 * Keeps a map Marker's custom child view tracked just long enough to be
 * captured in full.
 *
 * Android draws a Marker's children into a bitmap once and then reuses it. If
 * it takes that snapshot before the view has finished laying out, the bitmap
 * holds a half-drawn view — which is why the bus pin appears sliced on Android
 * while iOS, which composites the view directly, looks right.
 *
 * Leaving tracksViewChanges on permanently would fix the clipping and cost a
 * re-rasterisation of every marker on every frame, so it is switched off once
 * the view has settled.
 *
 * Pass a key that changes whenever the marker's *content* changes (not its
 * position — moving a marker does not need a redraw) to re-arm the capture.
 */
export function useMarkerTracking(contentKey: string | number = 0): boolean {
  const [tracking, setTracking] = useState(true);

  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), 1000);
    return () => clearTimeout(timer);
  }, [contentKey]);

  return tracking;
}
