---
id: BL-0020
type: bug
area: build-engine
title: "Engine never emits the achievement/gate Party events FRD-06 consumes — Bóveda always empty, tribunal never opens"
status: done
severity: p1
opened: 2026-07-01
closed: 2026-07-01
source: "owner/conversation — implement-speed audit (2026-07-01), phase 4: 'el Party no conecta con el build'"
closes: "producer side of Mission Control FRD-06 (REQ-06-005 trophies, REQ-06-016 toast, AC-06-004.2 gate)"
links: [BL-0002, DR-031, DR-066, DR-092]
---

## Problem
Mission Control's Party tab (FRD-06 "La Fragua") derives the Bóveda trophy shelf + the "¡Logro
desbloqueado!" toast from **`achievement`** events and the review tribunal's open state from **`gate`**
events in `~/.claude/dashboard-events.ndjson`. The engine emitted **neither** — the 13MB stream from the
personal-page-v2 build contains 47 `AgentWorking` / 304 `SubagentStop` / 281 `SupervisorTick` and **0
`achievement`, 0 `gate`**. So: trophies always empty, global done-counter stuck at 0, toast never fires,
tribunal sprite never activates — the "Party doesn't connect with the build" symptom, even though room
placement (frontmatter via `woStates`, DR-092) was already correct. The live snapshot was NOT stale (code
identical to dev; `PANDACORP_FACTORY_ROOT` correct) — this was purely a producer gap.

## Root cause
When the engine's `EMIT` telemetry was enriched (WO-06-012: `frd`/`phase`/`activity` fields), the event
**vocabulary** was never extended: only `AgentWorking` was ever generated. The two consumers that mark
COMPLETION (the FRD gate and the post-patch verifier — the only agents allowed to stamp VERIFIED) carried
no emission instruction at all.

## Fix plan
In `pandacorp-build.js`:
1. `ACHIEVEMENT(frd)` helper — one ndjson line per WO set VERIFIED (`workOrder` + `wo` top-level + `frd`,
   matching MC's `lib/events.ts` mapping) — appended by the FRD gate's success branch AND `verifyPatched`'s
   success branch (the two VERIFIED stampers).
2. `GATE_EVENT(frd)` helper — a `gate` line with top-level `frd` (the field `fragua-snapshot.ts` ~:350
   matches) — appended at `frdGate` open, alongside `review_start`.
3. Consumer-side fallback (trophies from `woStates` when no events exist — old builds / rotated streams /
   cold render) is a **Mission Control** change, filed in ITS queue:
   `mission-control/.pandacorp/inbox/changes/mc-party-trophies-frontmatter-fallback.md` (status: ready).

## Tests (prove the fix — TDD, RED → GREEN)
Empirical on the next build (the events are fire-and-forget printf lines from prompts): after an FRD
verifies, `grep '"event":"achievement"' ~/.claude/dashboard-events.ndjson` must show one line per VERIFIED
WO with `workOrder` set, and one `gate` line per FRD gate with `frd` set; the Party Bóveda renders the
trophies live. The MC-side fixture test ships with the queued MC change.

## Done when
Engine emits both events from both stampers; the MC fallback change is filed `ready` in MC's queue; plugin
MINOR + `OVERLAY_VERSION` bumped. All true as of 2026-07-01 (plugin v9.41.0, OVERLAY 8.55.0).

## Out of scope
The MC consumer change itself (built by MC's own build via its queue); renaming the engine's existing
`GateVerdict`/`ReviewVerdict` supervisor events; event-stream rotation policy.
