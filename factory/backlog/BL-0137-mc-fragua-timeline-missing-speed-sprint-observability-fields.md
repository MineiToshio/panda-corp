---
id: BL-0137
type: change
area: mission-control
title: "La Fragua timeline doesn't render UiPassSkipped/GateEvidenceFallback or surface per-agent/phase cost, concurrency_max, or change-queue age"
status: open
severity: p2
opened: 2026-09-22
closed:
source: "docs/proposals/37-fast-change-path-and-implement-cost.md §B.7 (M-1..M-9); mission-control/.pandacorp/inbox/changes/ (gitignored, project-owned)"
closes:
links: []
---

## Problem
The 2026-09 implement-speed sprint adds new observability the build engine emits (`UiPassSkipped` and
`GateEvidenceFallback` events, per-agent/sub-gate `durationMs` from WP-09's instrumentation,
`concurrency_max`, and the change-queue's per-item age) but Mission Control's La Fragua timeline (the
Party panel's build-progress view) does not render any of it yet. Per the memo's own verified starting
point (`grep -rln "cost_usd|costUsd|usage_summary" mission-control/src/` returns zero matches while
`track.jsonl` has carried a full `usage_summary` since 2026-09-03), MC shows **no cost anywhere**, and
none of M-1 (cost by stage/agent), M-3 (time per sub-gate), M-5 (real concurrency vs `maxAgents`), or M-8
(queue age) surface either — so the owner has no way to SEE the sprint's own headline win (or a
regression) without reading raw `wf_*.json`/`track.jsonl` by hand.

## Note on routing (DR-103)
This is a **product change to Mission Control**, not factory tooling — per this same backlog's own
routing rule, it does NOT belong here as the implementation ticket. A gitignored MC change-card already
exists for the UiPassSkipped/timeline piece specifically:
`mission-control/.pandacorp/inbox/changes/render-uipassskipped-timeline.md` is the doc this item was
briefed to point at.

**Live-verification note (2026-09-22):** that path was checked directly in this session
(`mission-control/.pandacorp/inbox/changes/` currently lists `README.md`, `decision-id-shared-emitter.md`,
`portada-seal-coverage-commits-funnel-ideas.md`, and a `done/` folder — NO
`render-uipassskipped-timeline.md`). Either the card has not been filed yet, lives in a different MC
worktree, or was filed and already drained/renamed. This item's "Done when" below does not assume the
card exists — file it (or confirm/re-point to the existing one) as step 1.

## Fix plan
1. Confirm whether `render-uipassskipped-timeline.md` already exists in SOME `mission-control/.pandacorp/inbox/changes/` (check other active MC worktrees, not just the primary checkout); if genuinely absent, file it fresh via `/pandacorp:change` inside `mission-control/`.
2. The change-card (new or existing) should scope at minimum: render `UiPassSkipped` and
   `GateEvidenceFallback` as distinct timeline entries (not silently absorbed into a generic step); add a
   cost-by-agent/phase readout (M-1); a real-vs-configured concurrency indicator (M-5,
   `concurrency_max`); and change-queue age (M-8) to whichever panel already lists queued changes.
3. M-2 (cache-write vs measured cost) and M-3 (per-sub-gate time) are prerequisites the memo calls out as
   "governance prerequisites" (§B.7) — note in the card whether this change depends on them shipping
   first or can read `durationMs`/`usage_summary` directly from what WP-09 already emits.

## Tests (prove the fix — TDD, RED → GREEN)
Owned by the MC change-card once filed (component tests per `mission-control/docs/rules/quality-and-testing.md` — `getByRole` queries on the new timeline entries and cost readout, a fixture `wf_*.json`/`track.jsonl` with a `UiPassSkipped` event asserting it renders distinctly from a normal step).

## Done when
`render-uipassskipped-timeline.md` (or its equivalent) is confirmed filed in
`mission-control/.pandacorp/inbox/changes/`, drained by `/pandacorp:implement` inside `mission-control/`,
and the resulting UI is live-verified (Mission Control's own gates, not this factory's). This factory-side
item closes once the pointer above is confirmed filed and queued — it does NOT wait for MC's own build to
finish (per DR-103, the factory backlog tracks the pointer, not the product work).

## Out of scope
Implementing the MC UI itself here — happens inside `mission-control/` through its own skills, never as a
direct edit from the factory backlog.
