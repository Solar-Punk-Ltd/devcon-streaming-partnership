import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  exitFace, anchorOn, cubicAt, edgeGeometry, pathOf, approxLength, centreOf,
  clearance, bestLabelT, samplePath, crossings, routedEdge, labelRect,
} from '../src/geom/routing.js';
import { DIAGRAMS } from '../src/model/diagrams.js';
import { OBJECTS, containmentTree, connectionsAmong } from '../src/model/index.js';
import { nestedLayout } from '../src/geom/nest.js';

const rect = (x, y, w = 100, h = 60) => ({ x, y, w, h });
const inside = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

test('exitFace picks the side that points at the target', () => {
  const a = rect(0, 0);
  assert.equal(exitFace(a, rect(400, 0)), 'right');
  assert.equal(exitFace(a, rect(-400, 0)), 'left');
  assert.equal(exitFace(a, rect(0, 400)), 'bottom');
  assert.equal(exitFace(a, rect(0, -400)), 'top');
});

test('the exit face follows the box diagonal, not the raw offset', () => {
  // A 60x300 column with a target 100 across and 150 down. Comparing raw
  // offsets would send the line out of the bottom, but relative to a box this
  // tall the target is plainly off to the side.
  const tall = { x: 0, y: 0, w: 60, h: 300 };
  assert.equal(exitFace(tall, { x: 100, y: 150, w: 60, h: 300 }), 'right');

  // The same rule the other way round: a flat bar with a target only slightly
  // across but well above really does leave through its top.
  const bar = { x: 0, y: 0, w: 600, h: 40 };
  assert.equal(exitFace(bar, { x: 50, y: -60, w: 600, h: 40 }), 'top');
});

test('anchors land exactly on the named face', () => {
  const r = rect(10, 20);
  assert.deepEqual(anchorOn(r, 'top'), { x: 60, y: 20 });
  assert.deepEqual(anchorOn(r, 'bottom'), { x: 60, y: 80 });
  assert.deepEqual(anchorOn(r, 'left'), { x: 10, y: 50 });
  assert.deepEqual(anchorOn(r, 'right'), { x: 110, y: 50 });
});

test('anchor slide is clamped inside the face', () => {
  const r = rect(0, 0, 100, 60);
  assert.equal(anchorOn(r, 'top', 5).x, 90);
  assert.equal(anchorOn(r, 'top', -5).x, 10);
});

test('cubicAt hits both endpoints', () => {
  const p0 = { x: 0, y: 0 }, c1 = { x: 10, y: 40 }, c2 = { x: 90, y: 40 }, p3 = { x: 100, y: 0 };
  assert.deepEqual(cubicAt(p0, c1, c2, p3, 0), p0);
  assert.deepEqual(cubicAt(p0, c1, c2, p3, 1), p3);
});

test('an edge starts and ends on the box borders, never inside', () => {
  const a = rect(0, 0), b = rect(400, 220);
  const g = edgeGeometry(a, b);
  assert.equal(inside({ x: a.x + 1, y: a.y + 1, w: a.w - 2, h: a.h - 2 }, g.p0), false);
  assert.equal(inside({ x: b.x + 1, y: b.y + 1, w: b.w - 2, h: b.h - 2 }, g.p3), false);
});

test('the label sits on the curve, not on the straight line between centres', () => {
  // This is the regression that used to hide labels behind boxes.
  const a = rect(0, 0), b = rect(0, 400);
  const g = edgeGeometry(a, b, { curve: 120, t: 0.5 });
  const straightMidX = (centreOf(a).x + centreOf(b).x) / 2;
  assert.ok(Math.abs(g.label.x - straightMidX) > 40, 'bowed edge label should leave the straight line');

  const onCurve = cubicAt(g.p0, g.c1, g.c2, g.p3, 0.5);
  assert.equal(g.label.x, onCurve.x);
  assert.equal(g.label.y, onCurve.y);
});

test('the t parameter moves the label along the curve', () => {
  const g = edgeGeometry(rect(0, 0), rect(500, 0), { t: 0.2 });
  const h = edgeGeometry(rect(0, 0), rect(500, 0), { t: 0.8 });
  assert.ok(h.label.x > g.label.x);
});

test('opposite bows separate two edges sharing endpoints', () => {
  const a = rect(0, 0), b = rect(500, 0);
  const up = edgeGeometry(a, b, { curve: 90 });
  const down = edgeGeometry(a, b, { curve: -90 });
  assert.ok(Math.abs(up.label.y - down.label.y) > 100);
});

test('pathOf emits a single cubic segment', () => {
  const d = pathOf(edgeGeometry(rect(0, 0), rect(300, 200)));
  assert.match(d, /^M[-\d.]+,[-\d.]+C[-\d.]+,[-\d.]+ [-\d.]+,[-\d.]+ [-\d.]+,[-\d.]+$/);
});

test('approxLength is at least the straight line distance', () => {
  const g = edgeGeometry(rect(0, 0), rect(600, 400));
  const straight = Math.hypot(g.p3.x - g.p0.x, g.p3.y - g.p0.y);
  assert.ok(approxLength(g) >= straight - 1e-6);
});

test('a control arm never outruns the gap it spans', () => {
  // The overshoot bug: arms longer than the gap make the curve leave, turn
  // round and come back, so the arrowhead reads as pointing at the wrong box.
  for (const gap of [4, 12, 30, 60, 140, 400]) {
    const g = edgeGeometry(rect(0, 0, 100, 60), rect(0, 60 + gap, 100, 60));
    const span = Math.hypot(g.p3.x - g.p0.x, g.p3.y - g.p0.y);
    const arm = Math.hypot(g.c1.x - g.p0.x, g.c1.y - g.p0.y);
    assert.ok(arm <= span * 0.5 + 10.001, `gap ${gap}: arm ${arm} against span ${span}`);
  }
});

test('a stacked pair points its arrow at the box below, not back at itself', () => {
  const above = rect(0, 0, 240, 120);
  const below = rect(0, 150, 240, 120);
  const g = edgeGeometry(above, below);
  // Every sampled point must travel downward; an overshoot reverses.
  const ys = samplePath(g).map((p) => p.y);
  for (let i = 1; i < ys.length; i++) {
    assert.ok(ys[i] >= ys[i - 1] - 0.001, 'the curve should never double back');
  }
});

test('a line routes around a box standing between its ends', () => {
  const a = { id: 'a', x: 0, y: 0, w: 160, h: 90 };
  const b = { id: 'b', x: 0, y: 520, w: 160, h: 90 };
  const blocker = { id: 'c', x: -30, y: 230, w: 220, h: 120 };

  const straight = edgeGeometry(a, b);
  assert.ok(crossings(straight, [blocker]) > 0, 'the straight run should be blocked');

  const routed = routedEdge(a, b, { fromId: 'a', toId: 'b' }, [a, b, blocker]);
  assert.equal(crossings(routed, [blocker]), 0, 'the routed one should go around it');
});

test('no connection in the rendered layout runs through a card', () => {
  // The thing that makes a diagram unreadable: a line vanishing behind a box
  // and reappearing, so you cannot tell which box it actually reached.
  // Checked against the layout that is actually drawn, at several depths.
  const roots = containmentTree().children;
  const diagramFor = (id) => (OBJECTS[id]?.drill ? DIAGRAMS[OBJECTS[id].drill] : null);
  const openable = Object.entries(OBJECTS).filter(([, o]) => o.drill).map(([id]) => id);

  for (const open of [new Set(), new Set(['sys']), new Set(['sys', 'pipeline']), new Set(openable)]) {
    const { rects } = nestedLayout(roots, open, diagramFor, DIAGRAMS.context);
    const placed = new Map(rects.map((r) => [r.id, r]));
    const boxes = rects.filter((r) => !r.open);

    for (const c of connectionsAmong(open)) {
      const from = placed.get(c.from), to = placed.get(c.to);
      if (!from || !to) continue;
      const g = routedEdge(from, to, { fromId: c.from, toId: c.to }, boxes);
      assert.equal(
        crossings(g, boxes, [c.from, c.to]), 0,
        `open=[${[...open].join(',')}]: ${c.from} to ${c.to} cuts through a card`,
      );
    }
  }
});

test('no two labels in the rendered layout land on each other', () => {
  // Found in the browser rather than here: two edges that cross in an X put
  // their labels in the same spot and the pair reads as one unparseable
  // string. Nothing was checking label against label, only label against card.
  const roots = containmentTree().children;
  const diagramFor = (id) => (OBJECTS[id]?.drill ? DIAGRAMS[OBJECTS[id].drill] : null);
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  for (const open of [new Set(['sys']), new Set(['sys', 'pipeline']), new Set(['sys', 'delivery'])]) {
    const { rects } = nestedLayout(roots, open, diagramFor, DIAGRAMS.context);
    const placed = new Map(rects.map((r) => [r.id, r]));
    const boxes = rects.filter((r) => !r.open);

    // Same accumulation the view does, so this measures what is drawn rather
    // than what each edge would have chosen on its own.
    const takenLabels = [];
    const drawn = [];
    for (const c of connectionsAmong(open)) {
      const from = placed.get(c.from), to = placed.get(c.to);
      if (!from || !to) continue;
      const text = c.labels[0] || '';
      const g = routedEdge(from, to, {
        fromId: c.from, toId: c.to, avoid: boxes, avoidLabels: takenLabels, label: text,
      }, boxes);
      if (!text) continue;
      const rect = labelRect(g.label, text);
      takenLabels.push(rect);
      drawn.push({ text, rect });
    }

    for (let i = 0; i < drawn.length; i += 1) {
      for (let j = i + 1; j < drawn.length; j += 1) {
        assert.equal(
          overlap(drawn[i].rect, drawn[j].rect), false,
          `open=[${[...open].join(',')}]: "${drawn[i].text}" collides with "${drawn[j].text}"`,
        );
      }
    }
  }
});

test('no label in the rendered layout lands on a card', () => {
  const roots = containmentTree().children;
  const diagramFor = (id) => (OBJECTS[id]?.drill ? DIAGRAMS[OBJECTS[id].drill] : null);

  for (const open of [new Set(), new Set(['sys']), new Set(['sys', 'delivery'])]) {
    const { rects } = nestedLayout(roots, open, diagramFor, DIAGRAMS.context);
    const placed = new Map(rects.map((r) => [r.id, r]));
    const boxes = rects.filter((r) => !r.open);

    for (const c of connectionsAmong(open)) {
      if (!c.labels.length) continue;
      const from = placed.get(c.from), to = placed.get(c.to);
      if (!from || !to) continue;
      const g = routedEdge(from, to, { fromId: c.from, toId: c.to, avoid: boxes }, boxes);
      for (const b of boxes) {
        assert.ok(clearance(g.label, b) > 0, `label "${c.labels[0]}" sits on "${b.id}"`);
      }
    }
  }
});
