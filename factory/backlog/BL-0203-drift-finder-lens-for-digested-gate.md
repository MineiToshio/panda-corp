---
id: BL-0203
type: change
area: build-engine
title: "digested gate: a sonnet whole-FRD drift finder whose claims go through the DR-122 proof (canary F2 build)"
status: done
severity: p1
opened: 2026-09-26
closed: 2026-09-26
source: "BL-0201 §F2; docs/reviews/canary-e2-report.md §3.2-§3.3 and §5 'An alternative worth testing'"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js (startDriftFinder, awaitDriftFinding, driftFinderBlock, mergeDriftFinderClaims, classifyFinderClaim, adjudicateDrift, gateCostEstimate) + plugin/agents/drift-finder.md — 0363d75c, docs 458d5c78"
links: [BL-0201, BL-0178, BL-0187, BL-0188, DR-015, DR-122]
---

## Problem
Canary E2 (`docs/reviews/canary-e2-report.md` §3) measured `gateEvidence:'digested'` at −62 % review cost but a
recall of 2/5 on the replay's known defects, against `explore`'s 4/5. The out-of-diff drift loss is structural:
the digested prompt caps exploration at `EVIDENCE_READ_BUDGET = 8` reads and ATTACHMENT 2 is the diff of the
reviewed WOs only, so the judge never reaches VERIFIED code. E2's gate:frd-02 and gate:frd-03 opened `phases.ts` /
`ACTIVE_PHASES` 0 times (D2 explore: 9 and 4). Lost: AC-02-010.8 (2/2 digested runs), REQ-03-001, and the lenient
`Date.parse` in `formatLastSync` (in the diff, but never exercised with the inputs V8 accepts).

## Design (as built)
- **One sonnet agent per pinned gate**: `find:drift:<frd>`, `agentType: 'pandacorp:drift-finder'` (fallback: the
  reviewer definition, still sonnet), `effort: 'medium'`, ≤ `DRIFT_FINDER_TOOL_BUDGET` (60) tool calls. Flag
  `args.driftFinder`: default on iff `gateEvidence === 'digested'`; `true` also under `explore`; `false` off; any
  other value logged and defaulted.
- **When it runs**: started in the gate's slot link beside the evidence collector (`launchEvidence` on the legacy
  slot, holding the worktree until it is done; `launchGate`; `launchGateInSlot` under `parallelGates`). The serial
  gate awaits it before spawning the judge; the split gate awaits it together with its four lenses. Only the
  pinned gate that launched it uses the report (`frdGate` drops it after; a gate on the main tree runs without it).
- **Input**: the FRD's whole roster (every WO with status and path, the VERIFIED foundation included), the planner's
  verbatim criteria of the cycle's WOs, the path of the cached inventory — never the diff or the evidence pack.
  The method (inventory every REQ/AC/CMP/IF; locate in code, not by name; compare sets/values literally — the
  `ACTIVE_PHASES` case; check input validation — the `Date.parse` case; check mounting; one probe per drift) is
  the `DRIFT_FINDER` block of `plugin/agents/drift-finder.md`, generated into the engine.
- **Output → judge**: `driftFinderBlock` shows drift claims (with probe), UNKNOWN on the cycle's contracts (MUST be
  deep-reviewed, outside the read budget, returned with non-empty `tests`), UNKNOWN elsewhere, and the
  IMPLEMENTED pointer map. The reviewer stays the judge (DR-015); `plugin/agents/reviewer.md` says how to treat it.
- **Output → engine** (`finalizeGate` → `mergeDriftFinderClaims` → `adjudicateDrift`): every provable finder drift
  (valid `*.finder.drift-probe.ts` path under this FRD, a REQ/AC id) that the judge neither recorded as `fail` nor
  refuted with a passing test of its own (listed in `testFiles`) becomes a `claim: "preexisting"` entry tagged
  `origin: 'drift-finder'`, proven by the same `drift-proof.mjs` run. `classifyFinderClaim`: preexisting → card +
  `drift:`; regression, or a reviewed-WO-owned contract failing on an assertion at the pin → reopen patch-first
  with the probe as the RED test; probe green at the pin → discarded; anything unproven → discarded with a log
  (the fail-closed side of DR-122 stays the judge's own). `driftPolicy:'block'` shows the report, merges nothing.
- **Budget**: `COST('sonnet')` = 1 unit at spawn; `gateCostEstimate` reserves it (a digested gate link ≈ 7 units).

## Expected cost (PROJECTION, not measured)
E2's sonnet agents cost ≈ 0.018-0.019 $/call (verify-patch: 19-22 calls, 0.35-0.43 $). A finder doing 40-60 calls
over a larger read context: ≈ 0.7-1.8 $ per gate, plus ≈ 0.02-0.1 $ per `drift-proof` when it claims (E1: 0.02 $).
On the E2 replay (4 FRDs): 9.26 $ + 4 × 0.7-1.8 $ + ≈ 0.1 $ ≈ 12.2-16.6 $ Σ evidence + gate + finder, under
BL-0201's 18.5 $ bar. Cache-write cost excluded (as in the E2 report). Latency: the serial judge now waits for the
finder instead of only the collector (≈ +3-6 min per gate on the critical path, partly hidden under
`parallelGates`).

## Tests
`plugin/scripts/test-pandacorp-build.mjs`, section `// ---- F2 drift finder ----` (RED → GREEN):
F2a1 (one sonnet finder, concurrent with the collector, whole roster, no diff, report in the judge prompt), F2a2
(split: concurrent with the four lenses, lenses report-free, closer gets it), F2b1-F2b6 (pre-existing → proof +
card + drift:; owned → reopen with the probe; judge refutation with its own test → no proof; probe green →
discarded; unproven → discarded, not a cycle fault; `driftPolicy:'block'` → no merge), F2c1-F2c5 (flag matrix,
invalid value, dead/malformed finder → logged fallback), F2d1-F2d2 (UNKNOWN on a cycle contract → MUST
deep-review, split and serial), F2f (a re-gate on main: no report, no second finder), F2e1-F2e3 (≈ 7 vs ≈ 6 units
reserved; MECH sites unchanged at 25, one new sonnet site; the generated block equals the agent's). WP06g now
counts the four evidence-fed lenses only. `test-preflight-version-skew.sh`: the fake full roster gains
`drift-finder` (§2c derives required agents from the engine, so it now requires it; a missing finder is a WARN,
not an oracle FAIL).

## Honest limits
- Not measured live: recall and cost are canary F2's job (BL-0201), scored on the E2 §3.2 ground truth.
- The tool budget is a prompt contract, not enforced by the engine; `toolCalls` is self-reported.
- The finder does not run its probes (another agent runs `verify.sh` in the same worktree); a probe that does not
  load is discarded by the proof, so a real drift can be lost to a broken probe.
- The judge's own pass with a pre-existing test (not one it wrote this gate) does not refute a finder claim.

## Done when
- [x] Finder built behind `args.driftFinder` with tests, RED → GREEN, engine suites green.
- [ ] Canary F2 run and scored (tracked in BL-0201).
