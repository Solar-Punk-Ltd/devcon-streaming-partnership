/* Objects: one entry per thing in the September 2026 MVP of the multi-brand
   streaming platform. A second model rather than a revision of the Devcon 8
   one: different scope, different brand, and a workshop rather than an event
   as the thing it has to survive.

   Every `scale.count` is read at one operating point: one brand, one stage,
   about 500 concurrent viewers, which is the September pilot. Almost nothing
   here is redundant and the model says so, because what is being tested this
   month is whether the shape is right rather than whether it survives a bad
   day. A rebuild is the recovery.

   `scale` is required on every object and checked by the schema. See
   ../scale.js for what the two enums mean and why they are not prose. */

import { GROWS, RESILIENCE } from '../scale.js';

export const MVP_OBJECTS = {
  /* ── Context ── */
  brand: { name: "Brand operator", type: "External actor", icon: "person", external: true,
    tech: ["one brand"],
    desc: "The customer's team. Creates streams, funds them, brands the player.",
    scale: { count: "1", unit: "one brand in the September pilot", grows: GROWS.BRANDS, resilience: RESILIENCE.EXTERNAL,
      onLoss: "Nothing of ours breaks. There is simply nobody asking for a stream that month." },
    blurb: "One brand to begin with, though nothing in the model assumes it stays that way: the admin layer is multi-tenant from the first line. They own the encoder, the money and the look of the player, and we own everything between the SRT socket and the browser.",
    note: "Which people inside a brand may create or stop a stream is undecided, which is why ownership is still an open question rather than a component." },

  encoder: { name: "Brand's encoder", type: "External actor", icon: "stream", external: true,
    tech: ["OBS", "SRT"],
    desc: "OBS or a hardware encoder at their venue, one SRT feed per stage.",
    scale: { count: "1", unit: "one encoder per stage", grows: GROWS.STAGES, resilience: RESILIENCE.EXTERNAL,
      onLoss: "That stage has no picture, and nothing downstream can invent one." },
    blurb: "Whatever the brand already owns, pointed at that stage's SRT endpoint with a passphrase we issue. One feed per stage, and in the pilot there is exactly one stage. The contribution spec is ours to write, and the keyframe interval is the part that decides whether segmenting is clean." },

  viewers: { name: "Viewers", type: "External actor", icon: "person", external: true,
    tech: ["browser"],
    desc: "Browsers and phones, on the brand's own domain.",
    scale: { count: "500", unit: "concurrent viewers in the pilot", grows: GROWS.VIEWERS, resilience: RESILIENCE.CLIENT,
      onLoss: "One person cannot watch. It says nothing about anyone else." },
    blurb: "About five hundred at once is what the pilot is sized for, which is small enough that delivery is not yet the interesting problem. They arrive on the brand's domain and never see ours.",
    metrics: [["Pilot peak", "about 500", ""], ["Where they arrive", "the brand's domain", ""]] },

  platform: { name: "Streaming platform", type: "Software system", icon: "system", drill: "containers",
    tech: ["Swarm", "HLS"],
    desc: "Ours. Ingest, publish to Swarm, and hand the brand a player.",
    scale: { count: "1", unit: "one platform, multi-tenant from the start", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "Every brand is off air at once. In the pilot that is one brand on one stage, which is the only reason a single one is defensible." },
    blurb: "Five containers: a stage host on GCP, the manager that deploys it, the Bee publishers on Vultr, a web2 admin layer, and the branded viewer SPA. That is the whole of the September MVP, and the claim this model makes is that nothing else is needed to put one brand on air.",
    metrics: [["Containers", "5", ""], ["Brands", "1, of many", ""], ["Stages", "1", ""], ["Concurrent viewers", "about 500", ""]],
    note: "The MVP is deliberately one of everything. Read the crimson dots as a decision rather than an oversight: a second copy of most of this would cost real money to prove a property nobody is testing this month." },

  swarm: { name: "Swarm", type: "External system", icon: "net", external: true,
    tech: ["Bee", "Gnosis"],
    desc: "Origin, delivery and archive. Also the candidate chat transport.",
    scale: { count: "1", unit: "one public network, nobody's to run", grows: GROWS.COVERAGE, resilience: RESILIENCE.EXTERNAL,
      onLoss: "Retrieval slows or stops for everyone at once, and the gateway fallback is no help, because it reads from the same network." },
    blurb: "Segments are pushed in by the publishers and pulled out by the viewer, either by a node running in their browser or through one of our gateways. Whether chat rides on it too, as feed updates or GSOC, is one of the questions this workshop has to settle." },

  chain: { name: "Gnosis Chain", type: "External system", icon: "store", external: true,
    tech: ["Gnosis", "xBZZ"],
    desc: "Postage batches bought and cheques settled, in xBZZ.",
    scale: { count: "1", unit: "one chain, shared by everyone on it", grows: GROWS.FIXED, resilience: RESILIENCE.EXTERNAL,
      onLoss: "No new batches and no cheque settlement. Publishing carries on against the postage already bought, until it fills." },
    blurb: "Everything that costs money happens here: buying a postage batch for a stream, topping it up before it fills, and settling the gateways' cheques. The admin layer is the only thing that talks to it, which keeps spend and keys in one place." },

  /* ── Containers ── */
  gcp: { name: "Streaming infra (GCP)", type: "Container", icon: "app", drill: "stagehost",
    tech: ["Terraform", "SRS", "ffmpeg"],
    desc: "One Terraform-built stage host: SRT in, ABR ladder, HLS out.",
    scale: { count: "1", unit: "one host per stage", grows: GROWS.STAGES, resilience: RESILIENCE.SINGLE,
      onLoss: "That stage is off air until Terraform rebuilds the host; no other stage notices." },
    blurb: "SRS terminates the SRT feed, ffmpeg encodes the ladder, the packager cuts two second segments and stream-uploader signs the feeds and pushes the chunks to the Bee publishers. One host holds all four, because at one stage there is nothing to gain by spreading them.",
    metrics: [["Hosts per stage", "1", ""], ["Renditions", "4, or 1", ""], ["vCPU", "about 7", ""]],
    note: "Terraform is what makes a single host acceptable. The recovery for losing one is applying the same definition again rather than repairing anything, which is a different bet from redundancy and a cheaper one at this size." },

  sim: { name: "streaming-infra-manager", type: "Container", icon: "system", drill: "manager",
    tech: ["Postgres", "docker compose"],
    desc: "Deploys and operates the media stack, one stage at a time.",
    scale: { count: "1", unit: "one manager for every stage", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "Streams already running keep running. Nothing new can be provisioned and nothing can be stopped cleanly." },
    blurb: "Holds what a stage needs to come up: the media profile, whether that is the four rung ladder or a single rendition, the port slot, the list of Bee publishers, the signing key, the postage batch and the SRT passphrase. API, web UI and Postgres, applying a profile by running docker compose over ssh.",
    note: "Today it runs on the stage host it deploys to, bound to loopback, which is why it has no authentication of its own. That holds while one machine is both the manager and the thing managed, and stops holding at the second stage." },

  beehost: { name: "Bee host (Vultr)", type: "Container", icon: "store", drill: "beehost",
    tech: ["Bee", "Vultr"],
    desc: "The Bee publishers for each stream, and the public gateways.",
    scale: { count: "1", unit: "one host, every stream on it", grows: GROWS.STAGES, resilience: RESILIENCE.SINGLE,
      onLoss: "Publishing stops for every stream at once and the gateways go with it. Chunks already in Swarm are unaffected." },
    blurb: "A publisher set per stream, four nodes for an ABR ladder and one for a single rendition, each holding the brand's postage and its own signing key. The public gateways sit on the same machine, which is convenient and also why a bad day takes both halves out together." },

  admin: { name: "Web2 admin layer", type: "Container", icon: "shield", drill: "admin",
    tech: ["Postgres", "REST"],
    desc: "The brand console and the API behind it. Multi-tenant.",
    scale: { count: "1", unit: "one admin layer for every brand", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "Streaming continues. Nobody can create a stream, top up a batch or change a logo until it is back." },
    blurb: "Streams, stamps and cheques, branding and users, for every brand rather than one. It is the only thing that spends money and the only thing that talks to the chain, so it is also where ownership has to be decided." },

  spa: { name: "Viewer SPA", type: "Container", icon: "app", drill: "spa",
    tech: ["hls.js", "bee-js"],
    desc: "The branded player. Starts a Bee node, falls back to a gateway.",
    scale: { count: "500", unit: "one copy per viewer, on their device", grows: GROWS.VIEWERS, resilience: RESILIENCE.CLIENT,
      onLoss: "One viewer's tab. Our capacity planning never sees it." },
    blurb: "Loads the brand's theme and stream list, tries to start a Bee node in the browser and falls back to a gateway when it cannot. hls.js plays the ladder and switches rungs itself. Chat is drawn here because this is where it would live, not because it is decided." },

  /* ── Stage host components ── */
  srtin: { name: "SRT ingest (SRS)", type: "Component", icon: "stream",
    tech: ["SRS", "SRT"],
    desc: "Terminates SRT and checks the passphrase.",
    scale: { count: "1", unit: "one endpoint per stage", grows: GROWS.STAGES, resilience: RESILIENCE.SINGLE,
      onLoss: "That stage's encoder cannot connect, so there is no feed to publish." },
    blurb: "SRS listens on this stage's port slot with its own passphrase, and an unknown stream id is refused outright. That is the whole of ingest authentication, and it is enough for a pilot on a host nobody advertises." },

  ladder: { name: "ABR ladder (ffmpeg)", type: "Component", icon: "app",
    tech: ["ffmpeg", "x264"],
    desc: "Decodes the feed and encodes four rungs, or passes one through.",
    scale: { count: "1", unit: "one ffmpeg set per stage", grows: GROWS.STAGES, resilience: RESILIENCE.SINGLE,
      onLoss: "That stage stops producing renditions, and every viewer on it stops with them." },
    blurb: "The media profile decides whether this is a four rung ABR ladder or a single rendition passed straight through. The ladder is the part of the MVP that is genuinely new work, and it is also the only thing on the host that costs real CPU.",
    metrics: [["Rungs", "4, or 1", ""], ["vCPU", "about 7", ""]],
    note: "The CPU floor of the whole design: one ffmpeg per rung, about 7 vCPU for four rungs. Everything else on this host is doing I/O, which is why one machine per stage is enough and why the second stage needs a second machine." },

  packager: { name: "HLS packager", type: "Component", icon: "queue",
    tech: ["HLS", "2 s"],
    desc: "Two second segments and playlists, cut on the keyframes.",
    scale: { count: "1", unit: "one packager per stage", grows: GROWS.STAGES, resilience: RESILIENCE.SINGLE,
      onLoss: "Segments stop being written, so the feeds stop advancing and the player runs out of buffer." },
    blurb: "Writes a master playlist and one variant playlist per rung, with two second segments cut on the encoder's keyframes. The uploader watches the output rather than being told about it, which keeps the two ends independent.",
    metrics: [["Segment", "2 s", ""], ["Variants", "4, or 1", ""]] },

  uploader: { name: "stream-uploader", type: "Component", icon: "gateway",
    tech: ["stream-uploader", "Bee API"],
    desc: "Signs the feeds, stamps the chunks, pushes them to the publishers.",
    scale: { count: "1", unit: "one uploader per stage", grows: GROWS.STAGES, resilience: RESILIENCE.SINGLE,
      onLoss: "Publishing stops for that stage while segments carry on being written to disk, so the stream is not live and the gap is at least recoverable." },
    blurb: "One process per stage, watching every rendition and handing each to its own Bee publisher over the Bee API. It holds the signing key and the stamp, which makes it the one component on the host that cannot simply be run twice." },

  /* ── Manager components ── */
  simweb: { name: "Manager UI", type: "Component", icon: "eye",
    tech: ["web UI"],
    desc: "The operator's view of what is deployed where.",
    scale: { count: "1", unit: "one UI, on the manager", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "The API still answers. Whoever is operating a stage has to do it by hand." },
    blurb: "Lists stages, the profile each one is running and whether its media stack is up. An operator tool rather than a customer surface, which is why it has never needed to look like anything." },

  simapi: { name: "Manager API", type: "Component", icon: "app",
    tech: ["REST"],
    desc: "Provision, stop, and read back what a stage is running.",
    scale: { count: "1", unit: "one API for every stage", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "Nothing can be provisioned or stopped. Running stages are untouched." },
    blurb: "The admin layer calls this to bring a stream up: profile, port slot, publisher list, key, stamp and passphrase in, a running media stack out. It has no authentication of its own, which is only survivable because it listens on loopback.",
    note: "One end of the open question about ownership. The moment the manager is not on the same host as the thing it deploys, this call has to be authenticated and attributed to a brand." },

  simdb: { name: "Postgres", type: "Component", icon: "store",
    tech: ["Postgres"],
    desc: "What each stage was given, so it can be given it again.",
    scale: { count: "1", unit: "one database on the manager", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "Running stages keep running, and nothing knows any more what they were built from." },
    blurb: "Profiles, port slots, publisher lists and stamp references. Small, and the only durable state on the manager, which makes it the one thing here worth a backup." },

  simdeploy: { name: "Deployer", type: "Component", icon: "system",
    tech: ["docker compose", "ssh"],
    desc: "Brings the media stack up and down over ssh.",
    scale: { count: "1", unit: "one deployer, one host per stage", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "Nothing changes on any stage until it is back. Nothing that is already up goes down." },
    blurb: "Applies a profile by running docker compose over ssh on the stage host. Today it runs on that same host and reaches it over loopback, which is the shortest honest version of a deployment tool and exactly right for one stage." },

  /* ── Bee host components ── */
  beepub: { name: "Bee publishers", type: "Component", icon: "store",
    tech: ["Bee", "postage"],
    desc: "A funded, signing node per rung. Four for a ladder, one otherwise.",
    scale: { count: "4", unit: "one publisher per rung of the one ABR stream", grows: GROWS.STAGES, resilience: RESILIENCE.SINGLE,
      onLoss: "That rung goes quiet, so viewers on it drop a rung rather than lose the stream." },
    blurb: "Each publisher holds the brand's postage batch and a signing key, receives chunks from the uploader and updates the feed for its own rung. One per rung rather than one per stream, so a full batch costs a rung instead of the whole ladder.",
    metrics: [["Publishers", "4 for ABR, 1 for single", ""], ["Feeds signed", "1 each", ""], ["Postage batch", "1 each", ""]] },

  beegw: { name: "Bee gateways", type: "Component", icon: "gateway",
    tech: ["Bee", "HTTPS"],
    desc: "Public read endpoint for viewers whose own node cannot start.",
    scale: { count: "2", unit: "two gateways, shared by every stream", grows: GROWS.FIXED, resilience: RESILIENCE.POOL,
      onLoss: "One going down leaves the other carrying every fallback viewer. Losing both leaves only the viewers whose in-browser node started." },
    blurb: "Plain HTTPS in front of Swarm for the viewers who cannot run a node: no WSS reachability, an unfriendly browser, or a phone. Two of them behind one name, because this is the one part of the read path that is cheap to make survivable.",
    metrics: [["Gateways", "2", ""], ["Per brand or shared", "undecided", "open"]],
    note: "Whether these are per brand or shared by all of them is a workshop question with a price on it: shared is two machines for everyone, per brand is two more for every brand we sign." },

  beeops: { name: "Bee deployment", type: "Component", icon: "system",
    tech: ["scripts", "ssh"],
    desc: "How a publisher set is brought up for a stream. Scripts, today.",
    scale: { count: "1", unit: "one way of doing it, run by hand", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "Nothing running is affected. A new stream cannot be given its publishers until someone repeats the steps." },
    blurb: "Bringing up four funded, keyed Bee nodes for a stream is a handful of scripts and a person following them. Whether the manager should own this instead is one of the questions for the workshop, and it is the difference between a demo and something a brand can start on its own.",
    metrics: [["Run by", "a person, today", ""], ["Via the manager", "undecided", "open"]] },

  /* ── Viewer SPA components ── */
  spaboot: { name: "Brand bootstrap", type: "Component", icon: "app",
    tech: ["brand config"],
    desc: "Fetches the brand's theme, stream list and gateway list.",
    scale: { count: "500", unit: "one bootstrap per viewer", grows: GROWS.VIEWERS, resilience: RESILIENCE.CLIENT,
      onLoss: "That viewer gets an unbranded page with nothing on it to play." },
    blurb: "The first request the page makes. It decides what the player looks like, which streams exist and which gateways to fall back to, which makes it the only thing the admin layer has to reach into the browser to change." },

  innode: { name: "In-browser Bee node", type: "Component", icon: "net",
    tech: ["bee-js", "WASM"],
    desc: "A light Bee node in the browser, fetching chunks directly.",
    scale: { count: "500", unit: "one node per viewer, when it starts at all", grows: GROWS.VIEWERS, resilience: RESILIENCE.CLIENT,
      onLoss: "That viewer falls back to a gateway and watches the same stream over HTTPS." },
    blurb: "The claim worth demonstrating: the viewer retrieves from Swarm itself rather than from us. It needs WSS-reachable nodes and a browser willing to cooperate, so it is attempted rather than relied on." },

  gwfallback: { name: "Gateway fallback", type: "Component", icon: "gateway",
    tech: ["HTTPS"],
    desc: "The path taken when the in-browser node cannot start.",
    scale: { count: "500", unit: "one fallback per viewer", grows: GROWS.VIEWERS, resilience: RESILIENCE.CLIENT,
      onLoss: "That viewer sees nothing, since the node is the thing that already failed. This is the second of two chances." },
    blurb: "Notices that the node did not come up, for whatever reason, and points the player at a gateway instead. Most viewers will take this path in the pilot, and assuming otherwise would size the gateways wrong." },

  abrplayer: { name: "ABR player", type: "Component", icon: "stream",
    tech: ["hls.js"],
    desc: "hls.js over the master playlist. Switches rungs by itself.",
    scale: { count: "500", unit: "one player per viewer", grows: GROWS.VIEWERS, resilience: RESILIENCE.CLIENT,
      onLoss: "One viewer's playback stops. Nothing else notices, and a reload fixes it." },
    blurb: "Stock hls.js pointed at the master playlist and fed by whichever of the two paths is working. Rung switching comes with the library, which is the reason a ladder is worth publishing at all." },

  chat: { name: "Chat", type: "Component", icon: "queue",
    tech: ["Swarm feeds", "GSOC"],
    desc: "Open. Over Swarm feeds or GSOC, or a web2 websocket.",
    scale: { count: "500", unit: "one chat client per viewer", grows: GROWS.VIEWERS, resilience: RESILIENCE.CLIENT,
      onLoss: "Viewers watch without talking to each other, which is a smaller loss than either transport is to build." },
    blurb: "Two honest options and no decision. Swarm feeds or GSOC keep the platform in one piece and are slow and unproven for a conversation; a websocket in the web2 layer works today and puts a centralised dependency in the middle of a decentralised product.",
    metrics: [["Transport", "undecided", "open"], ["In the MVP at all", "undecided", "open"]],
    note: "Worth deciding in the workshop rather than during the build, because the two answers put the component in two different places: one is another service on the admin host, the other is another thing running in the browser." },

  /* ── Admin components ── */
  adminui: { name: "Brand console", type: "Component", icon: "eye",
    tech: ["web UI"],
    desc: "Where a brand creates a stream and watches it cost money.",
    scale: { count: "1", unit: "one console for every brand", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "The API is unaffected and the brand has no way to reach it. Everything on air stays on air." },
    blurb: "Streams, stamps, cheque balances and branding, scoped to whichever brand is logged in. It is the only surface the customer touches, so it is also where multi-tenancy either holds or is obviously broken." },

  adminapi: { name: "Admin API", type: "Component", icon: "app",
    tech: ["REST"],
    desc: "Every state change a brand can make, in one place.",
    scale: { count: "1", unit: "one API for every brand", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "Nothing can be created, funded or changed. Whatever is running carries on running." },
    blurb: "Calls the manager to provision a stream, the stamp manager to fund it, and the chain to buy a batch. Being the only writer is what makes ownership a tractable question: there is exactly one place to enforce it." },

  admindb: { name: "Postgres", type: "Component", icon: "store",
    tech: ["Postgres"],
    desc: "Brands, users, streams, batches and branding.",
    scale: { count: "1", unit: "one database, every brand in it", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "The console and the API stop answering. Streams already published stay published, because Swarm holds them rather than this." },
    blurb: "The durable state of the whole platform, and the one row set that has to be right about which brand owns what. Small enough that a nightly dump is a real backup strategy rather than a gesture." },

  auth: { name: "Authentication & ownership", type: "Component", icon: "shield",
    tech: ["OIDC", "wallet"],
    desc: "Open. Who may create and manage a brand's streams.",
    scale: { count: "1", unit: "one answer needed, none chosen yet", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "Anyone who can reach the API can act as any brand, which is why this cannot ship undecided." },
    blurb: "Three candidates and no decision: OIDC against something the brand already has, a wallet signature, or a magic link. It is a separate thread from this model, and it blocks the second brand rather than the first.",
    metrics: [["Model", "undecided", "open"], ["Blocks", "the second brand", ""]],
    note: "The pilot survives without it because there is one brand and one operator and both are us. Every path from here to two brands runs through this box." },

  stampmgr: { name: "Stamps & cheques", type: "Component", icon: "queue",
    tech: ["postage", "cheques"],
    desc: "Buys batches, tops them up, and watches the gateways' cheques.",
    scale: { count: "1", unit: "one manager over every batch and chequebook", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "Nothing for hours, then a batch fills and that rung publishes holes while every log line still says success." },
    blurb: "Postage is the thing that quietly kills a Swarm stream, so this owns the whole lifecycle: buy, watch TTL and bucket utilisation, dilute before saturation, top up. It watches the gateways' cheque balances for the same reason, because an underfunded gateway degrades retrieval without ever failing.",
    metrics: [["Batches watched", "1 per stream", ""], ["Dilute at", "85% utilisation", ""], ["Chequebook floor", "0.5 BZZ", ""]],
    note: "Measured during the Devcon work, and the reason this is a component rather than a runbook step: an immutable batch filled hours earlier than predicted and kept publishing with holes, because only the fullest buckets refuse." },

  branding: { name: "Branding", type: "Component", icon: "system",
    tech: ["theme", "domain"],
    desc: "Logo, colours and domain, turned into the SPA's config.",
    scale: { count: "1", unit: "one theme per brand", grows: GROWS.FIXED, resilience: RESILIENCE.SINGLE,
      onLoss: "The player falls back to an unbranded default, which for a white-label product is a visible failure rather than a cosmetic one." },
    blurb: "The whole point of the product is that the viewer sees the brand and not us, so this is not decoration. It writes the config the bootstrap reads: theme, logo, stream list, and the domain the player is served from." }
};
