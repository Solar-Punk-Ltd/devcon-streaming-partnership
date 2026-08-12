# Measuring Bee peer-to-peer egress

**Why this exists.** The cost model carries **1.0 to 1.5 Mbps** of sustained peer-to-peer
egress per Bee node. Swarm's own guidance for a full node doing constant chunk syncing is
nearer **10 Mbps**. Across the 800-node fleet that single constant is the difference between
roughly **$21,000 and $205,000 a month** on metered egress, which is more than any other
number in [../../docs/gcp-alibaba-deployment.md](../../docs/gcp-alibaba-deployment.md) moves.
Two nodes and a week of patience settle it.

It is also the cheapest open item on the list, and it depends on nothing from the EF.

---

## Method, and why it is done this way

**Bee has no byte counters.** Its libp2p metrics are connection and stream counts, not
volume, so the figure cannot come from `/metrics`. It has to be measured at the network
layer.

**Port matching does not work either.** Bee listens on 1634 for plain p2p and 1635 for WSS,
but peers listen on arbitrary ports — the mainnet scan found nodes on 30442, 31638 and dozens
of others. Traffic on connections Bee *initiates* has an ephemeral source port and an
arbitrary destination port, so no fixed port filter can capture it.

**So each node runs in its own container**, and the counters are read from inside that
container's network namespace. Every byte on the container's `eth0` is Bee's, and nothing
else on the host is counted. That includes Bee's Gnosis RPC traffic, which is correct — it
is egress we would pay for.

`tx_bytes` is what a provider bills as egress. `rx_bytes` is reported too, because inbound is
free on every provider under consideration and the ratio is diagnostic.

---

## Running it

**1. Two hosts, not one.** Two nodes on the same host share an uplink and a NAT, and will
peer with each other, which biases the result. Use two separate VMs in different networks —
ideally one in Europe and one in India, since that is the split the fleet will have.

**2. Configure.** Create a `.env` beside `docker-compose.yml`:

```
BEE_PASSWORD=<a strong password>
RPC_ENDPOINT=<your Gnosis RPC endpoint>
```

The nodes need funding to reach full-node status and start serving chunks. An unfunded node
will not sync a reserve and will measure close to nothing, which is the main way this
measurement goes wrong.

**3. Start the nodes and wait.** Give them **at least 24 hours before you start sampling**.
A fresh node's reserve sync is a burst, not its steady state, and including it inflates the
answer.

```bash
docker compose up -d
docker compose logs -f          # wait for full-node status and a synced reserve
```

**4. Sample for a week.**

```bash
INTERVAL=300 OUT=week.csv nohup ./sample.sh > sample.log 2>&1 &
```

Five-minute samples over seven days is about 2,000 rows per node — plenty of resolution, and
small enough to commit alongside the result. Counters are cumulative and the report
differences them, so a container restart shows up as a skipped interval rather than a wrong
number.

**5. Report.**

```bash
python3 report.py week.csv --nodes 800 --json result.json
```

It prints mean, median, p95 and peak per node, then projects the fleet's monthly volume and
prices it against the same rate cards the deployment document uses, so the two cannot drift.

---

## Reading the answer

| Measured sustained egress | What it means |
|---|---|
| under 2 Mbps | costing assumption holds. Metered egress is still five figures a month, so a flat-rate host still wins, but the design is sound |
| 2 to 6 Mbps | re-cost the fleet before committing to any provider, and revisit whether four prefetch levels are affordable |
| above 6 Mbps | metered egress is unaffordable at this fleet size. The **placement design** needs to change, not just the provider |

Whatever it says, record it in `docs/measurements/` next to the WSS scan, with the CSV, and
update the fleet figures in the deployment document to match.

## Caveats

- **A week is the minimum useful window.** Swarm's traffic varies with network-wide activity
  and reserve churn; a day can be off by a large factor in either direction.
- **Two nodes is a small sample.** It bounds the number, it does not characterise the
  distribution. Neighborhood population affects how much a node serves, so a node mined into
  a busy neighborhood will differ from a quiet one.
- **A prefetch node under our own load will exceed this.** These nodes measure baseline
  network participation. During the event, prefetch nodes additionally serve our own
  segments, which is delivery traffic on top of what is measured here.
- **Erasure coding and postage affect volume.** These figures are for a node with default
  settings and no publishing load.
