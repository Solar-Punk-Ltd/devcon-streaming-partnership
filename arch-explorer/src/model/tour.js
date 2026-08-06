/**
 * One walkthrough of the whole plan, in the order it makes sense to hear it.
 *
 * Each step declares the exact set of boxes it wants open, so a step can close
 * what the last one opened rather than only ever accumulating. `focus` is what
 * the camera frames, `light` is what stays lit while everything else recedes,
 * and `edge` is the one connection being talked about.
 *
 * The incidents that used to be separate scenarios are folded in where they
 * belong in the story, because "what happens when this breaks" is part of
 * explaining a component, not a separate topic.
 */

export const TOUR = {
  name: "The whole thing, end to end",
  about: "Twenty stages of live video onto a decentralised network, and what happens when each part of it fails.",
  steps: [
    /* ── What we were asked for, before anything is opened ── */
    {
      title: "What we are being asked for",
      text: "Twenty stages, twelve hours a day, four days. EF expects a peak around four thousand watching at once and we build to hold forty thousand, because the cost of finding the ceiling on the day is the event. Seventy percent of them are on a phone. EF asked for stability above everything else, which is the sentence every decision after this one answers to.",
      open: [], focus: null,
    },
    {
      title: "The feed is theirs, not ours",
      text: "EF's AV vendor owns capture, vision mix and encoding, on their own production network. They will encode to whatever spec we give them, so the contribution spec is ours to write: 1080p30, closed GOP on a fixed 2 second keyframe, one SRT output per stage. That keyframe rule is what makes clean segmenting possible and it is the one people forget.",
      open: [], focus: ["av", "sys"], light: ["av", "sys"], edge: "av>sys",
    },
    {
      title: "We publish, then get out of the way",
      text: "Every segment goes into Swarm in real time. Viewers retrieve from Swarm, not from us. The nodes we run are how most of them do it and what makes it cheap, but the content is public by address, so anyone holding the reference can fetch it anywhere.",
      open: [], focus: ["sys", "swarm", "viewers"], light: ["sys", "swarm", "viewers"], edge: "swarm>viewers",
    },
    {
      title: "Including people we never meet",
      text: "Somebody running their own node fetches the same bytes from the network without touching anything of ours. We run no entry nodes for them and we do not scale for them. That is the claim being demonstrated rather than a tier we operate, and it works only if mainnet already has nodes a browser can dial, which nobody has measured.",
      open: [], focus: ["swarm", "browsernode"], light: ["swarm", "browsernode"], edge: "swarm>browsernode",
    },

    /* ── Inside the system ── */
    {
      title: "Inside: four containers",
      text: "Publish, a standby path, delivery, and the player. Everything in here is on the signal chain. The control plane and the network monitor sit outside the box, because they watch the stream rather than carry it.",
      open: ["sys"], focus: "sys",
    },
    {
      title: "Nothing sits in front of the stages",
      text: "Each encoder pushes to its own stage, on an address that belongs to the stage rather than to the machine. A worker dies, the address moves to a standing spare, and the encoder reconnects to the destination it was configured with months ago. Nobody at the venue touches anything, and there is no shared tier for everything to fail behind.",
      open: ["sys"], focus: ["av", "pipeline"], light: ["av", "pipeline"], edge: "av>pipeline",
    },
    {
      title: "One worker per stage, and that is the whole idea",
      text: "Every stage gets its own isolated worker, so a crash takes down exactly one stage of twenty. Twenty workers is about 150 vCPU across ten machines, with N plus two standing spares rather than a hot twin for each. A worker is stateless, so a spare has nothing to move across and paying twice for compute buys almost nothing.",
      open: ["sys"], focus: "pipeline", light: ["pipeline"],
    },

    /* ── What happens in one stage ── */
    {
      title: "What happens in a stage",
      text: "This is where the session is finally opened, so this is where authentication happens: the receiver checks the streamid and passphrase and refuses anything it does not recognise. A firewall in front of it means a stranger cannot open a session at all. Then decode, encode four rungs, and cut two second segments on the encoder's keyframes.",
      open: ["sys", "pipeline"], focus: "pipeline", light: ["venueacl", "srtin"],
    },
    {
      title: "The lower rungs are the product",
      text: "360p, 480p, 720p and 1080p. With seventy percent on phones the bottom two carry most of the audience, so the ladder is not a luxury tier. The top rung is 3 Mbps, which is what makes a two second segment come out at the 750 KB we measured. Writing this ladder well is the work, because the player switches between them on its own.",
      open: ["sys", "pipeline"], focus: ["worker", "packager"], light: ["srtin", "worker", "packager"], edge: "worker>packager",
    },
    {
      title: "Two lanes, because one writer cannot be made redundant",
      text: "A feed is a numbered list only one key may append to, so two writers on one feed write conflicting entries at the same index and fork it permanently. The usual fix, run two of them, is the disaster rather than the cure. So we run two whole lanes instead: one uploader a stage in each, handing its four rungs to four publishers that each own one feed, one key and one postage batch. Nothing is shared that can be signed or funded, so a fork is impossible by construction rather than policed.",
      open: ["sys", "pipeline"], focus: ["uploader", "uploaderb"],
      light: ["packager", "uploader", "uploaderb", "beepub", "beepubb"], edge: "packager>uploaderb",
    },
    {
      title: "And no distributed lock to get wrong",
      text: "There was a publish lease here, a TTL lock deciding who may sign. It is gone. Two writers inside one lane are prevented more simply: a writer is pinned to one host and the supervisor guarantees one process on it, so there is no second place it could run from. A lock could not have been airtight anyway, because real fencing means the storage refuses a stale write, and a Swarm feed accepts any correctly signed update.",
      open: ["sys", "pipeline"], focus: ["uploader", "beepub"],
      light: ["uploader", "beepub"], edge: "uploader>beepub",
    },
    {
      title: "Into Swarm, in real time",
      text: "A 750 KB segment scatters into 183 chunks landing in 183 different neighborhoods, then the signed feed is updated to point at the new manifest. Blocking one neighborhood blocks a fraction of one chunk in a segment, and erasure coding reconstructs it. Where those chunks land is decided by their content, not by us, which is why placement cannot steer a chunk and why covering the space evenly is the only thing that works.",
      open: ["sys", "pipeline"], focus: ["beepub", "swarm"], light: ["uploader", "beepub", "swarm"], edge: "beepub>swarm",
    },
    {
      title: "And a clean copy regardless",
      text: "The recording is taken on site at the encoder, not from our path, so it keeps running whatever the network does. When a stage drops, the archive does not have to inherit the gap even though the live stream did. It is post-event only, and right now nobody owns the splice and it is in no timeline, so it is insurance nobody is set up to claim.",
      open: ["sys", "pipeline"], focus: "record", light: ["srtin", "record"], edge: "srtin>record",
    },

    /* ── The path that is not Swarm ── */
    {
      title: "A second path, and this one is ours",
      text: "The same segments written again to plain object storage behind a different CDN provider. It runs from day one and serves nobody. Building it rather than renting somebody's platform means the fallback fails the way we decided it would, and it shares nothing with the Swarm path but the packager output, so a full batch, a forked feed or a bad Bee release cannot reach it.",
      open: ["sys"], focus: "fallback", light: ["pipeline", "fallback"], edge: "pipeline>fallback",
    },
    {
      title: "What it covers, and the gap it does not",
      text: "Fed from the packager, so it covers everything downstream: Swarm trouble, a full batch, a delivery failure, a bad release. It does not cover a lost contribution feed, because that takes both paths down together. Only a second uplink out of the venue closes that, and nothing inside our stack can.",
      open: ["sys", "fallback"], focus: "fallback", light: ["objstore", "fallcdn"], edge: "objstore>fallcdn",
    },

    /* ── Getting it to forty thousand people ── */
    {
      title: "One node per feed, and the whole set again at four distances",
      text: "Three gateways used to serve all twenty stages, which made losing the pool an event-wide outage. Now a prefetch node subscribes to exactly one feed, the same way a publisher writes exactly one, so a full copy of the stream is 160 nodes. Level 0 sits in the stages' own neighborhoods and feeds the CDN. Levels 1 to 3 are the same 160 again, further out, until there is one of ours in all 512 neighborhoods. That is what makes the worst case one hop, and one hop is the requirement that set the number.",
      open: ["sys", "delivery"], focus: ["delivery", "prefetch"], light: ["delivery", "swarm", "prefetch", "allow"], edge: "swarm>prefetch",
    },
    {
      title: "The CDN absorbs the viewers, and the attack",
      text: "Level 0 serves about 2.4 TB of unique content once. The edge serves it to everyone, about 12 Gbps at EF's expected peak and about 120 Gbps at the forty thousand ceiling we build for. Without the shield each point of presence would pull every segment independently and that number moves by an order of magnitude. The realistic attack here is not knocking us offline, it is running up that bill, so the circuit breaker is a hard egress ceiling that trips before the budget does.",
      open: ["sys", "delivery"], focus: ["shield", "cdn"], light: ["prefetch", "shield", "cdn"], edge: "shield>cdn",
    },
    {
      title: "What the phone actually does",
      text: "The player is hls.js with one thing replaced: its loader, so it fetches from Swarm feeds rather than URLs. Everything else is stock. It switches rungs off the master playlist by itself, and it fails over to the standby by itself, because both are listed in the manifest as redundant streams. Two components rather than four, and only one of them is unbuilt work.",
      open: ["sys", "player"], focus: "player", light: ["loader", "telemetry"],
    },

    /* ── Knowing what is happening ── */
    {
      title: "Knowing, and being able to act",
      text: "Stability means detection and response, not more redundancy. Configure the parts that already exist, Prometheus, Grafana, Loki, Alertmanager and Terraform. Build only the five that do not: the Swarm exporters, the stream prober, the beacon collector, the stamp manager and the run-of-show board.",
      open: ["ctrl"], focus: "ctrl",
    },
    {
      title: "What a viewer would see",
      text: "Synthetic probes in four regions, pulling the manifest exactly as a viewer would and asserting it is advancing and gapless. What a server thinks is fine is not evidence. The most diagnostic probe deliberately fetches uncached content, because if every probe hits cache then everything looks healthy right up until it is not.",
      open: ["ctrl"], focus: ["probes", "metrics"], light: ["probes", "metrics"], edge: "probes>metrics",
    },
    {
      title: "And what they actually saw",
      text: "CDN logs already give us concurrency, rungs, errors and geography for free. The one thing they cannot see is rebuffering, because the CDN watched the segment leave and has no idea the buffer ran dry waiting for it. So one viewer in twenty sends four numbers every thirty seconds, no cookies and no IDs. Until recently the player reported and nothing received, which would have meant no Gate 2 evidence at all. Size it for the worst case, because a bad day makes every player retry and report at once.",
      open: ["ctrl"], focus: ["beacons", "metrics"], light: ["beacons", "metrics", "alerts"], edge: "beacons>metrics",
    },
    {
      title: "The quiet failure worth fearing",
      text: "A full postage batch does not stop publishing. Only the fullest buckets refuse, so the stream keeps going with holes in it while every log line still says success. Watch bucket utilisation, dilute at 85%, buy mutable so a batch recycles rather than dies. This used to be unrecoverable. With a batch per publisher it costs one rung of one lane, and the price of that is 160 batches and 160 chequebooks for this component to keep alive.",
      open: ["ctrl"], focus: "stamps", light: ["stamps", "alerts"], edge: "stamps>alerts",
    },
    {
      title: "And watching the ground we stand on",
      text: "Network size, neighborhood population and reachable node count, watched separately from watching ourselves. It answers a different question: not are we healthy, but is the ground moving under us. Swarm had about 3,143 reachable nodes at the last snapshot and effectively no presence in India, so every Mumbai retrieval crosses to Europe and back.",
      open: [], focus: "netmon", light: ["netmon", "swarm"], edge: "netmon>swarm",
    },

    /* ── The two questions a reliability review asks ── */
    {
      title: "How many of each, and what covers one",
      text: "Every box carries its count, so the shape reads without a word. One number explains most of them: twenty stages times four rungs times two lanes is one hundred and sixty feeds. One publisher writes each, one prefetch node reads each, and four levels of those puts one of ours in every neighborhood. Everything else is twenty of something inside a stage, or one of a few things that must never run twice. Green means a second is already live. Crimson means exactly one on purpose, because a second would fork a feed or duplicate a signing key.",
      open: ["sys", "pipeline", "delivery"], focus: null, overlay: "scale",
    },
    {
      title: "Redundancy is not the same as spare capacity",
      text: "Two rules pointing opposite ways. Anything stateless is duplicated freely: standing spares beat hot twins, because a worker has nothing to move across. Anything that appends to a signed list cannot be duplicated at all, because a second live copy corrupts rather than covers. So redundancy there means a second whole lane sharing no index, not a second writer on the same one.",
      open: ["sys", "pipeline"], focus: ["uploader", "uploaderb"],
      light: ["uploader", "uploaderb", "beepub", "beepubb"], edge: "packager>uploaderb", overlay: "scale",
    },
    {
      title: "What breaks together",
      text: "There is no every-stage component left in the publish path at all, and none in delivery either, since the shared gateways became one node per feed. From the encoder to the viewer the blast radius is one stage of twenty, and inside a stage it is usually one rung of one lane. What is left on the short list is the CDN and its settings, and losing the control plane costs the warning rather than the stream.",
      open: ["sys"], focus: null, overlay: "blast",
    },

    /* ── What is still theirs to answer ── */
    {
      title: "Still open with EF",
      text: "Does AV run one aggregation node we receive from, or do twenty encoders push to us directly? One address per stage assumes the second. And the uplink is the real constraint: twenty stages at 8 Mbps is 160 Mbps sustained for twelve hours a day out of a packed hall, which is very likely more than the building has. Six would bring it to 120, and the top delivery rung is only 3, so there is room to trim. Both are their spend and their lead time, so raise them early.",
      open: [], focus: ["av", "sys"], light: ["av", "sys"], edge: "av>sys",
    },
  ],
};
