/* Overlay groups for the MVP model.
 *
 * The two questions this workshop exists to answer come first, because they
 * are the ones people disagree about: what actually ships this month, and
 * which of these boxes is per brand rather than shared by all of them. The
 * feature overlay is there to settle the first one honestly, by showing that
 * a feature is never one box.
 *
 * Membership is listed here rather than as a field on each object, so the
 * whole answer to "what is undecided" is readable in one place. The two
 * derived groups at the end come from the objects themselves.
 *
 * Colours are the same wheel the Devcon model uses. Amber and crimson are
 * kept off anything claimed for this month, so they read as "not settled"
 * wherever they appear rather than as one more category.
 */

/** Everything not named as open or deferred. Enumerated, so a new object
 *  without a scope shows up as a hole in the overlay rather than passing as
 *  shipped by default. */
const SHIP = [
  'brand', 'encoder', 'viewers', 'platform', 'swarm', 'chain',
  'gcp', 'sim', 'beehost', 'admin', 'spa',
  'srtin', 'ladder', 'packager', 'uploader',
  'simweb', 'simapi', 'simdb', 'simdeploy',
  'beepub',
  'spaboot', 'innode', 'gwfallback', 'abrplayer',
  'adminui', 'adminapi', 'admindb', 'stampmgr', 'branding',
];

const SCOPE_MEMBERS = {
  ship: SHIP,
  // Four boxes, four different kinds of undecided: who owns a stream, whether
  // chat is in at all, whether a publisher set is brought up by hand or by the
  // manager, and whether the gateways are per brand or shared.
  open: ['auth', 'chat', 'beeops', 'beegw'],
  // Deliberately empty. The workshop fills it, and until it does there is
  // nothing here to point at and call a phase two.
  later: [],
};

const FEATURE_MEMBERS = {
  'abr-stream': ['encoder', 'gcp', 'srtin', 'ladder', 'packager', 'uploader', 'beepub', 'sim'],
  'abr-watch': ['spa', 'spaboot', 'innode', 'gwfallback', 'abrplayer', 'beegw', 'swarm'],
  branding: ['branding', 'spaboot', 'adminui'],
  stamps: ['stampmgr', 'beepub', 'beegw', 'chain'],
  auth: ['auth', 'adminapi', 'simapi'],
  chat: ['chat'],
};

const TENANCY_MEMBERS = {
  perbrand: ['encoder', 'brand', 'gcp', 'srtin', 'ladder', 'packager', 'uploader', 'beepub',
    'spa', 'spaboot', 'innode', 'gwfallback', 'abrplayer', 'branding', 'stampmgr'],
  shared: ['admin', 'adminui', 'adminapi', 'admindb', 'auth', 'sim', 'simweb', 'simapi',
    'simdb', 'simdeploy', 'beehost', 'beeops', 'platform'],
  tbd: ['beegw', 'chat'],
};

/** Where each thing runs. Also the always-on card colour for this model. */
export const MVP_PLACE_MEMBERS = {
  gcp: ['gcp', 'srtin', 'ladder', 'packager', 'uploader', 'sim', 'simweb', 'simapi', 'simdb', 'simdeploy'],
  vultr: ['beehost', 'beepub', 'beegw', 'beeops'],
  web2: ['admin', 'adminui', 'adminapi', 'admindb', 'auth', 'stampmgr', 'branding', 'platform'],
  browser: ['spa', 'spaboot', 'innode', 'gwfallback', 'abrplayer', 'chat', 'viewers'],
  brandside: ['encoder', 'brand'],
  swarm: ['swarm'],
  chain: ['chain'],
};

export const MVP_PLACE_COLOUR = Object.freeze({
  gcp: '#3A7CB8',
  vultr: '#17868C',
  web2: '#8465B8',
  browser: '#2E8B63',
  brandside: '#B8763A',
  swarm: '#B07A22',
  chain: '#7C8B93',
});

/**
 * The overlay bar, in this order. A `derive` entry is filled in from the
 * objects rather than listed: scale and redundancy comes from each object's
 * own `scale`, technology from its tech list.
 */
export const MVP_GROUP_DEFS = [
  {
    id: 'scope',
    name: 'MVP scope',
    hint: 'What ships this month, what is undecided, what waits.',
    tags: [
      { id: 'ship', name: 'Ship this month', color: '#2E8B63',
        hint: 'In scope for September. Twenty-nine boxes, and one brand on air.' },
      { id: 'open', name: 'Open question', color: '#B07A22',
        hint: 'Drawn because it has to exist, not because it is decided.' },
      { id: 'later', name: 'After the MVP', color: '#7C8B93',
        hint: 'Nothing yet. This is the list the workshop is here to write.' },
    ],
    members: SCOPE_MEMBERS,
  },
  {
    id: 'feature',
    name: 'Feature',
    hint: 'Which boxes each of the six features lives in.',
    tags: [
      { id: 'abr-stream', name: 'ABR streaming', color: '#3A7CB8',
        hint: 'One SRT feed in, four rungs published. The new work.' },
      { id: 'abr-watch', name: 'ABR watching', color: '#17868C',
        hint: 'Node first, gateway second, rung switching for free.' },
      { id: 'branding', name: 'Branding', color: '#8465B8',
        hint: 'The viewer sees the brand and not us. Three boxes.' },
      { id: 'stamps', name: 'Stamps & cheques', color: '#4E8C4E',
        hint: 'The only part of this that spends money.' },
      { id: 'auth', name: 'Auth & ownership', color: '#B07A22',
        hint: 'Undecided, and it touches both APIs rather than one box.' },
      { id: 'chat', name: 'Chat', color: '#A33F5E',
        hint: 'One box today, and two entirely different builds behind it.' },
    ],
    members: FEATURE_MEMBERS,
  },
  {
    id: 'tenancy',
    name: 'Tenancy',
    hint: 'Per brand, shared by every brand, or not yet decided.',
    tags: [
      { id: 'perbrand', name: 'Per brand', color: '#17868C',
        hint: 'One of these for every brand we sign. The cost of the second brand.' },
      { id: 'shared', name: 'Shared', color: '#8465B8',
        hint: 'Built once, multi-tenant, and paid for once.' },
      { id: 'tbd', name: 'Undecided', color: '#B07A22',
        hint: 'Cheap shared, honest per brand. Both have been argued for.' },
    ],
    members: TENANCY_MEMBERS,
  },
  {
    id: 'place',
    name: 'Where it runs',
    hint: 'Which machine and whose account each piece sits on.',
    tags: [
      { id: 'gcp', name: 'GCP, per stage', color: MVP_PLACE_COLOUR.gcp,
        hint: 'One Terraform-built host per stage, with the manager on it.' },
      { id: 'vultr', name: 'Vultr', color: MVP_PLACE_COLOUR.vultr, hint: 'One host, publishers and gateways together.' },
      { id: 'web2', name: 'Web2 host', color: MVP_PLACE_COLOUR.web2, hint: 'Ordinary hosting, and the only thing that spends.' },
      { id: 'browser', name: "Viewer's browser", color: MVP_PLACE_COLOUR.browser, hint: 'Runs on their device, so it fails for one person.' },
      { id: 'brandside', name: "Brand's side", color: MVP_PLACE_COLOUR.brandside, hint: 'Their venue and their encoder.' },
      { id: 'swarm', name: 'Swarm', color: MVP_PLACE_COLOUR.swarm, hint: 'The public network. Nobody runs it, including us.' },
      { id: 'chain', name: 'Gnosis Chain', color: MVP_PLACE_COLOUR.chain, hint: 'Where the postage and the cheques settle.' },
    ],
    members: MVP_PLACE_MEMBERS,
  },
  { derive: 'scale' },
  { derive: 'tech' },
];
