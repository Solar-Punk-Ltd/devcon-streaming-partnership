/**
 * Application state and the URL it serialises to.
 *
 * Every view reads from one store and re-renders on change, and every piece
 * of state that a colleague might want to send someone lives in the query
 * string. Sending "look at this" should mean sending a link, not a screenshot
 * with instructions for how to get back to what you were looking at.
 */

const INITIAL = Object.freeze({
  selected: null,
  /** Which boxes are open. This is the whole of "where am I". */
  opened: ['sys'],
  /** Overlay group currently painting stripes, or null. */
  overlay: null,
  /** Tag ids soloed inside the active overlay. Empty means show all. */
  solo: [],
  /** Tag ids hidden inside the active overlay. */
  hidden: [],
  /** Whether the guided walkthrough is running, and where it is. */
  touring: false,
  step: 0,
  playing: false,
  tree: true,
  inspector: true,
});

/**
 * Query keys that are not state and must survive every rewrite.
 *
 * `toSearch` builds the query from scratch, so anything it does not know
 * about is dropped. `model` is chosen once at load and never changes, which
 * means dropping it would silently switch models on the first click: the URL
 * loses `?model=mvp`, and the next reload shows the default.
 *
 * Read once here, before the first rewrite, so it survives being read back
 * out of a URL this file has already edited.
 */
const CARRIED = ['model'];

const carried = (() => {
  const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const out = {};
  for (const key of CARRIED) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
})();

const LIST_KEYS = new Set(['opened', 'solo', 'hidden']);
const BOOL_KEYS = new Set(['playing', 'tree', 'inspector', 'touring']);
const NUM_KEYS = new Set(['step']);

/**
 * @param {Function} onChange  called with the new state after every change
 * @param {object} initial     per-model defaults, for the state the model
 *                             decides rather than the reader: which box is
 *                             open before anything has been clicked.
 */
export function createStore(onChange, initial = {}) {
  let state = { ...INITIAL, ...initial, ...fromSearch(location.search) };
  let frozen = false;

  const notify = () => { if (!frozen) onChange(state); };

  const api = {
    get: () => state,

    /** Merge a patch. Returns the new state. Unchanged patches do not notify. */
    set(patch) {
      const next = { ...state, ...patch };
      if (shallowEqual(next, state)) return state;
      state = next;
      writeSearch(state);
      notify();
      return state;
    },

    /** Apply several patches with a single render and a single history write. */
    batch(fn) {
      frozen = true;
      try { fn(api); } finally { frozen = false; }
      writeSearch(state);
      notify();
      return state;
    },

    toggleIn(key, value) {
      const list = state[key] || [];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return api.set({ [key]: next });
    },

    reset: () => api.set({ ...INITIAL, ...initial }),
  };

  addEventListener('popstate', () => {
    state = { ...INITIAL, ...initial, ...fromSearch(location.search) };
    notify();
  });

  return api;
}

const shallowEqual = (a, b) => {
  for (const k of Object.keys(a)) {
    const x = a[k], y = b[k];
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length || x.some((v, i) => v !== y[i])) return false;
    } else if (x !== y) return false;
  }
  return true;
};

/** Read state from a query string. Unknown keys are ignored, never thrown on. */
export function fromSearch(search) {
  const params = new URLSearchParams(search);
  const out = {};
  for (const [key, raw] of params) {
    if (!(key in INITIAL)) continue;
    if (LIST_KEYS.has(key)) out[key] = raw ? raw.split(',').filter(Boolean) : [];
    else if (BOOL_KEYS.has(key)) out[key] = raw === '1';
    else if (NUM_KEYS.has(key)) out[key] = Number.isFinite(+raw) ? Math.max(0, Math.trunc(+raw)) : 0;
    else out[key] = raw;
  }
  // Autoplay is deliberately not restored from a link: a shared scenario
  // should open on the step the sender was looking at and hold there.
  out.playing = false;
  return out;
}

/** Serialise state, omitting anything still at its default. */
export function toSearch(state, carry = carried) {
  const params = new URLSearchParams();
  // First, so a shared link still opens with the model in front of the state
  // that only makes sense inside it.
  for (const [key, value] of Object.entries(carry)) if (value) params.set(key, value);
  for (const [key, value] of Object.entries(state)) {
    if (!(key in INITIAL) || key === 'playing') continue;
    const initial = INITIAL[key];
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else if (value !== initial && value !== null && value !== undefined) {
      params.set(key, BOOL_KEYS.has(key) ? (value ? '1' : '0') : String(value));
    }
  }
  const q = params.toString();
  return q ? `?${q}` : '';
}

let pending = null;
function writeSearch(state) {
  // Coalesce, so dragging a slider or stepping a scenario leaves one history
  // entry per idle moment rather than one per frame.
  clearTimeout(pending);
  pending = setTimeout(() => {
    const url = `${location.pathname}${toSearch(state)}${location.hash}`;
    history.replaceState(null, '', url);
  }, 120);
}
