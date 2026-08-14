#!/usr/bin/env bash
# Sample Bee peer-to-peer traffic counters into a CSV, one row per interval.
#
# Reads the byte counters from inside each container's network namespace, so
# every byte counted is Bee's own and nothing else on the host is included.
# Counters are cumulative since container start; report.py differences them.
#
# Usage:
#   ./sample.sh                                   # default: 60s, forever
#   INTERVAL=300 OUT=week.csv ./sample.sh          # 5-minute samples
#   CONTAINERS="bee-egress-a bee-egress-b" ./sample.sh
#
# Run it under systemd, tmux or nohup so it survives your session:
#   nohup ./sample.sh > sample.log 2>&1 &

set -euo pipefail

INTERVAL="${INTERVAL:-60}"
OUT="${OUT:-egress-samples.csv}"
CONTAINERS="${CONTAINERS:-bee-egress-a bee-egress-b}"
IFACE="${IFACE:-eth0}"

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker not found. This harness reads counters from container namespaces." >&2
  exit 1
fi

for c in $CONTAINERS; do
  if ! docker inspect "$c" >/dev/null 2>&1; then
    echo "error: container '$c' does not exist. Start it with docker compose up -d first." >&2
    exit 1
  fi
done

if [ ! -f "$OUT" ]; then
  echo "timestamp_utc,container,rx_bytes,tx_bytes" > "$OUT"
  echo "created $OUT"
fi

echo "sampling $CONTAINERS every ${INTERVAL}s into $OUT (ctrl-c to stop)"
echo "leave this running for a full week — a day is not enough to see the"
echo "reserve-sync tail settle, and the weekly figure is what the costing needs."

while true; do
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for c in $CONTAINERS; do
    # /proc/net/dev inside the container: cumulative bytes for its own eth0.
    line="$(docker exec "$c" cat /proc/net/dev 2>/dev/null \
            | awk -v i="$IFACE" '$1 ~ "^"i":" {gsub(/:/,"",$1); print $2","$10}')" || line=""
    if [ -n "$line" ]; then
      echo "${ts},${c},${line}" >> "$OUT"
    else
      # Container restarted or iface renamed; record a gap rather than a wrong number.
      echo "${ts},${c},," >> "$OUT"
      echo "warn: no counters from $c at $ts" >&2
    fi
  done
  sleep "$INTERVAL"
done
