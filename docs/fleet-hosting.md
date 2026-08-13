# Hosting the Swarm fleet without the egress bill

The 800-node fleet is the one workload no hyperscaler can carry, and
[gcp-alibaba-deployment.md](gcp-alibaba-deployment.md) left it as an open procurement item.
This is the answer to that item. Written 2026-08-12.

Prices pulled live on 2026-08-12 from Vultr's public plans API (`bom`, Mumbai) and Oracle's
public price list API. Model and workings in [../tools/fleet-cost/model.py](../tools/fleet-cost/model.py).

---

## The short version

**Vultr was cost-effective, and it still is — it remains the best metered option by a wide
margin.** But there is a better shape, and the reason is not price: it is that the best option
is the only one whose bill does not depend on a number nobody has measured.

| Option | at 1.25 Mbps/node | at 10 Mbps/node | swing |
|---|---|---|---|
| **Mumbai metal, unmetered port** | **$7,500** | **$7,500** | **none** |
| Vultr Mumbai, bare metal | $9,515 | $32,510 | 3.4x |
| Vultr Mumbai, cloud instances | $16,560 | $29,020 | 1.8x |
| OCI Mumbai, Ampere per node | $20,452 | $77,940 | 3.8x |
| GCP `asia-south1`, per node | $63,205 | $258,662 | 4.1x |

Every metered option swings by 2x to 4x on the unmeasured per-node throughput constant. **An
unmetered port costs the same either way.** Given that the measurement has not been taken and
the event is in November, buying certainty for $7,500 a month is worth more than buying the
theoretical minimum.

**Recommended: a split, matching the logic the plan already uses in §13.5.**

- **Bulk coverage fleet, ~600 nodes** on unmetered bare metal. Geography matters least here,
  and this is where the egress risk concentrates.
- **India-local WSS entry and publisher nodes, ~200 nodes** on **Vultr Mumbai**. A tier-1
  provider with three Indian regions, a real API, mature Terraform support and $0.01/GB if we
  overrun. This is the latency-critical tier and the one that must not wobble.

---

## Was Vultr cost-effective? Yes, and here is the arithmetic

At the costing's own 1.25 Mbps assumption, hosting the fleet on Vultr bare metal in Mumbai is
**$9,515 a month against $63,205 on GCP** — 6.6x cheaper. Two features do the work, and both
survive scrutiny:

- **$0.01/GB overage**, a single worldwide rate, against GCP's $0.085 to $0.12 and OCI's
  $0.025 in APAC.
- **Included transfer pools across the whole account.** Every instance contributes its
  allowance to one bucket, plus 2 TB free per account. Twenty-five metal boxes at 10 TB each
  is 252 TB of headroom before a cent of overage.

So the earlier decision was sound on price. It lapsed for want of a quote, not because the
arithmetic was wrong.

### A counterintuitive result worth knowing

**At 10 Mbps, Vultr cloud instances beat Vultr bare metal** — $29,020 against $32,510 — even
though metal is far cheaper per node on compute. The reason is the pooled allowance: 115 cloud
instances contribute 12 TB each, so 1,380 TB of included transfer, where 25 metal boxes
contribute only 252 TB.

**On a pooled-allowance provider, packing density trades against included bandwidth.** Denser
packing is cheaper on compute and more expensive on egress, and which wins depends entirely on
the throughput number. That is another way of saying the same thing: while the constant is
unmeasured, every Vultr sizing is a bet.

---

## The lever nobody has pulled: packing density

The plan assumes **8 Bee nodes per 16-core VM** (§7.5). That is a CPU-shaped guess for a
process that is bound by disk and network, and it is the most expensive assumption in the
model.

Vultr metal in Mumbai, egress at 1.25 Mbps:

| Nodes per machine | Machines | Compute | Egress | Total |
|---|---|---|---|---|
| 8, the plan's assumption | 100 | $35,000 | $0 | **$35,000** |
| 16 | 50 | $17,500 | $0 | $17,500 |
| 24 | 34 | $11,900 | $0 | $11,900 |
| 32 | 25 | $8,750 | $765 | **$9,515** |
| 40 | 20 | $7,000 | $1,265 | $8,265 |

**Going from 8 nodes per machine to 32 saves more than changing provider does.** A
`vbm-8c-132gb` in Mumbai is 8 cores / 16 threads, 128 GB RAM, 1.9 TB NVMe for $350, and at a
3 GB / 40 GB / half-a-thread envelope per node that is 32 nodes with headroom. Disk is the
binding constraint, not CPU.

This wants validating on one box before anything is ordered at scale, and it is a day's work:
run 32 nodes on a single machine, watch reserve sync complete, and confirm they stay healthy
under retrieval load. **That test and the week-long egress measurement together settle the
entire fleet cost question.**

---

## The options, in full

### Unmetered bare metal in Mumbai — recommended for the bulk fleet

Several providers sell dedicated servers in Mumbai, Delhi and Bangalore with unmetered 1 Gbps
or 10 Gbps ports, from roughly $130 to $300 a month. Twenty-five boxes at 32 nodes each covers
the fleet for about **$7,500 a month at any throughput the nodes can produce** — 800 nodes at
10 Mbps is 8 Gbps aggregate, or 320 Mbps per box, comfortably inside a 1 Gbps port.

**The catch is real and must be closed before ordering.** "Unmetered" frequently carries a
fair-use policy with no published number, which is precisely the clause that bites a sustained
multi-gigabit workload. So:

1. **Get the sustained profile accepted in writing** — 320 Mbps per box, continuous, plus
   hundreds of long-lived peer-to-peer connections. This is the same written-confirmation step
   the plan already requires of any host.
2. **Ask for the fair-use number explicitly.** If they will not put a figure in writing,
   treat the port as metered and price it accordingly.
3. **Take one box for a month first.** The egress measurement needs a host anyway; run it
   there and test the provider at the same time.

These are smaller companies than Vultr, and that is the trade: no mature API, thinner
Terraform support, less predictable support response. Acceptable for coverage nodes whose
failure mode is a slightly colder cache. Not acceptable for the WSS entry tier.

### Vultr Mumbai — recommended for the India-local tier

Best metered option, and the right home for the nodes that must not wobble. Three Indian
regions (`bom`, `blr`, `del`), a clean API that this model reads directly, and pooled
transfer. Keep the WSS entry nodes and the 160 publishers here.

### Oracle Cloud Mumbai — the surprise that did not survive checking

Worth recording because the headline looks compelling and is wrong for us.

OCI's Ampere A2 is genuinely the cheapest hyperscaler compute in this comparison —
$0.014/OCPU-hour and $0.002/GB-hour of memory, about $15.60 per node per month all in, and Bee
runs on ARM. There are Mumbai and Hyderabad regions.

**But the egress rate is the problem, and reporting on it is misleading.** Secondary sources
state that Oracle eliminated outbound transfer charges globally in February 2026. Oracle's own
published price list, last updated 2026-08-06, still lists **10 TiB free per month and then a
per-GB rate that varies by origin**: $0.0085 in North America, Europe and the UK, **$0.025 in
APAC**, and $0.05 in the Middle East and Africa. India is APAC. That puts the fleet at
$20,452 a month at 1.25 Mbps and $77,940 at 10 — better than GCP, 2.7x worse than Vultr.

If Oracle does extend free egress to APAC, this becomes the strongest option available and is
worth re-checking before signing anything. Verify it against the price list API rather than a
news article.

### GCP and Alibaba — for the record

$63,205 and upward, rising to $258,662 at 10 Mbps. Confirms the conclusion of
[gcp-alibaba-deployment.md](gcp-alibaba-deployment.md): they are the right home for ingest,
transcode, delivery and control plane, and the wrong home for a single Bee node.

### Not in the comparison: European bulk hosting

Cheap European bandwidth is genuinely the lowest per-GB rate available, and the plan's §13.3
table still shows it that way. Two findings rule it out for this fleet regardless of price.

**It has no India region**, so it cannot host the WSS entry tier, which
[measurements/wss-reachability.md](measurements/wss-reachability.md) shows is the tier that
actually needs to exist.

**And it would concentrate the risk rather than spread it.** 2,045 of the 2,065 WSS-reachable
nodes on mainnet already sit in one European hosting network. Putting our own entry layer
in the same autonomous system would mean the entire browser-dialable Swarm surface, ours
included, shares one operator and one jurisdiction. The point of running our own WSS nodes is
to add independence. Buying it in the same place buys none.

---

## What to do next, in order

1. **Density test, one box, one day.** 32 Bee nodes on a single machine through a full reserve
   sync. Settles a 4x cost range, and it is the cheapest test on this list.
2. **Egress measurement, two nodes, one week**, with
   [../tools/bee-egress/](../tools/bee-egress/). Settles a 3.4x cost range. Run it on a
   candidate unmetered box so it doubles as a provider trial.
3. **Get the fair-use number in writing** from two or three Mumbai metal providers, then take
   one box for a month.
4. **Quote Vultr for the India tier**, roughly 200 nodes across `bom`, `blr` and `del`.
5. **Re-check OCI's APAC egress rate** against the price list API before any contract, in case
   the free-egress change is real and merely not yet published.

Until items 1 and 2 land, treat every figure here as a range and not a number. The
recommendation is deliberately the shape that survives both ranges rather than the one that
wins the optimistic case.
