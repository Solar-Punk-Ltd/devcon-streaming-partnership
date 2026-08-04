/**
 * Pan and zoom arithmetic. No DOM, no state: every function takes a viewport
 * and returns a new one, so the whole camera is testable without a browser.
 *
 * A viewport is `{ k, x, y }`, applied as `translate(x, y) scale(k)`.
 * World coordinates are diagram units, screen coordinates are viewport pixels.
 */

export const MIN_SCALE = 0.16;
export const MAX_SCALE = 2.8;

export const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

export const IDENTITY = Object.freeze({ k: 1, x: 0, y: 0 });

export const toWorld = (vp, screenX, screenY) => ({
  x: (screenX - vp.x) / vp.k,
  y: (screenY - vp.y) / vp.k,
});

export const toScreen = (vp, worldX, worldY) => ({
  x: worldX * vp.k + vp.x,
  y: worldY * vp.k + vp.y,
});

export const panBy = (vp, dx, dy) => ({ k: vp.k, x: vp.x + dx, y: vp.y + dy });

/**
 * Zoom about a fixed screen point, so the world point under the cursor does
 * not move. The applied ratio is recomputed after clamping, otherwise a zoom
 * that hits the scale limit still drifts the canvas sideways.
 */
export function zoomAt(vp, screenX, screenY, factor, minScale = MIN_SCALE, maxScale = MAX_SCALE) {
  const k = clamp(vp.k * factor, minScale, maxScale);
  const applied = k / vp.k;
  return {
    k,
    x: screenX - (screenX - vp.x) * applied,
    y: screenY - (screenY - vp.y) * applied,
  };
}

/**
 * Camera that frames a world rect inside a viewport, centred, with `pad`
 * screen pixels of margin.
 *
 * Returns null when the viewport has no measurable size. That happens on the
 * very first render, before the grid resolves, and a null here is the signal
 * to retry rather than a scale clamped to the minimum with the diagram
 * stranded in a corner.
 */
export function fitRect(rect, viewW, viewH, pad = 48, minScale = MIN_SCALE, maxScale = MAX_SCALE) {
  if (!(viewW > 0) || !(viewH > 0)) return null;
  if (!(rect.w > 0) || !(rect.h > 0)) return null;

  const k = clamp(
    Math.min((viewW - pad * 2) / rect.w, (viewH - pad * 2) / rect.h),
    minScale,
    maxScale,
  );
  return {
    k,
    x: (viewW - rect.w * k) / 2 - rect.x * k,
    y: (viewH - rect.h * k) / 2 - rect.y * k,
  };
}

/** Union of world rects, or null when the list is empty. */
export function boundsOf(rects) {
  if (!rects.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const growRect = (rect, by) => ({
  x: rect.x - by,
  y: rect.y - by,
  w: rect.w + by * 2,
  h: rect.h + by * 2,
});

/** True when a world rect is at least partly inside the visible screen area. */
export function isVisible(vp, rect, viewW, viewH, margin = 0) {
  const a = toScreen(vp, rect.x, rect.y);
  const b = toScreen(vp, rect.x + rect.w, rect.y + rect.h);
  return b.x >= -margin && a.x <= viewW + margin && b.y >= -margin && a.y <= viewH + margin;
}

/** Cubic ease-out, matching the CSS easing used for the same transitions. */
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export const lerpViewport = (from, to, t) => ({
  k: from.k + (to.k - from.k) * t,
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
});
