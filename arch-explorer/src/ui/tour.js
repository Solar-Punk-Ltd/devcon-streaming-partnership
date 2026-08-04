/**
 * The walkthrough dock: one guided pass over the whole architecture.
 *
 * A step is not just a caption. It declares which boxes are open, what the
 * camera should frame and what stays lit, so playing it drives the canvas
 * rather than describing it. That is the difference between a narration and a
 * slide deck with a diagram behind it.
 */

import { TOUR } from '../model/index.js';
import { glyph } from '../render/icons.js';

const STEP_MS = 8000;

export function createTour(mount, { onStep, onStop }) {
  let timer = null;
  let timerKey = '';

  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
    timerKey = '';
  }

  // Restart only when the step changed, so unrelated clicks do not reset the
  // countdown and quietly stop the walkthrough advancing.
  function startTimer(index) {
    const key = String(index);
    if (timer && key === timerKey) return;
    if (timer) clearInterval(timer);
    timerKey = key;
    timer = setInterval(() => onStep(index + 1 >= TOUR.steps.length ? 0 : index + 1, true), STEP_MS);
  }

  function render({ playing, step, touring }) {
    if (!touring) { mount.hidden = true; stopTimer(); return null; }

    const index = Math.min(Math.max(step, 0), TOUR.steps.length - 1);
    const current = TOUR.steps[index];

    mount.hidden = false;
    mount.dataset.kind = 'tour';

    if (playing) startTimer(index);
    else stopTimer();

    mount.replaceChildren(head(index, playing), body(current), rail(index));
    return { step: index, current };
  }

  function head(index, playing) {
    const bar = document.createElement('div');
    bar.className = 'sc-head';

    const kind = document.createElement('span');
    kind.className = 'sc-kind';
    kind.innerHTML = `${glyph('book', 10)}<span>Walkthrough</span>`;

    const name = document.createElement('span');
    name.className = 'sc-name';
    name.textContent = TOUR.steps[index].title;

    const tools = document.createElement('div');
    tools.className = 'sc-tools';

    const count = document.createElement('span');
    count.className = 'sc-count';
    count.textContent = `${index + 1} / ${TOUR.steps.length}`;

    tools.append(
      count,
      button('prev', 'Previous', () => onStep(index - 1, false)),
      button(playing ? 'pause' : 'play', playing ? 'Pause' : 'Play', () => onStep(index, !playing)),
      button('next', 'Next', () => onStep(index + 1, false)),
      button('close', 'Leave the walkthrough', () => onStop()),
    );

    bar.append(kind, name, tools);
    return bar;
  }

  function body(step) {
    const wrap = document.createElement('div');
    wrap.className = 'sc-body';
    const text = document.createElement('p');
    text.className = 'sc-text';
    text.textContent = step.text;
    wrap.append(text);
    return wrap;
  }

  function rail(index) {
    const bar = document.createElement('div');
    bar.className = 'sc-steps';
    TOUR.steps.forEach((s, i) => {
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = 'sc-step';
      tick.dataset.done = String(i < index);
      tick.dataset.current = String(i === index);
      tick.title = `${i + 1}. ${s.title}`;
      tick.setAttribute('aria-label', `${i + 1}. ${s.title}`);
      tick.addEventListener('click', () => onStep(i, false));
      bar.append(tick);
    });
    return bar;
  }

  function button(name, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dock-btn';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = glyph(name, 14);
    b.addEventListener('click', onClick);
    return b;
  }

  return { render, stop: stopTimer };
}

/** What a step keeps lit. Null means light everything. */
export function spotlightOf(step) {
  if (!step) return null;
  const ids = new Set(step.light || []);
  if (step.edge) for (const end of step.edge.split('>')) ids.add(end);
  return ids.size ? ids : null;
}

/** What the camera should frame, as a list of object ids. */
export function focusOf(step) {
  if (!step) return [];
  if (Array.isArray(step.focus)) return step.focus;
  if (step.focus) return [step.focus];
  if (step.edge) return step.edge.split('>');
  return [];
}
