# Questionnaire for the Devcon(nect) team: streaming partnership

> Purpose: everything Solar Punk needs to size, staff, and commit to streaming Devcon 8 (Mumbai, 3-6 Nov 2026).
> Priority legend: 🔴 **blocker**: we cannot produce a final proposal/estimate without it. 🟡 needed before build starts (by mid-August). 🟢 needed before the event.
>
> Context for the EF: we ask these because a live event stream is a chain: capture -> mixing -> contribution -> transcode -> delivery -> player -> archive. The handoff point between your team/AV vendor and ours determines scope, cost, and staffing on both sides.

## A. Event basics

1. 🔴 Which event(s) exactly is this for: Devcon 8 Mumbai (3-6 Nov 2026), a future Devconnect, or both? Are satellite/side events in scope?
2. 🔴 How many stages/tracks stream **in parallel**, and for how many hours per day? (Devcon 7 had 6 main stages + ~70 spaces. What subset streams live?)
3. 🟡 Is the full program streamed publicly, or are some sessions restricted (unlisted, ticket-holder-only, speaker-consent-pending)?

## B. Scope & responsibility split (the single biggest cost driver)

4. 🔴 You mentioned providing "streaming devices". Please define the exact **handoff point**. Which of these does your side (or your AV vendor) own, per stage?
   - cameras, vision mixing / program cut, graphics, audio mix
   - hardware encoders that push a contribution feed (SRT/RTMP) to us
   - or only raw capture gear, with Solar Punk expected to operate encoding on-site?
   Our working assumption: **you hand us one produced program feed per stage at the encoder output. Everything downstream (ingest -> Swarm delivery -> player -> archive) is ours.** Please confirm or correct.
5. 🔴 Who is the AV production vendor, and can we get a technical contact for a joint signal-flow session?
6. 🔴 Who owns which budget lines: physical production, venue connectivity, delivery/infrastructure costs, our engineering time?
7. 🟡 Is Solar Punk the sole streaming provider, or one path among several? If another party runs a parallel stream (e.g. an EF-operated YouTube), that is independent of our path. Please confirm so we do not design around it.

## C. Contribution feed: technical spec (per stage)

8. 🔴 Protocol and format of the feed we receive: SRT (preferred) / RTMP(S) / NDI / SDI? Codec, resolution, framerate, bitrate? (Our assumption: 1080p30, H.264, ~5-10 Mbps per stage.) We transcode the contribution feed to our delivery rendition, roughly 2.5-3 Mbps per 1080p30 rung with 2-second segments, so the incoming bitrate does not need to be low. If you prefer we pass through without transcoding, send us the delivery bitrate directly, around 3 Mbps.
9. 🟡 Audio: how many channels/languages? Is live translation mixed in (separate audio tracks), and who provides it?
10. 🟡 Are slides/screen-share a separate source or already mixed into the program feed?
11. 🟡 Is the contribution feed **redundant** (dual encoders / dual network paths), or a single encoder and path? If single, who owns that risk?
12. 🟢 Timecode/sync expectations across stages (matters for multi-stage DVR and archive alignment)?

## D. Venue & connectivity (Mumbai, JIO World Center)

13. 🔴 What dedicated uplink bandwidth is available for streaming, and is it **isolated from attendee Wi-Fi** (separate circuit/VLAN)? Who is the venue ISP/network contact?
14. 🟡 Is bonded-cellular backup (e.g. LiveU/SRTLA-style) permitted in the venue, and are local SIM/carrier arrangements possible?
15. 🟡 Our ingest runs in the cloud, so our on-site footprint is small: a workspace with power and wired ethernet near production for monitoring (optionally one small local-recording box), seats for 2-3 crew, and badges for them. Can the venue accommodate that, and how many badges can we get?
16. 🟢 Do you require our streaming operators to be physically on-site, or is remote operation acceptable? If we place any equipment on-site, can our remote team reach it over VPN?

## E. Audience, scale & latency

17. 🔴 What audience should we design for: expected **concurrent** viewers (total and per stage), and a stress ceiling you want us to load-test to? (Devcon 6 saw ~60k total live viewers over 4 days. Concurrent peaks are far lower. Our current design point: 5,000 concurrent, stress-tested to 20,000.)
18. 🟡 Geographic mix assumptions (India-heavy + global?). This drives gateway/node placement.
19. 🟡 Latency requirement: is standard HLS (~10-15 s glass-to-glass) acceptable, or is low-latency (6 s or less) a hard requirement? Any interactivity (live Q&A voting) that depends on it?
20. 🟢 DVR/rewind on the live edge: required or nice-to-have?

## F. Player, UX & site integration

21. 🔴 Where do viewers watch: embedded on devcon.org / a live.devcon.org page we build / the Devcon app / all of these? Who builds and hosts the surrounding page?
22. 🟡 Player requirements: multi-stage switcher, quality selector, captions, chat integration (which system?), schedule/now-playing metadata (from which source, your program API?).
23. 🟡 Captions/subtitles: required? Which languages? Who supplies live transcription (vendor, or should we include it)?
24. 🟡 Delivery-model alignment: our delivery is **decentralized-only (Swarm, no web2 CDN or backstop from us)**. Please confirm the EF is aligned on this.
25. 🟢 Accessibility requirements beyond captions (keyboard nav, screen-reader labels, WCAG target)?

## G. VOD & archive

26. 🟡 Archive destination: our archive deliverable is Swarm-native (the live segments persist as the permanent decentralized archive, continuing the archive.devcon.org precedent). If you also want a YouTube or other mirror, is that EF-operated and independent of our pipeline?
27. 🟡 Turnaround: are same-day session VODs expected, or is post-event publishing fine? Who does editing/chaptering/metadata?
28. 🟢 Long-term persistence funding on Swarm (postage stamps): who owns and funds the archive after the event?

## H. Operations, rehearsal & timeline

29. 🔴 Key dates on your side: when is the AV vendor locked, when can we do a joint end-to-end rehearsal with a real feed (a test feed from your encoder well before the event), and when do you need our final go/no-go commitment?
30. 🟡 Venue access days before the event for setup and a full dry run?
31. 🟡 Comms & escalation during the event: shared channel (Slack/TG/Matrix), named decision-maker on your side, incident severity definitions?
32. 🟢 Post-event: what reporting do you want (viewer stats, uptime, incidents)? Any privacy constraints on analytics (e.g. no third-party trackers on the player page)?

## I. Commercial & legal

33. 🔴 What is the budget envelope / compensation model for the streaming partner (fixed fee, cost-plus, grant)?
34. 🟡 Contract/SLA expectations: what uptime/quality commitments do you expect us to sign, and what is the process if a session fails to stream?
35. 🟡 Speaker consent/rights: who ensures sessions are cleared for live broadcast and permanent archive? Any geo-restrictions?
36. 🟢 Insurance/liability requirements for on-site crew and equipment?

---

## The five we'd ask first (if we only get 15 minutes)

1. Handoff point: do we receive a produced program feed per stage? (Q4)
2. How many parallel stages, which hours? (Q2)
3. Design concurrency + latency requirement? (Q17, Q19)
4. Venue uplink: dedicated, isolated bandwidth? (Q13)
5. Budget owner + decision timeline? (Q6, Q29, Q33)
