/**
 * The one view: every object on a single canvas, opened in place.
 *
 * Drilling used to be navigation, which meant the reader lost their place
 * every time they wanted detail. Here a box grows to hold its contents and its
 * neighbours move aside, so the thing you opened stays where you were looking
 * and the level above it stays on screen.
 */

import { OBJECTS, DIAGRAMS, containmentTree, connectionsAmong, CHILD_COUNTS } from '../model/index.js';
import { nestedLayout } from '../geom/nest.js';
import { labelRect } from '../geom/routing.js';

export function createExplorerView(scene) {
  let placed = new Map();
  let edges = new Map();
  let cards = new Map();
  let frames = new Map();

  const diagramFor = (id) => (OBJECTS[id]?.drill ? DIAGRAMS[OBJECTS[id].drill] : null);

  function render(openIds, { stripesFor, onToggle } = {}) {
    const open = new Set(openIds);
    const roots = containmentTree().children;

    const { rects, width, height } = nestedLayout(roots, open, diagramFor, DIAGRAMS.context);
    placed = new Map(rects.map((r) => [r.id, r]));

    scene.clear();
    scene.setSize(width, height);
    cards = new Map();
    frames = new Map();
    edges = new Map();

    // Edges first so cards sit above them, and obstacles are every visible box
    // so a label never lands on one.
    const obstacles = rects.filter((r) => !r.open);
    // Each label placed becomes an obstacle for the next one, so two crossing
    // edges cannot both claim the same clear gap.
    const takenLabels = [];
    for (const c of connectionsAmong(open)) {
      const from = placed.get(c.from), to = placed.get(c.to);
      if (!from || !to) continue;
      const text = c.labels[0] || '';
      const drawn = scene.edge(from, to, {
        label: text,
        strong: c.strong,
        kind: c.kind || 'media',
        fromId: c.from,
        toId: c.to,
        avoid: obstacles,
        avoidLabels: takenLabels,
        obstacles,
      });
      if (text) takenLabels.push(labelRect(drawn.geometry.label, text));
      edges.set(`${c.from}>${c.to}`, drawn);
    }

    for (const rect of rects) {
      const object = OBJECTS[rect.id];
      if (!object) continue;

      if (rect.open) {
        frames.set(rect.id, scene.frame(rect, {
          id: rect.id,
          icon: object.icon,
          title: object.name,
          count: `${CHILD_COUNTS[rect.id]}`,
          scale: object.scale,
          depth: rect.depth,
          onOpen: () => onToggle?.(rect.id),
        }));
      } else {
        cards.set(rect.id, scene.node(object, rect, {
          badge: CHILD_COUNTS[rect.id] || null,
          stripes: stripesFor ? stripesFor(rect.id) : null,
        }));
      }
    }

    return { width, height, open };
  }

  /**
   * Light a selection and everything it touches.
   *
   * Selecting a box and seeing only the box is the least useful thing a
   * diagram can do. What matters about a component is what it is wired to, so
   * that is what the selection shows.
   */
  function emphasise({ selected, spotlight, activeEdge, incident } = {}) {
    scene.stage.dataset.mode = incident ? 'incident' : 'normal';

    const wired = new Set();
    if (selected) {
      wired.add(selected);
      for (const key of edges.keys()) {
        const [from, to] = key.split('>');
        if (from === selected) wired.add(to);
        else if (to === selected) wired.add(from);
      }
    }

    const lit = spotlight || (selected && wired.size > 1 ? wired : null);
    const [actFrom, actTo] = activeEdge ? activeEdge.split('>') : [];

    for (const [id, card] of cards) {
      const active = id === actFrom || id === actTo;
      card.dataset.dim = String(Boolean(lit) && !lit.has(id) && !active);
      card.dataset.act = String(active);
      card.dataset.selected = String(id === selected);
      card.dataset.wired = String(Boolean(selected) && id !== selected && wired.has(id));
    }
    for (const [id, frame] of frames) {
      frame.dataset.dim = String(Boolean(lit) && !lit.has(id));
      frame.dataset.selected = String(id === selected);
    }

    for (const [key, drawn] of edges) {
      const [from, to] = key.split('>');
      const touches = Boolean(selected) && (from === selected || to === selected);
      const active = key === activeEdge;
      const dim = Boolean(lit) && !(lit.has(from) && lit.has(to));

      for (const part of [drawn.line, drawn.tip, drawn.label, drawn.label?.plate]) {
        if (!part) continue;
        part.dataset.dim = String(dim && !active && !touches);
        part.dataset.act = String(active);
        part.dataset.wired = String(touches && !active);
      }

      if ((active || touches) && !drawn.flow && active) {
        const flow = drawn.line.cloneNode();
        flow.setAttribute('class', 'wire-flow');
        delete flow.dataset.act;
        drawn.line.after(flow);
        drawn.flow = flow;
      } else if (!active && drawn.flow) {
        drawn.flow.remove();
        drawn.flow = null;
      }
    }
  }

  const rectOf = (id) => placed.get(id) || null;

  /** Everything that can be opened, for an expand-all affordance. */
  const openable = () => Object.keys(CHILD_COUNTS).filter((id) => CHILD_COUNTS[id] > 0);

  return { render, emphasise, rectOf, openable, get edges() { return edges; } };
}
