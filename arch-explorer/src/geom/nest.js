/**
 * Nested layout: one canvas where any box can be opened in place.
 *
 * The authored diagrams put boxes where a person wanted them, which is worth
 * keeping. But absolute positions cannot grow, and opening a box has to make
 * room for its contents at any depth. So the authored coordinates are read as
 * a grid rather than as pixels: nodes that share roughly an x become a column,
 * nodes that share roughly a y become a row, and the tracks are then sized
 * from whatever those cells actually contain.
 *
 * That keeps the arrangement the author chose, in particular the left to right
 * flow, while letting a single cell expand and push its neighbours outward.
 *
 * Pure arithmetic, no DOM.
 */

export const CARD = Object.freeze({ w: 232, h: 118 });
// Wide enough for a connection to pass between two boxes rather than over
// one of them. Routing has to have somewhere to route.
export const GAP = Object.freeze({ x: 78, y: 56 });
export const PAD = Object.freeze({ top: 46, side: 30, bottom: 30 });

/** Nodes within this many world units of each other share a track. */
const TRACK_TOLERANCE = 60;

/**
 * Cluster values into tracks. Returns a function from value to track index,
 * preserving order, so a diagram's own left-to-right reading survives.
 */
export function trackIndex(values, tolerance = TRACK_TOLERANCE) {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const starts = [];
  for (const v of sorted) {
    if (!starts.length || v - starts[starts.length - 1] > tolerance) starts.push(v);
  }
  return (value) => {
    let best = 0;
    for (let i = 0; i < starts.length; i++) if (value >= starts[i] - tolerance) best = i;
    return best;
  };
}

/** Grid coordinates for every node of a diagram, from its authored layout. */
export function gridOf(diagram) {
  const col = trackIndex(diagram.nodes.map((n) => n.x));
  const row = trackIndex(diagram.nodes.map((n) => n.y));
  const cells = new Map();
  for (const n of diagram.nodes) cells.set(n.id, { col: col(n.x), row: row(n.y) });
  return cells;
}

const sum = (list, upto = list.length) => list.slice(0, upto).reduce((a, b) => a + b, 0);

/**
 * Arrange cells into columns, stacking each column independently.
 *
 * Global row tracks are wrong for a flow diagram: one tall box makes its whole
 * row tall, which flings everything in that row to the far edges of it. Each
 * column stacking its own contents and centring against the tallest keeps the
 * left to right reading and costs no vertical space it does not need.
 *
 * @param {Array} cells  each `{w, h, col, order}`
 * @returns {{slots: Array<{x, y}>, width, height}}
 */
export function packColumns(cells) {
  const cols = Math.max(...cells.map((c) => c.col)) + 1;
  const byCol = Array.from({ length: cols }, () => []);
  cells.forEach((c, i) => byCol[c.col].push({ ...c, i }));
  for (const column of byCol) column.sort((a, b) => a.order - b.order);

  const colW = byCol.map((column) => Math.max(0, ...column.map((c) => c.w)));
  const colH = byCol.map((column) =>
    column.reduce((total, c) => total + c.h, 0) + Math.max(column.length - 1, 0) * GAP.y);

  const height = Math.max(...colH, 0);
  const width = sum(colW) + Math.max(cols - 1, 0) * GAP.x;

  const slots = new Array(cells.length);
  byCol.forEach((column, ci) => {
    const x = sum(colW, ci) + ci * GAP.x;
    let y = (height - colH[ci]) / 2;
    for (const c of column) {
      // Centred in its column, so a narrow card in a wide column still reads
      // as belonging to it.
      slots[c.i] = { x: x + (colW[ci] - c.w) / 2, y };
      y += c.h + GAP.y;
    }
  });

  return { slots, width, height };
}

/**
 * Measure a node and everything opened beneath it.
 *
 * @param {{id, children}} node   containment node
 * @param {Set<string>} open      ids whose children are shown
 * @param {(id) => object} diagramFor  the drill diagram of an object, or null
 */
export function measure(node, open, diagramFor) {
  const diagram = diagramFor(node.id);
  const isOpen = open.has(node.id) && node.children.length > 0 && diagram;
  if (!isOpen) return { id: node.id, w: CARD.w, h: CARD.h, open: false, children: [] };

  const grid = gridOf(diagram);
  const kids = node.children.map((c) => {
    const cell = grid.get(c.id) || { col: 0, row: 0 };
    return { ...measure(c, open, diagramFor), col: cell.col, order: cell.row };
  });

  const packed = packColumns(kids);
  return {
    id: node.id,
    open: true,
    children: kids,
    slots: packed.slots,
    w: PAD.side * 2 + packed.width,
    h: PAD.top + PAD.bottom + packed.height,
  };
}

/** Assign absolute positions to a measured tree. */
export function place(measured, x = 0, y = 0, depth = 0, out = []) {
  out.push({ id: measured.id, x, y, w: measured.w, h: measured.h, open: measured.open, depth });

  if (measured.open) {
    measured.children.forEach((kid, i) => {
      const slot = measured.slots[i];
      place(kid, x + PAD.side + slot.x, y + PAD.top + slot.y, depth + 1, out);
    });
  }
  return out;
}

/**
 * Lay out the whole model. Roots use the root diagram's own grid, so the top
 * level keeps the arrangement it was drawn with.
 */
export function nestedLayout(roots, open, diagramFor, rootDiagram) {
  const grid = gridOf(rootDiagram);
  const measured = roots.map((r) => {
    const cell = grid.get(r.id) || { col: 0, row: 0 };
    return { ...measure(r, open, diagramFor), col: cell.col, order: cell.row };
  });

  const packed = packColumns(measured);
  const rects = [];
  measured.forEach((m, i) => place(m, packed.slots[i].x, packed.slots[i].y, 0, rects));

  return { rects, width: packed.width, height: packed.height };
}
