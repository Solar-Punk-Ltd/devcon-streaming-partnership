/**
 * The model, assembled once and indexed for the views that ask questions the
 * raw literals cannot answer directly: what contains what, what depends on
 * what, which scenarios touch a given object.
 *
 * Everything here is derived. The three literals stay the single source of
 * truth, so replacing them replaces the content without touching a view.
 */

import { OBJECTS } from './objects.js';
import { DIAGRAMS } from './diagrams.js';
import { TOUR } from './tour.js';
import { buildTagGroups, tagsByObject } from './tags.js';
import { validateModel, edgeKey } from './schema.js';

for (const [id, d] of Object.entries(DIAGRAMS)) d.id = id;
for (const [id, o] of Object.entries(OBJECTS)) o.id = id;
TOUR.steps.forEach((s, i) => { s.index = i; });

export const ROOT_DIAGRAM = 'context';

/** Diagram ids from the root down to `id`, inclusive. */
export function ancestry(diagramId) {
  const chain = [];
  let cursor = diagramId;
  const guard = new Set();
  while (cursor && DIAGRAMS[cursor] && !guard.has(cursor)) {
    guard.add(cursor);
    chain.unshift(cursor);
    cursor = DIAGRAMS[cursor].parent;
  }
  return chain;
}

/**
 * Nested containment, the shape the systems view draws.
 *
 * A child of X is an object placed in X's drill diagram that no ancestor
 * diagram already places. Without that second clause the external actors a
 * detail diagram repeats for context, Devcon AV and the viewers, would read
 * as living inside the system they merely talk to.
 */
export function containmentTree() {
  const build = (diagramId, seenAbove) => {
    const d = DIAGRAMS[diagramId];
    if (!d) return [];
    const seen = new Set(seenAbove);
    for (const n of d.nodes) seen.add(n.id);

    return d.nodes
      .filter((n) => !seenAbove.has(n.id))
      .map((n) => {
        const o = OBJECTS[n.id];
        return {
          id: n.id,
          object: o,
          diagram: diagramId,
          children: o.drill ? build(o.drill, seen) : [],
        };
      });
  };

  return {
    id: ROOT_DIAGRAM,
    object: null,
    diagram: ROOT_DIAGRAM,
    children: build(ROOT_DIAGRAM, new Set()),
  };
}

export const flatten = (node, depth = 0, out = []) => {
  for (const c of node.children) {
    out.push({ ...c, depth });
    flatten(c, depth + 1, out);
  }
  return out;
};

/**
 * Every connection in the model, collapsed across diagrams. One pair of
 * objects connected at several levels of detail is one dependency, recorded
 * once with the places it shows up.
 */
export function connectionIndex() {
  const byPair = new Map();
  for (const [did, d] of Object.entries(DIAGRAMS)) {
    for (const e of d.edges) {
      const key = edgeKey(e.from, e.to);
      const entry = byPair.get(key) || { from: e.from, to: e.to, labels: [], diagrams: [], strong: false };
      if (e.label && !entry.labels.includes(e.label)) entry.labels.push(e.label);
      if (!entry.diagrams.includes(did)) entry.diagrams.push(did);
      entry.strong = entry.strong || Boolean(e.strong);
      byPair.set(key, entry);
    }
  }
  return [...byPair.values()];
}

/**
 * Who feeds this object and who it feeds. The blast radius question in graph
 * form: everything downstream is what stops when this stops.
 */
export function impactOf(objectId, connections = CONNECTIONS) {
  const incoming = connections.filter((c) => c.to === objectId);
  const outgoing = connections.filter((c) => c.from === objectId);
  return { incoming, outgoing };
}

/** Transitive downstream set, breadth first, excluding the origin. */
export function downstreamOf(objectId, connections = CONNECTIONS, maxDepth = 4) {
  const reached = new Map();
  let frontier = [objectId];
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next = [];
    for (const id of frontier) {
      for (const c of connections) {
        if (c.from !== id || c.to === objectId || reached.has(c.to)) continue;
        reached.set(c.to, depth);
        next.push(c.to);
      }
    }
    frontier = next;
  }
  return reached;
}

/** Where in the walkthrough an object is talked about. */
export function tourStepsFor(objectId) {
  return TOUR.steps.filter((s) => {
    if (s.focus === objectId) return true;
    if (Array.isArray(s.focus) && s.focus.includes(objectId)) return true;
    if ((s.light || []).includes(objectId)) return true;
    return Boolean(s.edge) && s.edge.split('>').includes(objectId);
  });
}

/** Flat, lower-cased haystack for the command palette. */
export function searchIndex() {
  const rows = [];
  for (const [id, o] of Object.entries(OBJECTS)) {
    rows.push({
      kind: 'object', id, name: o.name, sub: o.type,
      hay: `${o.name} ${o.type} ${o.desc} ${(o.tech || []).join(' ')}`.toLowerCase(),
    });
  }
  for (const [id, d] of Object.entries(DIAGRAMS)) {
    rows.push({ kind: 'diagram', id, name: d.name, sub: `${d.level} view`, hay: `${d.name} ${d.level}`.toLowerCase() });
  }
  TOUR.steps.forEach((s, i) => {
    rows.push({
      kind: 'step', id: String(i), name: s.title, sub: `Step ${i + 1}`,
      hay: `${s.title} ${s.text}`.toLowerCase(),
    });
  });
  return rows;
}

/** Object id to its containing object id, from the containment tree. */
export function parentIndex() {
  const parents = {};
  const walk = (list, parent) => list.forEach((n) => {
    parents[n.id] = parent;
    walk(n.children, n.id);
  });
  walk(containmentTree().children, null);
  return parents;
}

/**
 * The box that stands in for an object right now.
 *
 * An object inside a closed box is not on screen, so anything connected to it
 * has to connect to the closed box instead. Walks down from the root while
 * each ancestor is open and stops at the first one that is not.
 */
export function visibleStandIn(id, open, parents = PARENTS) {
  const chain = [];
  for (let cur = id; cur; cur = parents[cur]) chain.unshift(cur);

  let visible = chain[0];
  for (let i = 0; i < chain.length - 1; i += 1) {
    if (!open.has(chain[i])) break;
    visible = chain[i + 1];
  }
  return visible;
}

/** Every ancestor of an object, so opening them all reveals it. */
export function ancestorsOf(id, parents = PARENTS) {
  const out = [];
  for (let cur = parents[id]; cur; cur = parents[cur]) out.push(cur);
  return out;
}

/**
 * True when opening `boxId` puts a more specific version of this same
 * relationship on screen, which is the only reason to stop drawing the
 * summary one.
 */
export function revealsFinerEdge(c, boxId, objects = OBJECTS, diagrams = DIAGRAMS) {
  const inside = diagrams[objects[boxId]?.drill];
  if (!inside) return false;
  // The far end keeps its identity inside the drill diagram, where it is
  // repeated for context, so a finer edge is one that still touches it.
  const isTarget = boxId === c.to;
  const far = isTarget ? c.from : c.to;
  return inside.edges.some((e) => (isTarget ? e.from === far : e.to === far));
}

/**
 * Connections between whatever is currently on screen.
 *
 * An edge is drawn when both of its authored ends are visible, and dropped
 * when an end is open **and** opening it reveals a finer version of the same
 * relationship. Dropping it merely for being open is what made a box look
 * unplugged the moment you opened it: nothing inside the stage pipeline is fed
 * by the ingest edge under that name, so opening the pipeline deleted the
 * arrow into it and drew no replacement.
 */
export function connectionsAmong(open) {
  const visible = (id) => visibleStandIn(id, open) === id;

  return CONNECTIONS.filter((c) => {
    if (!visible(c.from) || !visible(c.to)) return false;
    return ![c.from, c.to].some((end) => open.has(end) && revealsFinerEdge(c, end));
  });
}

/**
 * How many things are inside each object, counted the same way the tree counts
 * them. Counting a drill diagram's nodes instead would include the externals
 * it repeats for context, so a card would claim eleven parts next to a tree
 * row saying eight.
 */
export function childCounts() {
  const counts = {};
  const walk = (list) => list.forEach((n) => {
    counts[n.id] = n.children.length;
    walk(n.children);
  });
  walk(containmentTree().children);
  return counts;
}

export const PARENTS = parentIndex();
export const CHILD_COUNTS = childCounts();
export const TAG_GROUPS = buildTagGroups(OBJECTS);
export const TAGS_BY_OBJECT = tagsByObject(TAG_GROUPS);
export const CONNECTIONS = connectionIndex();
export const VALIDATION = validateModel({
  objects: OBJECTS,
  diagrams: DIAGRAMS,
  tour: TOUR,
  overlays: new Set(TAG_GROUPS.map((g) => g.id)),
});

export { OBJECTS, DIAGRAMS, TOUR };
