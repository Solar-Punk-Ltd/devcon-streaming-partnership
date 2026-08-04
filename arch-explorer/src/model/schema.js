/**
 * Model validation.
 *
 * The model is three hand-written literals, so the failure mode is a typo in a
 * cross reference: an edge naming a node the diagram does not place, a drill
 * target that no longer exists, a scenario step pointing at an edge that was
 * renamed. None of those throw at runtime, they just silently render nothing.
 * This turns every one of them into a build failure.
 */

import { GROWS_VALUES, RESILIENCE_VALUES } from './scale.js';

/** Scenario steps name an edge as "from>to". */
export const EDGE_SEP = '>';

export const edgeKey = (from, to) => `${from}${EDGE_SEP}${to}`;

const OBJECT_TYPES = new Set([
  'External actor',
  'Software system',
  'External system',
  'Container',
  'Component',
]);

const FLOW_KINDS = new Set(['normal', 'incident']);

/** Relationship kinds, following C4: solid for the call, dashed for the rest. */
const EDGE_KINDS = new Set(['media', 'control', 'observe']);

export function validateModel({ objects, diagrams, flows, tour, overlays }) {
  const errors = [];
  const warnings = [];
  const seen = new Set();

  const fail = (msg) => errors.push(msg);
  const warn = (msg) => warnings.push(msg);

  for (const [id, o] of Object.entries(objects)) {
    if (!o.name) fail(`object "${id}" has no name`);
    if (!OBJECT_TYPES.has(o.type)) fail(`object "${id}" has unknown type "${o.type}"`);
    if (!o.icon) fail(`object "${id}" has no icon`);
    if (o.drill && !diagrams[o.drill]) fail(`object "${id}" drills to missing diagram "${o.drill}"`);
    if (Array.isArray(o.metrics)) {
      for (const m of o.metrics) {
        if (!Array.isArray(m) || m.length < 2) fail(`object "${id}" has a malformed metric`);
      }
    }
    checkScale(id, o, fail);
  }

  for (const [did, d] of Object.entries(diagrams)) {
    if (!d.name) fail(`diagram "${did}" has no name`);
    if (!(d.w > 0) || !(d.h > 0)) fail(`diagram "${did}" has no size`);
    if (d.parent && !diagrams[d.parent]) fail(`diagram "${did}" has missing parent "${d.parent}"`);
    if (d.of && !objects[d.of]) fail(`diagram "${did}" details missing object "${d.of}"`);
    if (d.parent === did) fail(`diagram "${did}" is its own parent`);

    const placed = new Set();
    for (const n of d.nodes) {
      if (!objects[n.id]) fail(`diagram "${did}" places unknown object "${n.id}"`);
      if (placed.has(n.id)) fail(`diagram "${did}" places "${n.id}" twice`);
      placed.add(n.id);
      seen.add(n.id);

      if (n.x < 0 || n.y < 0) fail(`diagram "${did}" node "${n.id}" starts off canvas`);
      if (n.x + n.w > d.w || n.y + n.h > d.h) {
        fail(`diagram "${did}" node "${n.id}" overflows the canvas`);
      }
    }

    // A band is decoration with a claim: it says the cards inside it belong
    // together. One drawn off canvas, or one that visually cuts a card in
    // half, makes that claim wrong rather than merely ugly.
    for (const g of d.groups || []) {
      if (!g.name) fail(`diagram "${did}" has an unnamed band`);
      if (!(g.w > 0) || !(g.h > 0)) fail(`diagram "${did}" band "${g.name}" has no size`);
      if (g.x < 0 || g.y < 0 || g.x + g.w > d.w || g.y + g.h > d.h) {
        fail(`diagram "${did}" band "${g.name}" runs off the canvas`);
      }
      for (const n of d.nodes) {
        const overlaps = n.x < g.x + g.w && g.x < n.x + n.w && n.y < g.y + g.h && g.y < n.y + n.h;
        const inside = n.x >= g.x && n.y >= g.y && n.x + n.w <= g.x + g.w && n.y + n.h <= g.y + g.h;
        if (overlaps && !inside) {
          fail(`diagram "${did}" band "${g.name}" cuts through node "${n.id}"`);
        }
      }
    }

    const edgeIds = new Set();
    for (const e of d.edges) {
      const key = edgeKey(e.from, e.to);
      if (!placed.has(e.from)) fail(`diagram "${did}" edge ${key} starts at an unplaced node`);
      if (!placed.has(e.to)) fail(`diagram "${did}" edge ${key} ends at an unplaced node`);
      if (e.from === e.to) fail(`diagram "${did}" edge ${key} is a self loop`);
      if (edgeIds.has(key)) warn(`diagram "${did}" has two edges keyed ${key}`);
      edgeIds.add(key);
      if (e.t !== undefined && (e.t < 0 || e.t > 1)) fail(`diagram "${did}" edge ${key} has t outside 0..1`);
      if (e.kind && !EDGE_KINDS.has(e.kind)) fail(`diagram "${did}" edge ${key} has unknown kind "${e.kind}"`);
    }
  }

  // Every diagram except the root must be reachable by drilling, otherwise the
  // tree renders an orphan the breadcrumb can never walk back to.
  const drillTargets = new Set(Object.values(objects).map((o) => o.drill).filter(Boolean));
  for (const [did, d] of Object.entries(diagrams)) {
    if (d.parent && !drillTargets.has(did)) {
      warn(`diagram "${did}" has a parent but no object drills into it`);
    }
  }

  if (tour) {
    if (!tour.name) fail('the tour has no name');
    if (!tour.steps?.length) fail('the tour has no steps');

    (tour.steps || []).forEach((s, i) => {
      const where = `tour step ${i + 1}`;
      if (!s.title) fail(`${where} has no title`);
      if (!s.text || s.text.length < 30) fail(`${where} has no readable text`);

      for (const id of s.open || []) {
        if (!objects[id]) fail(`${where} opens unknown object "${id}"`);
        else if (!objects[id].drill) fail(`${where} opens "${id}", which has nothing inside it`);
      }
      for (const id of [].concat(s.focus || [], s.light || [])) {
        if (!objects[id]) fail(`${where} names unknown object "${id}"`);
      }
      // A step naming an overlay that does not exist turns the filter off and
      // narrates a colour scheme nobody can see.
      if (s.overlay && overlays && !overlays.has(s.overlay)) {
        fail(`${where} turns on unknown overlay "${s.overlay}"`);
      }

      if (!s.edge) return;
      const [from, to] = s.edge.split(EDGE_SEP);
      if (!objects[from] || !objects[to]) {
        fail(`${where} highlights edge "${s.edge}", which names an unknown object`);
        return;
      }
      // The connection has to exist somewhere in the model, and both ends have
      // to be on screen given what this step opens.
      const exists = Object.values(diagrams).some((d) =>
        d.edges.some((e) => e.from === from && e.to === to));
      if (!exists) fail(`${where} highlights edge "${s.edge}", which no diagram has`);

      const open = new Set(s.open || []);
      for (const end of [from, to]) {
        const missing = ancestorsOfIn(end, objects, diagrams).filter((p) => !open.has(p));
        if (missing.length) {
          fail(`${where} highlights "${s.edge}" but does not open ${missing.join(', ')}`);
        }
      }
    });
  }

  for (const [fid, f] of Object.entries(flows || {})) {
    if (!f.name) fail(`scenario "${fid}" has no name`);
    if (!FLOW_KINDS.has(f.kind)) fail(`scenario "${fid}" has unknown kind "${f.kind}"`);
    if (!f.steps || !f.steps.length) fail(`scenario "${fid}" has no steps`);

    (f.steps || []).forEach((s, i) => {
      const where = `scenario "${fid}" step ${i + 1}`;
      const d = diagrams[s.d];
      if (!d) { fail(`${where} names missing diagram "${s.d}"`); return; }
      if (!s.text) fail(`${where} has no text`);
      if (!s.edge) return;

      const [from, to] = s.edge.split(EDGE_SEP);
      const found = d.edges.some((e) => e.from === from && e.to === to);
      if (!found) fail(`${where} highlights edge "${s.edge}", which diagram "${s.d}" does not have`);
    });
  }

  for (const id of Object.keys(objects)) {
    if (!seen.has(id)) warn(`object "${id}" appears in no diagram`);
  }

  return { errors, warnings, ok: errors.length === 0 };
}

/**
 * Every object has to say how many of it there are and what covers the loss of
 * one. Adding a box without answering both is how a diagram ends up implying a
 * redundancy nobody ever designed, so it is an error rather than a warning.
 */
function checkScale(id, object, fail) {
  const s = object.scale;
  if (!s) { fail(`object "${id}" does not declare scale`); return; }
  if (!s.count) fail(`object "${id}" scale has no count`);
  if (!s.unit) fail(`object "${id}" scale has no unit`);
  if (!GROWS_VALUES.has(s.grows)) fail(`object "${id}" scale has unknown grows "${s.grows}"`);
  if (!RESILIENCE_VALUES.has(s.resilience)) {
    fail(`object "${id}" scale has unknown resilience "${s.resilience}"`);
  }
  // The claim that carries the design argument. A posture with no consequence
  // written next to it is a label, not an answer.
  if (!s.onLoss || s.onLoss.length < 20) fail(`object "${id}" scale does not say what losing one costs`);
}

/**
 * Ancestors of an object, derived here rather than imported, so validation
 * stays a pure function of the literals it is handed.
 */
function ancestorsOfIn(id, objects, diagrams) {
  const parent = {};
  // An object already placed at a shallower level is context being repeated,
  // not a child. Without this, Devcon AV appears inside the system it feeds.
  const claimed = new Set();

  const walk = (diagramId, owner) => {
    const d = diagrams[diagramId];
    if (!d) return;

    const fresh = d.nodes.filter((n) => !claimed.has(n.id));
    for (const n of fresh) {
      claimed.add(n.id);
      if (owner) parent[n.id] = owner;
    }
    for (const n of fresh) {
      const drill = objects[n.id]?.drill;
      if (drill) walk(drill, n.id);
    }
  };
  walk('context', null);

  const out = [];
  for (let cur = parent[id]; cur; cur = parent[cur]) out.push(cur);
  return out;
}

export const formatIssues = (issues) =>
  issues.length ? issues.map((m) => `  - ${m}`).join('\n') : '  (none)';
