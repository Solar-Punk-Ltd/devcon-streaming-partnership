/**
 * Overlay groups: filters painted on top of whatever diagram is open, rather
 * than a separate diagram per question. Turning a group on stripes every card
 * that carries one of its tags, and a tag can be soloed or hidden.
 *
 * "Blast radius" is first because EF asked for stability specifically, and
 * the useful question is never "is this reliable" but "what else goes down
 * with it".
 *
 * Membership is listed explicitly here rather than as a field on each object,
 * so the whole answer to "what breaks together" is readable in one place.
 * `technology` is the exception: it derives from each object's own tech list.
 *
 * The definitions in this file are the Devcon 8 model's. The MVP model brings
 * its own, in ./mvp/tags.js, and everything below them is shared: the builder
 * takes an ordered list of definitions and fills in the two derived groups
 * wherever that list asks for them.
 */

import { RESILIENCE_TAGS, resilienceMembers } from './scale.js';

/** Overlay group ids, referenced by walkthrough steps and by the filter bar. */
export const SCALE_GROUP = 'scale';

export const BLAST = {
  ONE_STAGE: 'one-stage',
  EVERY_STAGE: 'every-stage',
  ONE_VIEWER: 'one-viewer',
  BLIND: 'blind',
  SAFETY_NET: 'safety-net',
  EXTERNAL: 'external',
};

const BLAST_MEMBERS = {
  // Nothing sits in front of the stages any more, so the publish path has no
  // every-stage component at all. That is the point of dropping the relay.
  [BLAST.ONE_STAGE]: ['pipeline', 'venueacl', 'srtin', 'worker', 'packager',
    'uploader', 'uploaderb', 'beepub', 'beepubb', 'prefetch'],
  [BLAST.EVERY_STAGE]: ['sys', 'delivery', 'cdn', 'shield', 'allow'],
  [BLAST.ONE_VIEWER]: ['player', 'loader'],
  [BLAST.BLIND]: ['ctrl', 'metrics', 'logs', 'alerts', 'probes', 'runofshow', 'netmon', 'telemetry', 'authz', 'beacons', 'deploy', 'stamps', 'cheq'],
  [BLAST.SAFETY_NET]: ['fallback', 'objstore', 'fallcdn', 'record'],
  [BLAST.EXTERNAL]: ['av', 'swarm', 'viewers', 'browsernode'],
};

export const DEVCON_PLACE_MEMBERS = {
  venue: ['av', 'record'],
  cloud: [
    'sys', 'venueacl',
    'pipeline', 'srtin', 'worker', 'packager',
    'uploader', 'uploaderb', 'beepub', 'beepubb',
    'fallback', 'objstore', 'prefetch', 'allow', 'ctrl', 'metrics', 'logs', 'alerts', 'probes', 'beacons', 'runofshow',
    'deploy', 'authz', 'stamps', 'cheq', 'netmon', 'delivery',
  ],
  edge: ['cdn', 'shield', 'fallcdn'],
  swarm: ['swarm'],
  device: ['viewers', 'player', 'loader', 'telemetry', 'browsernode'],
};

/** Tag colours are single values that hold up on both the light and dark ground. */
export const DEVCON_GROUP_DEFS = [
  {
    id: 'blast',
    name: 'Blast radius',
    hint: 'What else stops working when this stops working.',
    tags: [
      { id: BLAST.ONE_STAGE, name: 'One stage', color: '#B07A22',
        hint: 'Takes exactly one stage of twenty off air.' },
      // Scope, not severity. Only the ingest edge takes the event genuinely
      // off air, because it kills publishing and the mirror that hangs off it.
      // The rest hit every stage at once while something still carries them.
      { id: BLAST.EVERY_STAGE, name: 'Every stage', color: '#A33F5E',
        hint: 'Hits all twenty at once rather than one. The short list to make boring.' },
      { id: BLAST.ONE_VIEWER, name: 'One viewer', color: '#2E8B63',
        hint: 'Affects only the person it happens to.' },
      { id: BLAST.BLIND, name: 'We go blind', color: '#3A7CB8',
        hint: 'The stream keeps running, we lose the ability to see or react.' },
      { id: BLAST.SAFETY_NET, name: 'Safety net only', color: '#8465B8',
        hint: 'Held in reserve. Losing it costs nothing today and everything later.' },
      { id: BLAST.EXTERNAL, name: 'Outside our control', color: '#7C8B93',
        hint: 'We can design around it, not fix it.' },
    ],
    members: BLAST_MEMBERS,
  },
  // The derived groups are ordered here rather than by the builder, so the
  // bar reads the way a reliability review asks the questions: what breaks
  // together, how many are there and what covers one, where does it run,
  // what is it built of.
  { derive: 'scale' },
  {
    id: 'place',
    name: 'Where it runs',
    hint: 'Which network and whose hardware each piece sits on.',
    tags: [
      { id: 'venue', name: 'Venue', color: '#B8763A', hint: "EF's AV production network." },
      { id: 'cloud', name: 'Our cloud', color: '#3A7CB8', hint: 'Two availability zones near Mumbai.' },
      { id: 'edge', name: 'CDN edge', color: '#17868C', hint: 'Rented points of presence.' },
      { id: 'swarm', name: 'Swarm', color: '#B07A22', hint: 'The public network, ours only in part.' },
      { id: 'device', name: 'Viewer device', color: '#2E8B63', hint: '70% of them a phone.' },
      { id: 'thirdparty', name: 'Third party', color: '#7C8B93', hint: 'Someone else runs it entirely.' },
    ],
    members: DEVCON_PLACE_MEMBERS,
  },
  { derive: 'tech' },
];

/**
 * Technology chips, one per distinct entry across every object's tech list,
 * sorted by how many objects use it. Colour is assigned from a fixed wheel by
 * rank so the busiest technologies get the most separable hues.
 */
// Starts at teal rather than amber: amber is selection and red is incident,
// and a categorical ramp that borrows either makes a stripe read as a state.
const TECH_WHEEL = [
  '#17868C', '#3A7CB8', '#2E8B63', '#8465B8', '#A33F5E',
  '#B07A22', '#5B7FA8', '#4E8C4E', '#9B5C8C', '#3E7F7A',
];

/**
 * Scale and redundancy, derived from each object's own `scale` rather than
 * listed here, so a component added without declaring how it survives a
 * failure is a validation error rather than a silent gap in the legend.
 */
export function resilienceGroup(objects) {
  return {
    id: SCALE_GROUP,
    name: 'Scale and redundancy',
    hint: 'How many of each there are, and what covers the loss of one.',
    tags: RESILIENCE_TAGS,
    members: resilienceMembers(objects),
  };
}

export function technologyGroup(objects) {
  const members = {};
  for (const [id, o] of Object.entries(objects)) {
    for (const t of o.tech || []) (members[t] ||= []).push(id);
  }
  const tags = Object.keys(members)
    .sort((a, b) => members[b].length - members[a].length || a.localeCompare(b))
    .map((name, i) => ({
      id: name,
      name,
      color: TECH_WHEEL[i % TECH_WHEEL.length],
      hint: `${members[name].length} object${members[name].length === 1 ? '' : 's'}`,
    }));
  return { id: 'tech', name: 'Technology', hint: 'What each piece is actually built from.', tags, members };
}

/** The groups a definition list can ask to have built for it. */
const DERIVED = { [SCALE_GROUP]: resilienceGroup, tech: technologyGroup };

/**
 * Group definitions with per-tag object sets resolved and counted, in the
 * order the definitions give them. A definition asking to `derive` a group is
 * filled in from the objects, so a model can say where the derived groups sit
 * without knowing how either one is built. A tag no object carries is dropped
 * rather than drawn as an empty chip.
 */
export function buildTagGroups(objects, defs) {
  return defs
    .map((g) => (g.derive ? DERIVED[g.derive](objects) : g))
    .map((g) => ({
      id: g.id,
      name: g.name,
      hint: g.hint,
      tags: g.tags
        .map((t) => ({ ...t, objects: (g.members[t.id] || []).filter((id) => objects[id]) }))
        .filter((t) => t.objects.length)
        .map((t) => ({ ...t, count: t.objects.length })),
    }));
}

/** Reverse index: object id to the tags it carries, per group. */
export function tagsByObject(groups) {
  const index = {};
  for (const g of groups) {
    for (const t of g.tags) {
      for (const id of t.objects) {
        (index[id] ||= []).push({ group: g.id, tag: t.id, name: t.name, color: t.color });
      }
    }
  }
  return index;
}

/**
 * Where each thing runs, as a colour applied to every card all the time.
 *
 * Grouping should not be a mode the reader has to remember to switch on. With
 * the bands gone from the nested view, this is what carries "these belong
 * together" at a glance.
 */
export const DEVCON_PLACE_COLOUR = Object.freeze({
  venue: '#B8763A',
  cloud: '#3A7CB8',
  edge: '#17868C',
  swarm: '#B07A22',
  device: '#2E8B63',
  thirdparty: '#7C8B93',
});

/** Object id to its place, given one model's membership lists. */
export function placeIndex(members) {
  const out = {};
  for (const [place, ids] of Object.entries(members)) for (const id of ids) out[id] = place;
  return (id) => out[id] || null;
}
