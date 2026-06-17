---
id: FRD-12
type: frd
title: FRD-12 — Observability and data visualization
status: ACTIVE
implementation_status: BLOCKED
last_updated: '2026-06-16'
---
# FRD-12 — Observability and data visualization

Pandacorp's "honest" layer: read the factory's state at a glance and understand *where something got stuck*, complementing Party's RPG show. Derived from the 2026 research (see [docs/proposals/06](../../../../docs/proposals/06-improvement-plan-2026.md)). Read-only, no calling Claude.

## Acceptance criteria (EARS)

- The header SHALL show **≤5 critical KPIs** (e.g. active projects, agents working, XP of the day, builds queued, **failed work orders**), top-left; the detail goes in collapsible sections.
- The view SHALL show a **Live / No signal** indicator with the **timestamp of the last event** read from `~/.claude/dashboard-events.ndjson` (data freshness), so the operator knows whether they're seeing something current or frozen.
- INSIDE a project, it SHALL offer an **RPG ↔ timeline/tree toggle** over the same data: work orders → tasks → actions, with duration and parent-child relationship.
- ANY grouping or ranking (agents, events, metrics) SHALL be limited to the **top-5** so as not to overwhelm the operator.
- IF the **work order DAG** is drawn, pointing at a node SHALL **highlight only its dependency chain** (upstream/downstream) and dim the rest; it SHALL offer "jump to the first error" and a *follow-mode* that centers the step in execution.
- The graph render SHALL use a cheap layout engine (**Dagre**, ~39KB) and NOT ELK.js, unless there is a real need for orthogonal routing.
- The honest metrics (tasks done vs failed, time per work order, events per minute) SHALL be derived from the same event file, with no extra instrumentation.

## Event schema (vendor-neutral)

The producer (factory hooks → `dashboard-events.ndjson`) and the consumer (Mission Control) share a **portable** schema (OpenTelemetry style: standardize the *shape* of the telemetry so as not to tie yourself to one viewer). Minimum per event: `event`, `at` (ISO timestamp), `agent`/`session`, `tool`, `status` (ok | fail), `work_order`/`task` id. This allows rendering it as RPG, as a timeline or exporting it without rewriting the emitter.

## Non-goals (v1)
- It is not a full APM nor does it keep a long history: it reads the **tail** of the event file (cap 100–200), not the whole history.
- It does not compute cost/tokens in v1 (left as a future metric if instrumented).

## Future
Cost/tokens per agent and per project; trace export; comparison of idea→launch speed between projects.
