# WSS-reachable nodes on Swarm mainnet

First measurement: **2026-08-12**. Re-run weekly with
[`tools/wss-scan.py`](../../tools/wss-scan.py).

[architecture-plan.md](../architecture-plan.md) §7.4 asks for this number and calls it "the
real ceiling on the direct tier", on the grounds that it bounds the in-browser tier more
tightly than any bandwidth figure. §8.3 lists it as one of three measurements that depend on
no answer from the EF. This is that number.

---

## The result

| | |
|---|---|
| Nodes visible to SwarmScan | 4,725 |
| Full nodes | 3,699 |
| Running bee ≥ 2.7.0, the AutoTLS releases | 3,701 (78.3%) |
| Advertising a websocket underlay | 2,070 |
| ...on a publicly routable address | 2,067 |
| **WSS-reachable, verified by completing a websocket upgrade** | **2,065 (43.7% of the network)** |

**Reachability is far better than the plan assumed.** §7.4 expected that opt-in AutoTLS would
leave "likely a small fraction" of nodes dialable. It is nearly half, and the failure rate
among publicly-advertised candidates was 2 nodes out of 2,067. AutoTLS adoption has been
effectively automatic: every node running 2.8.x advertises a working
`…libp2p.direct/ws` endpoint with a valid certificate.

**Two findings qualify that heavily**, and both matter more than the headline.

### Nothing is reachable from India, or anywhere in Asia

| Country | WSS-reachable |
|---|---|
| Germany | 1,201 |
| unknown (no geolocation) | 843 |
| France | 18 |
| Brazil, Canada, United States | 1 each |
| **India** | **0** |

A browser node in Mumbai has **nothing local to dial**. It opens its connection pool to
Europe, at roughly 120 to 150 ms, while retrieving 2-second segments. This makes the
India-local WSS entry role entirely ours to fill, and it has to be in India — which is why it
became decisive in the [provider plan](../feasibility/gcp-alibaba-deployment.md).

### The reachable set is one hosting network

Grouping the reachable nodes by IP prefix, checked against RDAP:

| Prefix | Nodes | Registered to |
|---|---|---|
| `116.202.0.0/16` | 1,921 | Hetzner Online GmbH (Falkenstein) |
| `168.119.0.0/16` | 123 | Hetzner Online GmbH |
| `109.205.0.0/16` | 18 | Eurofiber France |
| `5.78.0.0/16` | 1 | Hetzner Online GmbH |
| `216.238.0.0/16`, `172.105.0.0/16` | 1 each | other |

**2,045 of 2,065 — 99.0% — sit in one company's address space.** The browser-dialable Swarm
network is, today, one autonomous system in one country. That is a concentration risk for the
direct tier that no amount of node-count growth fixes on its own, and it is not ours to fix.
It is a further argument for running our own WSS entry layer rather than treating public
reachability as infrastructure we can lean on.

---

## Method

Three stages, because each removes a different false positive. Counting advertised addresses
alone overstates the answer; the tool exists so the number is reproducible rather than
asserted.

**1. Enumerate.** Page the SwarmScan node API to exhaustion, deduplicating on overlay
address.

**2. Filter to publicly routable.** Bee's AutoTLS encodes the node's own IP into its SNI
name, so a node behind Kubernetes advertises something like
`10-233-74-58.<peerid>.libp2p.direct`, which resolves into RFC1918 space and is undialable
from outside its own cluster. Only 3 nodes advertise private space exclusively, but the check
has to happen before the count can be trusted — most nodes advertise a private *and* a public
address, and taking the first one would have thrown away 2,000 reachable nodes.

**3. Dial.** Complete a real TCP connect, a TLS handshake with hostname verification against
the default trust store, and an HTTP `Upgrade: websocket`, accepting only
`HTTP/1.1 101 Switching Protocols`. Advertising an address is not the same as answering
on it.

```bash
python3 tools/wss-scan.py --json scan-$(date +%Y-%m-%d).json
```

### Caveats

- **SwarmScan's view is a sample, not a census.** It reports what it can reach and handshake;
  4,725 is a floor on network size, and the 843 nodes with no geolocation are a gap in the
  data rather than nodes in an unknown country.
- **The dial ran from a single vantage point.** A node reachable from here may be firewalled
  from elsewhere. The prefix concentration means this matters less than it would for a
  well-distributed set.
- **TLS verification is browser-equivalent, the rest is not.** The probe verifies
  certificates exactly as a browser would, and these are `wss://` so mixed-content rules are
  satisfied. It does not model per-origin connection limits, Brave Shield's 30-connection
  cap, or what happens when 200 pools open at once — those are the remaining two measurements
  in §8.3.
- **Node totals drift a few tens between runs.** Two scans 20 minutes apart saw 4,706 and
  4,725. Treat week-on-week movement under ~1% as noise.

---

## What it changes

- **The direct tier is not connection-starved for lack of reachable nodes.** 2,065 is a
  workable pool, and this removes one of the two doubts in §8.3. Whether weeb-3 performs
  against a *live, cold-cache* feed, and what Brave Shield's 30-connection cap does to it,
  are both still unmeasured and both still gate the tier.
- **India-local WSS entry moves from "nice to have" to load-bearing.** Zero local
  reachability means the prefetch fleet's WSS role cannot be deferred, and it constrains
  provider choice to those with an India region.
- **Weekly tracking is worth keeping up.** §7.6 lists a falling WSS count as a trigger to add
  nodes to the warm fleet. The tool writes JSON for exactly that; keep the files so the trend
  is visible.
