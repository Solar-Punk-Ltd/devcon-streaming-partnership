/**
 * The model, assembled once and indexed for the views that ask questions the
 * raw literals cannot answer directly: what contains what, what depends on
 * what, which scenarios touch a given object.
 *
 * Everything here is derived. The three literals stay the single source of
 * truth, so replacing them replaces the content without touching a view.
 *
 * Which set of literals arrives is ./select.js's business. The derivations
 * below take the model they read as an optional argument defaulting to the
 * active one, so the same functions can answer the same questions about a
 * model that is not on screen, which is how the second model is tested.
 */

import { MODEL } from './select.js';
import { buildTagGroups, tagsByObject, placeIndex } from './tags.js';
import { validateModel, edgeKey } from './schema.js';

export const OBJECTS = MODEL.objects;
export const DIAGRAMS = MODEL.diagrams;
export const TOUR = MODEL.tour;

for (const [id, d] of Object.entries(DIAGRAMS)) d.id = id;
for (const [id, o] of Object.entries(OBJECTS)) o.id = id;
TOUR.steps.forEach((s, i) => { s.index = i; });

export const ROOT_DIAGRAM = 'context';

/** What the chrome needs to name the model it is showing. */
export const MODEL_ID = MODEL.id;
export const MODEL_MARK = MODEL.mark;
export const ROOT_NAME = DIAGRAMS[ROOT_DIAGRAM].name;
/** Open on arrival: the one system worth being inside rather than looking at. */
export const INITIAL_OPEN = MODEL.open;

/** Diagram ids from the root down to `id`, inclusive. */
export function ancestry(diagramId, diagrams = DIAGRAMS) {
  const chain = [];
  let cursor = diagramId;
  const guard = new Set();
  while (cursor && diagrams[cursor] && !guard.has(cursor)) {
    guard.add(cursor);
    chain.unshift(cursor);
    cursor = diagrams[cursor].parent;
  }
  return chain;
}

/**
 * Nested containment, the shape the canvas draws.
 *
 * An object is claimed by the shallowest diagram that places it, and between
 * two diagrams at the same depth by whichever is drawn first. Everywhere else
 * it appears it is context being repeated: without that, the external actors
 * a detail diagram repeats, Devcon AV and the viewers, would read as living
 * inside the system they merely talk to, and a component two branches both
 * talk to would be drawn twice with two different parents.
 *
 * One claim set for the whole walk rather than one per branch, which is what
 * makes that last case work, and it is the same rule schema.js validates the
 * walkthrough against. Two rules here would mean a model that validates and
 * still renders a box twice.
 */
export function containmentTree(m = ACTIVE) {
  const claimed = new Set();

  const build = (diagramId) => {
    const d = m.diagrams[diagramId];
    if (!d) return [];

    // The whole level is claimed before anything descends, so a sibling
    // further down cannot take a node this one has already placed.
    const fresh = d.nodes.filter((n) => !claimed.has(n.id));
    for (const n of fresh) claimed.add(n.id);

    return fresh.map((n) => {
      const o = m.objects[n.id];
      return {
        id: n.id,
        object: o,
        diagram: diagramId,
        children: o.drill ? build(o.drill) : [],
      };
    });
  };

  return {
    id: ROOT_DIAGRAM,
    object: null,
    diagram: ROOT_DIAGRAM,
    children: build(ROOT_DIAGRAM),
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
export function connectionIndex(m = ACTIVE) {
  const byPair = new Map();
  for (const [did, d] of Object.entries(m.diagrams)) {
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
export function tourStepsFor(objectId, tour = TOUR) {
  return tour.steps.filter((s) => {
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
export function parentIndex(m = ACTIVE) {
  const parents = {};
  const walk = (list, parent) => list.forEach((n) => {
    parents[n.id] = parent;
    walk(n.children, n.id);
  });
  walk(containmentTree(m).children, null);
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
export function connectionsAmong(open, m = ACTIVE) {
  const visible = (id) => visibleStandIn(id, open, m.parents) === id;

  return m.connections.filter((c) => {
    if (!visible(c.from) || !visible(c.to)) return false;
    return ![c.from, c.to].some((end) => open.has(end) && revealsFinerEdge(c, end, m.objects, m.diagrams));
  });
}

/**
 * How many things are inside each object, counted the same way the tree counts
 * them. Counting a drill diagram's nodes instead would include the externals
 * it repeats for context, so a card would claim eleven parts next to a tree
 * row saying eight.
 */
export function childCounts(m = ACTIVE) {
  const counts = {};
  const walk = (list) => list.forEach((n) => {
    counts[n.id] = n.children.length;
    walk(n.children);
  });
  walk(containmentTree(m).children);
  return counts;
}

/**
 * One model's literals with the two indexes every question needs, so a model
 * can be interrogated without being the one the page is showing.
 */
export function indexModel(objects, diagrams) {
  const literals = { objects, diagrams };
  return {
    objects,
    diagrams,
    parents: parentIndex(literals),
    connections: connectionIndex(literals),
  };
}

/** The model on screen, indexed. Every derivation above defaults to it. */
export const ACTIVE = indexModel(OBJECTS, DIAGRAMS);

export const PARENTS = ACTIVE.parents;
export const CONNECTIONS = ACTIVE.connections;
export const CHILD_COUNTS = childCounts(ACTIVE);
export const TAG_GROUPS = buildTagGroups(OBJECTS, MODEL.groups);
export const TAGS_BY_OBJECT = tagsByObject(TAG_GROUPS);

/** Where each thing runs, painted on every card all the time. Per model. */
export const PLACE_COLOUR = MODEL.placeColour;
export const placeOf = placeIndex(MODEL.places);

export const VALIDATION = validateModel({
  objects: OBJECTS,
  diagrams: DIAGRAMS,
  tour: TOUR,
  overlays: new Set(TAG_GROUPS.map((g) => g.id)),
});
