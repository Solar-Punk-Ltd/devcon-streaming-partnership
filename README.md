# Devcon 8 streaming partnership

Working documents for the Ethereum Foundation streaming-partner conversation about
Devcon 8 (Mumbai, 3 to 6 November 2026). The question underneath all of it: can a
twenty-stage conference be streamed over [Swarm](https://www.ethswarm.org), and what
would it actually take.

**The architecture explorer is live at
<https://solar-punk-ltd.github.io/devcon-streaming-partnership/>**

These are working documents, not a finished proposal. They were written over three
weeks and the design changed underneath them more than once, so the tables below say
which parts of the older ones no longer hold.

## Where the design stands

Twenty parallel stages, twelve hours a day, four days. EF expects a peak around 4,000
concurrent viewers. We build to hold 40,000, because the cost of finding the ceiling
on the day is the event.

**Publishing.** Every stage is transcoded to a four rung ladder and published to Swarm
twice, on two lanes that share no signing key, no feed and no postage batch. A forked
feed is impossible by construction rather than policed. Twenty stages times four rungs
times two lanes is **160 feeds**, and one publisher node writes each one.

**Delivery.** A CDN sits in front of nodes we run, with Swarm as origin, storage and
archive in one. One prefetch node follows each feed, and the full set of 160 is placed
four times over at increasing distance across the address space, so anyone retrieving
from the network directly is at most one hop from a warm copy. A standby stack we build
ourselves runs dormant behind all of it, listed in the manifest as a redundant stream,
so failing over to it is stock HLS behaviour rather than something we operate.

**This supersedes the Swarm-only position** recorded on 2026-07-21, which said no CDN,
no fallback and no backstop of any kind. The reasoning for the change is in
[docs/architecture-plan.md](docs/architecture-plan.md), and the short version is that
egress dominates the cost model and load testing on origin-only delivery would have
cost more than the event itself.

## The documents

| Document | Written | Status |
|---|---|---|
| [arch-explorer/](arch-explorer/) | current | **The live model.** An interactive map of the architecture as it now stands, with the count and blast radius of every component. Where anything below disagrees with it, this one is right. |
| [docs/architecture-plan.md](docs/architecture-plan.md) | 2026-07-29 | The full reasoning: Swarm capacity analysis, failure and threat models, a cost model across seven providers, and the go or no-go gates. Still the best account of **why**. Its component design has moved on, see below. |
| [docs/architecture-plan.html](docs/architecture-plan.html) | 2026-07-29 | The same plan written for reading rather than for reference. Same caveat. |
| [docs/handover.md](docs/handover.md) | 2026-07-22 | The partnership brief for the EF. Written under the Swarm-only decision, so its delivery claims are superseded. Everything about scope, the split of responsibility and what we need from them still holds. |
| [docs/questionnaire.md](docs/questionnaire.md) | 2026-07-22 | Priority-tagged questions for the Devcon team across scope, feed spec, venue, scale, UX, archive, ops and commercial terms. Q17 and Q24 carry superseded numbers. |
| [docs/rollout/two-stage-terraform.md](docs/rollout/two-stage-terraform.md) | 2026-08-14 | The two-stage pilot on Google Cloud: two stage hosts, monitoring, and the Bee publishers out of scope on our own machines. Implemented in [terraform/](terraform/); [terraform/README.md](terraform/README.md) is the runbook. |

## What has moved since the older documents

The delivery model changed on 2026-07-29, and the component design changed again in an
architecture review on 2026-08-03. Both are reflected in `arch-explorer/`. Neither is
reflected in the July documents.

| Claim in an older document | Where it stands now |
|---|---|
| Delivery is Swarm-only, no CDN, no fallback | A CDN fronts nodes we run, and we build our own standby stack |
| A rented web2 mirror is the fallback | We build the fallback rather than rent it, so it fails the way we decided rather than the way a vendor decided |
| Design for 5,000 concurrent, stress to 20,000 | EF expects 4,000, we build a 40,000 ceiling |
| A publish lease decides who may sign | Deleted. Two independent lanes make a fork impossible, so there is nothing left to arbitrate |
| Three shared origin gateways serve every stage | One prefetch node per feed, so no shared component sits behind the stages |
| A coverage fleet seeds 256 neighborhoods | Four levels of 160 prefetch nodes, reaching all 512 neighborhoods at depth 9 |
| The player picks its tier and its rung | Neither. hls.js switches rungs off the master playlist and HLS fails over to a redundant stream, both without code from us |

## What the pilot costs to run

The pilot bills mostly for existing, not for streaming: idle egress is nothing, and the stage
machines are ~80% of the bill — each a `t2d-standard-8`, eight physical cores, chosen over n2 for
both price and transcode throughput. List-price estimates, ±5%, worth one calculator pass before
the first apply:

| State | Running | ≈ per day |
|---|---|---|
| Monitoring only (M1) | e2-standard-2, disks, one static address | **$2.50** |
| Stage 1 live (M2) | + a t2d-standard-8 in Frankfurt | **$13** |
| Both stages (M3) | + a t2d-standard-8 in Mumbai | **$19** |
| Paused between test windows | instances stopped; disks, addresses and TSDB kept | **$1** |

Neither T2D nor E2 earns a sustained-use discount, and test windows sit below the
quarter-of-month threshold where SUD starts — windows pay list either way. Streaming adds egress
on top: roughly $24 for a 40-hour test week of two stages, ~$425/month left running (GCP bills
GiB, and 216 GB is 201 GiB) — the arithmetic in the
[rollout plan](docs/rollout/two-stage-terraform.md). Spot instances would take 60% off the
machines, but a preemption voids a measured run: drills only, and never the monitoring host.
Pause by **stopping the instances**, not `terraform destroy`: destroy releases the static
addresses a Hetzner-side allowlist would key on and deletes the monitoring history with them.

## Running the architecture explorer

Zero dependencies. Native ES modules need a real origin, so opening `index.html` off
the filesystem will not work.

```bash
npm --prefix arch-explorer run dev
```

Then open <http://localhost:4173>.

```bash
npm --prefix arch-explorer test
npm --prefix arch-explorer run build
```

The build emits a single self-contained HTML file to `arch-explorer/dist/`.

GitHub Pages serves `docs/`, and the published site is the explorer itself at
`docs/index.html`. After changing the model, refresh it with:

```bash
npm --prefix arch-explorer run pages
```

## Open questions

Three things are unresolved, and each one changes a number in the design.

- **Contribution bitrate.** The spec says 8 Mbps per stage, which is 160 Mbps of venue
  uplink across twenty stages. Six would bring it to 120. Deferred pending the venue answer.
- **Mainnet storage depth.** The four-level placement assumes depth 9 and 512
  neighborhoods. A July survey measured depth 8 as the healthy radius. If the network
  has grown past 9, four levels stops covering everything.
- **In-browser retrieval.** Whether mainnet has enough wss-reachable nodes for a browser
  node to work at all is unmeasured, and we deliberately run no entry nodes to make it work.
