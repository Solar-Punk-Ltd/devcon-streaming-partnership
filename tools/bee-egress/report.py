#!/usr/bin/env python3
"""Turn sample.sh's CSV into a sustained-throughput figure and a fleet bill.

This closes the single largest open number in the cost model. The costing in
docs/gcp-alibaba-deployment.md carries 1.0 to 1.5 Mbps of sustained
peer-to-peer egress per Bee node; Swarm's own guidance for a full node doing
constant chunk syncing is nearer 10 Mbps. On a 800-node fleet that is the
difference between roughly $21,000 and $205,000 a month, so it is worth
measuring rather than assuming.

Usage:
    python3 report.py egress-samples.csv
    python3 report.py egress-samples.csv --nodes 800 --json result.json
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import statistics
from collections import defaultdict

# Rate cards, kept identical to docs/gcp-alibaba-deployment.md so the two
# documents cannot drift. All per-GB / per-GiB, list price, egress only.
GiB_PER_TB = 1000 / 1.073741824
GCP_VM_PREMIUM = [(1, 0.12), (10, 0.11), (float("inf"), 0.085)]  # $/GiB, upto TiB
ALIBABA_SG_FLAT = 0.081       # $/GB, Singapore, pay-by-data-transfer
ALIBABA_BUNDLE = 0.25         # top prepaid bundle discount
FLAT_RATE_REFERENCE = 0.01    # $/GB, for comparison with metered pricing


def tiered_gib(volume_tb: float, tiers) -> float:
    vol = volume_tb * GiB_PER_TB
    cost = prev = 0.0
    for upto, rate in tiers:
        bound = upto * 1024 if upto != float("inf") else upto
        if vol <= prev:
            break
        cost += (min(vol, bound) - prev) * rate
        prev = bound
    return cost


def load(path: str):
    """container -> list of (datetime, rx, tx), gaps dropped."""
    rows = defaultdict(list)
    with open(path, newline="") as fh:
        for r in csv.DictReader(fh):
            if not r.get("tx_bytes"):
                continue  # recorded gap
            try:
                ts = dt.datetime.strptime(r["timestamp_utc"], "%Y-%m-%dT%H:%M:%SZ")
                rows[r["container"]].append((ts, int(r["rx_bytes"]), int(r["tx_bytes"])))
            except (ValueError, KeyError):
                continue
    for c in rows:
        rows[c].sort(key=lambda t: t[0])
    return rows


def deltas(samples):
    """Per-interval (seconds, rx_bytes, tx_bytes), skipping counter resets."""
    out = []
    resets = 0
    for (t0, rx0, tx0), (t1, rx1, tx1) in zip(samples, samples[1:]):
        secs = (t1 - t0).total_seconds()
        if secs <= 0:
            continue
        if tx1 < tx0 or rx1 < rx0:
            resets += 1  # container restarted; counters went backwards
            continue
        out.append((secs, rx1 - rx0, tx1 - tx0))
    return out, resets


def mbps(byte_delta: float, secs: float) -> float:
    return (byte_delta * 8) / secs / 1_000_000


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("csv", help="output from sample.sh")
    ap.add_argument("--nodes", type=int, default=800,
                    help="fleet size to project (default 800: 160 publisher + 640 prefetch)")
    ap.add_argument("--json", metavar="PATH", help="also write machine-readable results")
    args = ap.parse_args()

    per_container = load(args.csv)
    if not per_container:
        print(f"no usable samples in {args.csv}")
        return 1

    print("=" * 74)
    print("BEE PEER-TO-PEER EGRESS — measured")
    print("=" * 74)

    all_tx_mbps: list[float] = []
    total_tx_bytes = 0.0
    total_secs = 0.0
    summary = {}

    for container, samples in sorted(per_container.items()):
        d, resets = deltas(samples)
        if not d:
            print(f"\n{container}: no usable intervals")
            continue
        tx_series = [mbps(tx, s) for s, _rx, tx in d]
        rx_series = [mbps(rx, s) for s, rx, _tx in d]
        span = (samples[-1][0] - samples[0][0]).total_seconds()
        tx_bytes = sum(tx for _s, _rx, tx in d)
        all_tx_mbps += tx_series
        total_tx_bytes += tx_bytes
        total_secs += sum(s for s, _r, _t in d)

        srt = sorted(tx_series)
        p50 = statistics.median(srt)
        p95 = srt[min(len(srt) - 1, int(0.95 * len(srt)))]
        mean_tx = statistics.fmean(tx_series)

        print(f"\n{container}")
        print(f"  window          {span / 3600:>8.1f} h   ({len(d)} intervals"
              + (f", {resets} counter resets skipped" if resets else "") + ")")
        print(f"  egress total    {tx_bytes / 1e9:>8.1f} GB")
        print(f"  egress  mean    {mean_tx:>8.2f} Mbps")
        print(f"          median  {p50:>8.2f} Mbps")
        print(f"          p95     {p95:>8.2f} Mbps")
        print(f"          peak    {max(tx_series):>8.2f} Mbps")
        print(f"  ingress mean    {statistics.fmean(rx_series):>8.2f} Mbps")
        summary[container] = {
            "window_hours": round(span / 3600, 2),
            "egress_gb": round(tx_bytes / 1e9, 2),
            "egress_mean_mbps": round(mean_tx, 3),
            "egress_median_mbps": round(p50, 3),
            "egress_p95_mbps": round(p95, 3),
            "egress_peak_mbps": round(max(tx_series), 3),
            "ingress_mean_mbps": round(statistics.fmean(rx_series), 3),
            "counter_resets": resets,
        }

    if not all_tx_mbps or total_secs <= 0:
        return 1

    # Byte-weighted mean is the right basis for a bill; the per-interval mean
    # over-weights short intervals. total_secs already aggregates node-seconds
    # across every container, so this is per-node without dividing again.
    fleet_mbps = (total_tx_bytes * 8) / total_secs / 1_000_000
    gb_per_node_month = fleet_mbps * 2_592_000 / 8 / 1000
    fleet_tb_month = args.nodes * gb_per_node_month / 1000

    print()
    print("=" * 74)
    print(f"PROJECTION — {args.nodes} nodes, full month")
    print("=" * 74)
    print(f"measured sustained egress per node   {fleet_mbps:>10.2f} Mbps")
    print(f"per node, per month                  {gb_per_node_month:>10,.0f} GB")
    print(f"fleet, per month                     {fleet_tb_month:>10,.0f} TB")
    print()
    gcp = tiered_gib(fleet_tb_month, GCP_VM_PREMIUM)
    ali = fleet_tb_month * 1000 * ALIBABA_SG_FLAT
    print(f"  GCP VM egress, Premium Tier        ${gcp:>10,.0f} / month")
    print(f"  Alibaba Singapore                  ${ali:>10,.0f} / month")
    print(f"  Alibaba, 25% prepaid bundle        ${ali * (1 - ALIBABA_BUNDLE):>10,.0f} / month")
    print(f"  a flat ${FLAT_RATE_REFERENCE:.2f}/GB host, for scale     "
          f"${fleet_tb_month * 1000 * FLAT_RATE_REFERENCE:>10,.0f} / month")
    print()
    if fleet_mbps < 2.0:
        print("  Within the 1.0-1.5 Mbps costing assumption. The metered-pricing")
        print("  bill is still five figures a month; a flat-rate host still wins.")
    elif fleet_mbps < 6.0:
        print("  ABOVE the 1.0-1.5 Mbps costing assumption. Re-cost the fleet before")
        print("  committing to any provider, and revisit the four-level placement.")
    else:
        print("  At or near Swarm's 10 Mbps guidance. Metered egress is unaffordable")
        print("  at this fleet size; the placement design needs to change, not just")
        print("  the provider.")

    if args.json:
        with open(args.json, "w") as fh:
            json.dump(
                {
                    "per_container": summary,
                    "sustained_mbps_per_node": round(fleet_mbps, 3),
                    "gb_per_node_month": round(gb_per_node_month, 1),
                    "fleet_nodes": args.nodes,
                    "fleet_tb_month": round(fleet_tb_month, 1),
                    "monthly_cost_usd": {
                        "gcp_vm_premium": round(gcp),
                        "alibaba_singapore": round(ali),
                        "alibaba_bundle_25pct": round(ali * (1 - ALIBABA_BUNDLE)),
                        "flat_rate_0_01_per_gb": round(fleet_tb_month * 1000 * FLAT_RATE_REFERENCE),
                    },
                },
                fh,
                indent=2,
            )
        print(f"\nwrote {args.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
