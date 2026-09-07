# September MVP review: what the diagram claims and what the code does

A review of the September 2026 MVP model in `arch-explorer/?model=mvp` against the code that would
have to ship it. The model was read as a set of claims, one per object, and every claim that bears
weight was checked against `swarm-hls-stream` (`main-v2`), `streaming-infra-manager` (`master`),
`gateway-proxy`, `stamp-monitor`, `bee` and this repo's `terraform/`. Nothing was run against the
live hosts; every figure below is derived from a number that exists in a repository, and every
finding names the file and line it rests on. Three specialist reviews (security and operations,
performance, cost) were carried out and each load-bearing claim in them was re-read at the cited
line before it was kept.

The one-sentence result: **the model is internally consistent and renders cleanly, and about a
third of what it tags "Ship this month" either does not exist in any repository or is contradicted
by the code that does.**

---

## The short version

1. **The uploader's HTTP API takes an attacker-controlled path, reads the file, publishes it to
   Swarm and deletes it, with no authentication.** `path.resolve` against the media root with no
   containment; `/proc/self/environ` holds the feed signing key and the batch ids. The fixes were
   written on 2026-07-30 and 2026-07-31 and are still not on `main-v2`. Today only the GCP firewall
   stands in front of it. *Critical.*
2. **The feed signing key is stored and moved in plaintext in five places**, three of them reachable
   without authentication: a `TEXT` column, an unauthenticated `GET /profiles`, the deploy script's
   command line, the manager's log (shipped to Loki), and a `.env` file. The model puts the key on
   the Bee publishers, which hold no key at all. *Critical.*
3. **The read path is uncached and has never been measured.** The gateway Bee node runs with
   `--cache-capacity` 0, `--full-node=false` and `--swap-enable=false`; there is no HTTP cache and no
   TLS in front of it. At 500 viewers that is ~1.1 Gbps out, ~1.1 Gbps in, ~3,900 requests and
   ~33,600 chunk retrievals per second from two nodes whose only measured figure is one stream at
   8 Mbps. The repo's own sizing measured ~123 viewers per gateway with caching on; the MVP asks
   250 per gateway with it off. *Critical.*
4. **The `admin → manager: provision` edge cannot exist as drawn.** The manager API has no
   authentication, binds every interface, and is contained only because its container publishes no
   host port. A web2 admin layer on another host has no path to it. The admin API itself is
   internet-facing from the first viewer (the SPA fetches its config from it), so "auth blocks the
   second brand rather than the first" is wrong: it blocks the first deployment. *Critical.*
5. **The stage host is not stateless, so "rebuild is the recovery" is false for anything that has
   published.** Profiles, private keys, passphrases, batch ids, port slots and the uploader's resume
   state live in local Docker volumes on the boot disk. A Terraform `-replace` changes the feed
   owner and breaks every viewer link. *High.*
6. **Postage fails silently on the shipped defaults.** Depth 20, mutable: the 1080p rung's bucket
   ceiling is reached after ~1.6 hours and Bee then wraps the counter and overwrites older chunks
   with no error and no log. No repo dilutes or tops up; the model's "Dilute at 85%" exists nowhere,
   and the real thresholds in code are 75% and 90%. *High.*
7. **Ingest authentication is thinner than claimed.** No component refuses an unknown stream id;
   the passphrase defaults to empty, and an empty value makes the entrypoint delete the encryption
   lines from the SRS config rather than refuse to start. The SRS webhook has no shared secret.
   *High.*
8. **The publisher hop from GCP to the Bee host is plain HTTP to an API with no authentication**,
   `--cors-allowed-origins=*` and SWAP enabled. Anyone who reaches a publisher can buy batches with
   its wallet and fill the brand's batch on demand. The only planned control is an IP allowlist that
   no repo implements. *High.*
9. **Both repos default the ladder to 9.7 Mbps, every document assumes 5.6.** SRS's entrypoint and
   the manager's `DEFAULT_ABR_LADDER` both carry 5000/2800/1200/700 kbps. Every egress, postage and
   CPU figure in the plan is 1.73× off unless the profile pins the documented rungs. *High.*
10. **The cost of the second brand cannot be read off the diagram, and nobody owns the machine
    bill.** The model carries no price; ~98% of the machine cost is idle at four streaming hours a
    week, no component starts or stops a VM, the Bee host is Vultr in the model and Hetzner in the
    plan (a 10× difference in egress price), and the second brand costs nearly as much as the first.
    *High.*

Three more things the model tags as shipping that do not exist in any repository: the in-browser
Bee node (`innode`), the stamps-and-cheques automation (`stampmgr`), and an HTTPS gateway that
restricts what it serves (`beegw`).

---

## Decisions the workshop has to make

1. **Manager topology.** One central manager, authenticated and reachable by the admin layer, or one
   per host reached over a tunnel. The model says both; the code supports neither remotely.
2. **Authentication on the admin API in the MVP.** Brand tenancy can wait for the second brand; a
   credential in front of an internet-facing API that creates streams and spends money cannot.
3. **Key custody.** Where the feed signing key lives (Secret Manager is the candidate), who may read
   it, and the rule that it is never on a command line or in a log.
4. **The read path.** A cache and a TLS terminator are components, not settings; whether the gateway
   restricts what it serves; how many gateways, from a load test rather than a guess; and which
   provider the Bee host is on.
5. **Postage policy.** Immutable batches by default so a full batch refuses instead of overwriting;
   a depth policy per rung; who watches utilisation and how it alerts; who funds the archive after
   the brand leaves, and for how long.
6. **Which ladder ships**, 5.6 Mbps or 9.7 Mbps, pinned in the profile and written on the card.
7. **The in-browser node**: a desktop demo on one machine, or an open question. It is not
   September's shipping code.
8. **Observability**: inherit the pilot's Prometheus, Grafana, Loki and Alertmanager host into the
   model, and decide who exports batch utilisation.
9. **Who brings the stage host up and down per streaming window.** It is the largest saving
   available and it has no owner.
10. **A latency target.** The player already decides 10 seconds on its own.
11. **Chat**, unchanged: still open.

---

## Security

**Uploader HTTP API: unauthenticated file read, publish and delete (Critical).** The SRS `on_hls`
webhook handler resolves the caller's `file` field against the media root with `path.resolve` and no
containment check, reads the result, hands it to the uploader (which stamps it and publishes it to
Swarm), then removes it (`packages/stream-uploader/src/engines/srs.ts:183-196`). Registering a
stream first is free: `StreamOrchestrator.startStream` returns `true` unconditionally
(`libs/StreamOrchestrator.ts:70-78`). The API server installs no authentication and listens without a
host, so it binds every interface (`api/server.ts:60`), and compose publishes it with no bind prefix
(`deploy/docker-compose.yml:71`). The container has no `USER` directive. The environment of that
process holds `STREAM_KEY`, `STAMP` and `BEE_PUBLISHERS`. Three branches fix this and are not
ancestors of `main-v2`: `feat/srs-path-containment` (2026-07-30), `feat/api-auth` and
`feat/srs-webhook-auth` (both 2026-07-31). Model claim affected: `srtin`, "That is the whole of
ingest authentication" — contradicted; the uploader API is a second ingest surface the model does
not draw.

**Feed signing key in plaintext, five places (Critical).** `private_key TEXT` in the manager schema
(`manager/src/migrations/001_init.sql:17`); returned unredacted by `GET /profiles`; copied into the
`containers.env` snapshot; passed as `--private-key=` on the deploy script's argv
(`manager/src/domain/DeploymentOrchestrator.ts:458`); logged in full by `ScriptRunner`
(`manager/src/domain/ScriptRunner.ts:50`), whose container logs Alloy ships to Loki; written into
`.env.<profile>` on disk. The key is generated in the browser and posted to the manager; Terraform and
Secret Manager never see it. The code is explicit that a Bee publisher "is not the owner of anything:
it is a pipe with a wallet" (`libs/BeePublisherPool.ts:28-35`). Model claims affected: `beepub` "each
holding ... its own signing key", `sim` "the signing key", tour step 3 — contradicted; `uploader` "It
holds the signing key and the stamp" — the one correct statement of the three.

**Manager API: no authentication, wrong containment story (Critical).** No auth middleware exists in
`manager/src`, `common/src` or `frontend/src`. `MANAGER_HOST` defaults to `0.0.0.0`
(`manager/src/utils/config.ts:26`) and the Terraform-rendered `manager.env` does not set it. The
`api` service publishes no host port; only `web` (`127.0.0.1:8080`) and Postgres do, reached by a
human over `ssh -L`. The `api` container mounts the Docker socket, so reaching it is root on the host.
Unauthenticated state changes today include creating, deploying and stopping profiles and buying
stamps. Model claim affected: `simapi` "only survivable because it listens on loopback" — the process
does not listen on loopback; Docker not publishing the port is the boundary. The `admin → sim`
provision edge in three diagrams has no mechanism behind it.

**Admin API cannot ship unauthenticated (High).** The model routes `admin → spaboot: brand config`,
which makes the admin API a public endpoint from the first viewer, while `auth` is tagged open and
`adminapi` and `stampmgr` are tagged ship. An unauthenticated API that provisions stages and buys
postage is reachable by anyone who finds the hostname. Model claim affected: `auth` "it blocks the
second brand rather than the first" — contradicted.

**Ingest: no stream-id check, passphrase optional and silently disabled (High).** SRS accepts any
`app/stream`; the only rejection point is the `on_publish` hook, which rejects only when
`startStream` returns `false`, which it never does. `SRT_PASSPHRASE` defaults to empty
(`deploy/docker-compose.yml:145`) and the entrypoint responds to an empty value by deleting the
`passphrase` and `pbkeylen` lines (`engines/srs/entrypoint.sh:8-13`), so SRS listens unencrypted with
no warning. streaming-infra-manager PR #38 (2026-09-05) makes the passphrase per deployment with
sound validation (10–79 characters, unreserved set, enforced at the schema, a Postgres `CHECK` and
again when the env is written), but the column is nullable and NULL falls back to the base `.env`.
The webhook itself carries no shared secret. Model claim affected: `srtin` "an unknown stream id is
refused outright" — contradicted; "with its own passphrase" — true only once someone sets one.

**Publisher hop: plain HTTP to an unauthenticated Bee API (High).** The manager builds
`http://host:port` publisher URLs (`manager/src/domain/StampService.ts:112-114`); the publisher nodes
run `--swap-enable=true` and `--cors-allowed-origins=*` (`deploy/docker-compose.yml:32-33`) with the
API bound to `0.0.0.0` by default. Bee 2.8.1 has no API authentication on any of its 64 routes. A
reachable publisher lets an attacker buy, top up and dilute batches with the node's wallet and fill
the brand's batch with garbage. Direct wallet withdrawal is gated by an empty-by-default whitelist,
and feed forgery needs the signing key, so the blast radius is money and availability rather than
identity. The rollout plan names an IP allowlist on the Bee side as the control and puts it out of
scope; no repo implements it.

**Gateways: no serve-allowlist, no TLS, no load balancer (High).** The deploy path publishes a raw
Bee node on `0.0.0.0:1733` behind an nginx that proxies `/bee/` with no filtering. `gateway-proxy`'s
`master` is upstream Ethersphere from 2024-08-08 with no Solar Punk commits and is referenced by
nothing; its allowlist blocks only HTML after fetching it; the two-upstream round-robin lives on the
unmerged `origin/lb` branch (2025-09-08) without health checks. No TLS termination exists in
`swarm-hls-stream/deploy` or `terraform/`. The architecture plan's own requirement ("The gateway
holds an allowlist of our feed owners and manifest references and refuses everything else") is
unmet. Model claim affected: `beegw` "Plain HTTPS ... Two of them behind one name" — contradicted on
both counts.

**Secret distribution is a human copy chain (Medium).** Terraform generates the SRT passphrase and
the Postgres password into Secret Manager and renders `manager.env`; everything else is typed by a
human into a `.env` or the manager's web form. The passphrase round-trips through an operator's
terminal, the UI, Postgres and a `sed` into `srs.conf`, and PR #38 also puts it into the copyable OBS
URL. One shared SSH key for `solarpunk` serves all hosts. Model claim affected: `sim` "Holds ... the
signing key, the postage batch and the SRT passphrase" — confirmed, which is the problem.

**Firewall is the only control on the non-SRT ports, and it holds (Low).** The Terraform firewall
opens only the per-stage SRT port, SSH from the IAP range, the scrape, the Loki push and the manager
UI over IAP. Ports 10010, 10012 and 10013 have no rule and the custom VPC has no default allow. This
is a good posture and it is the entire posture; it vanishes on any host Terraform does not build.

## Operations

**State on the stage host (High).** `google_compute_instance.stage` has a boot disk and nothing else
(`terraform/stages.tf:67-73`). On it: the manager's `manager-pg` volume (profiles, private keys,
passphrases, stamp ids, port slots), the uploader's `uploader-state` volume (per-stream resume state
and the random per-stream feed topics, `libs/StreamOrchestrator.ts:92`), the SRS media volume, the
hand-authored `swarm-hls-stream/.env` and every `.env.<profile>`. Only `manager.env` is Terraform
rendered. The feed owner is derived from `STREAM_KEY` and baked into the viewer bundle at build time;
lose the key and every link breaks. The rollout plan's M4 criterion, "back up inside ~15 minutes
with no manual step", is contradicted by the Terraform README's own M4 step, "redeploy the manager
stack and the media profile exactly as in M2". Model claims affected: `gcp` "applying the same
definition again" — contradicted for anything that has published; `simdb` "worth a backup" —
understated.

**No observability in the MVP, and nothing that could catch its named failure (Medium).** The pilot
runs Prometheus, Alertmanager, Loki and Grafana with four node-level alert rules; Prometheus scrapes
only `node_exporter`. Bee's `/metrics` is not a target, the manager's `/metrics` is JSON for its own
UI, and the uploader and SRS expose nothing. Batch utilisation, TTL and bucket saturation are visible
nowhere. The MVP model has no monitoring box.

**Manager topology is stated two ways.** `sim` declares one manager for every stage, fixed size,
shared tenancy, called by a remote admin layer; its own note, the rollout plan and Terraform all say
one manager per host on loopback. Both cannot be the MVP.

**Bee deployment is by hand, on a host the documents place with two providers.** `beeops` says
scripts and a person; the plan and Terraform key the allowlist identity on Hetzner; the model says
Vultr. No document names a move.

**No VM lifecycle owner.** Terraform sets no `desired_status`; stopping is a manual `gcloud` step in
prose; `simdeploy` operates containers, not machines.

**The lowest-rung publisher is the ladder's single point of failure (Low).** The stream catalog and
every master playlist go through the lowest rung's node, and failover is a TODO
(`libs/BeePublisherPool.ts:116-130`). If that node or its batch fails, no new viewer can join any
rung. Model claim affected: `beepub` "That rung goes quiet, so viewers on it drop a rung rather than
lose the stream" — true for three rungs of four.

## Performance and capacity at 500 viewers

Operating point: one brand, one stage, 500 concurrent viewers, four rungs, two-second segments, two
gateways on one host. Every input was read from a repository; nothing was measured live.

| Figure | Value | Derivation |
|---|---|---|
| Gateway egress | 1.10 Gbps average, 1.50 worst | 500 × 2.2 Mbps; 500 × 3 Mbps |
| Volume | ~495 GB per streaming hour | 1.1 Gbps × 3,600 s |
| Requests per viewer | ~7.8 per second | four rung feeds polled every 750 ms whether playing or not, plus one segment per 2 s |
| Requests at the gateways | ~3,900 per second | 500 × 7.8 |
| Chunk retrievals from Swarm | ~33,600 per second | no cache: every served segment re-fetches ~134 chunks; a caching gateway would do ~170 |
| Gateway NIC | ~2.2 Gbps aggregate | ingress equals egress when nothing is cached |
| Publisher egress, same NIC | ~6 Mbps | 5.6 Mbps + 7.5% parity |
| Only measured Bee throughput in the repos | 8 Mbps, one stream | pac-bench v1; Bee's own guidance ~10 Mbps per node |
| Measured viewers per gateway | ~123, with caching | `main-v3` sizing doc; the MVP asks 250 per gateway without caching |
| Vultr included transfer | exhausted in ~4 h | 2 TB at 495 GB/h |
| Glass-to-glass | ~13 to 15 s | 10 s player target + 2 s segmenting + ~1.6 s publish |

1. **Uncached, unpaid and unmeasured read path (Critical).** `--cache-capacity=${BEE_GATEWAY_CACHE_CAPACITY:-0}`,
   `--full-node=false`, `--swap-enable=false` (`deploy/docker-compose.yml:53-55`). No HTTP cache in
   front; `gateway-proxy` deletes `cache-control`, `etag` and `last-modified` from every response
   (`src/proxy.ts:154-163`). With SWAP off the gateway can only draw on each peer's time-based free
   allowance, and the plan's own finding is that an underfunded chequebook throttles retrieval past
   it. No benchmark, load test or concurrency ceiling for a Bee gateway exists in any of the repos.
2. **Request rate is four times the code comment (High).** The ladder poller walks all four rung
   feeds on a 750 ms clock, retries immediately after a hit, sleeps only on an empty pass, and can
   burst 25 catch-up reads per rung (`LadderFeedPoller.ts:22, 30, 33-34, 130-132`).
3. **One NIC, unstated speed (High).** ~6 Mbps of publishing shares an interface with ~2.2 Gbps of
   gateway traffic; `beehost` carries no machine size, port speed, RAM or disk. Six Bee nodes at the
   repo's own envelope (3 GB RAM, 40 GB disk each) is 18 GB and 240 GB before any cache.
4. **Ladder default 9.7 Mbps in both repos (High).** `engines/srs/entrypoint.sh:100` and
   `streaming-infra-manager/common/src/abrLadder.ts:79-82`.
5. **`innode` exists in no repo (High).** The HLS client fetches everything over HTTP from a gateway
   URL and contains no WASM, weeb-3 or light-node code; `bee-lite` is a Go library for native and
   Android with `EnableWS: false` and no WASM target. `docs/measurements/wss-reachability.md`: 2,065
   dialable mainnet nodes, none in Asia, 99% in one hosting network; iOS Safari's native HLS bypasses
   any loader. A mobile-heavy 500 yields low single digits to ~10% on the in-browser path, which
   confirms `gwfallback` and contradicts tour step 5.
6. **No latency target (Medium).** The player sets `liveSyncDuration: 10`, "deliberately not
   hls.js's own defaults" (`SwarmHlsPlayer.tsx:64`); that constant is two-thirds of glass-to-glass.
7. **Stage host CPU unmeasured (Medium).** `ABR_THREADS` defaults to 0, four rungs are four decodes,
   ~7 of 8 physical cores; the manager, Postgres, SRS, packager and uploader share the eighth. The
   plan has asked for "one measured run" since August.
8. **Uploader serialised, backpressure unmarked (Medium).** Every queue is `concurrency: 1`;
   `MAX_QUEUE_SIZE` 100 returns 429; a discontinuity is armed only when an upload fails inside its
   retry window (`StreamUploader.ts:80-81, 140-150`).
9. **Redundancy and the bench corpus (Low).** `SEGMENT_REDUNDANCY=0` in the local working `.env`
   against a default of 1 (deployed value unverified); the benchmark corpus, `stamp-guard` and the
   postage gate live on `origin/main-v3` and not on `main-v2`; the client playlist grows without bound
   (7.6 MB after ten hours on `main-v3`'s measurement).

## Cost

Every price below is a list price found in a repository; where none exists the row says so.
Month = 30.44 days; the brand streams four hours a week (17.3 hours a month).

**Fixed, monthly**

| Line | Basis | $/month |
|---|---|---|
| Monitoring host (e2-standard-2, TSDB disk, static IP) | $2.50/day, README | 76 |
| Stage host (t2d-standard-8, boot disk, two static IPs) | $13 − $2.50 per day, README | 319 |
| Bee host, 4 publishers + 2 gateways | not priced for the MVP; nearest repo price Vultr vhp-12c-24gb, 12 TB included (`tools/fleet-cost/model.py`) | 144 |
| Web2 admin host, SPA hosting | not in any repo | — |
| **Total priced** | | **~540** |
| GCP floor with instances stopped | $1/day, README | 30 |

**Per streaming hour**

| Line | Volume | Cost |
|---|---|---|
| GCP publish egress at 6 Mbps | 2.7 GB | ~$0.30 (two independent repo derivations agree) |
| Viewer egress, 500 × 2.2 Mbps | 495 GB | $0 inside the allowance, $4.95 beyond at $0.01/GB |
| Gateway cheques, two gateways | 5 GB retrieved | ~3.4 BZZ (`main-v3` bench, 0.00068 BZZ/MB) |
| Postage for one hour of ladder, held one year | 2.7 GB stamped | ~28 BZZ by bytes, ~54 BZZ as bought |

**Postage as bought, not as counted.** Utilisation is the fullest of 65,536 buckets
(`bee/pkg/postage/stampissuer.go:217-222`, ceiling `2^(depth−16)` at `:246-251`), the repo measured
the fullest bucket filling at ~6.4 per broadcast hour at 720p, and the operational stop line is 75%.
Stored bytes at the stop line are therefore ~53% of the batch's nominal capacity, independent of
depth, so every postage figure in this repo is understated by 1.4× to 1.9×. On the shipped defaults
(`DEFAULT_DEPTH = 20`, `DEFAULT_AMOUNT = 10000000000`, `STAMP_IMMUTABLE=false`) a rung's batch buys
8.5 days of TTL and the 1080p rung reaches its bucket ceiling after ~1.6 hours; being mutable, Bee
then resets the bucket counter and overwrites (`stampissuer.go:181-200`) with no error and no log,
which the repo has already observed on a live batch. The fiat conversion used above, ~$0.15 per BZZ,
is derived from two repo figures that agree with each other; no BZZ price is recorded anywhere.

**Lifetime.** At four hours a week the archive grows by ~563 GB a year: ~$880 a year by bytes,
~$1,700 as bought, recurring for as long as the archive is "permanent". No object or document says
who pays after the brand leaves.

**Idle.** The stage host runs 17 of 730 hours a month. Stopping it between windows saves ~$300 a
month; stopping everything saves ~$360. No component owns that action.

**The second brand.** Another stage host (+$319 always-on, or ~+$8 per-window; multiplexing two
ladders on one host is CPU-bound and does not save), +$5 publish egress, a second Bee host at ten
nodes against a seven-node instance (+$144, so `beehost` is not shared in practice), gateways from
+$0 to +$288 depending on whether "two more" means processes or machines, and ~+$139 a month of
archive. Roughly $540 to $690 a month always-on, or $230 to $380 with per-window bring-up: nearly the
first brand again. The Bee host provider decides a further 10× on viewer egress (Vultr $0.01/GB over
2 TB against Hetzner EU 1 EUR/TB over 20 TB). Per-brand billing is impossible today for shared
gateway egress and gateway cheques; GCP egress and postage are attributable.

**At 500 viewers the gateway is cheaper than any CDN in the repo** ($0 to $86 a month against $43 to
$944), because there is no volume yet. The caution is elsewhere: gateway cheque spend works out at
~$0.10 per GB retrieved, ten times Vultr's egress rate, and it scales with gateway count.

## Model, diagram and document consistency

What holds: `npm test` passes 100 tests including the 24 MVP tests; the MVP model validates with no
errors or warnings; `dist/` is byte-identical to a fresh rebuild; the page at `?model=mvp` loads the
right model, sets its own title, keeps `model=mvp` across navigation and logs no console errors; a
Node replica of the three rendered-layout collision tests finds zero label or line collisions at any
open-set combination.

What does not:

1. **Manager topology stated two ways** (see Operations).
2. **The signing key has three owners** (`sim`, `uploader`, `beepub`); only `uploader` is right.
   `admin`/`chain` say the admin layer "is the only thing that talks to" the chain and buys batches;
   batches are bought by each node's own wallet through the manager
   (`manager/src/domain/BeeStampClient.ts:75-89`).
3. **"Rebuild is the recovery" against the state on the same host** (see Operations).
4. **`innode` in SHIP against the repo's own measurement and the absence of any code.**
5. **No observability component.**
6. **The rollout plan says stream config is hand-authored in `swarm-hls-stream/.env`; tour step 7
   says nothing on the host is configured by hand and the manager holds the profile.** The plan is
   stale on this point.
7. **Bee host: Hetzner in the plan and Terraform, Vultr in the model.**
8. **The tenancy overlay conflates per-brand configuration with per-brand instances.** `stampmgr` and
   `branding` are tagged per brand inside the shared admin layer, and `beehost` is tagged shared while
   its own `scale` says it grows with stages; the tour reads teal as "another machine or another
   process every time we sign someone".
9. **Passphrase claims describe a redeployed state**, not the running one (empty on 2026-09-04).
10. **Tooling covers the second model unevenly.** `tools/bundle.js` validates only the Devcon
    literals; the rendered-layout tests in `test/routing.test.js` run only against the active model.
    The MVP has no hard collisions but six bowed edges with everything open and one at the default
    view: `brand → admin "manages"` loops under the whole diagram, the first thing an audience sees.
11. **Hygiene.** The README row for the MVP links the source tree; the published Pages copy has no
    MVP model; an empty untracked `arch-explorer/pnpm-lock.yaml` contradicts the README's "no
    lockfile".

## Fix list before the September build

Cheap and unblocking, in order:

- Merge `feat/srs-path-containment`, `feat/api-auth` and `feat/srs-webhook-auth` into `main-v2`.
- Make the SRT passphrase mandatory: refuse to start rather than delete the encryption lines.
- Drop `--cors-allowed-origins=*` on the publishers; put TLS and a token or mTLS in front of their
  APIs, or write down that an IP allowlist is the only control and implement it.
- Redact `private_key` from `GET /profiles`, stop logging script arguments, pass the key by
  environment rather than argv, and move `STREAM_KEY` and the feed topic into Secret Manager as the
  durable identity; add a persistent disk or an off-host `pg_dump` for `manager-pg`; re-run M4 and
  check the same feed address comes back.
- Set `BEE_GATEWAY_CACHE_CAPACITY` to hold a live window, enable SWAP on the gateways, put an
  immutable-segment HTTP cache and TLS terminator in front, and load-test one gateway at 250 viewers
  before choosing a count.
- Pin `ABR_LADDER` in the profile to the documented rungs, or move the documents to 9.7 Mbps.
- Buy immutable batches by default, adopt a depth policy per rung, scrape each publisher's Bee
  `/metrics` and alert below the dilute threshold.
- Put a credential in front of the admin API before its first internet-facing deployment.
- Edit the model: one key owner, one manager topology, `innode` and `stampmgr` to open until built,
  an observability box and an ingress/TLS box, a latency target, prices on the tenancy overlay, the
  Bee host provider named; parametrise the layout tests over both models and fix the `brand → admin`
  bow. Bring `docs/rollout/two-stage-terraform.md` up to date on hand-authoring and the Bee host.

## Method, and what was not checked

Three Opus reviews (security and operations, performance, cost) worked read-only over the six
repositories; the orchestrator re-read every load-bearing citation at the named line before keeping
it, ran the test suite, rebuilt the explorer in a scratch copy, replicated the layout-collision tests
over the MVP literals and inspected the rendered page. Not checked: anything on the running GCP or
Bee hosts (deployed passphrase, deployed `SEGMENT_REDUNDANCY`, whether a `private_key` row exists for
the live profile, whether the Bee-side allowlist exists); live cloud prices; the web2 admin layer,
which has no repository; the in-browser node POC, which lives outside these repositories;
`postage-batcher`, which is not cloned here.
