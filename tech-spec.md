# Solar Punk — Devcon 8 streaming partnership: technical specification

> **Audience:** Solar Punk management.
> **Purpose:** an honest statement of what we can offer the Devcon(nect) team as a streaming partner, and where the boundary between "works today" and "not yet" sits.
> **Delivery model (decided):** **fully decentralized — Swarm only. No web2 CDN, no rented fallback path.** This is native to our stack: `swarm-hls-stream`'s design goal is "no centralized CDN required."
> **Foundation (decided):** built on the current-generation **`swarm-hls-stream`** monorepo (stream-uploader + client + cli) and its `streaming-infra-manager` deployment tooling. The prior-generation MSRS/MSSD wrappers are superseded and out of scope.
> **Event assumption:** Devcon 8, Mumbai, JIO World Center, **3–6 Nov 2026**. (Confirm event identity — [questionnaire](questionnaire.md) Q1.)

---

## 1. Executive summary

**What we can honestly offer:** a **fully decentralized live streaming service on Swarm** — ingest of the EF's produced per-stage feeds, real-time upload to Swarm, feed-based HLS manifests, playback through our own web player, and a permanent decentralized archive as a natural by-product (the segments *are* the archive). No centralized CDN and no web2 fallback anywhere in the path.

**Where we stand:**

- **The core pipeline is real and it is decentralized-native.** `swarm-hls-stream` takes HLS segments from a media server (SRS by default, OME or any HLS producer via its HTTP API), uploads them to Swarm in real time, and serves playback from Swarm feeds — no CDN in the loop by design. `streaming-infra-manager` deploys the whole stack in isolated "profiles" and carries an end-to-end fault-injection suite: Bee-node outages, uploader crashes, engine restarts, and gateway outages are *tested* recovery scenarios, not hopes.
- **It is single-stream-grade today, not conference-grade.** The honest boundary (§4): no adaptive-bitrate ladder (single rendition per stream), no ingest redundancy per stage, no multi-stage conference UX, and — the big one — **no proof it serves thousands of concurrent viewers straight from Bee nodes without a CDN.** That last point is the defining technical risk of the decentralized-only choice, and it is ours to retire by load testing.
- **The decisive unknown is scope, not technology.** If the EF hands us a produced program feed per stage ("they provide the streaming devices" points this way), our job is ingest → Swarm → player → archive, which is squarely on our stack. If we are expected to run physical production (cameras, mixing, uplink), that is a different discipline and not our offer.

**Recommendation to management:** engage the partnership with the decentralized-only offering (§3), send the [questionnaire](questionnaire.md), and treat two things as gating before any commitment: (1) the EF confirming the feed handoff (not production), and (2) our own load test proving Swarm-only delivery at Devcon scale.

---

## 2. What we have today — capability inventory

Maturity legend: ✅ **proven** (deployed/tested, evidence cited) · 🟡 **viable** (works, needs hardening for this event) · 🧪 **prototype** (not event-ready) · ❌ **missing**.

Everything below is the `swarm-hls-stream` generation. The older MSRS (RTMP) and MSSD (SRT) Node wrappers are superseded by `swarm-hls-stream`'s cleaner stream-uploader + pluggable engine and are not part of this offering.

### 2.1 Ingest & upload

| Capability | Status | Evidence / notes |
|---|---|---|
| SRT/RTMP ingest via pluggable engine (SRS default, OME, or any HLS producer via HTTP API) | ✅ | `swarm-hls-stream` — `engines/srs`; `OBS/FFmpeg ──SRT──> SRS ──HLS──> stream-uploader`. SRT is the modern contribution protocol and the preferred EF-feed handoff. |
| Real-time HLS segment upload to Swarm | ✅ | `swarm-hls-stream/packages/stream-uploader` — queued uploads (100-segment buffer, 10 concurrent), live + VOD feed manifests. |
| Single-stream fault tolerance | ✅ | `streaming-infra-manager/e2e`: Bee outage <15 s → zero loss; >15 s → clean discontinuity + resume; uploader crash → state recovery; engine restart → re-announce; gateway outage → viewer path unaffected; multi-stream concurrent playback. |
| Bee node + postage-stamp management | ✅ | `swarm-hls-stream/packages/cli` — stamp buy/check, node status, wallet/balance; auto-detects Bee URL from deploy config. |
| **Adaptive-bitrate (ABR) ladder** | ❌ | Single rendition per stream. A conference audience (mobile, hotel Wi-Fi, Indian 4G) needs a ladder (~`[5.0, 3.0, 1.5, 0.8]` Mbps). |
| **Ingest redundancy / HA per stage** | ❌ | One ingestion path per stream = a single point of failure per stage. |

### 2.2 Delivery — pure Swarm, no CDN

| Capability | Status | Evidence / notes |
|---|---|---|
| Segment persistence on Swarm (feeds + postage stamps) | ✅ | All content is content-addressed and immutable on Swarm; the live segments double as the permanent archive. |
| CDN-free delivery model | ✅ *(design)* | Native to `swarm-hls-stream` ("no centralized CDN required"); client fetches manifest + segments directly from Bee nodes/gateways. |
| Horizontal gateway scaling (multiple Bee nodes) | 🟡 | `streaming-infra-manager` "Watcher" model runs **N** ultra-light Bee nodes + client containers; the scaling lever for viewer load. |
| **Delivery proven at thousands of concurrent viewers** | ❌ | The defining open question (§5). No load data beyond single-stream / small-N. Must be measured before we commit numbers. |
| Stamp / infra monitoring | 🟡 | `mssd-monitor` remains usable as a standalone stamp-health monitor (validity/expiry/remaining GB); no unified live NOC dashboard yet. |

### 2.3 Playback & viewer UX

| Capability | Status | Evidence / notes |
|---|---|---|
| Swarm-native HLS React player (custom hls.js loaders) | ✅ | `swarm-hls-stream/packages/client` — plays live + VOD from feeds; handles manifest merging across restarts. |
| In-browser QoE overlay | ✅ | Built into the client — quality-of-experience metrics viewers/ops can see live. |
| Stream browsing / discovery | 🟡 | Client browses available Swarm-backed streams; example-grade, not yet a curated conference catalog. |
| **Multi-stage conference UX** (stage switcher, schedule, now-playing, deep links) | ❌ | No "conference home → pick stage" experience. |
| Captions, DVR, low-latency HLS | ❌ | Not implemented; scope depends on EF requirements (questionnaire Q19–23). |
| Browser-native P2P streaming (MediaRecorder → WebM → Swarm, no server) | 🧪 | `swarm-stream-js` — Chrome-only, VP9/Opus-locked, no tests. A demo of the fully-decentralized endgame; **not** the event-critical path. |

### 2.4 Operations & event-adjacent

| Capability | Status | Evidence / notes |
|---|---|---|
| Profile-based deployment & orchestration | ✅ | `streaming-infra-manager` — named, isolated docker-compose profiles (Streamer + Watcher servers), slot-based ports, SRS/OME engines. |
| **Multi-stage orchestration & scheduling** (stage→feed mapping, schedule enforcement, stale-feed handling) | ❌ | No automation for running/curating several stages in parallel over multiple days. |
| **Live NOC dashboard** (per-stage bitrate/errors/rebuffer/viewers) & incident runbooks | ❌ | Never needed at single-stream scale; mandatory for a 4-day live event. |
| Devcon companion app (session comments, agenda, on Swarm) | 🟡 | `DevconAgora` — active, aimed at Devcon 8; a natural integration surface for the player, not on the streaming critical path. |

**Bottom line:** ingest → Swarm → playback is proven at single-stream scale with real fault-injection evidence and is decentralized by design. What makes it a *conference* service — ABR, ingest redundancy, multi-stage orchestration/UX, and proven at-scale Swarm-only delivery — is not there yet.

---

## 3. Reference architecture (what we would run in Mumbai)

Scenario A (expected): the EF's AV vendor hands us one produced program feed per stage; the handoff point is the encoder output. Everything downstream is Swarm-native, no CDN, no web2.

```
 EF AV vendor (per stage)              SOLAR PUNK SCOPE ─ 100% Swarm, no CDN
 cameras → vision mix → encoder
        │
        └─ SRT/RTMP ─▶ SRS / OME ─ HLS ─▶ stream-uploader ─▶ Swarm Network
                        (pluggable engine)   (real-time upload,   (feeds + postage
                                              live+VOD manifest)    stamps; immutable)
                                                                          │
                                     Client (React) ◀── feed lookup + segment fetch
                                     multi-stage UI, QoE overlay      from Bee nodes / gateways
                                     (embedded on the Devcon site)    (scale = N Watcher nodes)
                                                                          │
                                     VOD / archive ◀── the same Swarm segments ARE the archive
                                                        (decentralized, permanent; no re-upload)
```

Design principles: **Swarm is the only delivery path** — no CDN, no rented platform, no web2 fallback; resilience comes from **within** the decentralized model (multiple Bee nodes/gateways, plus the client's tested tolerance of node/gateway outages), not from failing over to a centralized service; the live stream and the permanent archive are the same content-addressed segments; every component reuses `swarm-hls-stream` / `streaming-infra-manager`.

---

## 4. Service offering — what we put on the table

| Tier | What the EF gets | Our confidence |
|---|---|---|
| **T1 — Decentralized archive & VOD** | Every session persisted permanently on Swarm and played back through our client; stamps funded and monitored. | **High** — inherent to the pipeline; lowest-risk standalone offer if live scope shrinks. |
| **T2 — Fully decentralized live streaming** *(the recommended offer)* | Per-stage live ingest (SRT), real-time upload to Swarm, multi-stage web player embedded on the Devcon site, live ops, archive included (T1). Swarm-only, no CDN. | **Conditional** — core pipeline proven at single-stream scale; the §5 gaps must close, and Swarm-only delivery must be load-proven at Devcon scale. |
| **T3 — Physical production (cameras, mixing, uplink)** | On-site AV production. | **Not our offer** — a different discipline; historically the EF contracts this itself. If asked, we broker a production vendor rather than staff it. |

Explicit non-offers, by decision: a web2 CDN, a rented fallback platform (Mux/Cloudflare/Livepeer), a YouTube backstop path, or building a proprietary web2 stack. Delivery is Swarm, full stop.

---

## 5. The honest boundary — what's missing before we could commit to T2

Stated as capability gaps, not a schedule. These are what stand between the proven single-stream pipeline and a Devcon-scale conference service:

1. **Swarm-only delivery at scale — unproven.** This is the defining risk of the decentralized-only choice. Serving thousands of concurrent viewers directly from Bee nodes/gateways, with no CDN caching layer, has not been measured. The Swarm-native answer is horizontal scale (many gateway/Watcher nodes) plus content-addressed immutability, but the actual capacity, cost-per-viewer, and rebuffer behaviour under load are open numbers. **We should not promise a concurrency figure until we have load-tested it.**
2. **No adaptive-bitrate ladder.** Single-rendition streams will fail viewers on mobile and constrained networks. Needs multi-rendition transcode (ffmpeg/NVENC, or a decentralized transcode option) feeding the existing uploader.
3. **No multi-stage orchestration or conference UX.** Devcon runs several stages in parallel for four days; we have single-stream deployment and a basic browser, not stage→feed scheduling or a "conference home → pick stage" experience.
4. **No ingest redundancy per stage.** A crashed ingestion path currently takes its stage down.
5. **No live NOC tooling / runbooks.** A four-day live event needs per-stage dashboards and rehearsed incident response.
6. **Requirement-dependent gaps:** captions, DVR, low-latency HLS — build only if the EF requires them (questionnaire Q19–23).

---

## 6. What the tech can target (numbers to validate, not commitments)

| Metric | Working target | Status |
|---|---|---|
| Concurrent viewers | design ~5,000; aspire 20,000 | **must be load-proven on Swarm-only delivery before we state a number** |
| Glass-to-glass latency | ~10–15 s (standard HLS) | LL-HLS (~3–6 s) only if the EF requires it and the pipeline supports it |
| Time-to-first-frame | < 3 s | to be measured under load |
| Rebuffer ratio | < 0.5 % | to be measured under load |
| Resilience | tolerate Bee node / gateway outages without viewer-visible failure | **proven** in `streaming-infra-manager` e2e (single-stream) |

Not signing any of the "target" numbers until load and chaos tests produce them is a feature of the offer, not a weakness — and it is the right posture given we are the ones carrying the decentralized-delivery risk.

---

## 7. Top risks

| Risk | Sev | Note / mitigation |
|---|---|---|
| Scope ambiguity — feed handoff vs full production | **critical** | Resolve via questionnaire before any commitment; determines whether this is our project at all. |
| **Swarm-only delivery unproven at scale** | **high** | The accepted risk of the decentralized-only decision. Mitigate within the model: horizontal Bee-node/gateway scaling, immutable content-addressing, and an early load test as the gate to any concurrency promise. |
| No ABR → poor experience on mobile/constrained networks | high | Add a transcode ladder feeding the existing uploader. |
| Multi-stage orchestration is net-new | medium | Extend the client + aggregator; single-stream base is solid. |
| Venue uplink quality (Mumbai) | high (external) | EF-owned; dual-path SRT + bonded cellular on a separate circuit (questionnaire Q13–14). |
| Commitment competes with core Swarm roadmap work | strategic | Management call; keeping delivery Swarm-only at least keeps the work on-mission. |

---

## 8. What we need from the Devcon(nect) team

Full list: [questionnaire.md](questionnaire.md) (priority-tagged). The blockers:

1. **Handoff point** — do we receive a produced program feed per stage, at the encoder output? What exactly are the provided "streaming devices"?
2. **Stage count & hours** — how many parallel streams, which days/hours?
3. **Audience & latency targets** — what concurrency should we design and load-test for, and is standard HLS latency acceptable?
4. **Venue uplink** — dedicated, attendee-isolated bandwidth in JIO World Center?
5. **Decentralized-only delivery is understood** — confirm the EF is aligned that delivery is Swarm-only (no YouTube/CDN backstop from us). Their own YouTube archive, if any, is theirs and independent of our path.

---

## 9. References

- Stack (the foundation): `swarm-hls-stream` (stream-uploader / client / cli), `streaming-infra-manager` (profiles + e2e fault suite); supporting: `mssd-monitor` (stamp health), `swarm-stream-js` (P2P endgame demo), `DevconAgora` (companion app).
- Context (audience/scale figures, Devcon streaming history, production-cost analysis): [`../swarm-web2-stream/research/findings.md`](../swarm-web2-stream/research/findings.md), [`cost-model.md`](../swarm-web2-stream/research/cost-model.md). Note: that study explored a web2 fallback; **that delivery-model question is now settled as Swarm-only** — cite it only for the history and scale numbers, not the fallback recommendation.
- Devcon streaming precedent for decentralized delivery: Devcon 6 (StreamETH/Livepeer + Swarm/IPFS archive) — being the decentralized streaming provider continues Devcon's own history.
