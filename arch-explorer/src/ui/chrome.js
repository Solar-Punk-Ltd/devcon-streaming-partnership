/**
 * Everything around the canvas: the view rail, the breadcrumb, the zoom dock,
 * the command palette, the theme switch and the toast.
 */

import { OBJECTS, ancestorsOf, searchIndex } from '../model/index.js';
import { icon, glyph } from '../render/icons.js';

const THEME_KEY = 'arch-explorer-theme';

export function createChrome(refs, handlers) {
  buildRail(refs.rail, handlers);
  const palette = buildPalette(refs.palette, handlers);
  const zoom = buildZoomDock(refs.stage, handlers);
  applyTheme(localStorage.getItem(THEME_KEY));

  function render(state) {
    renderCrumbs(refs.crumbs, state, handlers);
  }

  return { render, palette, zoom };
}

function buildRail(rail, { onExpandAll, onCollapseAll, onToggleTheme, onSearch }) {
  const mark = document.createElement('div');
  mark.className = 'rail-mark';
  mark.textContent = 'D8';
  mark.title = 'Devcon 8 streaming architecture';
  rail.append(mark);

  rail.append(
    railButton('expand', 'Open everything, E', onExpandAll),
    railButton('collapse', 'Close everything, C', onCollapseAll),
  );

  const spacer = document.createElement('div');
  spacer.className = 'rail-spacer';
  rail.append(spacer);

  rail.append(
    railButton('search', 'Search, K', onSearch),
    railButton('moon', 'Switch theme', onToggleTheme),
  );
}

function railButton(name, title, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rail-btn';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.innerHTML = glyph(name, 16);
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Where the selection sits in the model, not where the canvas is.
 *
 * With one expandable view there is no page to be on, so the breadcrumb
 * answers a different question: what is this thing inside of.
 */
function renderCrumbs(mount, state, { onSelect }) {
  mount.replaceChildren();

  if (!state.selected) {
    mount.append(crumb('system', 'Devcon 8 streaming', true));
    return;
  }

  const chain = [...ancestorsOf(state.selected)].reverse().concat(state.selected);
  chain.forEach((id, i) => {
    const o = OBJECTS[id];
    if (!o) return;
    const last = i === chain.length - 1;
    mount.append(crumb(o.icon, o.name, last, last ? null : () => onSelect(id)));
    if (!last) mount.append(sep());
  });
}

function crumb(iconName, text, current, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'crumb';
  if (current) b.setAttribute('aria-current', 'page');
  b.innerHTML = `${icon(iconName, 13)}<span></span>`;
  b.querySelector('span').textContent = text;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

function sep() {
  const s = document.createElement('span');
  s.className = 'crumb-sep';
  s.innerHTML = glyph('chevron', 12);
  return s;
}

function buildZoomDock(stage, { onZoom, onFit }) {
  const dock = document.createElement('div');
  dock.className = 'dock dock-zoom';

  const read = document.createElement('span');
  read.className = 'zoom-read';
  read.textContent = '100%';

  dock.append(
    dockButton('collapse', 'Zoom out', () => onZoom(1 / 1.3)),
    read,
    dockButton('expand', 'Zoom in', () => onZoom(1.3)),
    dockButton('target', 'Fit to view, F', onFit),
  );
  stage.append(dock);

  return { setReading: (k) => { read.textContent = `${Math.round(k * 100)}%`; } };
}

function dockButton(name, title, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'dock-btn';
  b.title = title;
  b.innerHTML = glyph(name, 14);
  b.addEventListener('click', onClick);
  return b;
}

function buildPalette(mount, { onPick }) {
  const rows = searchIndex();
  let matches = [];
  let active = 0;

  mount.innerHTML =
    '<div class="pal-box">' +
    `<div class="pal-input">${glyph('search', 16)}` +
    '<input type="text" placeholder="Search objects, views and scenarios" aria-label="Search"></div>' +
    '<div class="pal-list"></div></div>';

  const input = mount.querySelector('input');
  const list = mount.querySelector('.pal-list');

  function search(term) {
    const q = term.trim().toLowerCase();
    matches = (q ? rows.filter((r) => r.hay.includes(q)) : rows).slice(0, 40);
    active = 0;
    paint(q);
  }

  function paint(q) {
    list.replaceChildren();
    if (!matches.length) {
      const none = document.createElement('div');
      none.className = 'empty';
      none.textContent = 'Nothing matches that.';
      list.append(none);
      return;
    }
    matches.forEach((m, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'pal-row';
      row.dataset.active = String(i === active);

      const mark = document.createElement('span');
      mark.innerHTML = m.kind === 'object' ? icon(OBJECTS[m.id].icon, 14)
        : glyph(m.kind === 'flow' ? 'play' : 'layers', 14);

      const name = document.createElement('span');
      name.append(highlight(m.name, q));

      const kind = document.createElement('span');
      kind.className = 'pr-kind';
      kind.textContent = m.sub;

      row.append(mark, name, kind);
      row.addEventListener('click', () => { close(); onPick(m); });
      list.append(row);
    });
  }

  function highlight(text, q) {
    const frag = document.createDocumentFragment();
    const at = q ? text.toLowerCase().indexOf(q) : -1;
    if (at < 0) { frag.append(text); return frag; }
    frag.append(text.slice(0, at));
    const hit = document.createElement('mark');
    hit.textContent = text.slice(at, at + q.length);
    frag.append(hit, text.slice(at + q.length));
    return frag;
  }

  // `inert` on the app gives the focus trap and the assistive-technology
  // hiding in one property, and the trigger gets focus back on close.
  let restoreTo = null;
  const app = () => document.getElementById('app');

  const open = () => {
    restoreTo = document.activeElement;
    mount.hidden = false;
    app().inert = true;
    input.value = '';
    search('');
    input.focus();
  };
  const close = () => {
    mount.hidden = true;
    app().inert = false;
    if (restoreTo && restoreTo.isConnected) restoreTo.focus();
    restoreTo = null;
  };

  input.addEventListener('input', () => search(input.value));
  mount.addEventListener('click', (e) => { if (e.target === mount) close(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Enter' && matches[active]) { close(); onPick(matches[active]); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    active = (active + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
    paint(input.value.trim().toLowerCase());
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  });

  return { open, close, get isOpen() { return !mount.hidden; } };
}

export function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  } else {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem(THEME_KEY);
  }
}

export function nextTheme() {
  const current = document.documentElement.dataset.theme;
  if (!current) return matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
  return current === 'dark' ? 'light' : 'dark';
}

let toastTimer = null;
export function toast(message) {
  let node = document.getElementById('toast');
  if (!node) {
    node = document.createElement('div');
    node.id = 'toast';
    document.getElementById('stage').append(node);
  }
  node.setAttribute('role', 'status');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 2400);
}
