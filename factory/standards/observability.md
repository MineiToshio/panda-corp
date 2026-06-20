# Observability (operation / production)

> Domain: Operation · Severity: **MUST** for the baseline; the rest staged. Enforcement: checklist + CI. Complements `infra.md` (which covers only local dev).

## Rule
- **Mandatory baseline (every project), cheap:**
  - **Structured JSON logs** (Pino or equivalent) with `service.name` = the project's name in the portfolio, level and timestamp; `trace_id`/`span_id` when there is request context.
  - **Error-tracking** integrated (Sentry, from the stack) from day 1 (DR-026).
  - **Never log PII or secrets** (see `privacy.md`).
- **Staged (when the project needs it):** portable instrumentation with **OpenTelemetry** (vendor-neutral): library auto-instrumentation, environment resource attributes, `instrumentation.ts` (Next's native hook) in the web golden path.

## Liveness & freshness fidelity — dashboards/monitors (DR-066)

> Severity: **MUST** for any project that ships a dashboard, monitor, status page or any UI that claims to show a *live* process. A monitoring UI must tell the **truth about its own liveness/freshness** — it may never present a stale snapshot as if it were live.

Three rules, applied to BOTH sides of the wire (the **producer** of the state and the **consumer**/UI that renders it):

- **(a) Liveness = `running` AND fresh — never a self-reported flag alone.** Never present a producer-set flag (`running: true`, `status: active`, an "online" dot) as proof of life. A flag only says *"the last time I wrote, I intended to keep going"* — it says nothing about *now*. Cross it with **recency**: `live ⇔ running AND (now − last_heartbeat) < staleness_window`. A frozen `running: true` with a stale timestamp is **NOT** live (the audit case: `status.yaml` had `running: true` + a frozen heartbeat while the build advanced — a naïve UI would have shown "corriendo" as proof of life).
- **(b) The UI declares its OWN freshness — graded, never silent.** A monitor states how old its data is, in three bands derived from the producer's heartbeat interval `T`:
  - **En vivo** — `age < 3·T` (≈ the producer should have beaten ≥1–2 times): render as live.
  - **Datos de hace X** — `3·T ≤ age < hard_TTL`: render the data but **stamp its age explicitly** ("datos de hace 4 min"). Never pass intermediate-age data off as live.
  - **Sin señal** — `age ≥ hard_TTL`: the producer is considered hung/dead; show **"sin señal"**, not the last value dressed as current. (`hard_TTL` = the same conservative TTL the producer's liveness lock uses — for the build, the 10-min concurrent-run TTL, DR-050 §9.)
- **(c) The producer emits a POSITIVE heartbeat every tick AND advances its timestamp.** So that "sin señal" genuinely means *hung* and not merely *quiet*: on every tick the state producer (i) appends a **positive heartbeat event** to its event stream and (ii) **advances a freshness timestamp** in its state file (`last_event_at` / `supervisor_heartbeat`). A long-running unit of work that emits only at its *start* and then goes silent for minutes will read as frozen — so the heartbeat is **time-driven** (a scheduled tick), not only event-driven, or a healthy-but-quiet process looks dead.

**The gate (a "live" transport doesn't ship unproven) — see [quality.md](quality.md) "Observability-fidelity gate" and [build-orchestration.md](build-orchestration.md) §9.** A UI/transport that claims to be live MUST prove, before it passes: (1) a **real state change is reflected in the UI quickly** — push/watch (fs-watch on the event stream, SSE, websocket) for near-real-time when the transport allows it at ~zero cost; poll-based fallback bounded to **≤ 30 s worst case**; and (2) **"sin señal" actually engages** when the heartbeat stops (kill the producer → the UI flips to stale/sin-señal within `hard_TTL`, it does not keep showing the last value as live).

**Why.** A monitoring UI exists to be trusted in the one moment it matters — when something is wrong. The most dangerous failure of a monitor is a confident lie: showing a dead/hung process as "running" because a flag said so. Crossing the flag with recency, declaring freshness, and emitting a real heartbeat make the UI fail *honest* (it says "sin señal" when it can't see) instead of fail *silent*.

## How it is verified
- Checklist in `/pandacorp:release`: structured logs? Sentry connected? `service.name` correct?
- **Observability-fidelity (DR-066)**: for any dashboard/monitor surface — does liveness cross `running` with heartbeat recency (never the flag alone)? Does the UI declare its own freshness (en vivo / datos de hace X / sin señal)? Does the producer emit a positive, time-driven heartbeat? Is the "sin señal" path actually exercised by a test (stop the producer → UI goes stale)? (The gate lives in `quality.md` + `build-orchestration.md` §9.)
- The data goes to **Sentry** (errors/traces) and **PostHog** (analytics), already present — OTel is the instrumentation layer, **not a parallel pipeline**.

## Why
Without observability you can't operate a portfolio: a production failure must be visible and attributable. OTel Traces/Metrics are stable; **Logs via OTel are experimental** (adopt with caution). Don't impose traces+metrics+logs from the MVP (it clashes with DR-012 minimal cut).

Sources: opentelemetry.io/docs/languages/js
