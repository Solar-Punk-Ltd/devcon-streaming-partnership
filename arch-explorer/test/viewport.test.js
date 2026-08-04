import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IDENTITY, toWorld, toScreen, panBy, zoomAt, fitRect, boundsOf, isVisible,
  lerpViewport, clamp, MIN_SCALE, MAX_SCALE,
} from '../src/geom/viewport.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

test('screen and world coordinates round trip', () => {
  const vp = { k: 1.7, x: -230, y: 44 };
  const screen = toScreen(vp, 312, -88);
  const back = toWorld(vp, screen.x, screen.y);
  near(back.x, 312, 1e-9);
  near(back.y, -88, 1e-9);
});

test('panning moves the origin and leaves scale alone', () => {
  const vp = panBy({ k: 2, x: 10, y: 10 }, -5, 30);
  assert.deepEqual(vp, { k: 2, x: 5, y: 40 });
});

test('zooming holds the world point under the cursor still', () => {
  const vp = { k: 1, x: 0, y: 0 };
  const cursor = { x: 640, y: 300 };
  const before = toWorld(vp, cursor.x, cursor.y);
  const after = toWorld(zoomAt(vp, cursor.x, cursor.y, 1.6), cursor.x, cursor.y);
  near(after.x, before.x, 1e-6);
  near(after.y, before.y, 1e-6);
});

test('a zoom clamped at the ceiling does not drift sideways', () => {
  // Requesting far past MAX_SCALE must still keep the cursor point fixed,
  // which is only true if the applied ratio is recomputed after clamping.
  const vp = { k: MAX_SCALE * 0.98, x: 120, y: -60 };
  const cursor = { x: 400, y: 250 };
  const before = toWorld(vp, cursor.x, cursor.y);
  const zoomed = zoomAt(vp, cursor.x, cursor.y, 50);
  assert.equal(zoomed.k, MAX_SCALE);
  const after = toWorld(zoomed, cursor.x, cursor.y);
  near(after.x, before.x, 1e-6);
  near(after.y, before.y, 1e-6);
});

test('zoom respects both scale limits', () => {
  assert.equal(zoomAt(IDENTITY, 0, 0, 0.0001).k, MIN_SCALE);
  assert.equal(zoomAt(IDENTITY, 0, 0, 10000).k, MAX_SCALE);
});

test('fitRect centres the rect in the viewport', () => {
  const rect = { x: 0, y: 0, w: 1000, h: 500 };
  const vp = fitRect(rect, 1200, 800, 0, MIN_SCALE, 4);
  const a = toScreen(vp, rect.x, rect.y);
  const b = toScreen(vp, rect.x + rect.w, rect.y + rect.h);
  near((a.x + b.x) / 2, 600, 1e-6);
  near((a.y + b.y) / 2, 400, 1e-6);
});

test('fitRect honours padding on the limiting axis', () => {
  const vp = fitRect({ x: 0, y: 0, w: 1000, h: 100 }, 1200, 800, 50, MIN_SCALE, 4);
  near(vp.k, (1200 - 100) / 1000, 1e-9);
});

test('fitRect returns null rather than stranding the diagram', () => {
  // The first render reads a viewport of zero before the grid resolves. A
  // number here would clamp to MIN_SCALE and park the diagram in a corner.
  const rect = { x: 0, y: 0, w: 800, h: 600 };
  assert.equal(fitRect(rect, 0, 0), null);
  assert.equal(fitRect(rect, 900, 0), null);
  assert.equal(fitRect({ x: 0, y: 0, w: 0, h: 0 }, 900, 900), null);
});

test('boundsOf unions rects and handles the empty case', () => {
  assert.equal(boundsOf([]), null);
  assert.deepEqual(
    boundsOf([{ x: 10, y: 10, w: 10, h: 10 }, { x: 50, y: 0, w: 20, h: 5 }]),
    { x: 10, y: 0, w: 60, h: 20 },
  );
});

test('isVisible rejects rects scrolled off screen', () => {
  const vp = { k: 1, x: 0, y: 0 };
  assert.equal(isVisible(vp, { x: 10, y: 10, w: 50, h: 50 }, 800, 600), true);
  assert.equal(isVisible(vp, { x: -400, y: 10, w: 50, h: 50 }, 800, 600), false);
  assert.equal(isVisible(vp, { x: 900, y: 10, w: 50, h: 50 }, 800, 600), false);
  assert.equal(isVisible(vp, { x: 900, y: 10, w: 50, h: 50 }, 800, 600, 200), true);
});

test('lerpViewport lands exactly on both ends', () => {
  const a = { k: 1, x: 0, y: 0 }, b = { k: 2, x: 100, y: -40 };
  assert.deepEqual(lerpViewport(a, b, 0), a);
  assert.deepEqual(lerpViewport(a, b, 1), b);
});

test('clamp bounds both ways', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(50, 0, 10), 10);
});
