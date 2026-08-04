# Decentralized Live Streaming for Devcon 8
## Capability & partnership brief

*Prepared for the Devcon / Ethereum Foundation events team, July 2026*

---

## 1. In brief

Solar Punk builds live video streaming on **Swarm**, Ethereum's decentralized storage network. Our pipeline takes a standard broadcast feed, writes every second of it to Swarm in real time, and plays it back to viewers' browsers. For Devcon 8 we propose to be your decentralized streaming provider: your team produces the program feed on-site, and we handle everything from there: decentralized delivery, an embeddable multi-stage player, and a permanent, decentralized archive of every session.

We are also being straight about where the technology stands. The pipeline is proven today at single-stream scale, with real, tested recovery from infrastructure failures. Scaling it to a full multi-stage conference is the frontier we are actively proving out, and that load testing is already under way ahead of any go-live commitment. Swarm is the origin, the storage and the archive throughout. A cache sits in front of it so the bulk of the audience is served affordably, and any viewer who prefers can fetch the identical hash-verified bytes from the network directly.

---

## 2. What we can provide

| Offering | What it means for Devcon | Status |
|---|---|---|
| **Decentralized archive & VOD** | Every session stored permanently on Swarm and replayable on demand, continuing Devcon's decentralized-archive tradition. | **Ready today** |
| **Fully decentralized live streaming** *(recommended)* | Live ingest of your per-stage feeds, real-time delivery over Swarm, an embeddable multi-stage player, with the archive included automatically. | **Strong. Scale to validate** |
| **Physical AV production** *(not our offering)* | Cameras, vision mixing, on-stage audio, venue uplink. We assume your AV vendor produces the program feed. We can help broker a production partner, but do not provide production ourselves. | Out of scope |

---

## 3. How it works

```
Your program feed  ->  Our ingest  ->  Swarm network  ->  Viewer's player

The stored stream is the archive: permanent, decentralized, automatic.
```

In plain terms: a standard broadcast feed comes in from your encoder. We split it into small chunks and write them continuously to Swarm. Viewers' browsers pull those chunks back from the network and play them as a normal live stream. Because content on Swarm is addressed by what it is rather than which server it sits on, the same stream can be served from many nodes at once. That is how a decentralized network takes the place of a CDN. And because every chunk is stored permanently, the live stream and the on-demand archive are the same thing: no separate archiving step.

---

## 4. What is ready today, and what we would build for Devcon

We would rather be clear than oversell.

**Ready and tested today**

- Ingest of a standard broadcast feed (SRT or RTMP).
- Real-time upload of the stream to Swarm.
- Live and on-demand playback through our web player, including an on-screen quality indicator.
- **Tested resilience:** the pipeline has an automated failure-testing suite. Storage-node outages, an uploader crash, and a viewer-gateway outage are all recovered from with defined behavior: short outages lose nothing, longer ones resume cleanly.
- A permanent decentralized archive as a by-product of the live stream.

**What we would build for the engagement**

- **Adaptive quality:** multiple resolutions so viewers on mobile and varied networks always get a smooth stream.
- **Multi-stage conference experience:** a viewer-facing home with a stage switcher, schedule, and deep links, running several stages in parallel across the days.
- **Ingest redundancy:** a standby path per stage so a single failure never takes a stage off air.
- **Live operations tooling:** real-time dashboards and rehearsed incident response for the event.
- **Scale validation:** load testing to confirm performance at your expected audience (see section 5).
- *On request:* captions, rewind/DVR on the live edge, and a low-latency mode.

---

## 5. Transparent about scale

The content stays on Swarm, which is the mission-aligned choice and also genuinely pioneering, which means the honest position is this:

- How much of a full conference audience can be served straight from the network, rather than from the cache in front of it, is not yet a measured number.
- We are already **running this load testing**, ahead of go-live, and will confirm a concurrency figure from it rather than promise one up front.
- No public go-live commitment would be made until that validation passes.

For the Ethereum Foundation specifically, we see this as a feature, not a hedge: Devcon would be demonstrating that live streaming at real scale can run on decentralized infrastructure.

---

## 6. What we would need from you

To turn this into a firm plan, the key questions we would want to align on early:

- **Scope:** Do you provide a produced program feed per stage (our assumption), or is production expected from us? How many stages stream in parallel, and for how many hours per day?
- **The feed:** What format and protocol does your encoder output (SRT preferred, or RTMP)? Resolution and bitrate?
- **Venue:** Is dedicated upload bandwidth available at the venue, separate from attendee Wi-Fi?
- **Audience:** What concurrent-viewer scale should we design and load-test for? Is standard streaming latency acceptable, or is low-latency required?
- **Timeline:** When could we run a joint rehearsal with a real feed, and when do you need a go/no-go decision?

---

## 7. Why Solar Punk, and why decentralized

Decentralized streaming is not new to Devcon. Devcon 6 was streamed on a decentralized transcoding network with a Swarm/IPFS archive. Being your decentralized provider for Devcon 8 continues that and extends it from decentralized archive to decentralized delivery.

---

### Technical appendix (for technical readers)

- **Ingest:** SRT (preferred) or RTMP into a media engine (SRS by default, pluggable: any HLS-producing source integrates via its HTTP API).
- **Packaging & playback:** HLS with a browser player built on hls.js, using custom loaders that read manifests and segments from Swarm feeds rather than HTTP origins.
- **Storage:** Swarm on Gnosis Chain, with persistence funded via postage stamps. Content is immutable and content-addressed, so live segments serve as the permanent archive with no re-upload.
- **Resilience (tested):** automated end-to-end fault injection. A storage-node outage under ~15s loses zero data, longer outages arm a clean discontinuity and resume, an uploader crash recovers from saved state, a media-engine restart re-announces, and a viewer-gateway outage does not affect the ingest/storage path.
- **Scaling model:** horizontal. Multiple lightweight Swarm nodes serve viewers in parallel, and content-addressing allows any node to serve any segment. At-conference-scale delivery is the item under load validation (section 5).
- **Open source:** the stack is published under the Solar-Punk-Ltd GitHub organization and can be shared for technical review.

---

## Full questionnaire

*Everything we'd want to align on to scope and commit to the engagement. Section 6 lists the five blockers. This is the complete set.*

*Priority: [Blocker] means we cannot finalize a proposal without it. [Before build] is needed before we start building (by mid-August). [Before event] is needed before the event.*

*Why we ask: a live event stream is a chain: capture -> mixing -> contribution -> transcode -> delivery -> player -> archive. The handoff point between your team (or AV vendor) and ours determines scope and staffing on both sides.*

### A. Event basics

1. **[Blocker]** Which event(s) exactly is this for: Devcon 8 Mumbai (3-6 Nov 2026), a future Devconnect, or both? Are satellite/side events in scope?
2. **[Blocker]** How many stages/tracks stream in parallel, and for how many hours per day? (Devcon 7 had 6 main stages + ~70 spaces. What subset streams live?)
3. **[Before build]** Is the full program streamed publicly, or are some sessions restricted (unlisted, ticket-holder-only, speaker-consent-pending)?

### B. Scope & responsibility split (the single biggest driver)

4. **[Blocker]** You mentioned providing "streaming devices". Please define the exact handoff point. Which of these does your side (or your AV vendor) own, per stage?
    - cameras, vision mixing / program cut, graphics, audio mix
    - hardware encoders that push a contribution feed (SRT/RTMP) to us
    - or only raw capture gear, with Solar Punk expected to operate encoding on-site?

    Our working assumption: **you hand us one produced program feed per stage at the encoder output. Everything downstream (ingest -> Swarm delivery -> player -> archive) is ours.** Please confirm or correct.
5. **[Blocker]** Who is the AV production vendor, and can we get a technical contact for a joint signal-flow session?
6. **[Blocker]** Who owns which budget lines: physical production, venue connectivity, delivery/infrastructure costs, our engineering time?
7. **[Before build]** Is Solar Punk the sole streaming provider, or one path among several? If another party runs a parallel stream (e.g. an EF-operated YouTube), that is independent of our path. Please confirm so we do not design around it.

### C. Contribution feed: technical spec (per stage)

8. **[Blocker]** Protocol and format of the feed we receive: SRT (preferred) / RTMP(S) / NDI / SDI? Codec, resolution, framerate, bitrate? (Our assumption: 1080p30, H.264, ~5-10 Mbps per stage.) We transcode the contribution feed to our delivery rendition, roughly 2.5-3 Mbps per 1080p30 rung with 2-second segments, so the incoming bitrate does not need to be low. If you prefer we pass through without transcoding, send us the delivery bitrate directly, around 3 Mbps.
9. **[Before build]** Audio: how many channels/languages? Is live translation mixed in (separate audio tracks), and who provides it?
10. **[Before build]** Are slides/screen-share a separate source, or already mixed into the program feed?
11. **[Before build]** Is the contribution feed redundant (dual encoders / dual network paths), or a single encoder and path? If single, who owns that risk?
12. **[Before event]** Timecode/sync expectations across stages (matters for multi-stage rewind and archive alignment)?

### D. Venue & connectivity (Mumbai, JIO World Center)

13. **[Blocker]** What dedicated uplink bandwidth is available for streaming, and is it isolated from attendee Wi-Fi (separate circuit/VLAN)? Who is the venue ISP/network contact?
14. **[Before build]** Is bonded-cellular backup (e.g. LiveU/SRTLA-style) permitted in the venue, and are local SIM/carrier arrangements possible?
15. **[Before build]** Our ingest runs in the cloud, so our on-site footprint is small: a workspace with power and wired ethernet near production for monitoring (optionally one small local-recording box), seats for 2-3 crew, and badges for them. Can the venue accommodate that, and how many badges can we get?
16. **[Before event]** Do you require our streaming operators to be physically on-site, or is remote operation acceptable? If we place any equipment on-site, can our remote team reach it over VPN?

### E. Audience, scale & latency

17. **[Blocker]** What audience should we design for: expected concurrent viewers (total and per stage), and a stress ceiling you want us to load-test to? (Devcon 6 saw ~60k total live viewers over 4 days. Concurrent peaks are far lower. Our current design point: 5,000 concurrent, stress-tested to 20,000.)
18. **[Before build]** Geographic mix assumptions (India-heavy + global?). This drives gateway/node placement.
19. **[Before build]** Latency requirement: is standard latency (~10-15 s glass-to-glass) acceptable, or is low-latency (6 s or less) a hard requirement? Any interactivity (live Q&A voting) that depends on it?
20. **[Before event]** Rewind/DVR on the live edge: required or nice-to-have?

### F. Player, UX & site integration

21. **[Blocker]** Where do viewers watch: embedded on devcon.org / a live.devcon.org page we build / the Devcon app / all of these? Who builds and hosts the surrounding page?
22. **[Before build]** Player requirements: multi-stage switcher, quality selector, captions, chat integration (which system?), schedule/now-playing metadata (from which source, your program API?).
23. **[Before build]** Captions/subtitles: required? Which languages? Who supplies live transcription (a vendor, or should we include it)?
24. **[Before build]** Delivery-model alignment: our delivery is decentralized-only (Swarm, no web2 CDN or backstop from us). Please confirm the EF is aligned on this.
25. **[Before event]** Accessibility requirements beyond captions (keyboard navigation, screen-reader labels, WCAG target)?

### G. Archive

26. **[Before build]** Archive destination: our archive deliverable is Swarm-native (the live segments persist as the permanent decentralized archive, continuing the archive.devcon.org precedent). If you also want a YouTube or other mirror, is that EF-operated and independent of our pipeline?
27. **[Before build]** Turnaround: are same-day session replays expected, or is post-event publishing fine? Who does editing/chaptering/metadata?
28. **[Before event]** Long-term persistence funding on Swarm (postage stamps): who owns and funds the archive after the event?

### H. Operations, rehearsal & timeline

29. **[Blocker]** Key dates on your side: when is the AV vendor locked, when can we do a joint end-to-end rehearsal with a real feed (a test feed from your encoder well before the event), and when do you need our final go/no-go commitment?
30. **[Before build]** Venue access days before the event for setup and a full dry run?
31. **[Before build]** Comms & escalation during the event: shared channel (Slack/TG/Matrix), a named decision-maker on your side, incident severity definitions?
32. **[Before event]** Post-event: what reporting do you want (viewer stats, uptime, incidents)? Any privacy constraints on analytics (e.g. no third-party trackers on the player page)?

### I. Commercial & legal

33. **[Blocker]** What is the budget envelope / compensation model for the streaming partner (fixed fee, cost-plus, grant)?
34. **[Before build]** Contract/SLA expectations: what uptime/quality commitments do you expect us to sign, and what is the process if a session fails to stream?
35. **[Before build]** Speaker consent/rights: who ensures sessions are cleared for live broadcast and permanent archive? Any geo-restrictions?
36. **[Before event]** Insurance/liability requirements for on-site crew and equipment?
