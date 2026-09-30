---
id: BL-0214
type: change
area: build-engine
title: "two remaining model relays of machine output are unverified: the digested evidence report, and the drift finder's `implemented` snippets (no check against the pin)"
status: open
severity: p2
opened: 2026-09-30
closed:
source: "red-team of the BL-0205/0206/0209 batch (2026-09-30): follow-ups the implementers named, triaged"
closes: "plugin/runtime/engine/pandacorp-build.src.js (validateEvidence, validateDriftFinding), plugin/runtime/verify (gate-report), a new deterministic snippet checker"
links: [BL-0206, BL-0205, BL-0187, BL-0189, BL-0203]
---

## Problem
BL-0206 established that a model is not a lossless copy channel for machine output. The red-team sealed the second
relay that decides something (the BL-0189 inventory `check` line: an altered copy could be a cache HIT that silently
drops a contract; now sealed and verified, tests GC-L3h/i). Two relays remain unverified:

1. **The digested evidence report (`evidence:<frd>`, BL-0187).** The collector returns `gate-report.json` "VERBATIM"
   and `validateEvidence` only checks that it parses with a boolean `green`. A copy that lost `failures[]` rows, or
   flipped a sub-gate's `exit`, is handed to the opus judge as authoritative. Certification is NOT exposed (the judge
   must re-run `verify.sh --since` after writing its tests and the WP-08 cage reads that run), so the cost is a
   misdirected review, not a false PASS — hence p2, not p1.
2. **The drift finder's `implemented` rows (BL-0205's own "not closed").** The engine checks the HEAD the finder SAYS
   it saw; a row's `{ file, line, snippet }` is never checked against `git show <pin>:<file>`. A finder that reported
   the pin and then read the main checkout still yields a false `implemented`, which tells the digested judge not to
   look — the recall loss canary F2 measured (2 false negatives).

## Fix plan
1. `verify.sh` writes a sealed sidecar of its report (or the collector's command pipes the report through a tiny
   `seal-file.mjs` that prints `{ report, sum }`); `validateEvidence` verifies the seal and falls back to explore mode
   on a mismatch (never to a silent pass).
2. A deterministic MECH step `finder-snippets.mjs --pin <sha> --rows '<json>'` that, for every `implemented` row,
   greps the snippet in `git show <pin>:<file>` around the line; a row whose snippet is absent at the pin is
   downgraded to `unknown` (the judge must look), and 2+ misses discard the report like a wrong tree. Cost: one mech
   unit per finder gate (add it to `gateCostEstimate` and the launcher floor note).

## Tests (prove the fix — TDD, RED → GREEN)
Engine scenarios: an altered evidence report falls back to explore with a loud log; an `implemented` row whose
snippet exists only on main (F2's `formatLastSync.ts` shape) becomes `unknown` and the judge's prompt lists it under
"UNKNOWN on this cycle's contracts". Script tests against a real git fixture.

## Done when
- [ ] Neither relay can steer a gate from an altered or wrong-tree copy without a loud log.
- [ ] `run-engine-tests.sh`, `test-engine-artifact.mjs` green.

## Out of scope
The MECH relays that only carry receipts the engine already treats as advisory (the inventory `write` receipt, the
rollup sync receipts).
