/**
 * Edge geometry. Lines leave a box perpendicular to the face that points at
 * the target and curve into the target's facing edge, which is what stops
 * connections from cutting diagonally across the boxes between them.
 *
 * Label placement evaluates the curve directly rather than asking the DOM for
 * `getPointAtLength`, so a label's position can be asserted in a unit test
 * and never lands underneath a box.
 */

export const FACES = Object.freeze(['top', 'right', 'bottom', 'left']);

const NORMALS = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export const centreOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/**
 * Which face of `from` a ray toward `to` actually leaves through.
 *
 * Normalising each offset by its own half extent is the standard test against
 * the box diagonal: it reduces to `|dx| * h >= |dy| * w`. Comparing the raw
 * offsets instead would send a tall narrow box out of its bottom edge for a
 * target that is plainly off to one side.
 */
export function exitFace(from, to) {
  const a = centreOf(from), b = centreOf(to);
  const dx = b.x - a.x, dy = b.y - a.y;
  const byX = Math.abs(dx) / Math.max(from.w / 2, 1);
  const byY = Math.abs(dy) / Math.max(from.h / 2, 1);
  if (byX >= byY) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

/**
 * A point on `face` of `rect`, slid along that face toward the target so
 * parallel connections between the same pair of boxes do not stack up on one
 * pixel. `slide` runs -1 to 1 and is clamped to 80% of the face.
 */
export function anchorOn(rect, face, slide = 0) {
  const s = Math.max(-0.8, Math.min(0.8, slide));
  switch (face) {
    case 'top': return { x: rect.x + rect.w / 2 + (rect.w / 2) * s, y: rect.y };
    case 'bottom': return { x: rect.x + rect.w / 2 + (rect.w / 2) * s, y: rect.y + rect.h };
    case 'left': return { x: rect.x, y: rect.y + rect.h / 2 + (rect.h / 2) * s };
    default: return { x: rect.x + rect.w, y: rect.y + rect.h / 2 + (rect.h / 2) * s };
  }
}

/** Point on a cubic bezier at parameter t. */
export function cubicAt(p0, c1, c2, p3, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
  };
}

/** Tangent angle in degrees at parameter t, for orienting a label or marker. */
export function cubicAngleAt(p0, c1, c2, p3, t) {
  const u = 1 - t;
  const dx = 3 * u * u * (c1.x - p0.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (p3.x - c2.x);
  const dy = 3 * u * u * (c1.y - p0.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (p3.y - c2.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

/** Distance from a point to a rect, 0 when the point is inside it. */
export function clearance(point, rect) {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.w));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}

/**
 * Where along the curve to put the label.
 *
 * Optimal edge label placement is NP-hard, so this is the standard practical
 * approach: keep every other element where it is, sample candidate positions
 * along the edge, and take the one that sits furthest from anything it could
 * land on. The preferred position wins outright when it is already clear, so
 * a hand-tuned `t` is still honoured wherever it works.
 *
 * @param {number} preferred  0 to 1, the position asked for
 * @param {Array}  boxes      rects the label must not sit on
 * @param {number} needed     clearance in world units that counts as clear
 */
/** Width of one character of label text, 10px monospace, in world units. */
export const LABEL_CHAR_W = 5.4;

/**
 * The box a label occupies, estimated from its text. Exported so the renderer
 * and anything checking the result share one estimate rather than two.
 */
export function labelRect(point, text) {
  const w = (text || '').length * LABEL_CHAR_W;
  return { x: point.x - w / 2, y: point.y - 14, w, h: 13 };
}

export function bestLabelT(curve, preferred, boxes, needed = 26, samples = 25) {
  if (!boxes || !boxes.length) return preferred;

  const scoreAt = (t) => {
    const p = cubicAt(curve.p0, curve.c1, curve.c2, curve.p3, t);
    let worst = Infinity;
    for (const b of boxes) worst = Math.min(worst, clearance(p, b));
    return worst;
  };

  if (scoreAt(preferred) >= needed) return preferred;

  let bestT = preferred, best = -Infinity;
  for (let i = 0; i <= samples; i++) {
    // Endpoints are excluded: a label on top of an arrowhead is no better
    // than one on top of a box.
    const t = 0.16 + (0.68 * i) / samples;
    const score = scoreAt(t);
    // Ties break toward the requested position, which keeps the result stable
    // and keeps deliberate placement where the author put it.
    if (score > best + 0.01 || (Math.abs(score - best) <= 0.01 && Math.abs(t - preferred) < Math.abs(bestT - preferred))) {
      best = score;
      bestT = t;
    }
  }
  return bestT;
}

/**
 * Full geometry for one connection.
 *
 * @param {{x,y,w,h}} from  source rect in world units
 * @param {{x,y,w,h}} to    target rect in world units
 * @param {object}    opts
 * @param {number}    opts.t      where the label sits along the curve, 0 to 1
 * @param {number}    opts.curve  extra sideways bow, world units, for edges
 *                                that would otherwise overlap a neighbour
 * @param {number}    opts.slide  offset along the exit face, -1 to 1
 */
export function edgeGeometry(from, to, opts = {}) {
  const { t = 0.5, curve = 0, slide = 0, avoid = null, avoidLabels = null } = opts;

  const faceOut = exitFace(from, to);
  const faceIn = exitFace(to, from);
  const p0 = anchorOn(from, faceOut, slide);
  const p3 = anchorOn(to, faceIn, slide);

  // Control arms scale with the gap. Capped at 40% of the actual span, because
  // an arm longer than the gap makes the curve leave, overshoot and come back,
  // which reads as an arrow pointing at the wrong box.
  const reach = Math.max(10, Math.min(dist(p0, p3) * 0.4, 170));
  const nOut = NORMALS[faceOut], nIn = NORMALS[faceIn];

  // A perpendicular bow, applied to both arms, separates edges that share a
  // pair of endpoints.
  const bowX = curve ? -nOut.y * curve : 0;
  const bowY = curve ? nOut.x * curve : 0;

  const c1 = { x: p0.x + nOut.x * reach + bowX, y: p0.y + nOut.y * reach + bowY };
  const c2 = { x: p3.x + nIn.x * reach + bowX, y: p3.y + nIn.y * reach + bowY };

  const shape = { p0, c1, c2, p3 };
  // Labels compete with each other for space, not only with boxes. Two edges
  // that cross put their labels in the same clear gap otherwise, and the pair
  // reads as one unparseable string. Each label already placed is widened by
  // half of this one, because clearance is measured from an anchor point and
  // the text spreads either side of it.
  const half = ((opts.label || '').length * LABEL_CHAR_W) / 2;
  const taken = (avoidLabels || []).map((r) => ({ ...r, x: r.x - half, w: r.w + half * 2 }));
  const labelT = bestLabelT(shape, t, taken.length ? [...(avoid || []), ...taken] : avoid);

  return {
    p0, c1, c2, p3,
    faceOut, faceIn,
    labelT,
    label: cubicAt(p0, c1, c2, p3, labelT),
    angle: cubicAngleAt(p0, c1, c2, p3, labelT),
    tipAngle: cubicAngleAt(p0, c1, c2, p3, 1),
  };
}

/** SVG path data for a geometry from `edgeGeometry`. */
export const pathOf = (g) =>
  `M${g.p0.x.toFixed(2)},${g.p0.y.toFixed(2)}` +
  `C${g.c1.x.toFixed(2)},${g.c1.y.toFixed(2)}` +
  ` ${g.c2.x.toFixed(2)},${g.c2.y.toFixed(2)}` +
  ` ${g.p3.x.toFixed(2)},${g.p3.y.toFixed(2)}`;

/**
 * Approximate arc length, sampled. Used to space dots along a flowing edge at
 * a constant visual speed regardless of how long the connection is.
 */
export function approxLength(g, samples = 24) {
  let total = 0;
  let prev = g.p0;
  for (let i = 1; i <= samples; i++) {
    const p = cubicAt(g.p0, g.c1, g.c2, g.p3, i / samples);
    total += dist(prev, p);
    prev = p;
  }
  return total;
}

/** Sampled points along a curve, for testing what it passes over. */
export function samplePath(g, samples = 26) {
  const points = [];
  for (let i = 0; i <= samples; i++) points.push(cubicAt(g.p0, g.c1, g.c2, g.p3, i / samples));
  return points;
}

/**
 * How badly a curve cuts through boxes it does not connect.
 *
 * Zero means clear. Higher counts sampled points landing inside a box, so a
 * line clipping a corner scores better than one running through the middle of
 * a card.
 */
export function crossings(g, boxes, ignore = [], inset = 7) {
  const skip = new Set(ignore);
  let hits = 0;
  for (const p of samplePath(g)) {
    for (const b of boxes) {
      if (skip.has(b.id)) continue;
      // Inset, because running alongside a card's edge is readable and only
      // running through its body is not.
      const core = { x: b.x + inset, y: b.y + inset, w: b.w - inset * 2, h: b.h - inset * 2 };
      if (core.w > 0 && core.h > 0 && clearance(p, core) === 0) hits += 1;
    }
  }
  return hits;
}

/**
 * Geometry that goes around what is in the way.
 *
 * A connection disappearing behind a card and reappearing on the far side is
 * the most confusing thing a diagram can do, because the reader cannot tell
 * which box it actually reached. This tries progressively wider bows and takes
 * the first that is clear, falling back to the least bad.
 */
export function routedEdge(from, to, opts = {}, boxes = []) {
  const obstacles = boxes.filter((b) => b.id !== opts.fromId && b.id !== opts.toId);
  const base = edgeGeometry(from, to, { ...opts, avoid: boxes });
  if (!obstacles.length || crossings(base, obstacles) === 0) return base;

  const bow = opts.curve || 0;
  let best = base;
  let bestScore = crossings(base, obstacles);

  // Widening steps, alternating side. A connection may have to clear a whole
  // stacked column two cells wide, so the search reaches well past one card.
  for (const extra of [50, -50, 95, -95, 145, -145, 200, -200, 265, -265,
    340, -340, 430, -430, 540, -540, 670, -670, 820, -820, 1000, -1000,
    1200, -1200, 1450, -1450]) {
    const candidate = edgeGeometry(from, to, { ...opts, curve: bow + extra, avoid: boxes });
    const score = crossings(candidate, obstacles);
    if (score === 0) return candidate;
    if (score < bestScore) { best = candidate; bestScore = score; }
  }
  return best;
}
