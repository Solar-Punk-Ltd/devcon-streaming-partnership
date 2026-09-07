/* The MVP model, checked the way the Devcon 8 one is.
 *
 * The derivations are imported and pointed at these literals rather than
 * reimplemented, so what is asserted here is what the page will draw. The
 * active model in Node is still the default one; `indexModel` is what makes
 * asking questions about the other one possible. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ancestry, containmentTree, flatten, childCounts, indexModel,
  connectionsAmong, ancestorsOf, tourStepsFor, ROOT_DIAGRAM,
} from '../src/model/index.js';
import { buildTagGroups, tagsByObject, placeIndex } from '../src/model/tags.js';
import { validateModel, formatIssues } from '../src/model/schema.js';
import { RESILIENCE } from '../src/model/scale.js';
import { ICONS } from '../src/render/icons.js';
import { MVP_OBJECTS } from '../src/model/mvp/objects.js';
import { MVP_DIAGRAMS } from '../src/model/mvp/diagrams.js';
import { MVP_TOUR } from '../src/model/mvp/tour.js';
import { MVP_GROUP_DEFS, MVP_PLACE_MEMBERS, MVP_PLACE_COLOUR } from '../src/model/mvp/tags.js';
import { MODELS, MVP_MODEL, DEFAULT_MODEL, modelFrom } from '../src/model/select.js';

const mvp = indexModel(MVP_OBJECTS, MVP_DIAGRAMS);
const GROUPS = buildTagGroups(MVP_OBJECTS, MVP_GROUP_DEFS);
const BY_OBJECT = tagsByObject(GROUPS);
const group = (id) => GROUPS.find((g) => g.id === id);
const tag = (groupId, tagId) => group(groupId).tags.find((t) => t.id === tagId);

test('the MVP model has no errors and no warnings', () => {
  const { errors, warnings, ok } = validateModel({
    objects: MVP_OBJECTS,
    diagrams: MVP_DIAGRAMS,
    tour: MVP_TOUR,
    overlays: new Set(GROUPS.map((g) => g.id)),
  });
  assert.equal(ok, true, `errors:\n${formatIssues(errors)}`);
  assert.deepEqual(warnings, [], `warnings:\n${formatIssues(warnings)}`);
});

test('the model is chosen by the query string, and nothing else', () => {
  assert.equal(modelFrom('?model=mvp'), MVP_MODEL);
  assert.equal(modelFrom('?opened=platform&model=mvp&step=3'), MVP_MODEL);
  assert.equal(modelFrom(''), DEFAULT_MODEL, 'no parameter is the Devcon model');
  assert.equal(modelFrom('?model=nonsense'), DEFAULT_MODEL, 'a bad link shows the usual thing');
  assert.equal(MODELS[MVP_MODEL].objects, MVP_OBJECTS, 'and it resolves to these literals');
  assert.deepEqual(MODELS[MVP_MODEL].open, ['platform']);
});

test('the root diagram is the only one without a parent', () => {
  const roots = Object.entries(MVP_DIAGRAMS).filter(([, d]) => !d.parent).map(([id]) => id);
  assert.deepEqual(roots, [ROOT_DIAGRAM]);
  assert.equal(MVP_DIAGRAMS[ROOT_DIAGRAM].name, 'Streaming platform MVP');
});

test('ancestry walks from the root down to the diagram', () => {
  assert.deepEqual(ancestry(ROOT_DIAGRAM, MVP_DIAGRAMS), ['context']);
  assert.deepEqual(ancestry('stagehost', MVP_DIAGRAMS), ['context', 'containers', 'stagehost']);
  assert.deepEqual(ancestry('nope', MVP_DIAGRAMS), []);
});

test('the containment tree holds every object exactly once', () => {
  const flat = flatten(containmentTree(mvp));
  assert.equal(flat.length, Object.keys(MVP_OBJECTS).length);
  assert.equal(new Set(flat.map((n) => n.id)).size, flat.length);
});

test('the platform holds five containers, in the order they are drawn', () => {
  const tree = containmentTree(mvp);
  const platform = tree.children.find((c) => c.id === 'platform');
  assert.deepEqual(platform.children.map((c) => c.id), ['gcp', 'sim', 'beehost', 'admin', 'spa']);

  // Counted the way the tree counts, so a card cannot claim more parts than
  // the row beside it: the externals a detail diagram repeats do not count.
  assert.deepEqual(childCounts(mvp), {
    platform: 5, gcp: 4, sim: 4, beehost: 3, admin: 6, spa: 5,
    brand: 0, encoder: 0, viewers: 0, swarm: 0, chain: 0,
    srtin: 0, ladder: 0, packager: 0, uploader: 0,
    simweb: 0, simapi: 0, simdb: 0, simdeploy: 0,
    beepub: 0, beeops: 0, beegw: 0,
    adminui: 0, auth: 0, adminapi: 0, admindb: 0, stampmgr: 0, branding: 0,
    spaboot: 0, innode: 0, gwfallback: 0, abrplayer: 0, chat: 0,
  });
});

test('the brand and the network sit beside the platform, not inside it', () => {
  const tree = containmentTree(mvp);
  const top = tree.children.map((c) => c.id);
  const platform = tree.children.find((c) => c.id === 'platform');
  const inside = flatten(platform).map((n) => n.id);

  for (const id of ['brand', 'encoder', 'viewers', 'swarm', 'chain']) {
    assert.ok(top.includes(id), `${id} should be a sibling of the platform`);
    assert.equal(inside.includes(id), false, `${id} is repeated for context, not contained`);
  }
});

test('a component is two levels inside the platform', () => {
  const flat = flatten(containmentTree(mvp));
  const uploader = flat.find((n) => n.id === 'uploader');
  assert.ok(uploader, 'the uploader should be in the tree');
  assert.equal(uploader.depth, 2, 'platform, then the stage host');
  assert.deepEqual(ancestorsOf('uploader', mvp.parents), ['gcp', 'platform']);
});

test('the walkthrough is ten steps, and hands the platform back', () => {
  assert.equal(MVP_TOUR.steps.length, 10);
  assert.equal(MVP_TOUR.name, 'The MVP, in ten steps');

  for (const [i, s] of MVP_TOUR.steps.entries()) {
    assert.ok(s.title.length > 4, `step ${i + 1} needs a title`);
    assert.ok(s.text.length > 60, `step ${i + 1} should say something worth reading`);
    assert.ok(Array.isArray(s.open), `step ${i + 1} must declare exactly what is open`);
  }

  assert.deepEqual(MVP_TOUR.steps[0].open, [], 'it opens on the whole picture');
  assert.deepEqual(MVP_TOUR.steps.at(-1).open, ['platform'], 'and closes on one overlay over it');
  assert.deepEqual(
    MVP_TOUR.steps.filter((s) => s.overlay).map((s) => s.overlay),
    ['scope', 'scope', 'tenancy'],
    'the last three steps are the arguments, so they end on an overlay',
  );
});

test('every walkthrough step can actually draw what it describes', () => {
  for (const [i, s] of MVP_TOUR.steps.entries()) {
    if (!s.edge) continue;
    const open = new Set(s.open);
    const drawn = connectionsAmong(open, mvp).map((c) => `${c.from}>${c.to}`);
    assert.ok(drawn.includes(s.edge), `step ${i + 1} highlights ${s.edge}, which is not on screen`);
  }
});

test('every walkthrough step frames something that exists', () => {
  for (const [i, s] of MVP_TOUR.steps.entries()) {
    for (const id of [].concat(s.focus || [], s.light || [])) {
      assert.ok(MVP_OBJECTS[id], `step ${i + 1} names unknown "${id}"`);
    }
    const open = new Set(s.open);
    for (const id of [].concat(s.focus || [])) {
      const hidden = ancestorsOf(id, mvp.parents).filter((p) => !open.has(p));
      assert.deepEqual(hidden, [], `step ${i + 1} frames "${id}" without opening ${hidden.join(', ')}`);
    }
  }
});

test('the walkthrough covers every container at least once', () => {
  const containers = Object.entries(MVP_OBJECTS)
    .filter(([, o]) => o.type === 'Container')
    .map(([id]) => id);
  const missed = containers.filter((id) => tourStepsFor(id, MVP_TOUR).length === 0);
  assert.deepEqual(missed, [], `never mentioned: ${missed.join(', ')}`);
});

test('the overlay bar asks the workshop questions first', () => {
  assert.deepEqual(GROUPS.map((g) => g.id), ['scope', 'feature', 'tenancy', 'place', 'scale', 'tech']);
});

test('the scope overlay accounts for every object, and names four as open', () => {
  assert.equal(tag('scope', 'ship').count, 29);
  assert.deepEqual(tag('scope', 'open').objects, ['auth', 'chat', 'beeops', 'beegw']);
  // Defined and empty: the workshop fills it, and an empty chip in the legend
  // would be a claim that something is already deferred.
  assert.equal(tag('scope', 'later'), undefined);
  assert.equal(MVP_GROUP_DEFS.find((g) => g.id === 'scope').members.later.length, 0);
});

test('a feature is never one box', () => {
  assert.deepEqual(
    group('feature').tags.map((t) => [t.id, t.count]),
    [['abr-stream', 8], ['abr-watch', 7], ['branding', 3], ['stamps', 4], ['auth', 3], ['chat', 1]],
  );
  // The one group where a box legitimately carries two tags, which is the
  // whole point of the overlay: features share components.
  const spaboot = BY_OBJECT.spaboot.filter((t) => t.group === 'feature').map((t) => t.tag);
  assert.deepEqual(spaboot.sort(), ['abr-watch', 'branding']);
});

test('tenancy prices the second brand', () => {
  assert.deepEqual(
    group('tenancy').tags.map((t) => [t.id, t.count]),
    [['perbrand', 15], ['shared', 13], ['tbd', 2]],
  );
  assert.deepEqual(tag('tenancy', 'tbd').objects, ['beegw', 'chat']);
});

test('where it runs covers every object exactly once', () => {
  assert.deepEqual(
    group('place').tags.map((t) => [t.id, t.count]),
    [['gcp', 10], ['vultr', 4], ['web2', 8], ['browser', 7], ['brandside', 2], ['swarm', 1], ['chain', 1]],
  );
  assert.deepEqual(Object.keys(MVP_PLACE_MEMBERS), Object.keys(MVP_PLACE_COLOUR));

  const placeOf = placeIndex(MVP_PLACE_MEMBERS);
  const unplaced = Object.keys(MVP_OBJECTS).filter((id) => !placeOf(id));
  assert.deepEqual(unplaced, [], `no colour on the card: ${unplaced.join(', ')}`);
});

test('the always-on colouring and the overlay agree', () => {
  const placeOf = placeIndex(MVP_PLACE_MEMBERS);
  for (const t of group('place').tags) {
    for (const id of t.objects) assert.equal(placeOf(id), t.id, `${id} is coloured for another place`);
  }
});

test('scope and place account for every object', () => {
  for (const id of ['scope', 'place', 'scale']) {
    const tagged = new Set(group(id).tags.flatMap((t) => t.objects));
    const missing = Object.keys(MVP_OBJECTS).filter((o) => !tagged.has(o));
    assert.deepEqual(missing, [], `${id} misses: ${missing.join(', ')}`);
  }
});

test('an object never carries two tags from the same group', () => {
  for (const g of GROUPS) {
    // Technology is one chip per entry in a list, and a feature is spread
    // across boxes on purpose. Everywhere else a second tag is a mistake.
    if (g.id === 'tech' || g.id === 'feature') continue;
    const seen = new Map();
    for (const t of g.tags) {
      for (const id of t.objects) {
        assert.equal(seen.has(id), false, `${id} is both ${seen.get(id)} and ${t.id} in ${g.id}`);
        seen.set(id, t.id);
      }
    }
  }
});

test('tag counts match the object lists', () => {
  for (const g of GROUPS) {
    for (const t of g.tags) assert.equal(t.count, t.objects.length);
  }
});

test('every object says how many there are and what covers the loss of one', () => {
  const missing = Object.entries(MVP_OBJECTS)
    .filter(([, o]) => !o.scale?.count || !o.scale?.onLoss)
    .map(([id]) => id);
  assert.deepEqual(missing, [], `no scale declared: ${missing.join(', ')}`);
});

test('the MVP claims no redundancy it does not have', () => {
  // One of everything, on purpose. Anything not single is either somebody
  // else's, running on the viewer's device, or the one pair of gateways, and
  // a fourth kind appearing here means a card started implying a failover
  // nobody built.
  const postures = {};
  for (const [id, o] of Object.entries(MVP_OBJECTS)) {
    const posture = o.scale.resilience;
    if (posture !== RESILIENCE.SINGLE) (postures[posture] ||= []).push(id);
  }
  assert.deepEqual(
    Object.keys(postures).sort(),
    [RESILIENCE.CLIENT, RESILIENCE.EXTERNAL, RESILIENCE.POOL].sort(),
  );
  assert.deepEqual(postures[RESILIENCE.POOL], ['beegw'], 'only the gateways are a pool');
  assert.deepEqual(postures[RESILIENCE.EXTERNAL].sort(), ['brand', 'chain', 'encoder', 'swarm']);
});

test('every icon is one the icon set actually draws', () => {
  const drawn = new Set(Object.keys(ICONS));
  const missing = Object.entries(MVP_OBJECTS)
    .filter(([, o]) => !drawn.has(o.icon))
    .map(([id, o]) => `${id} wants ${o.icon}`);
  // An unknown name silently falls back to the generic box, so every card
  // would render and none of them would mean anything.
  assert.deepEqual(missing, [], missing.join(', '));
});
