/* Diagrams for the September MVP.
 *
 * Coordinates are read as a grid rather than as pixels: nodes sharing roughly
 * an x become a column, nodes sharing roughly a y become a row, and the
 * nested view sizes the tracks from whatever the cells contain, with fixed
 * card sizes and a 78-unit gap between columns. Two consequences shape every
 * diagram here. A label between two adjacent cards has about 14 characters of
 * room before it lands on one of them, so labels are short and the sentence
 * lives in the object's blurb. And an edge that has to cross a column passes
 * over whatever sits in it, so the control plane is a row under the media
 * path rather than a column beside it: every dashed edge is then adjacent or
 * one row, and the one that is not (admin to SPA) runs through the gap the
 * layout leaves between the two rows.
 *
 * Bands are validated, not drawn in the nested view, so they only document
 * whose machine each card sits on. Every detail diagram repeats the externals
 * it talks to for context; containment claims an object at the shallowest
 * diagram that places it, so a repeat costs nothing and is the only way to
 * draw an edge across branches.
 */

export const MVP_DIAGRAMS = {
  context: {
    // Six boxes, and five of them are somebody else's. The whole of what we
    // build is the one in the middle, which is the honest shape of an MVP.
    // The brand is the left column: their encoder and their operator. The
    // right column is the decentralised side the stream lands on: Swarm, the
    // viewers reading from it, and the chain the postage is bought on.
    name: "Streaming platform MVP", level: "Context", parent: null, w: 1250, h: 640,
    nodes: [
      { id: "encoder",  x: 20,  y: 120, w: 215, h: 140 },
      { id: "brand",    x: 20,  y: 330, w: 215, h: 140 },
      { id: "platform", x: 420, y: 230, w: 270, h: 185 },
      { id: "swarm",    x: 820, y: 60,  w: 250, h: 150 },
      { id: "viewers",  x: 820, y: 250, w: 250, h: 140 },
      { id: "chain",    x: 820, y: 440, w: 250, h: 140 }
    ],
    edges: [
      { from: "encoder",  to: "platform", label: "SRT per stage", strong: true },
      { from: "brand",    to: "platform", label: "manages", kind: "control" },
      { from: "platform", to: "chain",    label: "buys stamps", kind: "control" },
      { from: "platform", to: "swarm",    label: "feeds + chunks", strong: true },
      { from: "platform", to: "viewers",  label: "branded SPA", strong: true }
    ]
  },

  containers: {
    name: "Streaming platform", level: "Containers", parent: "context", of: "platform", w: 1500, h: 640,
    // Two rows. The top one is the signal: stage host, Bee host, SPA, left to
    // right. The bottom one is control: the manager under the stage host it
    // deploys to, so "deploys" is one short vertical edge, and the admin layer
    // under the Bee host, so it sits next to the SPA it configures and the
    // chain it buys on lies straight ahead of it under the SPA. The SPA stands
    // alone in its column and centres between the rows. The one edge that has
    // to cross a card, the brand reaching the admin layer past the manager,
    // is left to the router, which lifts it through the gap between the rows.
    // The stamp relationship between the admin layer and the Bee host is drawn
    // inside the Bee host rather than here, where it would only cross.
    groups: [
      { name: "Brand's side",   x: 14,  y: 40,  w: 232, h: 580, hint: "Their venue, their encoder, their money." },
      { name: "GCP, per stage", x: 284, y: 40,  w: 262, h: 460, hint: "One Terraform-built host per stage, and the manager that runs on it." },
      { name: "Vultr",          x: 584, y: 40,  w: 252, h: 190, hint: "Bee publishers per stream, and the public gateways." },
      { name: "Web2",           x: 584, y: 310, w: 252, h: 190, hint: "Ordinary hosting. The only thing that spends money." },
      { name: "Viewer",         x: 884, y: 175, w: 262, h: 190, hint: "Runs in the browser, on the brand's own domain." }
    ],
    nodes: [
      { id: "gcp",     x: 300,  y: 60,  w: 230, h: 150 },
      { id: "sim",     x: 300,  y: 330, w: 230, h: 150 },
      { id: "beehost", x: 600,  y: 60,  w: 220, h: 150 },
      { id: "admin",   x: 600,  y: 330, w: 220, h: 150 },
      { id: "spa",     x: 900,  y: 195, w: 230, h: 150 },
      { id: "encoder", x: 30,   y: 120, w: 200, h: 140 },
      { id: "brand",   x: 30,   y: 330, w: 200, h: 140 },
      { id: "swarm",   x: 1200, y: 60,  w: 220, h: 140 },
      { id: "viewers", x: 1200, y: 250, w: 220, h: 130 },
      { id: "chain",   x: 1200, y: 440, w: 220, h: 140 }
    ],
    edges: [
      { from: "encoder", to: "gcp",     label: "SRT per stage", strong: true },
      { from: "gcp",     to: "beehost", label: "stamped chunks", strong: true },
      { from: "beehost", to: "swarm",   label: "pushsync", strong: true },
      { from: "swarm",   to: "spa",     label: "chunks", strong: true },
      { from: "beehost", to: "spa",     label: "HLS fallback", kind: "media" },
      { from: "spa",     to: "viewers", label: "playback", strong: true },
      { from: "brand",   to: "admin",   label: "manages", kind: "control" },
      { from: "admin",   to: "sim",     label: "provision", kind: "control" },
      { from: "sim",     to: "gcp",     label: "deploys", kind: "control" },
      { from: "admin",   to: "chain",   label: "buys stamps", kind: "control" },
      { from: "admin",   to: "spa",     label: "brand config", kind: "control" }
    ]
  },

  stagehost: {
    // One straight line, which is the point: everything that makes a stage
    // work is four processes on one machine, in the order the video moves
    // through them. The manager is drawn under the uploader because that is
    // the component it configures rather than merely starts.
    name: "Stage host", level: "Components", parent: "containers", of: "gcp", w: 1600, h: 560,
    nodes: [
      { id: "srtin",    x: 300,  y: 200, w: 200, h: 140 },
      { id: "ladder",   x: 570,  y: 200, w: 200, h: 140 },
      { id: "packager", x: 840,  y: 200, w: 200, h: 140 },
      { id: "uploader", x: 1110, y: 200, w: 200, h: 140 },
      { id: "encoder",  x: 30,   y: 200, w: 200, h: 140 },
      { id: "sim",      x: 1110, y: 390, w: 200, h: 140 },
      { id: "beehost",  x: 1380, y: 200, w: 200, h: 140 }
    ],
    edges: [
      { from: "encoder",  to: "srtin",    label: "SRT", strong: true },
      { from: "srtin",    to: "ladder",   label: "decoded feed", strong: true },
      { from: "ladder",   to: "packager", label: "4 rungs, or 1", strong: true },
      { from: "packager", to: "uploader", label: "2 s segments", strong: true },
      { from: "uploader", to: "beehost",  label: "stamped chunks", strong: true },
      { from: "sim",      to: "uploader", label: "profile", kind: "control" }
    ]
  },

  manager: {
    // The deployer is the only part of this that leaves the box, and today it
    // leaves it over loopback, because the manager runs on the host it
    // deploys to. That is why there is no authentication in this diagram.
    // It sits on top so its one edge out, up to the stage host above this
    // box, leaves through the top with nothing in the way.
    name: "streaming-infra-manager", level: "Components", parent: "containers", of: "sim", w: 1360, h: 520,
    nodes: [
      { id: "simweb",    x: 300,  y: 200, w: 220, h: 140 },
      { id: "simapi",    x: 570,  y: 200, w: 220, h: 140 },
      { id: "simdeploy", x: 840,  y: 60,  w: 220, h: 140 },
      { id: "simdb",     x: 840,  y: 340, w: 220, h: 140 },
      { id: "admin",     x: 30,   y: 200, w: 220, h: 140 },
      { id: "gcp",       x: 1110, y: 340, w: 220, h: 140 }
    ],
    edges: [
      { from: "simweb",    to: "simapi",    label: "calls" },
      { from: "simapi",    to: "simdb",     label: "state" },
      { from: "simapi",    to: "simdeploy", label: "apply", kind: "control" },
      { from: "simdeploy", to: "gcp",       label: "up / down", kind: "control" },
      { from: "admin",     to: "simapi",    label: "provision", kind: "control" }
    ]
  },

  beehost: {
    // Two halves of one machine that have nothing to do with each other: the
    // publishers write, the gateways read, and the only thing they share is
    // the host and the bill. Whether that is a mistake is a workshop
    // question, which is why the deployment of a publisher set is drawn as a
    // box rather than left implied. The admin layer's money edges land here,
    // on the two things that actually hold stamps and cheques, and since the
    // admin layer sits under this box the publishers are drawn on the lower
    // row so that edge arrives from below instead of through the deployment.
    name: "Bee host (Vultr)", level: "Components", parent: "containers", of: "beehost", w: 1120, h: 520,
    nodes: [
      { id: "beeops", x: 300, y: 60,  w: 220, h: 150 },
      { id: "beepub", x: 300, y: 300, w: 220, h: 150 },
      { id: "beegw",  x: 570, y: 300, w: 220, h: 150 },
      { id: "gcp",    x: 30,  y: 60,  w: 220, h: 140 },
      { id: "admin",  x: 30,  y: 300, w: 220, h: 140 },
      { id: "swarm",  x: 570, y: 60,  w: 220, h: 140 },
      { id: "spa",    x: 840, y: 60,  w: 220, h: 150 }
    ],
    edges: [
      { from: "gcp",    to: "beepub", label: "chunks", strong: true },
      { from: "beepub", to: "swarm",  label: "pushsync", strong: true },
      { from: "swarm",  to: "beegw",  label: "retrieval", strong: true },
      { from: "beegw",  to: "spa",    label: "HLS", kind: "media" },
      { from: "admin",  to: "beepub", label: "top up stamps", kind: "control" },
      { from: "admin",  to: "beegw",  label: "cheques", kind: "control" },
      { from: "beeops", to: "beepub", label: "per stream", kind: "control" }
    ]
  },

  spa: {
    // Two ways in and one player: chunks from Swarm through a node in the
    // browser, and the same chunks over HTTPS from a gateway when that node
    // will not start. The two sources sit one above the other with the player
    // level between them, so both edges into it stay horizontal. The
    // bootstrap is on the bottom row, level with the admin layer that feeds it
    // config, and hands the fallback its gateway list; the node-first policy
    // it enforces is written on the cards rather than drawn, because an edge
    // two rows up would have to cross the fallback. Chat has no wire on purpose:
    // whether it rides Swarm feeds or a web2 socket is the open question, and
    // a card connected to nothing says so more honestly than a guessed edge.
    name: "Viewer SPA", level: "Components", parent: "containers", of: "spa", w: 1120, h: 700,
    nodes: [
      { id: "innode",     x: 300, y: 60,  w: 220, h: 140 },
      { id: "gwfallback", x: 300, y: 280, w: 220, h: 140 },
      { id: "spaboot",    x: 300, y: 500, w: 220, h: 140 },
      { id: "abrplayer",  x: 570, y: 60,  w: 220, h: 150 },
      { id: "chat",       x: 570, y: 280, w: 220, h: 140 },
      { id: "swarm",      x: 30,  y: 60,  w: 220, h: 140 },
      { id: "beehost",    x: 30,  y: 280, w: 220, h: 140 },
      { id: "admin",      x: 30,  y: 500, w: 220, h: 140 },
      { id: "viewers",    x: 840, y: 60,  w: 220, h: 140 }
    ],
    edges: [
      { from: "admin",      to: "spaboot",    label: "brand config", kind: "control" },
      { from: "spaboot",    to: "gwfallback", label: "gateway list", kind: "control" },
      { from: "swarm",      to: "innode",     label: "chunks", strong: true },
      { from: "innode",     to: "abrplayer",  label: "segments", strong: true },
      { from: "beehost",    to: "gwfallback", label: "HLS", kind: "media" },
      { from: "gwfallback", to: "abrplayer",  label: "fallback", kind: "media" },
      { from: "abrplayer",  to: "viewers",    label: "playback", strong: true }
    ]
  },

  admin: {
    // Console, API, database, and then three things that are each somebody
    // else's problem to receive: the manager gets a stream, the chain and the
    // Bee host get money, the SPA gets a look. Authentication is drawn beside
    // the API rather than in front of the console, because the question is
    // which brand a call may act for, not who may see a page. The manager is
    // repeated as its API rather than as the whole box, so that with both
    // opened the two levels draw one arrow between them, not two.
    name: "Web2 admin layer", level: "Components", parent: "containers", of: "admin", w: 1390, h: 700,
    nodes: [
      { id: "adminui",  x: 300,  y: 60,  w: 220, h: 140 },
      { id: "auth",     x: 300,  y: 280, w: 220, h: 150 },
      { id: "adminapi", x: 570,  y: 60,  w: 220, h: 140 },
      { id: "admindb",  x: 570,  y: 280, w: 220, h: 140 },
      { id: "stampmgr", x: 840,  y: 60,  w: 230, h: 150 },
      { id: "branding", x: 840,  y: 500, w: 230, h: 140 },
      { id: "brand",    x: 30,   y: 60,  w: 220, h: 140 },
      { id: "simapi",   x: 840,  y: 280, w: 230, h: 140 },
      { id: "beehost",  x: 1120, y: 60,  w: 230, h: 140 },
      { id: "chain",    x: 1120, y: 280, w: 230, h: 140 },
      { id: "spa",      x: 1120, y: 500, w: 230, h: 140 }
    ],
    edges: [
      { from: "brand",    to: "adminui",  label: "logs in", kind: "control" },
      { from: "adminui",  to: "adminapi", label: "calls" },
      { from: "adminapi", to: "admindb",  label: "state" },
      { from: "auth",     to: "adminapi", label: "authorises", kind: "control" },
      { from: "adminapi", to: "simapi",   label: "provision", kind: "control" },
      { from: "stampmgr", to: "beehost",  label: "top up, TTL", kind: "control" },
      { from: "stampmgr", to: "chain",    label: "buys batches", kind: "control" },
      { from: "branding", to: "spa",      label: "theme, domain", kind: "control" }
    ]
  }
};
