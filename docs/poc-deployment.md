# Single-stage POC: where it runs and what it costs

> **Status:** build plan, 2026-08-07.
> **Compute:** **Vultr Mumbai.** Settled, and [provider-selection.md](provider-selection.md)
> re-tested it against AWS and Azure with the same answer.
> **Delivery:** a CDN, **bunny.net Volume or a CloudFront flat-rate plan**, decided on a
> quote. bunny is priced below.
> **Cost:** **$182/month** for the dev loop, **$444/month** for a rehearsal with 300
> viewers, **$508/month** with a 3,000-viewer load test on top.

This covers the proof of concept only: one stage, end to end, on real infrastructure.
The twenty-stage build is costed in [architecture-plan.md](architecture-plan.md) section 13,
and the component design is in [`../arch-explorer/`](../arch-explorer/).

---

## 1. What the POC proves, and what it does not

**Proves:** a produced feed goes in, a four rung ladder comes out, every segment lands on
Swarm on two independent lanes, a CDN serves it to a browser, and the archive is the same
chunks. Plus the numbers we do not have: retrieval latency from a cold cache, what a Bee
node actually costs in bandwidth, and whether the postage and chequebook lifecycle survives
four days unattended.

**Does not prove:** anything about scale. Neighborhood coverage, the four-level prefetch
placement and the 40,000 ceiling are all questions about a network, not about a pipeline,
and one stage cannot answer them. Do not let a green POC be read as a green Gate 2.

---

## 2. Why the fleet is not on a hyperscaler

**Both hyperscalers were priced against Vultr and both lose on the same line.** Ingest and
transcode run fine anywhere. What decides it is that on a POC the dominant traffic is not
viewers, it is the Bee nodes talking to the network, and a Bee node earns BZZ at a rate
nowhere near cloud egress list price. Vultr charges $0.01/GB and pools an allowance across
the account. Azure charges $0.12/GB from the first byte and **AWS charges $0.1093/GB**,
which is the same money. A like-for-like single-stage rehearsal is **$4,243/month on Azure,
$1,776 of it egress**, against **$924 on Vultr with the egress line at zero.**

Compute compounds it. The five machines in section 4 cost $420/month on Vultr, **$977 on
AWS and $1,030 on Azure** for the same cores, memory and disk. The full comparison,
including the DDoS and Terraform criteria that price tables miss, is in
[provider-selection.md](provider-selection.md).

**Neither hyperscaler's CDN is ruled out, and CloudFront's is a real contender.** Its
flat-rate plans bundle WAF and DDoS and carry no overage charge even during an attack,
which is a property nothing else here offers. Azure Front Door is cheaper at volume than
the twenty-stage plan credits it for, but still several times bunny Volume. Section 5 below
prices bunny because that is what the POC will be built on; the event-scale choice between
the two is a quote, not an argument.

**On the fleet, the plan's split is worth collapsing.** Section 13.5 spreads the Swarm fleet
across a bulk-coverage host in Europe and a handful of India-local nodes for the WSS entry
role. That is two providers, two networks, two secret stores and two monitoring integrations
for one fleet, and section 13.4 already argues that complexity is the main threat to shipping
in the weeks we have.

Vultr does both jobs. It has **Mumbai, Bangalore and Delhi NCR**, which the European hosts do
not, so coverage nodes and India-local nodes can be the same provider and, if we want, the
same region. Its bandwidth allowance **pools across the whole account** rather than per
instance, which is what makes the cost model below work. And node hosting is a supported use
case rather than something to check.

Note also that the European bandwidth figures in section 13.3 predate two 2026 price rises,
roughly 37% in April and **up to 176% on the CPX and CCX lines on 15 June**, so the gap they
imply is smaller than it looks. Sections 13.3, 13.5 and 13.7 are updated alongside this
document.

---

## 3. Vultr, and what it gives us

| Requirement | Vultr |
|---|---|
| **Node hosting is a supported workload** | Running nodes, decentralised applications and web3 infrastructure is an advertised use case, with its own solutions page. |
| **India presence** | Three regions: **Mumbai (`bom`)**, Bangalore (`blr`), Delhi NCR (`del`). Mumbai is the venue city. |
| **Bandwidth economics** | **$0.01/GB** overage, and included transfer is **pooled globally across the whole account**, not per instance. Inbound is free. |
| **Inbound P2P reachability** | A public IPv4 per instance, with each Bee node on its own port. No NAT gateway problem. |

The pooling is what makes the cost model work. Five instances carrying 3 to 7 TB each give
**24 TB of pooled monthly egress before a cent of overage**, and the whole POC is estimated
to use about 5 TB of that.

This is not a new idea. It is Variant B in the plan's provider comparison, promoted from
fallback to primary.

---

## 4. The fleet

Prices are Mumbai (`bom`), from Vultr's public plans API on 2026-08-06.

| Role | Plan | Qty | $/mo | Transfer |
|---|---|---|---|---|
| Transcode worker, four rungs | `voc-c-8c-16gb-150s-amd`, 8 **dedicated** vCPU | 1 | 160 | 7 TB |
| Bee publishers, 8 nodes, 4 per host | `vc2-4c-8gb`, 4 vCPU / 8 GB / 160 GB | 2 | 80 | 8 TB |
| Bee prefetch, level 0, 8 nodes | `vc2-8c-32gb`, 8 vCPU / 32 GB / 640 GB | 1 | 160 | 6 TB |
| Control plane, Prometheus + Grafana + Loki | `vc2-2c-4gb`, 2 vCPU / 4 GB / 80 GB | 1 | 20 | 3 TB |
| | | **5** | **$420** | **24 TB pooled** |

Notes on the choices:

- **Transcode takes dedicated vCPU.** A four rung x264 veryfast ladder is about 7.5 vCPU
  sustained, and shared vCPU under a sustained encode is where noisy neighbours show up as
  dropped frames. `voc-c-8c-16gb-150s-amd` costs the same $160 as the shared 8 vCPU plan and
  is dedicated, so there is nothing to trade off.
- **Publishers are light nodes.** They push and sign, they do not hold a reserve, so 40 GB of
  disk each is plenty and four fit comfortably on one host.
- **Prefetch nodes are full nodes.** They hold their neighborhood's reserve, so they need real
  disk: 640 GB across 8 nodes is 80 GB each, against a Bee reserve of roughly 16 GB plus cache.
- **One stage is 8 feeds**, being 4 rungs on 2 lanes, so 8 publishers and 8 level-0 prefetch
  nodes is one of each per feed. That is the design's own ratio, just at n=1 stage.

**Level 0 only.** The full design places the 160-node set four times over. That is a
neighborhood-coverage property and one stage cannot exercise it, so the POC runs level 0 and
the four-level question waits for a network test. Adding the other three levels is three more
`vc2-8c-32gb`, $480/month, and is priced in the table below as the like-for-like row.

---

## 5. Cost

Assumptions stated so they can be argued with: 48 live hours a month of test streaming for
the rehearsal, 3 Mbps average delivered bitrate to viewers, and **Bee peer-to-peer egress
estimated at 1.0 to 1.5 Mbps per node sustained**. Bandwidth is pooled and inbound is free.

| Scenario | What it is | Compute | Egress | bunny | **Total/mo** |
|---|---|---|---|---|---|
| **Dev loop** | 40 h streaming, ~10 internal viewers, 2 rungs, level 0 | $180 | $0 | $3 | **$183** |
| **Rehearsal** | 200 h streaming, 300 concurrent for a 12 h day, 4 rungs | $420 | $0 | $24 | **$444** |
| **Load tested** | the same, plus 3,000 concurrent for 3 h | $420 | $0 | $85 | **$508** |
| *Like-for-like* | *rehearsal with all 4 prefetch levels, 32 nodes* | *$900* | *$0* | *$24* | *$924* |

**The egress column is zero in every row, and that is the whole point.** Estimated usage is
2.9 TB for the dev loop and 5.1 TB for the rehearsal, against 24 TB pooled and included.
Even the like-for-like 32-node row uses about 16.9 TB against 42 TB pooled. The same traffic
costs $1,778 on Azure and $1,671 on AWS.

Load generators are trivial: 3,000 virtual viewers is about 30 vCPU for three hours, roughly
$3 at hourly billing, and they pull from bunny rather than from origin.

### Against the hyperscaler figures

| | Azure | AWS | Vultr + bunny |
|---|---|---|---|
| Rehearsal, 32 prefetch nodes | $4,243 | ~$4,100 | **$924** |
| of which egress | $1,778 | $1,671 | **$0** |
| of which prefetch compute and disk | ~$1,950 | ~$1,900 | $640 |

**AWS and Azure land within a few percent of each other**, which is the useful result:
there is no cheaper hyperscaler to escape to. Both meter peer-to-peer egress from the
first byte, and both charge roughly two and a half times Vultr for the same cores.

### What is not in these numbers

- **Postage stamps and chequebooks.** One stage is 8 postage batches, one per publisher, plus
  a funded chequebook each with a 0.5 BZZ floor. Denominated in BZZ and xDAI on Gnosis, so it
  moves with the token price and is outside what this document prices.
- **Engineering time**, which is the actual scarce resource.
- **The venue hop**, which does not exist yet. See below.

---

## 6. Does the POC need India?

**Probably not, and it is worth asking before committing.** There is no venue feed yet, so
the contribution source is synthetic. Nothing in the POC's list of things to prove depends on
being 150 km from JIO World Centre.

Mumbai is chosen anyway because it costs the same as anywhere else on Vultr, it removes a
variable from the eventual rehearsal, and India-local retrieval latency is one of the numbers
worth collecting early given that Swarm has effectively no presence in India. But if
Bangalore or Delhi NCR has better capacity for the plans above, take it.

---

## 7. Risks, and what to get in writing

1. **Describe the workload in writing, not just the traffic profile.** The plan already says
   to get sustained bandwidth agreed up front. That conversation should cover what the nodes
   actually do as well, so the profile is on record before the event rather than explained
   during it. Sustained multi-gigabit video alongside long-lived peer-to-peer connections is
   an unusual shape for a low-cost host, and an abuse review mid-event would be
   unrecoverable.
2. **The Bee peer-to-peer egress figure is an estimate**, and it is the largest uncertainty
   here even though it currently costs nothing. Swarm's own guidance is roughly 10 Mbps for a
   full node doing constant chunk syncing, which is 7x the figure used above. At 10 Mbps per
   node the like-for-like row uses 105 TB and would cost about $630 in overage on Vultr,
   against **$9,102 on Azure and $8,995 on AWS**. **Measure two nodes for a week before sizing
   anything at twenty stages.** It is cheap to measure and it moves the twenty-stage bill more
   than any other single number.
3. **Vultr is a smaller provider than either hyperscaler.** Less headroom to burst, support is
   not theirs, and sustained multi-gigabit video from a low-cost VPS is exactly the profile
   that triggers an abuse review. Immaterial at POC volume; it is a twenty-stage risk, and the
   mitigation is the same written agreement.
4. **The transcode host cannot have Vultr's DDoS protection.** The add-on is $10/month per
   instance and is offered on Cloud Compute and High Frequency plans;
   `voc-c-8c-16gb-150s-amd` is Optimized Cloud Compute and is not eligible. Move it to a
   `vhf` plan, put it behind something, or accept that it is unprotected. Decide before the
   fleet is built. The add-on is also **layer 3 and 4 only**, so it is not an answer to
   application-layer attack on any host.
5. **What we give up.** No managed Kubernetes worth the name, no Front Door-grade WAF, weaker
   autoscale, and monitoring agents on plain VMs. The CDN absorbs DDoS at the edge, which
   covers the biggest of those. The plan budgets 1.5 to 2.5 engineer-weeks for this at twenty
   stages; at one stage it is days.

---

## 8. What to do first

1. **Open the Vultr account and ask the policy question in writing** before building anything.
   This is the long pole and it is a two-line email: 8 to 40 Bee nodes, sustained outbound,
   storage-incentive rewards, not mining.
2. Stand up the dev loop, five instances, and get one stage end to end.
3. **Instrument Bee egress per node from day one.** See risk 2.
4. Open the bunny.net account, **measure what the Volume tier does for India** given its
   nearest PoPs are Singapore and Hong Kong rather than Mumbai, and **verify origin shield is
   actually on** before quoting any saving that depends on it.
5. **In parallel, pull a configured CloudFront Premium quote** at the event's volumes. It
   costs nothing to ask and it is the only way to settle the delivery choice. See
   [provider-selection.md](provider-selection.md) section 7.
6. Fund 8 postage batches and 8 chequebooks, and let them run unattended for a week to see
   whether the lifecycle automation holds.
7. Only then add prefetch levels 1 to 3 and start asking network questions.

---

## Sources

Checked 2026-08-06, hyperscaler and DDoS figures rechecked 2026-08-07.

- Vultr plans and regions, [public API](https://api.vultr.com/v2/plans): Mumbai `bom`,
  Bangalore `blr`, Delhi NCR `del`. All plan prices above are from this endpoint.
- [Vultr blockchain solutions](https://www.vultr.com/solutions/blockchain/): node hosting as a supported workload.
- [Vultr bandwidth overage](https://docs.vultr.com/support/platform/billing/what-is-the-bandwidth-overage-rate):
  $0.01/GB. [Global pooling and free ingress](https://www.vultr.com/news/Vultr-Announces-Reduced-Bandwidth-Pricing-2-Tb-Of-Free-Monthly-Egress-Free-Ingress-And-Global-Pooling/).
- [Vultr DDoS Protection](https://docs.vultr.com/ddos-protection): 10 Gbps per instance, layers
  3 and 4, Cloud Compute and High Frequency plans only,
  [$10 per instance per month](https://docs.vultr.com/support/platform/billing/how-much-does-ddos-protection-cost).
- Hetzner June 2026 price increase: [CPX and CCX up to +176%](https://wz-it.com/en/blog/hetzner-price-increase-june-2026-cpx-ccx-alternatives/).
- [bunny.net pricing](https://bunny.net/pricing/): Volume tier $0.005/GB, no per-request fee.
  [Volume network PoPs](https://bunny.net/network/): 10 globally, none in India.
- AWS and Azure comparison figures are derived in
  [provider-selection.md](provider-selection.md) from the AWS metered unit maps and the
  [Azure retail prices API](https://prices.azure.com/api/retail/prices).
