---
id: BL-0176
type: bug
area: build-engine
title: "The generic \"can't pinpoint specific WOs\" gate exit hardcodes verdict:\"fail\" and skips frd_end, even when the agent classifies blocked_reason:needs-owner"
status: done
severity: p2
opened: 2026-09-25
closed: 2026-09-25
source: "canary D2 (wf_faf48b18-881), canary-d-frd02-forensics.md §7 finding H4"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js frdGateSerial/frdGateSplit generic-fail exit — F4"
links: [BL-0159]
---

## Problem
frd-02's gate blocked with `blocked_reason: 'needs-owner'`, but `dashboard-events.ndjson`/`track.jsonl`
showed `GateVerdict verdict:"fail"` and no `frd_end` ever closed the review. Cause: the "If it's broken
and you can't pinpoint specific WOs" prompt branch (`frdGateSerial`/`frdGateSplit`, two copies)
hardcoded `TRACK('review_end', ...'verdict:"fail"')` and `GATE_VERDICT(frd, 'fail')` BEFORE the agent
even chose its `blocked_reason` — so the emitted verdict category never matched what the engine
actually did with it downstream (`gateAndConverge`'s C1 branch treats `needs-owner`/`external` as a
BLOCK, never as a bare "fail"). `persistGateBlock`'s `alreadyTracked:true` (BL-0159) then suppressed a
SECOND, correct emission, assuming this branch had already emitted the right thing — it hadn't.

## Root cause
The verdict category was written as a JS-time literal (`'fail'`) instead of matching the reason the
LLM chooses at agent-runtime — the same class of gap the reopen exit already solved (BL-0159's
`GATE_VERDICT(frd, 'reopen', ',"reopened":%s', ...)` %s-placeholder pattern), just not applied here.

## Fix plan
Route this exit through the shared `emitGateOutcome(frd, 'blocked', ...)` helper (adds the missing
`frd_end` for free) with `blocked_reason` threaded as a runtime-filled `%s` placeholder — the agent
supplies the SAME value it puts in the returned `blocked_reason` field, via the printf `args`
mechanism already used elsewhere. Verdict is now consistently `"blocked"` for every terminal block,
never a bare `"fail"`.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`: `G11a` updated (no branch emits `verdict":"fail"` any more;
the generic exit's static prompt text now shows `verdict":"blocked"` + `"kind":"frd_end"`), plus a
dedicated `BL-0176a` (marker `// ---- BL-0174..0177 ----`) asserting the GateVerdict/blocked_reason %s
contract and the frd_end emission directly.

## Done when
- [x] `G11a` and `BL-0176a` are green; `G11a` confirmed RED against the pre-fix engine (its own
  original assertion required literal `verdict":"fail"` text, which the fix removes by design — the
  test itself was updated to assert the CORRECTED contract, not just re-passed by accident).
- [x] `bash plugin/scripts/run-engine-tests.sh` green (173/173).
- [x] Shipped in the same release batch as BL-0174/0175/0177 (plugin 9.109.0).

## Out of scope
Auditing every OTHER hand-rolled review_end/GateVerdict emission in the engine for the same class of
staleness — this item only closes the one call site canary D2's forensics found live.
