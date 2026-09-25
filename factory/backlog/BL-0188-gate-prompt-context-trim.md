---
id: BL-0188
type: change
area: build-engine
title: "Trim the FRD gate's context: a read-scope directive (args.gateContextScope) and a lossless compaction of the digested report"
status: done
severity: p1
opened: 2026-09-25
closed: 2026-09-25
source: "docs/proposals/38-parallel-frd-gates-and-drift-policy.md — Red-team addendum §A2 option (g) 'gate context hygiene' and §A6 row 4 (avg context per gate turn ≤ 100k, from 125-143k)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js gateContextScope + validateEvidence/evidenceBlock compaction; factory/standards/build-orchestration.md args table + §gate evidence (commit 1d609548, branch gate-cost)"
links: [BL-0187, BL-0189, DR-015, DR-080, DR-115]
---

## Problem
The gate is ~77% of a multi-FRD run's cost (addendum A1: D2 gate ladder 27.95 $ of 36.24 $ dedup) and a
gate's cost ≈ turns × context per turn (cache reads ~80%; 59-80 turns at 125-143k tokens/turn; bash
exploration 25-54% of turns; the frd-02 gate even read the engine source). The brief assumed the gate
prompt injects the FRD, the blueprint, every WO, lessons and standards. **Reading `frdGateSerial`,
`frdGateSplit`, `WHOLE_FRD_ORACLE` and `reviewer.md` shows it does not**: the spawn prompt is ~17k chars
of instructions (oracle, drift rule, DR-072 split, exits, telemetry printf's) and the agent body
(`reviewer.md`, 21.5k chars) is the system prompt — together ≈ 10k tokens, ~7% of a 125-143k turn. What
fills the context is what the reviewer READS by itself: for FRD-02 at the D2 pin, reading frd.md +
blueprint.md + all 9 WOs in full is 106,425 chars. In digested mode the pack IS injected, and on the
nested MC topology it carried an 18,613-char factory-noise stat (BL-0187) and a pretty-printed report.

## Fix plan (as shipped)
- `args.gateContextScope` (default **false** until canary E, per addendum A6 row 4): `gateContextScope()`
  appended to the serial gate, the 4 split finders and the closer. frd.md and this cycle's WOs in FULL
  (the oracle's source is never trimmed without a verified cache — BL-0189); the FRD's other (VERIFIED)
  WOs header-only (frontmatter + `## Status Note`); blueprint by the sections the cycle's ids hit;
  `docs/rules/*`, AGENTS.md, standards, memory as pointers; NEVER the factory/plugin/engine source; heavy
  output to `.pandacorp/run/gate-logs/` + `tail`/`grep`. It relaxes no obligation (oracle, DR-080 tests,
  7-class traceability, DR-015 judge untouched).
- `validateEvidence` keeps the parsed report and the gate renders `JSON.stringify(parsed)` (lossless).

## Measurements (all reproducible; none is a live-run measurement)
Spawn-prompt chars, reconstructed with the engine harness on an FRD-02-shaped fixture
(`projectDir` = MC, 1 cycle WO + 1 VERIFIED, the real MC gate-report.json in the pack):

| Prompt | main `4a15f4cc` | branch, flags off | branch, `gateContextScope` |
|---|---:|---:|---:|
| explore gate | 16,925 | 17,256 (+2.0%: the nested cd preamble) | 18,699 (+10.5%) |
| digested gate, REAL D2 FRD-02 pack¹ | 38,634 | **26,974 (−30.2%)** | **28,417 (−26.4%)** |
| digested collector (haiku) | 3,854 | 5,062 | 5,062 |

¹ pre-fix = the outputs the pre-fix collector commands give on `d9addc89..c575adfc` (whole-repo stat
18,613 chars, artifact patch 0 bytes); post-fix = `--relative` stat 3,405 chars + the real 3,382-byte
patch. Both runs carry the real report (pretty 1,291 → compact 805, −37.6%).
Read-set PROJECTION of the directive on the real FRD-02 docs at `c575adfc` (file sizes, not observed
reviewer behaviour): 106,425 → 62,447 chars (−41.3%): frd.md 28,374 + cycle WO 5,400 + 8 other WOs'
header+Status Note 12,004 + 3 blueprint sections 16,669.

## Tests
`test-pandacorp-build.mjs` `// ---- GATE-COST ----`: `GC-L2a` (real report: compact in the prompt, pretty
absent, 1,291 → 805, ≥30% and lossless — RED on `main`), `GC-L2b1` (default off: no directive),
`GC-L2b2` (on: every scope rule present, frd.md still READ IN FULL, oracle/no-waiver/by-path tests
intact; measures the prompt delta and bounds it ≤ 2.5k chars — RED on `main`), `GC-L2c` (split: 4 finders
+ closer carry it, closer still opus). 232/232 in the harness; the 218 pre-existing scenarios unchanged
except WP03a's MECH-site count (21 → 22, BL-0189's new `gate-inventory:` site).

## Done when
- [x] Directive behind `args.gateContextScope` (default off) + lossless compaction; scenarios green; 27/27 suites.
- [x] `factory/standards/build-orchestration.md` args table + gate-evidence section updated.

## Out of scope
- The effect on context per turn / cost (addendum target ≤ 100k tokens/turn) — NOT verifiable in the
  harness; canary E (addendum A5) measures it with the flag on, then the owner decides the default.
- Rewriting the gate's telemetry/exit text or `reviewer.md` (its §1 "run the full verify.sh" and §7 PASS
  protocol predate the review-only C2 gate; not a cost lever measured here — the prompt is ~3-4% of a turn).
- The plugin version bump/release (owner/orchestrator).
