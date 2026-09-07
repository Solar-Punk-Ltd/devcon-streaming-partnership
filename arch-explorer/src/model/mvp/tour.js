/**
 * One pass over the MVP, in the order it makes sense to hear it in a room.
 *
 * The first seven steps are what ships. The last three are the arguments the
 * workshop is there to have, which is why they end on an overlay rather than
 * on a component: the answer is a colour across the whole diagram, not a box.
 *
 * Each step declares the exact set of boxes it wants open, so a step can
 * close what the last one opened rather than only ever accumulating.
 */

export const MVP_TOUR = {
  name: "The MVP, in ten steps",
  about: "The September pilot of the multi-brand platform: what ships, what is still an open question, and what the second brand would cost.",
  steps: [
    {
      title: "One month, one brand, one stage",
      text: "A brand pushes one SRT feed, we publish an ABR ladder to Swarm, and their viewers watch it in a player carrying their name. That is the whole of September, at about five hundred concurrent viewers. Everything else in this model is a decision this workshop is here to make.",
      open: [], focus: null,
    },
    {
      title: "The brand brings the feed",
      text: "OBS or a hardware encoder at their venue, one SRT endpoint per stage, on a passphrase we issue. The contribution spec is ours to write, and the keyframe interval is the part that matters, because it is what lets segments be cut cleanly at two seconds. Nothing on the far side of that socket is ours.",
      open: [], focus: ["encoder", "platform"], light: ["encoder", "platform"], edge: "encoder>platform",
    },
    {
      title: "Per stage on GCP, per stream on Vultr",
      text: "Two machines and a clean split. One Terraform-built host per stage does ingest, the ladder, packaging and the upload; one Vultr host holds the Bee publishers that own the postage and the signing keys. Losing either takes the stream off air, and the recovery is applying the definition again rather than failing over to anything.",
      open: ["platform"], focus: ["gcp", "beehost"], light: ["gcp", "beehost", "sim"], edge: "gcp>beehost",
    },
    {
      title: "Publishers and gateways",
      text: "Four publishers for a four rung ladder, one per rung, each with its own feed, key and postage batch, so a full batch costs a rung instead of the stream. The gateways are the other half of the same machine and have nothing to do with publishing: they are how a viewer reads when their own node will not start. Whether they belong to one brand or to all of them is undecided.",
      open: ["platform", "beehost"], focus: ["beepub", "beegw"], light: ["beepub", "beegw", "swarm"], edge: "beepub>swarm",
    },
    {
      title: "Watching: node first, gateway second",
      text: "The SPA tries to start a Bee node in the browser and fetch chunks from Swarm directly, which is the claim the whole product rests on. When that fails, and in the pilot it often will, it falls back to a gateway over plain HTTPS and the player never learns the difference. hls.js switches rungs off the master playlist either way, which is the one part of ABR that comes for free.",
      open: ["platform", "spa"], focus: ["innode", "abrplayer"],
      light: ["spa", "innode", "gwfallback", "abrplayer"], edge: "innode>abrplayer",
    },
    {
      title: "Who pays, and how we know it is paid",
      text: "Postage is what quietly kills a Swarm stream: a full batch keeps publishing holes while every log line still says success. So one component buys the batch, watches its TTL and bucket utilisation, dilutes before saturation, and watches the gateways' cheque balances for the same reason. It is the only thing here that spends money and the only thing that talks to the chain.",
      open: ["platform", "admin"], focus: ["stampmgr", "chain"],
      light: ["stampmgr", "chain", "beehost"], edge: "stampmgr>chain",
    },
    {
      title: "Operating it",
      text: "Nothing on the stage host is configured by hand. The manager holds the media profile, the port slot, the publisher list, the signing key, the stamp and the SRT passphrase, and applies them by running docker compose over ssh. Today it runs on the host it deploys to and reaches it over loopback, which is why it has no authentication of its own, and why a second stage is the thing that changes that.",
      open: ["platform"], focus: ["admin", "sim"], light: ["admin", "sim", "gcp"], edge: "admin>sim",
    },
    {
      title: "Open: who owns a stream",
      text: "Three candidates and no decision: OIDC against something the brand already has, a wallet signature, or a magic link. It is not one box either, because the admin API and the manager API both have to know which brand a call may act for. The pilot survives without it since there is one brand and one operator and both are us, and every path to a second brand runs through here.",
      open: ["platform", "admin"], focus: "auth", light: ["auth", "adminui", "adminapi"], overlay: "scope",
    },
    {
      title: "Open: chat",
      text: "Swarm feeds or GSOC keep the whole product on one network, and are slow and unproven for a conversation. A websocket in the web2 layer works today and puts a centralised dependency in the middle of a decentralised product. Worth deciding here rather than during the build, because the two answers put the component in two different places.",
      open: ["platform", "spa"], focus: "chat", light: ["chat", "abrplayer", "swarm"], overlay: "scope",
    },
    {
      title: "Per brand or shared",
      text: "With this on, the cost of the second brand reads straight off the diagram. Teal is another machine or another process every time we sign someone, violet is built once and paid for once, and amber is the argument still to have. Everything the viewer touches is per brand whether we like it or not, which is the half of the bill nobody argues about.",
      open: ["platform"], focus: null, overlay: "tenancy",
    },
  ],
};
