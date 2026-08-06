import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OBJECTS, DIAGRAMS, TOUR, CONNECTIONS, TAG_GROUPS, TAGS_BY_OBJECT,
  ancestry, containmentTree, flatten, impactOf, downstreamOf,
  tourStepsFor, searchIndex, ROOT_DIAGRAM, connectionsAmong, ancestorsOf,
} from '../src/model/index.js';

test('ancestry walks from the root down to the diagram', () => {
  assert.deepEqual(ancestry('context'), ['context']);
  assert.deepEqual(ancestry('stage'), ['context', 'containers', 'stage']);
});

test('ancestry terminates on an unknown diagram', () => {
  assert.deepEqual(ancestry('nope'), []);
});

test('the containment tree holds every object exactly once', () => {
  const flat = flatten(containmentTree());
  assert.equal(flat.length, Object.keys(OBJECTS).length);
  assert.equal(new Set(flat.map((n) => n.id)).size, flat.length);
});

test('external actors sit beside the system, not inside it', () => {
  // Devcon AV and the viewers are drawn on the containers diagram for
  // context. Reading that as containment would put EF's camera crew inside
  // our software.
  const tree = containmentTree();
  const top = tree.children.map((c) => c.id);
  for (const id of ['av', 'viewers', 'swarm', 'browsernode']) {
    assert.ok(top.includes(id), `${id} should be a sibling of the system`);
  }
  const sys = tree.children.find((c) => c.id === 'sys');
  const inside = flatten(sys).map((n) => n.id);
  for (const id of ['av', 'viewers', 'swarm', 'browsernode']) {
    assert.equal(inside.includes(id), false, `${id} should not be inside the system`);
  }
});

test('the pipeline contains its own components', () => {
  const flat = flatten(containmentTree());
  const worker = flat.find((n) => n.id === 'worker');
  assert.ok(worker, 'worker should be in the tree');
  assert.equal(worker.depth, 2, 'worker sits under system then pipeline');
});

test('connections dedupe a pair that appears on several diagrams', () => {
  const keys = CONNECTIONS.map((c) => `${c.from}>${c.to}`);
  assert.equal(new Set(keys).size, keys.length);
  const total = Object.values(DIAGRAMS).reduce((n, d) => n + d.edges.length, 0);
  assert.ok(CONNECTIONS.length <= total);
});

test('impactOf separates what feeds a thing from what it feeds', () => {
  const { incoming, outgoing } = impactOf('pipeline');
  assert.ok(incoming.every((c) => c.to === 'pipeline'));
  assert.ok(outgoing.every((c) => c.from === 'pipeline'));
  assert.ok(incoming.some((c) => c.from === 'av'));
});

test('downstreamOf reaches viewers from the contribution feed', () => {
  const reach = downstreamOf('av');
  assert.ok(reach.has('pipeline'));
  assert.ok(reach.has('viewers'));
  assert.equal(reach.get('pipeline'), 1);
  assert.ok(reach.get('viewers') > 1);
  assert.equal(reach.has('av'), false, 'the origin is not its own downstream');
});

test('downstreamOf terminates on a cycle', () => {
  const cyclic = [
    { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' },
  ];
  const reach = downstreamOf('a', cyclic, 10);
  assert.deepEqual([...reach.keys()].sort(), ['b', 'c']);
});

test('the walkthrough covers the whole system in order', () => {
  assert.ok(TOUR.steps.length >= 12, 'a full explanation needs more than a handful of steps');

  // Every step has to leave the canvas in a state a reader can act on.
  for (const [i, s] of TOUR.steps.entries()) {
    assert.ok(s.title.length > 4, `step ${i + 1} needs a title`);
    assert.ok(s.text.length > 60, `step ${i + 1} should say something worth reading`);
    assert.ok(Array.isArray(s.open), `step ${i + 1} must declare exactly what is open`);
  }

  // It should open the system and hand it back, not leave it in pieces.
  assert.deepEqual(TOUR.steps[0].open, []);
  assert.deepEqual(TOUR.steps.at(-1).open, []);
});

test('every walkthrough step can actually draw what it describes', () => {
  for (const [i, s] of TOUR.steps.entries()) {
    if (!s.edge) continue;
    const open = new Set(s.open);
    const drawn = connectionsAmong(open).map((c) => `${c.from}>${c.to}`);
    assert.ok(drawn.includes(s.edge), `step ${i + 1} highlights ${s.edge}, which is not on screen`);
  }
});

test('every walkthrough step frames something that exists', () => {
  for (const [i, s] of TOUR.steps.entries()) {
    const focus = [].concat(s.focus || []);
    for (const id of focus) {
      assert.ok(OBJECTS[id], `step ${i + 1} frames unknown "${id}"`);
      const open = new Set(s.open);
      const hidden = ancestorsOf(id).filter((p) => !open.has(p));
      assert.deepEqual(hidden, [], `step ${i + 1} frames "${id}" without opening ${hidden.join(', ')}`);
    }
  }
});

test('the walkthrough covers every container at least once', () => {
  const containers = Object.entries(OBJECTS)
    .filter(([, o]) => o.type === 'Container')
    .map(([id]) => id);
  const missed = containers.filter((id) => tourStepsFor(id).length === 0);
  assert.deepEqual(missed, [], `never mentioned: ${missed.join(', ')}`);
});

test('tag groups cover every object at least once', () => {
  for (const id of ['blast', 'scale']) {
    const group = TAG_GROUPS.find((g) => g.id === id);
    const tagged = new Set(group.tags.flatMap((t) => t.objects));
    const missing = Object.keys(OBJECTS).filter((o) => !tagged.has(o));
    assert.deepEqual(missing, [], `${id} misses: ${missing.join(', ')}`);
  }
});

test('every object says how many there are and what covers the loss of one', () => {
  // The schema enforces this too. Asserting it here as well means a failure
  // names the objects rather than arriving as one line of validator output.
  const missing = Object.entries(OBJECTS)
    .filter(([, o]) => !o.scale?.count || !o.scale?.onLoss)
    .map(([id]) => id);
  assert.deepEqual(missing, [], `no scale declared: ${missing.join(', ')}`);
});

test('opening a box keeps the arrows into it that nothing inside replaces', () => {
  // Dropping every edge that touched an open box made the box look unplugged
  // the moment you opened it. Nothing inside the pipeline is fed by "ingest"
  // under that name, so opening it deleted the arrow in and drew no
  // replacement, and the same for the control plane line underneath.
  const drawn = connectionsAmong(new Set(['sys', 'pipeline'])).map((c) => `${c.from}>${c.to}`);
  assert.ok(drawn.includes('av>pipeline'), 'the feed into the pipeline should survive opening it');
  assert.ok(drawn.includes('ctrl>sys'), 'so should the control plane line, now drawn to the frame');
  assert.ok(drawn.includes('pipeline>fallback'), 'and the standby feed leaving it');
});

test('opening a box drops only the summary edges it actually replaces', () => {
  const drawn = connectionsAmong(new Set(['sys', 'pipeline'])).map((c) => `${c.from}>${c.to}`);
  assert.equal(drawn.includes('pipeline>swarm'), false, 'the publisher says this by name now');
  assert.ok(drawn.includes('beepub>swarm'));
  assert.ok(drawn.includes('av>pipeline'), 'nothing inside names the contribution feed, so it stays');
});

test('nothing sits in front of the stages', () => {
  // The whole argument for a per-stage floating address over a shared relay:
  // the publish path is left with no component every stage passes through.
  // If one reappears here, that argument quietly stopped being true.
  const blast = TAG_GROUPS.find((g) => g.id === 'blast');
  const everyStage = blast.tags.find((t) => t.id === 'every-stage').objects;
  const publishSide = ['pipeline', 'venueacl', 'srtin', 'worker', 'packager', 'uploader', 'beepub'];
  const shared = publishSide.filter((id) => everyStage.includes(id));
  assert.deepEqual(shared, [], `shared again: ${shared.join(', ')}`);
});

test('the venue allowlist is per stage and sits with the receiver', () => {
  const flat = flatten(containmentTree());
  assert.ok(flat.some((n) => n.id === 'venueacl'), 'the allowlist should still exist');
  assert.equal(ancestorsOf('venueacl').join('>'), 'pipeline>sys');
  assert.ok(tourStepsFor('srtin').length > 0, 'the receiver is never mentioned');
});

test('the two publish lanes share nothing that can be signed or funded', () => {
  // The entire argument for lane B is that a fork is impossible by
  // construction rather than policed. That holds only while the lanes have
  // no component in common downstream of the packager.
  const stage = DIAGRAMS.stage;
  const laneA = ['uploader', 'beepub'];
  const laneB = ['uploaderb', 'beepubb'];
  for (const id of [...laneA, ...laneB]) {
    assert.ok(stage.nodes.some((n) => n.id === id), `${id} should be drawn, not implied by a count`);
  }
  // Nothing in lane A may feed anything in lane B, or the other way round.
  const crossing = stage.edges.filter((e) =>
    (laneA.includes(e.from) && laneB.includes(e.to)) || (laneB.includes(e.from) && laneA.includes(e.to)));
  assert.deepEqual(crossing, [], 'the lanes are wired together, so they are not independent');
});

test('every single-writer component has a twin in the other lane', () => {
  for (const [a, b] of [['uploader', 'uploaderb'], ['beepub', 'beepubb']]) {
    assert.equal(OBJECTS[a].lane, 'A');
    assert.equal(OBJECTS[b].lane, 'B');
    assert.equal(OBJECTS[a].scale.count, OBJECTS[b].scale.count, `${a} and ${b} should be the same size`);
  }
});

test('authentication is claimed by exactly one component', () => {
  // A shared edge and the SRT receiver both used to say they authenticate,
  // which left a reader no way to know where the passphrase actually lives.
  assert.match(OBJECTS.srtin.desc, /authenticate/i);
  const others = Object.entries(OBJECTS).filter(([id]) => id !== 'srtin');
  const claimants = others.filter(([, o]) => /authenticat/i.test(o.desc)).map(([id]) => id);
  assert.deepEqual(claimants, [], `also claim to authenticate: ${claimants.join(', ')}`);
});

test('an object never carries two tags from the same group', () => {
  for (const g of TAG_GROUPS) {
    if (g.id === 'tech') continue;
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
  for (const g of TAG_GROUPS) {
    for (const t of g.tags) assert.equal(t.count, t.objects.length);
  }
});

test('the reverse tag index agrees with the groups', () => {
  const worker = TAGS_BY_OBJECT.worker.map((t) => t.tag);
  assert.ok(worker.includes('one-stage'));
  assert.ok(worker.includes('cloud'));
});

test('search covers objects, diagrams and scenarios', () => {
  const rows = searchIndex();
  const kinds = new Set(rows.map((r) => r.kind));
  assert.deepEqual([...kinds].sort(), ['diagram', 'object', 'step']);
  assert.ok(rows.some((r) => r.hay.includes('ffmpeg')));
});

test('the root diagram is the only one without a parent', () => {
  const roots = Object.entries(DIAGRAMS).filter(([, d]) => !d.parent).map(([id]) => id);
  assert.deepEqual(roots, [ROOT_DIAGRAM]);
});

/* The rates and counts on the cards are authored as strings, which is what keeps
   objects.js a plain literal with no rendering or arithmetic in it. Nothing in the
   schema stops two of them drifting apart, and that is exactly what went wrong:
   the published bitrate, the event content volume and the per-node throughput were
   all quoting a ladder the transcode worker had stopped describing, and every one
   of them passed a full test run. These recompute the derived figures from the
   rungs and the counts they come from, so an edit that moves one and not the others
   fails here rather than shipping to a page the EF reads. */

const cardMetric = (id, label) => {
  const row = (OBJECTS[id].metrics || []).find((m) => m[0] === label);
  assert.ok(row, `${id} has no metric labelled "${label}"`);
  return row[1];
};
const figures = (s) => (String(s).match(/[\d.]+/g) || []).map(Number);
const figure = (s) => figures(s)[0];
const plainCount = (s) => Number(String(s).replace(/,/g, ''));
const round1 = (n) => Math.round(n * 10) / 10;

const EVENT_HOURS = 48;
const LANES = 2;

test('the published rates agree with the ladder they are derived from', () => {
  const rungs = [
    ...figures(cardMetric('worker', '360p / 480p')),
    ...figures(cardMetric('worker', '720p / 1080p')),
  ];
  assert.equal(rungs.length, Number(cardMetric('worker', 'Rungs')));

  const ladder = rungs.reduce((a, b) => a + b, 0);
  const stages = Number(OBJECTS.pipeline.scale.count);

  assert.equal(
    Math.round(ladder * stages * LANES),
    figure(cardMetric('sys', 'Published bitrate')),
    'published bitrate is the ladder across every stage, on both lanes',
  );

  // Both lanes write identical bytes to identical addresses, so unique content is one lane.
  const uniqueTB = (ladder * stages * 1e6 * EVENT_HOURS * 3600) / 8 / 1e12;
  assert.equal(round1(uniqueTB), figure(cardMetric('sys', 'Event content')));
  assert.equal(round1(uniqueTB), figure(cardMetric('delivery', 'Unique content')));

  // A prefetch node follows exactly one feed, so it carries exactly one rung.
  const [perNodeMbps, perNodeGB] = figures(cardMetric('prefetch', 'Per node'));
  assert.equal(round1(ladder / rungs.length), perNodeMbps);
  assert.equal(Math.round((perNodeMbps * 1e6 * EVENT_HOURS * 3600) / 8 / 1e9), perNodeGB);
});

test('the fleet counts multiply out from stages, rungs and lanes', () => {
  const stages = Number(OBJECTS.pipeline.scale.count);
  const rungs = Number(cardMetric('worker', 'Rungs'));

  const feedsPerLane = stages * rungs;
  assert.equal(Number(OBJECTS.beepub.scale.count), feedsPerLane, 'one publisher per rung per stage');
  assert.equal(Number(OBJECTS.beepubb.scale.count), feedsPerLane, 'and the same again in lane B');

  const feeds = feedsPerLane * LANES;
  const levels = Number(cardMetric('prefetch', 'Levels'));
  assert.equal(figure(cardMetric('prefetch', 'Per level')), feeds, 'a level is one node per feed');
  assert.equal(Number(cardMetric('prefetch', 'Total')), feeds * levels);
  assert.equal(Number(OBJECTS.prefetch.scale.count), feeds * levels);
  assert.equal(Number(OBJECTS.delivery.scale.count), feeds * levels);
});

test('four levels is the first count that reaches every neighborhood', () => {
  const feeds = Number(cardMetric('prefetch', 'Per level').match(/\d+/)[0]);
  const levels = Number(cardMetric('prefetch', 'Levels'));
  const neighborhoods = Number(cardMetric('swarm', 'Depth we cover')) === 9 ? 512 : null;
  assert.ok(neighborhoods, 'the covered depth should be 9, giving 512 neighborhoods');

  assert.ok(feeds * levels >= neighborhoods, 'the fleet has to reach every neighborhood');
  assert.ok(feeds * (levels - 1) < neighborhoods, 'and one level fewer must not be enough');
});

test('the edge is sized at the ceiling times the top rung', () => {
  const ceiling = plainCount(OBJECTS.viewers.scale.count);
  const expected = plainCount(cardMetric('viewers', "EF's expected peak"));
  const sizingMbps = figure(cardMetric('viewers', 'Sizing bitrate'));

  assert.equal((ceiling * sizingMbps) / 1000, figure(cardMetric('viewers', 'Edge sized for')));
  assert.equal((ceiling * sizingMbps) / 1000, figure(cardMetric('cdn', 'Peak at the 40,000 ceiling')));
  assert.equal((expected * sizingMbps) / 1000, figure(cardMetric('cdn', "Peak at EF's 4,000")));

  // Costing uses the mean, which cannot be the top rung when most of the audience is on mobile.
  assert.ok(figure(cardMetric('viewers', 'Modelled average')) < sizingMbps);
});
