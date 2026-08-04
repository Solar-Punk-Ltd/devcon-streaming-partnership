/**
 * Wiring. One store, one scene, three views, and a single render pass that
 * every change funnels through, so there is exactly one place where state
 * becomes pixels.
 */

import { OBJECTS, TOUR, VALIDATION, ancestorsOf, CHILD_COUNTS } from './model/index.js';
import { createStore } from './state/store.js';
import { createScene } from './render/scene.js';
import { createExplorerView } from './views/explorer.js';
import { createTree } from './ui/tree.js';
import { createInspector } from './ui/inspector.js';
import { createOverlays, stripesFor, filterSpotlight } from './ui/overlays.js';
import { createTour, spotlightOf, focusOf } from './ui/tour.js';
import { createChrome, applyTheme, nextTheme, toast } from './ui/chrome.js';
import { glyph } from './render/icons.js';

// A broken cross reference renders nothing and throws nothing, so it is worth
// saying out loud rather than leaving someone to wonder why a step is blank.
if (!VALIDATION.ok) {
  console.error(`Model validation failed:\n${VALIDATION.errors.join('\n')}`);
}

const $ = (id) => document.getElementById(id);
const refs = {
  app: $('app'),
  rail: $('rail'),
  crumbs: $('crumbs'),
  stage: $('stage'),
  tree: $('tree'),
  inspector: $('inspector'),
  overlays: $('overlays'),
  scenario: $('scenario'),
  palette: $('palette'),
  treeToggle: $('tree-toggle'),
};

const scene = createScene(refs.stage);
const explorerView = createExplorerView(scene);

const store = createStore(render);

/* ── Navigation ───────────────────────────────────────────────────────── */

/**
 * Move to an object wherever it lives, switching diagram if the current one
 * does not hold it. Selecting something in the tree should never leave the
 * canvas showing a view that does not contain it.
 */
function goToObject(id) {
  tree.revealPath(id);
  // Selecting something buried has to open the boxes it is buried in, or the
  // canvas shows a selection that is not on screen.
  const opened = new Set(store.get().opened);
  for (const parent of ancestorsOf(id)) opened.add(parent);

  store.set({ selected: id, opened: [...opened], inspector: true });
  // revealPath mutated the tree's own state, which a no-op patch would never
  // flush. Searching for what you are already looking at still has to open
  // the branch it sits in.
  tree.render(store.get());
}

/** Open or close a box in place. */
function openInside(id) {
  if (!CHILD_COUNTS[id]) {
    const object = OBJECTS[id];
    if (object) toast(`${object.name} has nothing inside it.`);
    return;
  }

  const opened = new Set(store.get().opened);
  if (opened.has(id)) {
    // Closing takes everything under it with it, otherwise reopening later
    // springs back to a depth nobody asked for.
    for (const other of [...opened]) if (ancestorsOf(other).includes(id)) opened.delete(other);
    opened.delete(id);
  } else {
    for (const parent of ancestorsOf(id)) opened.add(parent);
    opened.add(id);
  }
  store.set({ opened: [...opened], selected: id });
}

/**
 * Enter the walkthrough, or jump to a step in it.
 *
 * A step declares the exact set of boxes it wants open rather than a set to
 * add, so the walkthrough closes what it is finished with. Following it should
 * feel like being shown around, not like watching things pile up.
 */
function goToStep(index, playing) {
  const next = ((index % TOUR.steps.length) + TOUR.steps.length) % TOUR.steps.length;
  const step = TOUR.steps[next];

  store.set({
    touring: true,
    step: next,
    playing: playing ?? store.get().playing,
    opened: [...step.open],
    selected: null,
    overlay: step.overlay ?? null,
    solo: [],
    hidden: [],
  });
}

/**
 * Move to a step, carrying the canvas with it.
 *
 * Steps deliberately cross levels of detail, so the diagram is part of the
 * step rather than something the reader has to go and find. Without this the
 * dock happily advances to a step whose connection is on a diagram that is
 * not open, and nothing lights up.
 */


/* ── Components ───────────────────────────────────────────────────────── */

const chrome = createChrome(refs, {
  onSelect: goToObject,
  onExpandAll: () => store.set({ opened: explorerView.openable(), selected: null }),
  onCollapseAll: () => store.set({ opened: [], selected: null }),
  onZoom: (factor) => scene.zoomCentre(factor),
  onFit: () => scene.fit(true),
  onSearch: () => chrome.palette.open(),
  onToggleTheme: () => applyTheme(nextTheme()),
  onPick: (match) => {
    if (match.kind === 'step') return goToStep(Number(match.id), false);
    return goToObject(match.id);
  },
});

const tree = createTree(refs.tree, {
  onSelect: (id) => goToObject(id, { keepView: true }),
  onOpen: openInside,
});

const inspector = createInspector(refs.inspector, {
  onSelect: goToObject,
  onOpenInside: openInside,
  onPlayStep: (index) => goToStep(index, false),
  onClose: () => store.set({ inspector: false }),
});

const overlays = createOverlays(refs.overlays, { onChange: (patch) => store.set(patch) });

const tour = createTour(refs.scenario, {
  onStep: goToStep,
  onStop: () => store.set({ touring: false, step: 0, playing: false, overlay: null }),
});

scene.on('select', (id) => store.set({ selected: id, inspector: true }));
scene.on('drill', openInside);
/** True when the tree is an overlay rather than a column. Matches app.css. */
const treeFloats = () => matchMedia('(max-width: 900px)').matches;

scene.on('background', () => {
  // A floating tree covers the canvas, so touching the canvas dismisses it.
  // Docked, it is furniture and closing it on a stray click would be rude.
  store.set(treeFloats() && store.get().tree
    ? { selected: null, tree: false }
    : { selected: null });
});
scene.on('camera', (vp) => chrome.zoom.setReading(vp.k));

/* ── Render ───────────────────────────────────────────────────────────── */

let lastSignature = '';
let lastSize = '';

function render(state) {
  // Per render, not module level. Held across renders it keeps a stale true
  // and fits the canvas on some later change that never resized anything.
  let resized = false;
  refs.app.classList.toggle('tree-open', state.tree);
  refs.app.classList.toggle('inspector-open', state.inspector && Boolean(state.selected || state.scenario));
  // The filter bar and the scenario dock want the same strip of canvas, and a
  // scenario is a narration rather than a query, so the filters step aside.
  refs.app.classList.toggle('narrating', Boolean(state.scenario));
  refs.treeToggle.setAttribute('aria-pressed', String(state.tree));

  chrome.render(state);
  overlays.render(state);
  tree.render(state);

  const inspectorFloats = matchMedia('(max-width: 1080px)').matches;
  scene.setInsets({
    right: inspectorFloats && refs.app.classList.contains('inspector-open')
      ? Math.min(352, innerWidth - 54)
      : 0,
  });

  const playing = tour.render(state);
  const step = playing?.current || null;

  // The canvas is rebuilt only when what it draws changed. Selection, dimming
  // and connection highlighting are restyles, so they never rebuild it and
  // never make the reader watch the whole thing flash.
  const signature = [state.opened.join('|'), state.overlay || ''].join('::');
  const redrew = signature !== lastSignature;
  if (redrew) {
    lastSignature = signature;
    explorerView.render(state.opened, {
      stripesFor: (id) => stripesFor(id, state.overlay),
      onToggle: openInside,
    });

    const size = `${scene.size.w}x${scene.size.h}`;
    resized = size !== lastSize;
    lastSize = size;
  }

  explorerView.emphasise({
    selected: state.selected,
    spotlight: spotlightOf(step) || filterSpotlight(state, Object.keys(OBJECTS)),
    activeEdge: step?.edge || null,
  });

  // A selection is the reader steering, so it takes the camera even while a
  // step is on screen. Letting the step win means clicking anything during the
  // walkthrough snaps the canvas back to whatever the step was framing, which
  // reads as the diagram yanking itself away from what you just asked to see.
  // Advancing a step clears the selection, so the step frames again by itself.
  //
  // A step that names nothing to look at wants the whole picture back, which
  // is what makes the opening and closing steps feel like breathing out.
  // Deferred a tick either way: the stage may not be laid out yet, and a fit
  // against a zero sized viewport clamps to minimum scale.
  const framed = rectsFor(state.selected ? [state.selected] : focusOf(step));
  if (framed) {
    setTimeout(() => scene.frameRect(scene.growRect(framed, 80), {
      animate: true, pad: 70, maxScale: 1.1,
    }), 0);
  } else if (resized || (step && redrew)) {
    setTimeout(() => scene.fit(true), 0);
  }

  renderInspector(state, playing);
}

function rectsFor(ids) {
  const rects = ids.map((id) => explorerView.rectOf(id)).filter(Boolean);
  return rects.length ? scene.boundsOf(rects) : null;
}

function renderInspector(state, playing) {
  if (state.selected) return inspector.renderObject(state.selected);
  if (playing) return inspector.renderTour(playing.step);
  return inspector.renderEmpty();
}

/* ── Keyboard ─────────────────────────────────────────────────────────── */

addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, [contenteditable]')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) { if (e.key !== 'k' && e.key !== 'K') return; }
  const onControl = Boolean(e.target.closest('button, [role="button"]'));
  const state = store.get();

  if (e.key === 'k' || e.key === 'K') { e.preventDefault(); chrome.palette.open(); return; }

  switch (e.key) {
    case 'Escape':
      if (chrome.palette.isOpen) chrome.palette.close();
      else if (state.touring) store.set({ touring: false, step: 0, playing: false, overlay: null });
      else store.set({ selected: null });
      break;
    case 'f': case 'F': scene.fit(true); break;
    case 't': case 'T': store.set({ tree: !state.tree }); break;
    case 'i': case 'I': store.set({ inspector: !state.inspector }); break;
    case 'e': case 'E': store.set({ opened: explorerView.openable(), selected: null }); break;
    case 'c': case 'C': store.set({ opened: [], selected: null }); break;
    case 'ArrowRight':
      if (state.touring) { e.preventDefault(); goToStep(state.step + 1, false); }
      break;
    case 'ArrowLeft':
      if (state.touring) { e.preventDefault(); goToStep(state.step - 1, false); }
      break;
    case ' ':
      // Only when nothing focusable would have used it: Space activates a
      // button, and stealing it would break every control on the page.
      if (state.touring && !onControl) { e.preventDefault(); store.set({ playing: !state.playing }); }
      break;
    default: break;
  }
});

$('scenario-open').addEventListener('click', () => {
  const state = store.get();
  if (state.touring) store.set({ touring: false, playing: false, overlay: null });
  else goToStep(0, false);
});

refs.treeToggle.addEventListener('click', () => store.set({ tree: !store.get().tree }));
$('search-open').addEventListener('click', () => chrome.palette.open());

/* ── Go ───────────────────────────────────────────────────────────────── */

// A link may name a step, which decides what is open, so settle that before
// the first paint. This cannot rely on the store notifying: when the link
// already holds the right values the patch is a no-op.
const opening = store.get();
if (opening.touring) goToStep(opening.step, false);

render(store.get());
// Only when nothing has already asked for a camera. A link that opens on a
// walkthrough step has framed what that step is about, and a blanket fit here
// would throw it straight back out to the whole diagram.
if (!store.get().touring && !store.get().selected) setTimeout(() => scene.fit(), 0);

// Exposed so an end to end test can assert on real state rather than pixels.
window.explorer = { store, scene, model: { OBJECTS, TOUR, VALIDATION } };
