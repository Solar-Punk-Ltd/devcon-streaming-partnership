#!/usr/bin/env python3
"""Count the WSS-reachable nodes on Swarm mainnet.

Browsers can only dial Bee nodes that speak wss://, so this number — not the
size of the network — is the ceiling on the direct in-browser tier. See
docs/architecture-plan.md §7.4 and docs/measurements/wss-reachability.md.

Three stages, because each one removes a different kind of false positive:

  1. enumerate   every node SwarmScan can see, paging the cursor to the end
  2. filter      to nodes advertising a websocket underlay on a *publicly
                 routable* address. Bee's AutoTLS encodes the node's own IP
                 into the SNI name, so a node behind Kubernetes advertises
                 10-233-x-y.<peerid>.libp2p.direct, which resolves into
                 RFC1918 space and is undialable from outside its cluster
  3. dial        actually complete a TLS handshake with hostname verification
                 and a websocket upgrade. Advertising an address is not the
                 same as answering on it

Usage:
    python3 tools/wss-scan.py                 # full scan, human-readable
    python3 tools/wss-scan.py --json out.json # also write machine-readable

No dependencies beyond the standard library.
"""
from __future__ import annotations

import argparse
import base64
import concurrent.futures as cf
import datetime as dt
import ipaddress
import json
import re
import socket
import ssl
import sys
import time
import urllib.request
from collections import Counter

API = "https://api.swarmscan.io/v1/network/nodes"
UA = "devcon8-wss-scan/1 (+https://github.com/Solar-Punk-Ltd/devcon-streaming-partnership)"
WS_TOKEN = re.compile(r"/wss?(/|$)")
VERSION = re.compile(r"bee/(\d+)\.(\d+)\.(\d+)")


# --------------------------------------------------------------- 1. enumerate
def fetch_all(page_cap: int = 400) -> list[dict]:
    nodes: list[dict] = []
    seen: set[str] = set()
    cursor: str | None = None
    page = 0

    while True:
        url = API if cursor is None else f"{API}?start={cursor}"
        data = _get(url)
        batch = data.get("nodes") or []
        fresh = 0
        for n in batch:
            overlay = n.get("overlay")
            if overlay and overlay not in seen:
                seen.add(overlay)
                nodes.append(n)
                fresh += 1
        page += 1
        cursor = data.get("next")
        print(f"  page {page:>3}  +{fresh:<4} total {len(nodes):>5}", file=sys.stderr)
        if not cursor or not batch or fresh == 0 or page >= page_cap:
            break
    return nodes


def _get(url: str, tries: int = 4) -> dict:
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.load(r)
        except Exception as exc:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            print(f"    retry {attempt + 1}: {exc}", file=sys.stderr)
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


# ------------------------------------------------------------------ 2. filter
def parse_multiaddr(addr: str) -> tuple[str | None, str | None, str | None]:
    """Pull (ip, tcp port, sni/dns name) out of a libp2p multiaddr."""
    parts = addr.strip("/").split("/")
    ip = port = name = None
    for i, tok in enumerate(parts):
        nxt = parts[i + 1] if i + 1 < len(parts) else None
        if tok in ("ip4", "ip6") and nxt:
            ip = nxt
        elif tok == "tcp" and nxt:
            port = nxt
        elif tok == "sni" and nxt:
            name = nxt
        elif tok in ("dns", "dns4", "dns6", "dnsaddr") and nxt and not name:
            name = nxt
    return ip, port, name


def is_routable(ip: str | None) -> bool:
    if not ip:
        return False
    try:
        return ipaddress.ip_address(ip).is_global
    except ValueError:
        return False


def candidates(nodes: list[dict]) -> tuple[dict, int, int]:
    """overlay -> (ip, port, sni, addr) for publicly routable ws underlays."""
    out: dict[str, tuple] = {}
    advertising = private_only = 0

    for n in nodes:
        addrs = {u.get("address", "") for u in (n.get("underlays") or [])}
        ws = [a for a in addrs if WS_TOKEN.search(a)]
        if not ws:
            continue
        advertising += 1
        best = None
        for a in ws:
            ip, port, name = parse_multiaddr(a)
            if not is_routable(ip):
                continue
            # prefer IPv4; most clients still lack working IPv6
            if best is None or (":" not in ip and ":" in best[0]):
                best = (ip, port, name, a)
        if best:
            out[n["overlay"]] = best
        else:
            private_only += 1
    return out, advertising, private_only


# -------------------------------------------------------------------- 3. dial
def dial(item: tuple[str, tuple]) -> tuple[str, str]:
    overlay, (ip, port, sni, _addr) = item
    try:
        port_i = int(port)
    except (TypeError, ValueError):
        return overlay, "bad_port"

    family = socket.AF_INET6 if ":" in ip else socket.AF_INET
    ctx = ssl.create_default_context()
    if not sni:
        # No name to verify against; test reachability only.
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    try:
        sock = socket.socket(family, socket.SOCK_STREAM)
        sock.settimeout(8)
        sock.connect((ip, port_i))
    except Exception as exc:  # noqa: BLE001
        return overlay, f"tcp_fail:{type(exc).__name__}"

    try:
        tls = ctx.wrap_socket(sock, server_hostname=sni) if sni else ctx.wrap_socket(sock)
    except ssl.SSLCertVerificationError:
        sock.close()
        return overlay, "tls_cert_fail"
    except Exception as exc:  # noqa: BLE001
        sock.close()
        return overlay, f"tls_fail:{type(exc).__name__}"

    try:
        key = base64.b64encode(b"0123456789abcdef").decode()
        host = sni or ip
        tls.sendall(
            f"GET / HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\n"
            f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\nOrigin: https://example.org\r\n\r\n"
            .encode()
        )
        head = tls.recv(128).decode("latin-1", "replace").split("\r\n")[0]
        return overlay, "ws_ok" if "101" in head else "tls_ok_no_ws"
    except Exception as exc:  # noqa: BLE001
        return overlay, f"ws_fail:{type(exc).__name__}"
    finally:
        try:
            tls.close()
        except Exception:  # noqa: BLE001
            pass


# ------------------------------------------------------------------- reporting
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", metavar="PATH", help="write machine-readable results here")
    ap.add_argument("--workers", type=int, default=60, help="concurrent dials (default 60)")
    args = ap.parse_args()

    stamp = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    print(f"scan started {stamp}", file=sys.stderr)

    print("enumerating nodes...", file=sys.stderr)
    nodes = fetch_all()
    cands, advertising, private_only = candidates(nodes)

    print(f"dialing {len(cands)} candidates...", file=sys.stderr)
    statuses: Counter[str] = Counter()
    reachable: list[str] = []
    with cf.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for overlay, status in pool.map(dial, cands.items()):
            statuses[status] += 1
            if status == "ws_ok":
                reachable.append(overlay)

    # supporting breakdowns
    versions: Counter[str] = Counter()
    ge_270 = 0
    ok = set(reachable)
    by_country: Counter[str] = Counter()
    by_prefix: Counter[str] = Counter()
    for n in nodes:
        m = VERSION.search(n.get("userAgent") or "")
        if m:
            trio = tuple(int(x) for x in m.groups())
            versions[f"{trio[0]}.{trio[1]}"] += 1
            if trio >= (2, 7, 0):
                ge_270 += 1
        else:
            versions["unknown"] += 1
        if n["overlay"] in ok:
            by_country[(n.get("location") or {}).get("country") or "unknown"] += 1
            entry = cands.get(n["overlay"])
            if entry and ":" not in entry[0]:
                octets = entry[0].split(".")
                by_prefix[f"{octets[0]}.{octets[1]}.0.0/16"] += 1

    total = len(nodes)
    w = lambda n: f"{n:>6}"  # noqa: E731
    print()
    print("=" * 72)
    print(f"SWARM MAINNET WSS REACHABILITY — {stamp}")
    print("=" * 72)
    print(f"nodes visible to SwarmScan          {w(total)}")
    print(f"  full nodes                        {w(sum(1 for n in nodes if n.get('fullNode')))}")
    print(f"  running bee >= 2.7.0 (AutoTLS)    {w(ge_270)}  {100 * ge_270 / max(total, 1):5.1f}%")
    print()
    print(f"advertising a websocket underlay    {w(advertising)}")
    print(f"  on a publicly routable address    {w(len(cands))}")
    print(f"  private/unroutable only           {w(private_only)}")
    print()
    print(f"WSS-REACHABLE (verified upgrade)    {w(len(reachable))}"
          f"  {100 * len(reachable) / max(total, 1):5.1f}% of network")
    print()
    print("dial outcomes:")
    for status, count in statuses.most_common():
        print(f"    {status:<22} {count:>6}")
    print()
    print("reachable nodes by country:")
    for country, count in by_country.most_common(10):
        print(f"    {country:<22} {count:>6}")
    print()
    print("reachable nodes by /16 (concentration check):")
    for prefix, count in by_prefix.most_common(8):
        print(f"    {prefix:<22} {count:>6}")

    if args.json:
        with open(args.json, "w") as fh:
            json.dump(
                {
                    "scanned_utc": stamp,
                    "nodes_visible": total,
                    "bee_ge_270": ge_270,
                    "ws_advertising": advertising,
                    "ws_public_candidates": len(cands),
                    "ws_private_only": private_only,
                    "wss_reachable": len(reachable),
                    "dial_outcomes": dict(statuses),
                    "by_country": dict(by_country),
                    "by_prefix_16": dict(by_prefix),
                    "reachable_overlays": sorted(reachable),
                },
                fh,
                indent=2,
            )
        print(f"\nwrote {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
