# Where the architecture runs: Vultr, Azure and AWS scored

> **Status:** provider evaluation, 2026-08-07. All prices are list, checked the same day
> against live pricing APIs.
> **Scored on:** DDoS and all-round security, price, and how much of it Terraform can hold.
> **Recommendation:** **two providers, not one and not three.** The Swarm fleet runs on
> **Vultr Mumbai** because no other candidate can carry peer-to-peer egress. Viewer delivery
> runs on a CDN, and the choice between **bunny.net Volume** and **CloudFront's flat-rate
> plan** is a quote rather than an argument. Ingest, transcode and control follow the CDN
> so the provider count stays at two.

The single-stage build plan is in [poc-deployment.md](poc-deployment.md). The full cost
model at twenty stages is [architecture-plan.md](architecture-plan.md) section 13. This
document only answers *where*.

---

## 1. The finding that decides it

**This is not one hosting question, it is three, and they have different answers.**

| Workload | What it actually needs | Egress shape |
|---|---|---|
| **Swarm fleet**, publishers and prefetch nodes | many small machines, a public IPv4 each, inbound peer-to-peer reachability, disk for reserve sync | **sustained peer-to-peer, all month, earning fractions of a cent per GB** |
| **Ingest, transcode, control plane** | predictable CPU, India proximity, reliability | negligible |
| **Viewer delivery** | 85 to 855 TB in four days, India PoPs, absorbing an attack | **the whole bill** |

The Swarm fleet is the one that forecloses options. A Bee node serves chunks to the
network continuously and is paid in BZZ at a rate nowhere near cloud egress list price,
so **metered egress turns the fleet from roughly free into the largest line in the model**:

| Fleet and assumption | Monthly egress | Vultr | AWS Mumbai | Azure Central India |
|---|---|---|---|---|
| 8 nodes at 1.0 to 1.5 Mbps, the POC estimate | 5.1 TB | **$0** | $546 | $600 |
| 32 nodes, same rate | 16.9 TB | **$0** | $1,671 | $1,778 |
| 32 nodes at Swarm's own 10 Mbps guidance | 105 TB | **$630** | $8,995 | $9,102 |

Vultr includes 2 to 7 TB per instance and **pools it across the account**, so the first
two rows are free outright. AWS and Azure meter every gigabyte from the first, at
$0.1093 and $0.12 respectively, and their published tiers converge above 10 TB — **AWS is
not the cheaper of the two hyperscalers here, it is the same price.**

Extend that to the design's 640-node prefetch fleet and the metered options stop being a
budget conversation. **The fleet stays on Vultr.** Everything below is about the other two
workloads, where the answer is genuinely open.

---

## 2. Criterion 1: all-round security and DDoS

### What each provider actually sells

| | What you get free | What the real product costs | Layers | Catch |
|---|---|---|---|---|
| **AWS** | **Shield Standard, automatic on every resource, no opt-in** | Shield Advanced **$3,000/mo, one-year commit** | L3/L4 free; L7 via WAF | WAF is **$0.60 per million requests** — see below |
| **Azure** | platform-level protection only, not a product you can configure or see | **IP Protection $199/mo per public IP**, or **Network Protection $2,944/mo** to 100 IPs | L3/L4; L7 via Front Door WAF | per-IP pricing is punitive for a fleet of many small nodes |
| **Vultr** | nothing | **$10/mo per instance**, 10 Gbps mitigation | **L3/L4 only** | **not available on Optimized Cloud Compute**, which is the plan family the transcode host uses; also requires Vultr's own DNS resolver |
| **bunny.net** | **DDoS mitigation included with the CDN**, 200 Tbps network, sub-10-second detection, and Shield Basic with 71 WAF rules | Shield Advanced $9.50/mo, Business $99/mo | **L3, L4 and L7** | paid Shield tiers are **request-metered**, and our volumes are far above the top published tier |
| **CloudFront flat-rate plans** | — | WAF, DDoS, bot management, DNS and logs **bundled in one flat monthly price** | L3, L4, L7 | allowance is per distribution; above 600 TB it is a sales conversation |

**Three things worth pulling out of that table.**

**AWS has the best free baseline of the three IaaS candidates, by a distance.** Shield
Standard is on by default, everywhere, at no cost. Azure's equivalent is a $199-per-IP
product, and on a fleet with a public IPv4 per node that is arithmetic nobody will sign
off. Vultr's is $10 per instance for L3 and L4 only.

**Vultr's DDoS add-on does not cover the machine we most need it on.** It is offered on
Cloud Compute and High Frequency plans. The transcode host in the POC build is
`voc-c-8c-16gb-150s-amd`, an Optimized Cloud Compute plan, and is therefore not eligible.
Either the transcode host moves to a `vhf` plan, or it sits behind something else, or it
has no DDoS protection at all. This needs deciding before the fleet is built, not after.

**The most expensive DDoS is the one you survive.** Every metered option above bills egress
during an attack. Mitigation working perfectly still leaves a bill, and at $0.1093/GB a
sustained flood against an origin is a financial denial of service whatever the traffic
graph says afterwards. The only structures that cap it are a flat-rate CDN plan and Shield
Advanced's cost-protection clause. **CloudFront's flat plans state no overage even during
traffic spikes or attacks, and accommodate a first spike up to three times the monthly
allowance.** On a four-day event with an unknown concurrency ceiling, that clause is worth
more than the feature list above it.

### The request count, which nobody has costed yet

Delivery is **2-second segments**, so a viewer generates roughly 1,800 segment GETs plus
1,800 media-playlist reloads per hour: **3,600 requests per viewer-hour.** Across 48 live
hours at the plan's concurrency scenarios:

| Scenario | Avg concurrent | Viewer-hours | **Requests** | AWS WAF at $0.60/M | bunny Shield tier |
|---|---|---|---|---|---|
| 4,000 peak | 1,800 | 86,400 | **311M** | $187 | above Business, quote |
| 10,000 peak | 4,500 | 216,000 | **778M** | $467 | quote |
| 20,000 peak | 9,000 | 432,000 | **1.56B** | $933 | quote |
| 40,000 peak | 18,000 | 864,000 | **3.11B** | $1,866 | quote |

**This is a new number and it changes which plan tier applies on both candidates.** Every
published WAF tier on both bunny and CloudFront is sized in requests, and at 2-second
segments we exceed the top published tier of each in every scenario at or above 10,000
peak. Neither the plan nor the POC document counts requests at all. Two consequences:
get the request allowance quoted alongside the bandwidth, and **note that lengthening the
segment is a security-cost lever as well as a latency one** — 4-second segments halve
this table.

### Where each option lands

**Delivery is where the DDoS posture lives, not the origin.** A CDN in front of a small
origin absorbs volumetric attack at the edge and never lets it reach us, which is the same
conclusion the plan reached in section 13.6 and it survives adding AWS to the comparison.
The origin's own protection matters much less once that is true.

- **bunny**: strong and included, L3 through L7, but the WAF request allowance needs a quote.
- **CloudFront**: equally strong, and the flat plan caps the bill during an attack, which
  is the one property the others do not offer.
- **Vultr alone, no CDN**: not adequate. L3/L4, per instance, blind to application-layer
  attack, and unavailable on part of the fleet.
- **Azure alone, no CDN**: adequate but priced for enterprises with few public IPs, which
  is the opposite of this fleet's shape.

---

## 3. Criterion 2: price

### The machines

Like-for-like, the five-machine POC fleet from [poc-deployment.md](poc-deployment.md)
section 4, priced in Mumbai on all three. AWS and Azure figures include block storage and
the public IPv4 charge both now levy; Vultr bundles both.

| Role | Qty | Vultr | AWS `ap-south-1` | Azure Central India |
|---|---|---|---|---|
| Transcode, 8 vCPU / 16 GB dedicated | 1 | **$160** | $276 `c7i.2xlarge` | $273 `F8s v2` |
| Bee publishers, 4 vCPU / 8 GB | 2 | **$80** | $294 `c7i.xlarge` | $298 `F4s v2` |
| Bee prefetch level 0, 8 vCPU / 32 GB | 1 | **$160** | $365 `m7i.2xlarge` | $383 `D8s v5` |
| Control plane, 2 vCPU / 4 GB | 1 | **$20** | $43 `t3.medium` | $76 `F2s v2` |
| | **5** | **$420** | **$977** | **$1,030** |

**AWS is 2.3x and Azure 2.5x on compute alone**, before a byte moves. Two details behind
the numbers: Azure managed disks are sold in fixed tiers, so a 640 GB requirement buys a
1 TB E30 disk, and both hyperscalers charge $3.65/month per public IPv4, which is small
here and is $290/month across the eighty machines the full design needs.

### The delivery bill

Viewer egress only, at the plan's four concurrency scenarios. CloudFront and Front Door
are priced on their India tiers; the last three columns are serving straight off VMs with
no CDN, for reference.

| Scenario | TB | **bunny Volume** | bunny Std Asia | CloudFront PAYG + WAF | Front Door Premium | Vultr VMs | Azure VMs | AWS VMs |
|---|---|---|---|---|---|---|---|---|
| 4,000 peak | 85.5 | **$428** | $2,565 | $6,807 | $7,731 | $615 | $7,503 | $7,396 |
| 10,000 peak | 213.8 | **$1,069** | $6,414 | $13,509 | $14,845 | $1,898 | $17,896 | $17,789 |
| 20,000 peak | 427.7 | **$2,138** | $12,831 | $22,531 | $20,962 | $4,037 | $35,008 | $34,901 |
| 40,000 peak | 855.4 | **$4,277** | $25,662 | $37,018 | $26,620 | $8,314 | $69,224 | $69,117 |

**bunny.net Volume is still the cheapest delivery by a factor of five to nine**, and
nothing about adding AWS to the comparison changes that. It has no per-request fee, which
given the table in section 2 is worth as much as the per-GB rate.

**Two corrections to the existing plan fall out of this.**

**Azure Front Door is no longer priced the way section 13.7 says it is.** The plan states
that Front Door's published tiers stop at 150 TB and that above 4,000 peak it is a sales
conversation. The retail pricing API now publishes India tiers all the way to 5 PB, and
they fall steeply: $0.109/GB to 10 TB, $0.085 to 50 TB, $0.082 to 150 TB, then **$0.0286
to 500 TB and $0.0101 to 1 PB.** The claim that Front Door saves nothing over raw Azure
egress is true only below about 100 TB. It saves 40% at 20,000 peak and **62% at the
40,000 ceiling.** Front Door is still four to six times bunny Volume, so the recommendation
does not change, but the reason has changed and the plan's wording is now wrong.

**CloudFront's flat-rate plans are the genuinely new option** and pay-as-you-go is the
wrong way to price it. Premium is $1,000/month for 50 TB and 500M requests, self-service
configurable to 600 TB and 6B requests at $10,000/month, with WAF, DDoS, DNS, logging and
edge compute inside the price and no overage. Our 4,000-peak scenario is 85.5 TB and 311M
requests, which sits near the bottom of that range; the 40,000 ceiling at 855 TB is above
the top of it and would be a Custom plan. **The intermediate levels are only visible in
the console, so this is a quote to fetch rather than a number to model.** If a configured
Premium plan covering the 10,000-peak scenario lands anywhere under about $2,500/month, it
is competitive with bunny once the bundled WAF, the capped bill and the Terraform story
below are counted.

### What is not in these numbers

Postage stamps and chequebooks, which are denominated in BZZ and xDAI and sit outside
every column. Engineering time. And the venue hop, which does not exist yet.

---

## 4. Criterion 3: what Terraform can actually hold

| Provider | Registry tier | Latest | Resources | What it means for us |
|---|---|---|---|---|
| **AWS** | **official** | 6.58.0, 2026-08-05 | ~1,500 | Everything, including CloudFront, WAF, Shield and Route 53. The best-supported provider in the ecosystem. |
| **Azure** | **official** | 5.0.1, 2026-07-30 | ~1,100 | Everything, including Front Door and DDoS plans. A major version landed a week ago, so pin it. |
| **Vultr** | **partner** | 2.32.0, 2026-07-14 | 51 resources, 42 data sources | Covers what this fleet needs: instances, block storage, VPCs, firewall groups, reserved IPs, startup scripts, DNS, load balancers. DDoS protection is a boolean on the instance. Small surface, but the surface we use. |
| **bunny.net** | **community**, `BunnyWay/bunnynet` | **0.17.0**, 2026-08-04 | 24 resources | Pull zones, edge rules, hostnames, shield, WAF rules, rate limits, storage zones. Actively developed. **Pre-1.0, so no compatibility promise, and community tier means no vendor support commitment.** |

**The effort is driven by the number of providers, not by which ones.** Two providers means
two credential paths, two state considerations and two sets of module conventions; three
means the coordination problem the plan already rejected as Variant C. **Keep it at two.**

**The awkward finding is that the CDN, the component we most want held in code, has the
weakest provider on either candidate path.** bunny's provider is community-maintained and
pre-1.0. CloudFront's is inside the official AWS provider and is as solid as Terraform
gets. If delivery goes to CloudFront and ingest and control follow it to AWS, **the entire
non-Swarm half of the system is one official provider** and the Terraform criterion is
answered outright. That is the strongest argument AWS has in this evaluation, and it is
worth weighing honestly against bunny's price advantage rather than dismissing.

Vultr's provider is adequate and partner-tier, which is the middle rung: maintained with
vendor involvement, no support SLA. Nothing in the fleet needs a resource it lacks.

---

## 5. Scored

Weighted the way the brief asks: security first, then price, then manageability.

| | Security / DDoS | Price | Terraform | Verdict |
|---|---|---|---|---|
| **All AWS** | **best free baseline**, bundled WAF and DDoS on CloudFront plans | **fails** — Bee fleet egress is unaffordable at any credible rate | **best** | No. One workload rules it out. |
| **All Azure** | adequate, priced per IP, wrong shape for this fleet | fails, same reason, and 2.5x on compute | good | No. |
| **All Vultr** | **inadequate** — L3/L4 only, and not on every plan family | best | adequate | No. Not without a CDN in front. |
| **Vultr + bunny.net** | good, L3 to L7 at the edge, WAF allowance unquoted | **best** | weakest link is a pre-1.0 community provider | **Strong. The incumbent.** |
| **Vultr + AWS CloudFront** | **best** — bundled, and the bill is capped during an attack | good if the Premium quote is reasonable | **best** | **Strong. The new contender.** |
| Three providers | no better than two | marginally cheaper | worst | No, for the reasons section 13.4 already gives. |

---

## 6. Recommendation

1. **The Swarm fleet runs on Vultr Mumbai.** Forced by peer-to-peer egress, and the margin
   is wide enough that no plausible correction reverses it. This part is settled.
2. **Viewer delivery runs on a CDN, and the CDN is either bunny.net Volume or a configured
   CloudFront Premium plan.** Get both quoted before choosing. bunny wins on price by
   roughly 4x at list; CloudFront wins on bundled security, on a bill that cannot run away
   during an attack, and on Terraform. **If the CloudFront quote for the 10,000-peak
   scenario comes in under about $2,500/month, take CloudFront.** Above that, take bunny.
3. **Ingest, transcode and control plane follow the CDN choice.** If CloudFront, put them
   on AWS and hold the whole non-Swarm side in one official provider. If bunny, leave them
   on Vultr and keep the machine count on one bill. Either way the money involved is small
   and the deciding factor is provider count, not price.
4. **Do not put Azure in the build.** It is the most expensive on compute, its DDoS product
   is priced for a shape this fleet does not have, and nothing it does uniquely well is
   needed here. Front Door is cheaper at volume than the plan claims, but still four to six
   times bunny and no better than CloudFront.
5. **Decide the transcode host's DDoS story explicitly**, given the Optimized Cloud Compute
   gap in section 2. Moving it to a `vhf` plan is the cheap answer.

### The one question that inverts all of this

**Do we have AWS or Azure credits, or an EF cloud sponsorship?** This is open question 1 in
section 13.8 of the plan and it has never been answered. Credits normally cover egress,
which is the entire basis of the recommendation above. **Ask before building anything.**

---

## 7. What to verify, in order

1. **Measure Bee peer-to-peer egress on two nodes for a week.** Everything in section 1
   rests on a figure that spans 1.0 to 10 Mbps depending on whose estimate you use, a 7x
   range. It is cheap to measure and it moves the twenty-stage bill more than any other
   number in this document. Already flagged as risk 2 in
   [poc-deployment.md](poc-deployment.md).
2. **Get a configured CloudFront Premium quote** for 85.5 TB / 311M requests and for
   213.8 TB / 778M requests. The intermediate levels are console-only.
3. **Get a bunny Shield quote** at 311M and 778M requests. Every published tier tops out
   below our volume.
4. **Confirm the bunny Volume network's India reach.** It is 10 PoPs globally and **Mumbai
   is not one of them** — the nearest are Singapore and Hong Kong. Mumbai is a Standard
   network PoP at $0.03/GB, six times the Volume rate. The plan's assumption that a CDN
   gives the best India latency of any option holds for Standard and needs measuring for
   Volume.
5. **Ask both candidate hosts the workload question in writing** before building: sustained
   outbound video alongside long-lived peer-to-peer connections, storage-incentive rewards,
   not mining. An abuse review mid-event is unrecoverable.
6. **Answer the credits question** from section 6.

---

## Sources

Checked 2026-08-07.

- Vultr plans and Mumbai (`bom`) availability, [public plans API](https://api.vultr.com/v2/plans).
- [Vultr DDoS Protection](https://docs.vultr.com/ddos-protection): 10 Gbps per instance, L3/L4,
  Cloud Compute and High Frequency plans, Vultr DNS resolver required.
  [Cost, $10/instance/month](https://docs.vultr.com/support/platform/billing/how-much-does-ddos-protection-cost).
- AWS EC2 `ap-south-1` on-demand Linux prices, AWS metered unit map. Data transfer out
  $0.1093/GB to 10 TB, then $0.085.
- [AWS Shield pricing](https://aws.amazon.com/shield/pricing/): Standard free and automatic,
  Advanced $3,000/month on a one-year commitment.
- [AWS WAF pricing](https://aws.amazon.com/waf/pricing/): $5/web ACL, $1/rule, $0.60 per million requests.
- [CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/) and the
  [configurable Premium allowances announcement](https://aws.amazon.com/blogs/networking-and-content-delivery/cloudfront-premium-flat-rate-plan-supports-configurable-usage-allowances/):
  50 TB / 500M requests at $1,000/month to 600 TB / 6B requests at $10,000/month, no overage.
- Azure Central India VM, disk and Front Door prices from the
  [Azure retail prices API](https://prices.azure.com/api/retail/prices). Front Door Zone 5
  tiers: $0.109, $0.085, $0.082, $0.0286, $0.0101, $0.0091, $0.0080.
- [Azure DDoS Protection pricing](https://azure.microsoft.com/en-us/pricing/details/ddos-protection/):
  IP Protection $199/month per public IP; Network Protection $2,944/month to 100 resources.
- [bunny.net pricing](https://bunny.net/pricing/): Volume $0.005/GB, Standard Asia $0.03/GB,
  no per-request fee. [Volume network PoP list](https://bunny.net/network/): 10 PoPs, no India.
  [Bunny Shield](https://bunny.net/shield/): Basic free with 71 rules and 25M requests,
  Advanced $9.50, Business $99.
- Terraform provider tiers, versions and resource counts from the
  [Terraform Registry API](https://registry.terraform.io/): `hashicorp/aws` official,
  `hashicorp/azurerm` official, `vultr/vultr` partner, `BunnyWay/bunnynet` community.
