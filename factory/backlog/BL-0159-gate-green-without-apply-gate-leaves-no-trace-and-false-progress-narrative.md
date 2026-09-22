---
id: BL-0159
type: bug
area: build-engine
title: "A green gate reached without apply-gate running leaves no telemetry trace (review_end/GateVerdict/frd_end) and notify-end writes a false progress.md narrative to the owner"
status: open
severity: p1
opened: 2026-09-23
closed:
source: "canary-c-forensics.md §7 'Hallazgos hermanos' + §2 timeline — Canary C live run, wf_1cf782d6-2ed, frd-23-materialized-stats-read-model"
closes:
links: [BL-0157]
---

## Problem
Canary C's FRD-23 went through two gate attempts. Gate #1 correctly returned `reopen` with real findings.
After `repair:frd-23` landed a fix (commit `f1fe6cd7`), gate #2 returned `green: true` (25 traceability
contracts, 0 `fail`, full `verify.sh` scope confirmed green at 20:46:38Z). Because of BL-0157's engine bug
(the whole-FRD traceability oracle rewrites even a legitimate `green:true` into `green:false` when the
`requirement` contract class is missing), the FRD ended up `blockFrd(frd, 'error')` **without `apply-gate`
ever running** — and `apply-gate` is the ONLY step that emits `review_end`, `GateVerdict`, and `frd_end`.

Two independently observable, durable symptoms remain even once BL-0157's oracle bug is fixed, because they
are a SEPARATE gap in the surrounding telemetry/reporting path, not the oracle itself:

1. **No trace of the second gate attempt anywhere.** `canary-c-forensics.md` §7: *"El gate 2 no deja
   rastro: con veredicto verde, `review_end`, `GateVerdict` y `frd_end` los emite `apply-gate`, que no
   corrió. `track.jsonl` queda con un `review_start` sin cerrar y el dashboard no tiene evento de verdict ni
   de bloqueo del attempt 2, solo `BuildComplete 0/1`."* Confirmed independently in `canary-c-report.md`
   §7 anomaly 2: zero `GateVerdict` events of type "pass" exist in `dashboard-events.ndjson` for the second
   attempt — only the `reopen` verdict from attempt 1 (20:22:52Z). A future operator or dashboard reading
   `track.jsonl`/the event stream has no way to see that a second, GREEN gate ever ran.
2. **`progress.md` (the owner-facing narrative) is false.** `canary-c-forensics.md` §7: *"progress.md (para
   el owner) es falso: dice que el FRD está bloqueado por los fallos del sello y que 'necesita decisión del
   propietario para aplicar el fix'. El fix ya estaba commiteado (`f1fe6cd7`) y el gate 2 fue verde.
   notify-end (haiku) solo recibió el reason `error` y rellenó con findings viejos del gate 1. También
   reporta '106/106' con 107 WOs."* — i.e. `notify-end` reconstructs its narrative purely from the terminal
   `blockFrd(frd, 'error')` reason string and gate #1's stale findings, with no way to know a fix already
   landed and gate #2 passed; separately, its work-order rollup count (106/106) undercounts the real
   on-disk total (107 `wo-*.md` files, confirmed by direct count) — a rollup staleness bug independent of
   the gate-trace gap.

## Root cause
Not fully diagnosed in this item. The `review_end`/`GateVerdict`/`frd_end` emission is coupled to
`apply-gate` running, so any path that reaches a terminal block WITHOUT calling `apply-gate` (BL-0157's
oracle rewrite is one such path, but there could be others) silently drops telemetry for whatever gate
attempts DID complete. Separately, `notify-end`'s `progress.md` writer appears to read only the terminal
`blocked_reason` string and the LAST gate result it was handed, not a full reconciliation of "did any
commit land after the findings were generated" or "did a later gate attempt supersede this one" — and its
WO count appears to read a stale rollup rather than counting `wo-*.md` files on disk.

## Fix plan
1. **Telemetry gap:** decouple `review_end`/`GateVerdict`/`frd_end` emission from `apply-gate` specifically
   — emit a verdict event for EVERY completed gate attempt (pass or reopen) at the point the gate agent
   returns its result, not only when `apply-gate` later runs. This is partially addressed by BL-0157's fix
   (which stops the oracle from swallowing a legitimate green before `apply-gate` is even reached) but does
   not by itself guarantee telemetry for gate attempts that terminate via some OTHER block path.
2. **`progress.md` narrative:** before `notify-end` writes a "blocked, needs owner decision" narrative,
   have it check whether a commit landed AFTER the cited findings' generation and whether a subsequent gate
   attempt exists and what it returned — write the narrative from the LATEST known state, not the first
   `blocked_reason` string it receives.
3. **WO rollup count:** `notify-end`'s work-order count should read the actual `wo-*.md` file count (or the
   same live rollup `status.yaml` is supposed to maintain per DR-115's single-writer rule) rather than a
   separately-maintained counter that drifted to 106 against 107 real files.

## Tests (prove the fix — TDD, RED → GREEN)
A scenario harness (in the existing `run-engine-tests.sh` suite) that: (a) forces a gate sequence of
reopen → repair → green WITHOUT going through `apply-gate` (simulating any block path, not just BL-0157's)
and asserts a `GateVerdict`/`review_end` event is still emitted for the green attempt; (b) asserts
`progress.md`'s narrative reflects the latest gate result and commit state, not a stale first-attempt
narrative; (c) asserts the WO count in `progress.md`/`BuildComplete` matches an independently-counted
`wo-*.md` file total.

## Done when
- A completed gate attempt (pass or reopen) always emits its verdict event regardless of whether
  `apply-gate` subsequently runs.
- `progress.md` never narrates a decision as pending when a later commit/gate result already resolved it.
- The WO count `notify-end` reports matches an independent on-disk count.
- `bash plugin/scripts/run-engine-tests.sh` green, run twice.

## Out of scope
BL-0157's own fix to `enforceWholeFrdTraceability` (the oracle-rewrite bug itself) — this item covers ONLY
the residual telemetry-gap and narrative-staleness symptoms that remain even once that oracle is fixed,
since a gate can in principle reach a terminal block via `apply-gate` never running through other paths too.
