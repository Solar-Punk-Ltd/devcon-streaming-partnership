/**
 * The model tree. The breadcrumb only walks up the hierarchy, so this is the
 * one control that moves across it, which is why it is never simply hidden at
 * narrow widths: it becomes an overlay instead.
 */

import { containmentTree, OBJECTS } from '../model/index.js';
import { icon, glyph } from '../render/icons.js';

export function createTree(mount, { onSelect, onOpen }) {
  const expanded = new Set(['sys']);

  function render(state = {}) {
    mount.replaceChildren();

    const title = document.createElement('div');
    title.className = 'tree-title';
    title.textContent = 'Model';
    mount.append(title);

    for (const node of containmentTree().children) {
      mount.append(branch(node, 0, state));
    }
  }

  function branch(node, depth, state) {
    const wrap = document.createElement('div');
    const object = OBJECTS[node.id];
    const hasKids = node.children.length > 0;
    const isOpen = expanded.has(node.id);

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'tree-row';
    row.style.paddingLeft = `${4 + depth * 13}px`;
    row.setAttribute('aria-selected', String(state.selected === node.id));
    row.dataset.id = node.id;

    const twist = document.createElement('span');
    twist.className = 'tree-twist';
    twist.dataset.open = String(isOpen);
    twist.dataset.leaf = String(!hasKids);
    twist.innerHTML = glyph('chevron', 11);
    twist.addEventListener('click', (e) => {
      if (!hasKids) return;
      e.stopPropagation();
      if (expanded.has(node.id)) expanded.delete(node.id);
      else expanded.add(node.id);
      render(state);
    });

    const mark = document.createElement('span');
    mark.className = 't-icon';
    mark.innerHTML = icon(object.icon, 13);

    const name = document.createElement('span');
    name.className = 't-name';
    name.textContent = object.name;

    row.append(twist, mark, name);

    if (hasKids) {
      const count = document.createElement('span');
      count.className = 't-count';
      count.textContent = String(node.children.length);
      row.append(count);
    }

    row.addEventListener('click', () => onSelect?.(node.id));
    row.addEventListener('dblclick', () => onOpen?.(node.id));
    wrap.append(row);

    if (hasKids && isOpen) {
      const kids = document.createElement('div');
      kids.className = 'tree-kids';
      for (const child of node.children) kids.append(branch(child, depth + 1, state));
      wrap.append(kids);
    }
    return wrap;
  }

  /** Open every ancestor of an id so a selection made elsewhere is visible. */
  function revealPath(id) {
    const walk = (list, trail) => {
      for (const n of list) {
        if (n.id === id) { trail.forEach((p) => expanded.add(p)); return true; }
        if (walk(n.children, [...trail, n.id])) return true;
      }
      return false;
    };
    walk(containmentTree().children, []);
  }

  return { render, revealPath };
}
