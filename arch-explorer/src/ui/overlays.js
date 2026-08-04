/**
 * Tag overlays: a filter painted on the diagram already open, rather than a
 * separate diagram per question.
 *
 * A tag can be soloed, which dims everything not carrying it, or hidden, which
 * dims everything that does. Both are reversible with one click, so asking
 * "show me only what takes down every stage" costs nothing and leaves no mess.
 */

import { TAG_GROUPS, TAGS_BY_OBJECT } from '../model/index.js';
import { glyph } from '../render/icons.js';

export function createOverlays(mount, { onChange }) {
  function render({ overlay, solo, hidden }) {
    mount.replaceChildren();

    const active = TAG_GROUPS.find((g) => g.id === overlay) || null;
    if (active) mount.append(tagRow(active, solo, hidden));

    const row = document.createElement('div');
    row.className = 'ov-groups';
    for (const g of TAG_GROUPS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ov-group';
      btn.setAttribute('aria-pressed', String(g.id === overlay));
      btn.title = g.hint;
      btn.innerHTML = `${glyph('tag', 12)}<span>${g.name}</span>`;
      btn.addEventListener('click', () => onChange({
        overlay: g.id === overlay ? null : g.id,
        solo: [],
        hidden: [],
      }));
      row.append(btn);
    }
    mount.append(row);
  }

  function tagRow(group, solo, hidden) {
    const wrap = document.createElement('div');
    wrap.className = 'ov-tags';

    for (const tag of group.tags) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ov-tag';
      // A custom property rather than `color`, because an inline colour beats
      // every hover and solo rule in the stylesheet.
      btn.style.setProperty('--tag', tag.color);
      btn.title = `${tag.hint}\nClick to solo, shift click to hide.`;
      btn.dataset.state = solo.includes(tag.id) ? 'solo' : hidden.includes(tag.id) ? 'hidden' : 'off';
      btn.setAttribute('aria-pressed', String(solo.includes(tag.id)));

      const swatch = document.createElement('span');
      swatch.className = 'ov-swatch';
      swatch.style.background = tag.color;

      const name = document.createElement('span');
      name.textContent = tag.name;

      const count = document.createElement('span');
      count.className = 'ov-n';
      count.textContent = String(tag.count);

      btn.append(swatch, name, count);
      btn.addEventListener('click', (e) => {
        const key = e.shiftKey ? 'hidden' : 'solo';
        const other = e.shiftKey ? 'solo' : 'hidden';
        const list = e.shiftKey ? hidden : solo;
        onChange({
          [key]: list.includes(tag.id) ? list.filter((v) => v !== tag.id) : [...list, tag.id],
          [other]: (e.shiftKey ? solo : hidden).filter((v) => v !== tag.id),
        });
      });
      wrap.append(btn);
    }
    return wrap;
  }

  return { render };
}

/** Colours to stripe under a card, given the active overlay group. */
export function stripesFor(objectId, overlay) {
  if (!overlay) return null;
  return (TAGS_BY_OBJECT[objectId] || [])
    .filter((t) => t.group === overlay)
    .map((t) => t.color);
}

/**
 * Which objects survive the current solo and hide sets. Returns null when no
 * filter is active, meaning "everything", so callers can skip dimming
 * entirely rather than building a set of every id.
 */
export function filterSpotlight({ overlay, solo, hidden }, objectIds) {
  if (!overlay || (!solo.length && !hidden.length)) return null;

  const tagsOf = (id) => (TAGS_BY_OBJECT[id] || []).filter((t) => t.group === overlay).map((t) => t.tag);

  return new Set(objectIds.filter((id) => {
    const tags = tagsOf(id);
    if (hidden.length && tags.some((t) => hidden.includes(t))) return false;
    if (solo.length && !tags.some((t) => solo.includes(t))) return false;
    return true;
  }));
}
