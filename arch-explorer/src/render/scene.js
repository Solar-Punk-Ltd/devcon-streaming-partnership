/**
 * The canvas: one camera, one world transform, and factories for the things
 * every view draws on it. Views decide what to place and where; the scene owns
 * panning, zooming, framing and hit testing.
 *
 * Nothing correctness bearing depends on requestAnimationFrame. A document
 * that is hidden, which is exactly what an embedded preview pane is, runs zero
 * frames, so a camera move that waited for one would simply never arrive.
 */

import {
  MIN_SCALE, MAX_SCALE, clamp, zoomAt, panBy, fitRect, boundsOf, growRect,
  lerpViewport, easeOut,
} from '../geom/viewport.js';
import { edgeGeometry, routedEdge, pathOf } from '../geom/routing.js';
import { icon, glyph, shapeOf } from './icons.js';
import { PLACE_COLOUR, placeOf } from '../model/tags.js';
import { multiplicity, colourOf, resilienceName } from '../model/scale.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
const svgEl = (tag, cls) => {
  const n = document.createElementNS(SVG_NS, tag);
  if (cls) n.setAttribute('class', cls);
  return n;
};

const GLIDE_MS = 380;
const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createScene(stage) {
  const world = el('div');
  world.id = 'world';
  const wires = svgEl('svg');
  wires.id = 'wires';
  // Decorative: the labels would otherwise be read as an orphaned list ahead
  // of every card, with no indication of what connects to what.
  wires.setAttribute('aria-hidden', 'true');
  // Labels ride above the card layer. Underneath it, any label whose midpoint
  // lands on a box is invisible, and eight of the forty one connections did.
  const labels = svgEl('svg');
  labels.id = 'labels';
  labels.setAttribute('aria-hidden', 'true');
  world.append(wires, labels);
  stage.append(world);

  let vp = { k: 1, x: 0, y: 0 };
  let size = { w: 1000, h: 600 };
  // Screen edges covered by a floating panel. Used to keep a selection out
  // from under it. Deliberately NOT used when fitting: squeezing a whole
  // diagram into the strip beside a 352px panel makes it unreadable, and a
  // diagram that resizes every time a panel opens is worse than one partly
  // covered by a panel you are about to close.
  let insets = { left: 0, right: 0 };
  let animation = null;
  const listeners = { select: [], drill: [], background: [], camera: [] };

  const emit = (name, ...args) => listeners[name].forEach((fn) => fn(...args));

  function apply() {
    world.style.transform = `translate(${vp.x}px, ${vp.y}px) scale(${vp.k})`;
    const step = 26 * vp.k;
    stage.style.setProperty('--grid-step', `${step}px`);
    stage.style.setProperty('--grid-x', `${vp.x % step}px`);
    stage.style.setProperty('--grid-y', `${vp.y % step}px`);
    emit('camera', vp);
  }

  function setViewport(next, animate = false) {
    if (animation) { clearInterval(animation.timer); animation = null; }
    if (!animate || prefersReduced() || document.hidden) { vp = next; apply(); return; }

    const from = { ...vp };
    const start = performance.now();
    // An interval rather than rAF: this must land even when no frames run.
    animation = {
      timer: setInterval(() => {
        const t = Math.min(1, (performance.now() - start) / GLIDE_MS);
        vp = lerpViewport(from, next, easeOut(t));
        apply();
        if (t >= 1) { clearInterval(animation.timer); animation = null; }
      }, 16),
    };
  }

  /**
   * Frame a world rect. When the stage has not been measured yet the request
   * is deferred rather than solved against a zero viewport, which would clamp
   * to the minimum scale and park the diagram in a corner.
   */
  function frame(rect, { animate = false, pad = 52, maxScale = MAX_SCALE, retries = 12 } = {}) {
    const next = fitRect(rect, stage.clientWidth, stage.clientHeight, pad, MIN_SCALE, maxScale);
    if (!next) {
      if (retries > 0) setTimeout(() => frame(rect, { animate: false, pad, maxScale, retries: retries - 1 }), 16);
      return;
    }
    setViewport(next, animate);
  }

  /** Declare the screen edges a floating panel is covering. */
  function setInsets(next) {
    const merged = { left: 0, right: 0, ...next };
    if (merged.left === insets.left && merged.right === insets.right) return false;
    insets = merged;
    return true;
  }

  const fit = (animate = false) => {
    const cards = [...world.querySelectorAll('.node, .frame')].map((n) => ({
      x: parseFloat(n.style.left) || 0,
      y: parseFloat(n.style.top) || 0,
      w: parseFloat(n.style.width) || 0,
      h: parseFloat(n.style.height) || 0,
    }));
    const content = cards.length ? growRect(boundsOf(cards), 34) : { x: 0, y: 0, w: size.w, h: size.h };
    frame(content, { animate, pad: 40, maxScale: 1.25 });
  };

  /** Bring a rect fully into view without changing scale unless it must. */
  function reveal(rect, animate = true) {
    const pad = 60;
    const vw = stage.clientWidth, vh = stage.clientHeight;
    if (!(vw > 0)) return;
    const left = rect.x * vp.k + vp.x, top = rect.y * vp.k + vp.y;
    const right = left + rect.w * vp.k, bottom = top + rect.h * vp.k;
    let dx = 0, dy = 0;
    if (left < insets.left + pad) dx = insets.left + pad - left;
    else if (right > vw - insets.right - pad) dx = vw - insets.right - pad - right;
    if (top < pad) dy = pad - top;
    else if (bottom > vh - pad) dy = vh - pad - bottom;
    if (dx || dy) setViewport(panBy(vp, dx, dy), animate);
  }

  // ── Interaction ──────────────────────────────────────────────────────

  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.node, .frame-head, .dock, #scenario, #overlays, .wire-hit')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    stage.setPointerCapture(e.pointerId);
    stage.dataset.panning = 'true';
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    drag.x = e.clientX; drag.y = e.clientY;
    setViewport(panBy(vp, dx, dy));
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) emit('background');
    drag = null;
    delete stage.dataset.panning;
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const box = stage.getBoundingClientRect();
    const cx = e.clientX - box.left, cy = e.clientY - box.top;
    // A trackpad pinch arrives as ctrlKey + wheel; a plain wheel also zooms,
    // because a canvas that scrolls under the pointer fights the pan.
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0022));
    setViewport(zoomAt(vp, cx, cy, factor));
  }, { passive: false });

  const zoomCentre = (factor) =>
    setViewport(zoomAt(vp, stage.clientWidth / 2, stage.clientHeight / 2, factor), true);

  // ── Factories ────────────────────────────────────────────────────────

  /**
   * One card. `opts.stripes` paints tag colours along the bottom edge,
   * `opts.badge` puts a count and drill affordance in the corner.
   */
  function node(object, rect, opts = {}) {
    const n = el('div', 'node');
    n.dataset.id = object.id;
    n.dataset.shape = shapeOf(object);
    const place = placeOf(object.id);
    if (place) {
      n.dataset.place = place;
      n.style.setProperty('--place', PLACE_COLOUR[place]);
    }
    // A card is a control, so it has to be one: focusable, named, and
    // operable without a pointer. Shift+Enter mirrors the double click.
    n.tabIndex = 0;
    n.setAttribute('role', 'button');
    // The count is drawn on the card, so it has to be spoken too. Without it a
    // screen reader gets a description of one worker and no hint that there
    // are twenty of them.
    n.setAttribute('aria-label', [
      `${object.name}.`, `${object.type}.`, object.desc || '',
      object.scale ? `${object.scale.count}, ${object.scale.unit}.` : '',
      object.scale ? `${resilienceName(object.scale.resilience)}.` : '',
    ].filter(Boolean).join(' '));
    if (object.external) n.dataset.external = 'true';
    Object.assign(n.style, {
      left: `${rect.x}px`, top: `${rect.y}px`,
      width: `${rect.w}px`, height: `${rect.h}px`,
    });

    const head = el('div', 'n-head');
    const mark = el('span', 'n-icon');
    mark.innerHTML = icon(object.icon, 15);
    const name = el('span', 'n-name');
    name.textContent = object.name;
    head.append(mark, name);

    const desc = el('p', 'n-desc');
    desc.textContent = object.desc || '';

    const foot = el('div', 'n-foot');
    const tech = el('span', 'n-tech');
    tech.textContent = `${object.type}: ${(object.tech || []).join(', ')}`;
    foot.append(tech);

    // How many of these exist, permanently, with no mode to switch on. The
    // dot carries what covers the loss of one, quietly enough not to fight
    // the placement rail down the left edge.
    if (object.scale) {
      const mult = el('span', 'n-mult');
      mult.style.setProperty('--res', colourOf(object.scale.resilience));
      mult.textContent = multiplicity(object.scale);
      mult.title = `${object.scale.unit}\n${resilienceName(object.scale.resilience)}`;
      foot.append(mult);
    }

    n.append(head, desc, foot);

    if (opts.badge) {
      n.dataset.badged = 'true';
      const badge = el('button', 'n-drill');
      badge.type = 'button';
      badge.innerHTML = `${glyph('expand', 10)}<span>${opts.badge}</span>`;
      badge.title = `Open ${object.name}`;
      // Without this the badge announces as its own bare number.
      badge.setAttribute('aria-label', `Open ${object.name}, ${opts.badge} parts inside`);
      badge.addEventListener('click', (e) => { e.stopPropagation(); emit('drill', object.id); });
      n.append(badge);
    }

    if (opts.stripes && opts.stripes.length) {
      const bar = el('div', 'n-stripes');
      for (const c of opts.stripes) {
        const s = el('span');
        s.style.background = c;
        bar.append(s);
      }
      n.append(bar);
    }

    world.insertBefore(n, labels);
    n.addEventListener('click', (e) => { e.stopPropagation(); emit('select', object.id); });
    n.addEventListener('dblclick', (e) => { e.stopPropagation(); emit('drill', object.id); });
    n.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      emit(e.shiftKey ? 'drill' : 'select', object.id);
    });
    return n;
  }

  /** One connection, returning the parts a view may want to restyle later. */
  function edge(fromRect, toRect, opts = {}) {
    // Steer around anything in the way rather than disappearing behind it.
    const g = opts.obstacles
      ? routedEdge(fromRect, toRect, opts, opts.obstacles)
      : edgeGeometry(fromRect, toRect, opts);
    const d = pathOf(g);
    const kind = opts.kind || 'media';

    const hit = svgEl('path', 'wire-hit');
    hit.setAttribute('d', d);
    if (opts.onSelect) {
      hit.setAttribute('tabindex', '0');
      hit.setAttribute('role', 'button');
      hit.setAttribute('aria-label', opts.label || 'connection');
    }
    const line = svgEl('path', 'wire');
    line.setAttribute('d', d);
    line.dataset.kind = kind;
    if (opts.strong) line.dataset.strong = 'true';

    const tip = svgEl('path', 'wire-tip');
    tip.setAttribute('d', 'M0,0 L-7.5,3.4 L-5.6,0 L-7.5,-3.4 Z');
    tip.setAttribute('transform', `translate(${g.p3.x} ${g.p3.y}) rotate(${g.tipAngle})`);
    tip.dataset.kind = kind;
    if (opts.strong) tip.dataset.strong = 'true';

    wires.append(hit, line, tip);

    let label = null;
    if (opts.label) {
      label = svgEl('text', 'wire-label');
      label.dataset.kind = kind;
      label.setAttribute('x', g.label.x.toFixed(1));
      label.setAttribute('y', (g.label.y - 7).toFixed(1));
      label.textContent = opts.label;
      labels.append(label);

      // A plate rather than a text halo. The label layer sits above the cards
      // so a label is never hidden, which means it can land on top of one, and
      // a stroke halo in the canvas colour reads as a hole punched in the box.
      // Measured after append, because getBBox needs the text laid out.
      const box = label.getBBox();
      const plate = svgEl('rect', 'wire-plate');
      plate.setAttribute('x', (box.x - 4).toFixed(1));
      plate.setAttribute('y', (box.y - 2).toFixed(1));
      plate.setAttribute('width', (box.width + 8).toFixed(1));
      plate.setAttribute('height', (box.height + 4).toFixed(1));
      plate.setAttribute('rx', '3');
      labels.insertBefore(plate, label);
      label.plate = plate;
    }

    if (opts.onSelect) {
      hit.addEventListener('click', (e) => { e.stopPropagation(); opts.onSelect(); });
      hit.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        opts.onSelect();
      });
    }

    return { geometry: g, d, line, tip, label, hit };
  }

  /**
   * A labelled band grouping related cards, drawn behind everything.
   *
   * This is the C4 boundary: a dashed region whose only job is to say these
   * things belong together. It is not selectable and it is not an object in
   * the model, so it never competes with a card for a click.
   */
  function boundary({ x, y, w, h, name, hint }) {
    const band = el('div', 'band');
    Object.assign(band.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });

    const tag = el('div', 'band-tag');
    tag.textContent = name;
    if (hint) tag.title = hint;
    band.append(tag);

    // Behind the wires as well as the cards: a band is ground, not content.
    world.insertBefore(band, world.firstChild);
    return band;
  }

  /** A dashed containment boundary with a clickable header. */
  function frameBox(rect, { id, icon: mark, title, count, scale, onOpen, selected, depth = 0 } = {}) {
    const box = el('div', 'frame');
    if (id) box.dataset.id = id;
    box.dataset.depth = String(Math.min(depth, 3));
    Object.assign(box.style, {
      left: `${rect.x}px`, top: `${rect.y}px`,
      width: `${rect.w}px`, height: `${rect.h}px`,
    });
    if (selected) box.dataset.selected = 'true';

    world.insertBefore(box, labels);
    if (title) {
      const head = el('button', 'frame-head');
      head.type = 'button';
      head.title = `Close ${title}`;
      head.innerHTML = `${icon(mark || 'system', 13)}<span></span>` +
        (count ? `<span class="fh-count">${count}</span>` : '') +
        `<span class="fh-close">${glyph('collapse', 11)}</span>`;
      head.querySelector('span').textContent = title;

      // An opened box loses its card, and with it the count. It is still
      // twenty of these, so the header has to keep saying so.
      if (scale) {
        const mult = el('span', 'fh-mult');
        mult.style.setProperty('--res', colourOf(scale.resilience));
        mult.textContent = multiplicity(scale);
        mult.title = `${scale.unit}\n${resilienceName(scale.resilience)}`;
        head.insertBefore(mult, head.querySelector('.fh-close'));
      }

      if (onOpen) head.addEventListener('click', (e) => { e.stopPropagation(); onOpen(); });
      box.append(head);
    }
    return box;
  }

  function clear() {
    for (const child of [...world.children]) {
      if (child !== wires && child !== labels) child.remove();
    }
    wires.replaceChildren();
    labels.replaceChildren();
  }

  function setSize(w, h) {
    size = { w, h };
    world.style.width = `${w}px`;
    world.style.height = `${h}px`;
    for (const layer of [wires, labels]) {
      layer.setAttribute('width', w);
      layer.setAttribute('height', h);
      layer.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
  }

  addEventListener('resize', () => apply());
  apply();

  return {
    stage, world, wires, labels,
    node, edge, boundary, frame: frameBox, clear, setSize,
    fit, frameRect: frame, reveal, zoomCentre, setInsets,
    get viewport() { return vp; },
    get size() { return size; },
    boundsOf, growRect, clampScale: (v) => clamp(v, MIN_SCALE, MAX_SCALE),
    on: (name, fn) => { listeners[name].push(fn); },
  };
}
