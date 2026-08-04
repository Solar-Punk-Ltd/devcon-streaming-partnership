export const DIAGRAMS = {
  context: {
    // The control plane and the network monitor sit beside the system rather
    // than inside it. They are ours and they watch it, but nothing in the
    // signal chain passes through either one, so drawing them inside the box
    // put two things in the reader's way that the stream never touches.
    name: "Devcon 8 streaming", level: "Context", parent: null, w: 1250, h: 600,
    nodes: [
      { id: "av",      x: 20,  y: 250, w: 215, h: 112 },
      { id: "sys",     x: 300, y: 210, w: 270, h: 185 },
      { id: "ctrl",    x: 300, y: 440, w: 270, h: 130 },
      { id: "swarm",   x: 660, y: 60,  w: 250, h: 150 },
      { id: "browsernode", x: 660, y: 440, w: 250, h: 130 },
      { id: "netmon",  x: 970, y: 60,  w: 250, h: 130 },
      { id: "viewers", x: 970, y: 250, w: 220, h: 140 }
    ],
    edges: [
      { from: "av",     to: "sys",     label: "SRT, one address per stage", strong: true },
      { from: "sys",    to: "swarm",   label: "segments + feed", strong: true, t: .55 },
      { from: "swarm",  to: "viewers", label: "HLS, via our CDN", strong: true, t: .34 },
      { from: "swarm",  to: "browsernode", label: "direct fetch, not through us" },
      { from: "ctrl",   to: "sys",     label: "stamps and config", kind: "control" },
      { from: "netmon", to: "swarm",   label: "observes", kind: "observe" }
    ]
  },

  containers: {
    name: "Streaming", level: "Containers", parent: "context", of: "sys", w: 1420, h: 640,
    // Two paths out of the pipeline, drawn as two rows: Swarm across the top,
    // the standby stack underneath it. They meet again at the player, which is
    // the only thing that ever chooses between them.
    groups: [
      { name: "Venue",         x: 14,   y: 46,  w: 206, h: 560, hint: "EF's AV production network." },
      { name: "Publish",       x: 246,  y: 46,  w: 282, h: 560, hint: "Ours. Everything from the encoder output to a signed feed." },
      { name: "Swarm",         x: 554,  y: 46,  w: 252, h: 250, hint: "The public network. Origin, delivery and archive in one." },
      { name: "Standby, ours", x: 554,  y: 300, w: 252, h: 260, hint: "Hot, unadvertised, and shares nothing with the path above it." },
      { name: "Deliver",       x: 832,  y: 46,  w: 252, h: 560, hint: "Ours. A cache over Swarm, not a gate in front of it." },
      { name: "Viewer",        x: 1110, y: 46,  w: 262, h: 560, hint: "Runs on the phone. 70% of them." }
    ],
    nodes: [
      { id: "av",       x: 30,   y: 268, w: 174, h: 116 },
      { id: "pipeline", x: 262,  y: 215, w: 250, h: 150 },
      { id: "swarm",    x: 570,  y: 100, w: 220, h: 140 },
      { id: "fallback", x: 570,  y: 330, w: 220, h: 140 },
      { id: "delivery", x: 848,  y: 100, w: 220, h: 150 },
      { id: "player",   x: 1126, y: 100, w: 230, h: 150 },
      { id: "viewers",  x: 1126, y: 330, w: 230, h: 130 }
    ],
    edges: [
      { from: "av",       to: "pipeline", label: "SRT, one address per stage", strong: true },
      { from: "pipeline", to: "swarm",    label: "pushsync", strong: true },
      { from: "pipeline", to: "fallback", label: "the same segments", kind: "media" },
      { from: "swarm",    to: "delivery", label: "retrieval", strong: true },
      { from: "delivery", to: "player",   label: "HLS + ABR", strong: true },
      { from: "player",   to: "viewers",  label: "playback", strong: true }
    ]
  },

  stage: {
    name: "Stage pipeline", level: "Components", parent: "containers", of: "pipeline", w: 1560, h: 560,
    // Two changes here are load bearing rather than cosmetic. The recording
    // hangs off the incoming feed, not off the publish half: it is taken at
    // the venue, holds no key and funds nothing. And the columns are paired
    // rather than 3 against 2, because the nested layout stacks each column
    // independently and centres it, so an odd column beside an even one puts
    // a card directly in the path of the edge that has to cross between them.
    // Two publish lanes drawn side by side rather than one card with a count
    // on it. The whole argument for them is that they share no index and no
    // key, and a diagram that draws one box cannot show that.
    groups: [
      { name: "Receive and record", x: 14, y: 60, w: 492, h: 420, hint: "One endpoint per stage, on an address that outlives the machine." },
      { name: "Transcode and package", x: 534, y: 60, w: 232, h: 420, hint: "Stateless, and shared by both lanes. Kill it and restart it freely." },
      { name: "Lane A", x: 794, y: 60, w: 492, h: 180, hint: "Four clients, four feeds, its own keys and its own postage." },
      { name: "Lane B", x: 794, y: 300, w: 492, h: 180, hint: "The same again, sharing nothing that can be signed or funded." }
    ],
    nodes: [
      { id: "venueacl",  x: 30,   y: 215, w: 200, h: 140 },
      { id: "srtin",     x: 290,  y: 100, w: 200, h: 140 },
      { id: "record",    x: 290,  y: 330, w: 200, h: 140 },
      { id: "worker",    x: 550,  y: 100, w: 200, h: 140 },
      { id: "packager",  x: 550,  y: 330, w: 200, h: 140 },
      { id: "uploader",  x: 810,  y: 100, w: 200, h: 140 },
      { id: "uploaderb", x: 810,  y: 330, w: 200, h: 140 },
      { id: "beepub",    x: 1070, y: 100, w: 200, h: 140 },
      { id: "beepubb",   x: 1070, y: 330, w: 200, h: 140 },
      { id: "swarm",     x: 1330, y: 215, w: 200, h: 140 }
    ],
    edges: [
      { from: "venueacl",  to: "srtin",     label: "who may connect at all", kind: "control" },
      { from: "srtin",     to: "worker",    label: "decoded feed", strong: true },
      { from: "srtin",     to: "record",    label: "local copy" },
      { from: "worker",    to: "packager",  label: "4 renditions", strong: true },
      { from: "packager",  to: "uploader",  label: "2 s segments", strong: true },
      { from: "packager",  to: "uploaderb", label: "the same bytes", strong: true },
      { from: "uploader",  to: "beepub",    label: "stamped chunks", strong: true },
      { from: "uploaderb", to: "beepubb",   label: "stamped again", strong: true },
      { from: "beepub",    to: "swarm",     label: "4 feeds", strong: true },
      { from: "beepubb",   to: "swarm",     label: "4 more, other keys", strong: true }
    ]
  },

  deliv: {
    // One kind of node, not two. Every prefetch node follows one feed and
    // caches whole segments; the only thing that differs between levels is
    // which neighborhood it was ground into. So there is one card here, and
    // its count carries the levels.
    name: "Delivery tier", level: "Components", parent: "containers", of: "delivery", w: 880, h: 460,
    groups: [
      { name: "Ours, at every level", x: 275, y: 14, w: 255, h: 380, hint: "160 nodes a level, four levels out from the stages." },
      { name: "Edge cache",           x: 575, y: 14, w: 255, h: 400, hint: "Rented. Absorbs the viewers and the attacks." }
    ],
    nodes: [
      { id: "swarm",    x: 30,  y: 200, w: 200, h: 140 },
      { id: "allow",    x: 290, y: 30,  w: 225, h: 130 },
      { id: "prefetch", x: 290, y: 230, w: 225, h: 148 },
      { id: "shield",   x: 590, y: 60,  w: 225, h: 140 },
      { id: "cdn",      x: 590, y: 250, w: 225, h: 150 }
    ],
    edges: [
      { from: "swarm",    to: "prefetch", label: "whole segments, before anyone asks", strong: true },
      { from: "allow",    to: "prefetch", label: "what may be served", kind: "control" },
      { from: "prefetch", to: "shield",   label: "unique content once", strong: true },
      { from: "shield",   to: "cdn",      label: "tiered cache", strong: true }
    ]
  },

  standby: {
    name: "Standby stack", level: "Components", parent: "containers", of: "fallback", w: 620, h: 280,
    nodes: [
      { id: "objstore", x: 30,  y: 60, w: 220, h: 140 },
      { id: "fallcdn",  x: 350, y: 60, w: 220, h: 140 }
    ],
    edges: [
      { from: "objstore", to: "fallcdn", label: "only once we switch", kind: "media" }
    ]
  },

  control: {
    // Four columns rather than three, and alerts sits in the middle of its own
    // column. Every edge here is now adjacent or one row, which it has to be:
    // an edge leaving a card's bottom and heading sideways always grazes the
    // card underneath it, and no amount of bowing fixes that.
    name: "Control plane", level: "Components", parent: "context", of: "ctrl", w: 1090, h: 580,
    groups: [
      { name: "Watch the viewer", x: 14,  y: 14, w: 252, h: 500, hint: "Synthetic, and real. Neither one is evidence on its own." },
      { name: "Collect",          x: 274, y: 14, w: 252, h: 500, hint: "Where everything lands before anyone looks at it." },
      { name: "Fund and warn",    x: 534, y: 14, w: 272, h: 520, hint: "The two things that stop publishing silently." },
      { name: "Act",              x: 814, y: 14, w: 262, h: 520, hint: "Where a human decides and a change gets made." }
    ],
    nodes: [
      { id: "probes",    x: 30,  y: 40,  w: 220, h: 140 },
      { id: "beacons",   x: 30,  y: 210, w: 220, h: 132 },
      { id: "metrics",   x: 290, y: 40,  w: 220, h: 132 },
      { id: "logs",      x: 290, y: 210, w: 220, h: 132 },
      { id: "stamps",    x: 550, y: 40,  w: 240, h: 146 },
      { id: "alerts",    x: 550, y: 210, w: 240, h: 132 },
      { id: "cheq",      x: 550, y: 380, w: 240, h: 132 },
      { id: "runofshow", x: 830, y: 40,  w: 230, h: 146 },
      { id: "deploy",    x: 830, y: 210, w: 230, h: 132 },
      { id: "authz",     x: 830, y: 380, w: 230, h: 132 }
    ],
    edges: [
      { from: "probes",  to: "metrics",   label: "viewer-eye SLOs", kind: "observe", strong: true },
      { from: "beacons", to: "metrics",   label: "what real viewers saw", kind: "observe", strong: true },
      { from: "metrics", to: "alerts",    label: "thresholds", kind: "observe", strong: true },
      { from: "logs",    to: "alerts",    label: "error rates", kind: "observe" },
      { from: "stamps",  to: "alerts",    label: "TTL + utilisation", kind: "observe", strong: true },
      { from: "cheq",    to: "alerts",    label: "balance floor", kind: "observe" },
      { from: "alerts",  to: "runofshow", label: "incident", kind: "observe", strong: true },
      { from: "authz",   to: "deploy",    label: "who may change what", kind: "control" }
    ]
  },

  play: {
    // No tier selector and no ABR selector. hls.js switches rungs off the
    // master playlist on its own, and HLS fails a viewer over to a redundant
    // stream on its own, so the standby is listed in the manifest rather than
    // chosen by anything we wrote.
    name: "Player", level: "Components", parent: "containers", of: "player", w: 850, h: 430,
    groups: [
      { name: "Ours to build", x: 274, y: 14, w: 262, h: 402, hint: "One loader and one beacon stream. The rest is stock." }
    ],
    nodes: [
      { id: "delivery",  x: 30,  y: 40,  w: 200, h: 140 },
      { id: "fallback",  x: 30,  y: 240, w: 200, h: 140 },
      { id: "loader",    x: 290, y: 40,  w: 230, h: 140 },
      { id: "telemetry", x: 290, y: 240, w: 230, h: 140 },
      // The control plane referenced rather than owned, the same way this
      // diagram's delivery and fallback are. Containment claims a node at the
      // shallowest diagram that places it, so a reference costs nothing, and
      // it is the only way to draw an edge between two different branches.
      { id: "ctrl",      x: 570, y: 240, w: 230, h: 132 }
    ],
    edges: [
      { from: "delivery",  to: "loader",    label: "segments, normally", strong: true },
      { from: "fallback",  to: "loader",    label: "segments, if it fails over", kind: "media" },
      { from: "loader",    to: "telemetry", label: "what the viewer saw", kind: "observe" },
      // The gap this closes: telemetry was drawn producing beacons and nothing
      // in any diagram received them, so the player reported to nobody.
      { from: "telemetry", to: "ctrl",      label: "four numbers, 5% of viewers", kind: "observe" }
    ]
  }
};
