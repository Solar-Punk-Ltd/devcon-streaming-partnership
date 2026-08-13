#!/usr/bin/env python3
"""What it costs to host 800 Bee nodes, priced across hosting shapes.

The fleet is 160 publisher + 640 prefetch nodes. Two numbers dominate the bill
and neither is measured yet:

  MBPS     sustained peer-to-peer egress per node. Costing carries 1.0-1.5,
           Swarm's own guidance is nearer 10.
  DENSITY  how many Bee nodes fit on one machine. The plan assumes 8 per
           16-core VM, which is a CPU-shaped guess for an I/O-shaped process.

So the interesting output is not a single figure. It is which hosting shape
stays affordable across the whole range of both, because that is the shape
that does not need the measurement to come back favourable.

Prices pulled from provider APIs on 2026-08-12:
  Vultr    api.vultr.com/v2/plans and /plans-metal, region bom (Mumbai)
  Oracle   apexapps.oracle.com/pls/apex/cetools/api/v1/products
  GCP      list price, see docs/gcp-alibaba-deployment.md
"""
from __future__ import annotations

NODES = 800
HOURS = 730  # a month

# Per-node resource envelope. Reserve at 2^22 chunks is ~17 GB before
# localstore overhead; 40 GB leaves room and assumes a shared remote RPC
# rather than a local chain copy on every node.
RAM_GB_PER_NODE = 3.0
DISK_GB_PER_NODE = 40.0
THREADS_PER_NODE = 0.5   # Bee is I/O bound, not CPU bound
OS_RAM_GB = 2.0


def density(ram_gb: float, disk_gb: float, threads: int) -> int:
    """Nodes per machine, bound by whichever resource runs out first."""
    by_ram = max(0, (ram_gb - OS_RAM_GB)) / RAM_GB_PER_NODE
    by_disk = disk_gb / DISK_GB_PER_NODE
    by_cpu = threads / THREADS_PER_NODE
    return max(1, int(min(by_ram, by_disk, by_cpu)))


def fleet_tb(mbps: float) -> float:
    """Fleet egress volume per month, TB."""
    return NODES * mbps * HOURS * 3600 / 8 / 1000 / 1000


def tiered(vol_gb: float, tiers) -> float:
    cost = prev = 0.0
    for upto, rate in tiers:
        if vol_gb <= prev:
            break
        cost += (min(vol_gb, upto) - prev) * rate
        prev = upto
    return cost


GCP_TIERS = [(931.32, 0.12), (9313.2, 0.11), (float("inf"), 0.085)]  # per GiB-ish, see doc


class Option:
    def __init__(self, name, note, machine_cost, nodes_per_machine,
                 included_tb_per_machine=0.0, account_free_tb=0.0,
                 overage_per_gb=None, tiers=None, free_gb=0.0, unmetered=False,
                 per_node_cost=None, india=True):
        self.name = name
        self.note = note
        self.machine_cost = machine_cost
        self.npm = nodes_per_machine
        self.included = included_tb_per_machine
        self.account_free = account_free_tb
        self.overage = overage_per_gb
        self.tiers = tiers
        self.free_gb = free_gb
        self.unmetered = unmetered
        self.per_node_cost = per_node_cost
        self.india = india

    def cost(self, mbps: float):
        vol_tb = fleet_tb(mbps)
        if self.per_node_cost is not None:
            machines = NODES
            compute = self.per_node_cost * NODES
        else:
            machines = -(-NODES // self.npm)  # ceil
            compute = machines * self.machine_cost

        if self.unmetered:
            egress = 0.0
        elif self.tiers:
            egress = tiered(max(0.0, vol_tb * 1000 - self.free_gb), self.tiers)
        else:
            pooled = machines * self.included + self.account_free
            over_tb = max(0.0, vol_tb - pooled)
            egress = over_tb * 1000 * (self.overage or 0.0)
        return machines, compute, egress, compute + egress


# ------------------------------------------------------------------- options
vbm_density = density(128, 1920, 16)
vhp_density = density(24, 500, 12)

OPTIONS = [
    Option(
        "GCP asia-south1, per-node VMs",
        "reference: the hyperscaler shape, metered egress, no included transfer",
        machine_cost=0, nodes_per_machine=1, per_node_cost=0.03 * 2 * HOURS,
        tiers=GCP_TIERS,
    ),
    Option(
        "OCI Mumbai, Ampere A2 per node",
        "cheapest hyperscaler compute; 10 TiB free egress then $0.025/GB (APAC)",
        machine_cost=0, nodes_per_machine=1,
        per_node_cost=(0.014 * 1 + 0.002 * RAM_GB_PER_NODE) * HOURS + DISK_GB_PER_NODE * 0.0255,
        tiers=[(float("inf"), 0.025)], free_gb=10240,
    ),
    Option(
        "Vultr Mumbai, vhp-12c-24gb",
        f"cloud instances, {vhp_density} nodes each, 12 TB included each, $0.01/GB over",
        machine_cost=144, nodes_per_machine=vhp_density,
        included_tb_per_machine=12, account_free_tb=2, overage_per_gb=0.01,
    ),
    Option(
        "Vultr Mumbai, vbm-8c-132gb metal",
        f"bare metal, {vbm_density} nodes each, 10 TB included each, $0.01/GB over",
        machine_cost=350, nodes_per_machine=vbm_density,
        included_tb_per_machine=10, account_free_tb=2, overage_per_gb=0.01,
    ),
    Option(
        "Mumbai metal, unmetered 1 Gbps",
        f"third-party bare metal, {vbm_density} nodes each, flat port. VERIFY the fair-use terms",
        machine_cost=300, nodes_per_machine=vbm_density, unmetered=True,
    ),
]

print("=" * 96)
print(f"COST TO HOST {NODES} BEE NODES PER MONTH")
print("=" * 96)
print(f"per-node envelope: {RAM_GB_PER_NODE} GB RAM, {DISK_GB_PER_NODE} GB disk, "
      f"{THREADS_PER_NODE} threads")
print(f"derived density:   vhp-12c-24gb -> {vhp_density} nodes    "
      f"vbm-8c-132gb metal -> {vbm_density} nodes")
print()

for mbps in (1.25, 10.0):
    vol = fleet_tb(mbps)
    print("-" * 96)
    print(f"AT {mbps} Mbps PER NODE  ->  fleet egress {vol:,.0f} TB/month")
    print("-" * 96)
    print(f"{'option':<38}{'machines':>9}{'compute':>12}{'egress':>13}{'TOTAL/mo':>13}")
    rows = []
    for o in OPTIONS:
        m, c, e, t = o.cost(mbps)
        rows.append((t, o, m, c, e))
        print(f"{o.name:<38}{m:>9}{c:>12,.0f}{e:>13,.0f}{t:>13,.0f}")
    best = min(rows)[0]
    print()
    for t, o, *_ in sorted(rows):
        print(f"    {o.name:<38} {t / best:>5.1f}x   {o.note}")
    print()

print("=" * 96)
print("SENSITIVITY — the two numbers nobody has measured")
print("=" * 96)
metal = OPTIONS[3]
print("Vultr metal, varying nodes per machine (egress at 1.25 Mbps):")
for d in (8, 16, 24, 32, 40):
    machines = -(-NODES // d)
    compute = machines * 350
    pooled = machines * 10 + 2
    egress = max(0.0, fleet_tb(1.25) - pooled) * 1000 * 0.01
    print(f"  {d:>3} nodes/machine -> {machines:>3} machines  "
          f"compute ${compute:>7,.0f}  egress ${egress:>7,.0f}  total ${compute + egress:>7,.0f}")
print()
print("Same fleet, unmetered port, varying nodes per machine:")
for d in (8, 16, 24, 32, 40):
    machines = -(-NODES // d)
    print(f"  {d:>3} nodes/machine -> {machines:>3} machines  total ${machines * 300:>7,.0f}"
          f"   (identical at 1.25 and at 10 Mbps)")
