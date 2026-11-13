# Observability (telemetry / production)

> Domain: Operation/Observability · Severity: **MUST** for the baseline; the rest staged. Enforcement: checklist + CI. Complements `infra.md` (which covers only local dev).
>
> **When it's added (DR-085):** observability/telemetry is instrumented **during construction** (`/pandacorp:implement`), as part of the final hardening step — not as a post-launch concern. Only integrations explicitly approved for the current version are instrumented. The product ships from construction with that approved scope; the `release` phase only verifies it's live, and `/pandacorp:review-launch` *reads* what construction wired.

## Rule
- **Mandatory baseline (every project), cheap:**
  - **Structured JSON logs** (Pino or equivalent) with `service.name` = the project's name in the portfolio, level and timestamp; `trace_id`/`span_id` when there is request context.
  - **Error-tracking scope** explicitly decided by the owner in the architecture round (DR-026/131): Sentry now, deferred or excluded. Only "now" plans the integration; silence is pending. Structured logs remain the baseline in all cases.
  - **Never log PII or secrets** (see `privacy.md`).
- **Staged (when the project needs it):** portable instrumentation with **OpenTelemetry** (vendor-neutral): library auto-instrumentation, environment resource attributes, `instrumentation.ts` (Next's native hook) in the web golden path.

## Liveness & freshness fidelity — dashboards/monitors (DR-066)

> Severity: **MUST** for any project that ships a dashboard, monitor, status page or any UI that claims to show a *live* process. A monitoring UI must tell the **truth about its own liveness/freshness** — it may never present a stale snapshot as if it were live.

Three rules, applied to BOTH sides of the wire (the **producer** of the state and the **consumer**/UI that renders it):

- **(a) Liveness requires fresh authority — never a self-reported flag alone.** Never present a producer-set flag (`running: true`, `status: active`, an "online" dot) as proof of life. A flag only says *"the last time I wrote, I intended to keep going"* — it says nothing about *now*. Cross it with **recency**: `live ⇔ active owner AND (now − renewal/heartbeat) < producer_TTL`. A frozen `running: true` with a stale timestamp is **NOT** live (the audit case: `status.yaml` had `running: true` + a frozen heartbeat while the build advanced — a naïve UI would have shown "corriendo" as proof of life).
- **(b) The UI declares its OWN freshness — graded, never silent.** A monitor states how old its data is, in three bands derived from the producer's heartbeat interval `T`:
  - **En vivo** — `age < 3·T` (≈ the producer should have beaten ≥1–2 times): render as live.
  - **Datos de hace X** — `3·T ≤ age < hard_TTL`: render the data but **stamp its age explicitly** ("datos de hace 4 min"). Never pass intermediate-age data off as live.
  - **Sin señal** — `age ≥ hard_TTL`: the producer is considered hung/dead; show **"sin señal"**, not the last value dressed as current. (`hard_TTL` = the same conservative TTL the producer's liveness lock uses — use the producer's declared TTL, not a universal constant.)
- **(c) The producer declares its freshness mechanism.** A heartbeat-based monitor emits a positive time-driven tick and advances its timestamp; a long quiet task must not appear dead merely because it emits no business events. A lease-based producer instead exposes its authoritative renewal and TTL. The active build uses that second model: fenced coordinator commands renew the lease, with no separate heartbeat process. Consumers distinguish ownership freshness from the age of the latest progress sample and never invent a supervisor tick.

**The gate (a "live" transport doesn't ship unproven) — see [quality.md](quality.md) "Observability-fidelity gate" and [build-orchestration.md](build-orchestration.md) §9.** A UI/transport that claims to be live MUST prove, before it passes: (1) a **real state change is reflected in the UI quickly** — push/watch (fs-watch on the event stream, SSE, websocket) for near-real-time when the transport allows it at ~zero cost; poll-based fallback bounded to **≤ 30 s worst case**; and (2) **"sin señal" actually engages** when the heartbeat stops (kill the producer → the UI flips to stale/sin-señal within `hard_TTL`, it does not keep showing the last value as live).

For a lease-backed build, these tests expire the authoritative lease and separately age the progress sample; they do not require a synthetic heartbeat event.

**Why.** A monitoring UI exists to be trusted in the one moment it matters — when something is wrong. The most dangerous failure of a monitor is a confident lie: showing a dead/hung process as "running" because a flag said so. Crossing ownership with recency, declaring sample age, and exposing the actual freshness signal make the UI fail *honest* (it says "sin señal" when it can't see) instead of fail *silent*.

## The build telemetry pipeline — producer map (what feeds Mission Control)

> This map names each producer and authoritative file. Runtime policy is [build-engine.md](build-engine.md); the layout comes from `plugin/runtime/build/paths.mjs`. Main-checkout docs show landed state, not every in-flight transition.

| Channel | Single writer / call site | Reader purpose |
|---|---|---|
| `~/.claude/dashboard-events.ndjson` or `~/.codex/dashboard-events.ndjson` | `plugin/runtime/build/telemetry.mjs:113` (`emitEvent`) through `event-transport.mjs`; runtime hooks also emit their own vocabulary events | Focus, narrative and observed activity. Company-specific overrides: `PANDACORP_EVENTS_FILE`, `PANDACORP_CODEX_EVENTS_FILE`. Explicit project/run identity; an event alone is not an owner lease |
| `.pandacorp/run/build.lease/lease.json` | `plugin/runtime/build/state.mjs:191` calls `build-state.mjs` renewal with `projectStatus:false` | Ownership/liveness from renewal and the lease's own TTL. Main's `running` flag is not authority |
| `.pandacorp/run/build/{state,admission}.json` | CLI state/admission modules; exposed by `plugin/runtime/build/lifecycle/status.mjs:12` (`statusSnapshot`) | Active unit progress, admission, parked questions and relay state. `state.json` is a reconstructible cache; frontmatter and journal remain authoritative |
| `.pandacorp/track.jsonl` on integration, then main at landing | `plugin/runtime/build/telemetry.mjs:92` (`appendTrack`), called by CLI transitions/review | Durable WO/review/FRD timing; never append tracked progress in the main checkout during a run |
| `.pandacorp/status.yaml` + WO frontmatter | CLI transition/landing commits on `lane/<run_id>/integration`; landing metadata in `plugin/runtime/build/land/command.mjs:73` | Verified snapshots and plan structure. Main shows the last landed projection; active-run readers must select integration state explicitly |
| `.pandacorp/inbox/decisions.pending.md` | `plugin/runtime/build/doubts/integrationLog.mjs:21` mirrors tracked canonical decisions; CLI `answer` owns resolution | Pending owner questions reach main-checkout readers, including nested projects. The mirror is ignored, never another answer writer |
| `.pandacorp/run/build/perf-samples.jsonl` and `~/.pandacorp/host/perf/journal.jsonl` | `plugin/runtime/build/perf.mjs:41` (`recordSample`) and `perf.mjs:115` (`finishPerformance`), called by `plugin/runtime/build/next/step.mjs:25` and `lifecycle/terminate.mjs:105` | Per-run worker counts, RAM, swap, disk, scale events and timings. Machine-local learning outside git; BUILD-9 owns policy and retention |

Consumers derive structure from the canonical WOs of the selected snapshot, run ownership from the lease, durations from track/performance records and data age from timestamps. They must not dress old landed state or an old sample as live activity. Telemetry failure is reported honestly and never creates an alternative state writer.

## How it is verified
- Checklist in `/pandacorp:implement`'s final hardening step (DR-085): structured logs? `service.name` correct? Sentry connected and events fire in the critical flow only when each integration is approved for now? Deferred/excluded providers have no SDK, stub, credentials, required env validation or provider-specific gate? (`/pandacorp:release` only confirms it's live.)
- **Observability-fidelity (DR-066)**: for any dashboard/monitor surface — does liveness cross `running` with heartbeat recency (never the flag alone)? Does the UI declare its own freshness (en vivo / datos de hace X / sin señal)? Does the producer expose its declared heartbeat or lease-renewal mechanism? Is the "sin señal" path actually exercised by a test (stop the producer → UI goes stale)? (The gate lives in `quality.md` + `build-orchestration.md` §9.)
- **Build transport/performance:** `plugin/scripts/test-build-v2-{telemetry,perf,state}.mjs` verify schemas, event vocabulary, timing and journal behavior; Mission Control reader tests must separately exercise stale/missing signals. Fake-worker evidence is not a live-run claim.
- When approved for now, data goes to **Sentry** (errors/traces) and **PostHog** (analytics) — OTel is the instrumentation layer, **not a parallel pipeline**.

## Post-launch cost monitoring

The stack runs on free tiers with hard ceilings — **PostHog** (1M events/mo), **Cloudflare R2** (10GB), **Neon** (compute hours), **Vercel** (bandwidth). The `/pandacorp:review-launch` loop checks consumption against these ceilings **monthly** for every launched product. **Approaching a ceiling is a needs-owner decision** (DR-005 spending gate: upgrading a plan is spending money) — never a silent upgrade; the alternative (trim events, prune assets, throttle) is presented alongside.

## Why
The owner chooses provider scope to avoid speculative SDKs and deployment requirements; structured logs still make failures visible. Without observability you can't operate a portfolio: a production failure must be visible and attributable. OTel Traces/Metrics are stable; **Logs via OTel are experimental** (adopt with caution). Don't impose traces+metrics+logs from the MVP (it clashes with DR-012 minimal cut).

Sources: opentelemetry.io/docs/languages/js
