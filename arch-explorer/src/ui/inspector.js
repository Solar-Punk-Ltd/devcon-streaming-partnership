/**
 * The detail panel. Everything an object knows, in the order someone actually
 * asks it: what is this, what does it cost or carry, what touches it, where it
 * shows up in a scenario, and the one thing worth knowing that the diagram
 * cannot draw.
 */

import { OBJECTS, TOUR, TAGS_BY_OBJECT, CHILD_COUNTS, impactOf, tourStepsFor } from '../model/index.js';
import { multiplicity, colourOf, resilienceName, growsLabel } from '../model/scale.js';
import { icon, glyph } from '../render/icons.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

function section(label, ...children) {
  const s = el('div', 'insp-section');
  s.append(el('div', 'insp-label', label), ...children);
  return s;
}

/**
 * How many, what covers the loss of one, and what that loss actually costs.
 *
 * The last line is the one that matters. A posture with no consequence next to
 * it is a label, which is how a diagram ends up implying a redundancy nobody
 * ever designed.
 */
function scaleRows(scale) {
  const head = el('div', 'scale-head');
  head.append(el('span', 'scale-count', multiplicity(scale)), el('span', 'scale-unit', scale.unit));

  const posture = el('div', 'scale-posture');
  const dot = el('span', 'scale-dot');
  dot.style.background = colourOf(scale.resilience);
  posture.append(dot, el('span', null, resilienceName(scale.resilience)),
    el('span', 'scale-grows', growsLabel(scale.grows)));

  return [head, posture, el('p', 'insp-prose', `Lose one: ${scale.onLoss}`)];
}

export function createInspector(mount, { onSelect, onOpenInside, onPlayStep, onClose }) {
  function linkRow(glyphName, label, sub, onClick) {
    const row = el('button', 'link-row');
    row.type = 'button';
    const mark = el('span', 'lr-icon');
    mark.innerHTML = glyph(glyphName, 13);
    row.append(mark, el('span', null, label));
    if (sub) row.append(el('span', 'lr-sub', sub));
    row.addEventListener('click', onClick);
    return row;
  }

  function headOf(kindHtml, name, desc) {
    const head = el('div', 'insp-head');
    const kind = el('div', 'insp-kind');
    kind.innerHTML = kindHtml;
    head.append(kind, el('h2', 'insp-name', name), el('p', 'insp-desc', desc || ''));

    const close = el('button', 'insp-close');
    close.type = 'button';
    close.title = 'Close';
    close.innerHTML = glyph('close', 13);
    close.addEventListener('click', () => onClose?.());
    head.append(close);
    return head;
  }

  function renderObject(id) {
    const o = OBJECTS[id];
    if (!o) return renderEmpty();

    const head = headOf(`${icon(o.icon, 13)}<span>${o.type}</span>`, o.name, o.desc);
    const body = el('div', 'insp-body');

    if (o.blurb) body.append(section('What it is', el('p', 'insp-prose', o.blurb)));
    if (o.scale) body.append(section('Scale and redundancy', ...scaleRows(o.scale)));

    const chips = el('div', 'chips');
    for (const t of TAGS_BY_OBJECT[id] || []) {
      if (t.group === 'tech') continue;
      const chip = el('span', 'chip');
      const dot = el('span', 'chip-dot');
      dot.style.background = t.color;
      chip.append(dot, el('span', null, t.name));
      chips.append(chip);
    }
    for (const t of o.tech || []) chips.append(el('span', 'chip', t));
    if (chips.children.length) body.append(section('Built from, and what it takes down', chips));

    if (o.metrics?.length) {
      const list = el('dl', 'metrics');
      for (const [label, value] of o.metrics) {
        const row = el('div', 'metric');
        row.append(el('dt', null, label), el('dd', null, value));
        list.append(row);
      }
      body.append(section('Numbers', list));
    }

    if (CHILD_COUNTS[id]) {
      body.append(section('Inside', linkRow(
        'expand', `Open ${o.name}`, `${CHILD_COUNTS[id]} parts`, () => onOpenInside?.(id),
      )));
    }

    const { incoming, outgoing } = impactOf(id);
    if (incoming.length || outgoing.length) {
      const wrap = document.createElement('div');
      for (const c of incoming) {
        wrap.append(linkRow('prev', OBJECTS[c.from]?.name || c.from, c.labels[0] || 'feeds it', () => onSelect?.(c.from)));
      }
      for (const c of outgoing) {
        wrap.append(linkRow('next', OBJECTS[c.to]?.name || c.to, c.labels[0] || 'it feeds', () => onSelect?.(c.to)));
      }
      body.append(section('Connections', wrap));
    }

    const steps = tourStepsFor(id);
    if (steps.length) {
      const wrap = document.createElement('div');
      for (const s of steps) {
        wrap.append(linkRow('play', s.title, `Step ${s.index + 1}`, () => onPlayStep?.(s.index)));
      }
      body.append(section('Where the walkthrough covers it', wrap));
    }

    if (o.note) body.append(section('Why it matters', el('div', 'note', o.note)));

    mount.replaceChildren(head, body);
  }

  /** The whole walkthrough, with the step being played marked. */
  function renderTour(current) {
    const head = headOf(`${glyph('book', 13)}<span>Walkthrough</span>`, TOUR.name, TOUR.about);

    const body = el('div', 'insp-body');
    const list = document.createElement('div');
    TOUR.steps.forEach((s, i) => {
      const row = linkRow('next', `${i + 1}. ${s.title}`, '', () => onPlayStep?.(i));
      if (i === current) row.dataset.current = 'true';
      list.append(row);
    });
    body.append(section('Steps', list));
    mount.replaceChildren(head, body);
  }

  function renderEmpty() {
    const empty = el('div', 'empty');
    empty.innerHTML =
      'Pick anything on the canvas to read it, or open it to go inside.<br>' +
      'Press <kbd>K</kbd> to search, or take the walkthrough for the whole thing end to end.';
    mount.replaceChildren(empty);
  }

  return { renderObject, renderTour, renderEmpty };
}
