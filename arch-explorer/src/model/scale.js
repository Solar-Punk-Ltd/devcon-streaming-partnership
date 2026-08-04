/**
 * How each piece scales, and what happens when one of them dies.
 *
 * Every object declares this, and the schema refuses a model where one does
 * not, because "how many of these are there" and "what covers it when it
 * fails" are the two questions a reliability review asks about every single
 * box. Prose in a note answers neither in a form anything can render or check,
 * which is why this was invisible while being written down five times.
 *
 * `count` is the number at twenty stages and four thousand viewers, so the
 * whole canvas reads at one operating point rather than each card quoting a
 * different one.
 */

/** What drives the count up. */
export const GROWS = {
  STAGES: 'stages',
  VIEWERS: 'viewers',
  COVERAGE: 'coverage',
  REGIONS: 'regions',
  FIXED: 'fixed',
};

/** What covers this when one instance is lost. */
export const RESILIENCE = {
  ZONES: 'zones',
  POOL: 'pool',
  SPARES: 'spares',
  CLIENT: 'client',
  DEGRADED: 'degraded',
  SINGLE: 'single',
  EXTERNAL: 'external',
};

export const GROWS_LABEL = Object.freeze({
  [GROWS.STAGES]: 'Grows with stages',
  [GROWS.VIEWERS]: 'Grows with viewers',
  [GROWS.COVERAGE]: 'Grows with coverage',
  [GROWS.REGIONS]: 'One per region',
  [GROWS.FIXED]: 'Fixed size',
});

/**
 * Ordered best to worst, which is also the order the overlay legend uses, so
 * the short list to make boring collects at the bottom instead of being
 * scattered through it.
 *
 * Names are kept short because they are chips in a legend that floats over the
 * canvas, and a legend tall enough to cover the diagram answers one question by
 * hiding the thing it is about. The sentence lives in the hint.
 */
export const RESILIENCE_TAGS = Object.freeze([
  { id: RESILIENCE.ZONES, name: 'Second zone live', color: '#2E8B63',
    hint: 'Two availability zones, both carrying traffic. Losing one is not an event.' },
  { id: RESILIENCE.POOL, name: 'Pool absorbs it', color: '#17868C',
    hint: 'Several behind a balancer. Lose one and the rest take the load.' },
  { id: RESILIENCE.SPARES, name: 'Spare promoted', color: '#3A7CB8',
    hint: 'N plus two idle capacity. A short gap on one stage, then it is back.' },
  { id: RESILIENCE.CLIENT, name: 'One viewer only', color: '#9B5C8C',
    hint: 'Runs on the device, so it breaks for the person it happens to and nobody else.' },
  { id: RESILIENCE.DEGRADED, name: 'We lose the warning', color: '#8465B8',
    hint: 'Video keeps flowing. We lose a margin, or the ability to see a problem coming.' },
  { id: RESILIENCE.SINGLE, name: 'Exactly one, on purpose', color: '#A33F5E',
    hint: 'A second instance would be worse than none. The short list to make boring.' },
  { id: RESILIENCE.EXTERNAL, name: 'Not ours', color: '#7C8B93',
    hint: 'We design around it. We cannot add another one.' },
]);

const RESILIENCE_NAME = Object.fromEntries(RESILIENCE_TAGS.map((t) => [t.id, t.name]));

export const GROWS_VALUES = new Set(Object.values(GROWS));
export const RESILIENCE_VALUES = new Set(Object.values(RESILIENCE));

/** The count as it appears on a card. */
export const multiplicity = (scale) => (scale ? `×${scale.count}` : '');

export const resilienceName = (id) => RESILIENCE_NAME[id] || id;

export const growsLabel = (id) => GROWS_LABEL[id] || id;

export const colourOf = (id) => RESILIENCE_TAGS.find((t) => t.id === id)?.color || null;

/** Overlay membership, derived from the objects so it can never drift. */
export function resilienceMembers(objects) {
  const members = {};
  for (const [id, o] of Object.entries(objects)) {
    const key = o.scale?.resilience;
    if (key) (members[key] ||= []).push(id);
  }
  return members;
}
