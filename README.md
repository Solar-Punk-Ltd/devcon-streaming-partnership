# Devcon streaming partnership

Working documents for the Devcon(nect) / Ethereum Foundation streaming-partner conversation (Devcon 8, Mumbai, 3–6 Nov 2026 — confirm event identity, see questionnaire Q1).

**Decisions locked (2026-07-21):** delivery is **Swarm-only** — no web2 CDN, no rented fallback, no YouTube backstop. Built on **`swarm-hls-stream`** (the MSRS/MSSD wrappers are out of scope). The management spec is **capability-only** (no dev cost / team / timeline / build plan).

| Doc | Audience | Contents |
|---|---|---|
| [tech-spec.md](tech-spec.md) | Solar Punk management | Honest capability inventory (proven / viable / prototype / missing), pure-Swarm reference architecture, tiered service offering, the gap boundary before we could commit, capability targets to validate, risks |
| [questionnaire.md](questionnaire.md) | Devcon(nect) team | Priority-tagged questions (🔴 blocker / 🟡 pre-build / 🟢 pre-event) across scope, feed spec, venue, scale, UX, archive, ops, commercial |

Context (audience/scale figures, Devcon streaming history, production-cost analysis): [`../swarm-web2-stream/`](../swarm-web2-stream/README.md). Note: that study's web2-fallback recommendation is superseded by the Swarm-only decision above — use it only for the history and scale numbers.

Status: drafts for internal review, 2026-07-21. Local only — not pushed to any remote.
