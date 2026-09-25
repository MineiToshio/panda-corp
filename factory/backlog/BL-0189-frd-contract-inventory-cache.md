---
id: BL-0189
type: change
area: build-engine
title: "Cache the FRD contract inventory between gates (FRD baseline gated at SHA), behind args.gateInventoryCache"
status: done
severity: p2
opened: 2026-09-25
closed: 2026-09-25
source: "docs/proposals/38-parallel-frd-gates-and-drift-policy.md — Red-team addendum §A2 option (d) 'delta-scoped whole-FRD oracle + cached inventory' and §A6 row 6"
closes: "plugin/scripts/gate-inventory.mjs (new); pandacorp-build.js resolveInventoryCache/inventoryBlock/enforceInventoryCoverage/inventoryCandidateOf/inventoryPersistStep/recordInventoryWrite (commit 1d609548, branch gate-cost)"
links: [BL-0078, BL-0187, BL-0188, DR-078, DR-115]
---

## Problem
`WHOLE_FRD_ORACLE` makes every gate inventory EVERY normative contract of the FRD from scratch — also on
the second, third… touch of an FRD whose spec has not changed (the owner's daily `/change` pattern). D2's
frd-02 gate spent turns on `for id in AC-02-…` loops and `git log -S` archaeology. Addendum estimate
(unmeasured): −20..−30% per repeat gate, 0 on first gates.

## Design (as shipped, flag default OFF)
- **Cache file** `.pandacorp/run/gate-evidence/<frd>/inventory.json` (gitignored run-state):
  `{version:1, frd, gatedAt:<pin sha>, sources:{frd, blueprint}, writtenAt, contracts:[{contract,
  contractClass, status: pass|not-applicable|drift, tests}]}`. `sources` = sha256 of the file BODY at the
  pin (frontmatter excluded: `sync-rollups` and the BL-0178 `drift:` replica rewrite it on every landing,
  which would make the cache always miss).
- **DR-115 honest cache:** single writer = the certifying landing (`applyGate` prompt's LAST STEP runs
  `gate-inventory.mjs write`), re-derived from every GREEN gate's adjudicated traceability
  (`finalizeGate` → `inventoryCandidateOf`); no display surface reads it.
- **Integrity:** the engine sends the JSON with an FNV-1a digest; the script refuses (writes nothing) on
  a digest mismatch, invalid JSON, a missing class, an open `fail`, or a passing edge/limit without tests.
  Atomic tmp+rename. An apply that does not land keeps the candidate for the re-apply.
- **Read:** `frdGate` runs a MECH `gate-inventory:<frd>` (`gate-inventory.mjs check` → verbatim cache +
  current fingerprints at the pin); the ENGINE parses and decides. Absent → full inventory; stale
  (frd.md/blueprint.md body changed) → full inventory, logged with which doc; **malformed → logged LOUD
  (⊘, DR-078), never read as empty**, full inventory, rewritten by the next green landing.
- **Hit:** the prompt injects compact rows (`class | status | contract | tests`): deep-review the cycle
  WOs' contracts; re-run every other contract's evidence tests by path in one batch (failure/missing/
  touched code → deep review); sample ≥ 3 (or 20%) more; return EVERY cached contract. With
  `gateContextScope`, frd.md is read by section instead of whole.
- **Never shrinks the oracle:** `enforceInventoryCoverage` refuses a green verdict that drops a cached
  REQ/AC id → `traceabilityDeficient` → gateConverge's B2 re-ask, which runs WITHOUT the cache. The 7-class
  check (`enforceWholeFrdTraceability`) is unchanged. Re-gates that call `frdGateSerial` directly never
  see the cache.

## Tests
- `plugin/scripts/test-gate-inventory.mjs` (new, auto-discovered; real git repo, nested project): body
  fingerprint ignores frontmatter-only edits and changes on a body edit; read at the pin, not the working
  tree; absent → null; verbatim return; write refuses digest mismatch / missing class / open fail /
  invalid JSON and leaves the previous cache untouched; input validation; blueprint-less FRD. 24/24.
- `test-pandacorp-build.mjs` `// ---- GATE-COST ----`: `GC-L3a` flag off (0 spawns, no write step),
  `GC-L3b` miss + write step whose digest `gate-inventory.mjs`'s own `fnv1a` reproduces, `GC-L3c` hit
  (rows, (1)-(4), oracle intact, frd.md by section), `GC-L3d` a dropped cached AC is refused and re-asked
  without the cache, `GC-L3e` stale + two malformed shapes logged loud, `GC-L3g` failed apply keeps the
  candidate, `GC-L3f1-3` a REAL round trip through the script (write with quotes/backticks/`$` in the
  contract text → HIT on the next gate → STALE after a committed frd.md body edit). RED on `main`.

## Done when
- [x] Script + engine wiring behind `args.gateInventoryCache` (default off); scenarios green; 27/27 suites.
- [x] `factory/standards/build-orchestration.md` args table + section updated.

## Out of scope
- A DR for the cache (addendum A6 row 6 asks for one) and the default flip — after a repeat-gate canary
  (canary F: repeat-gate cost ≤ 70% of that FRD's first gate with an identical pass/fail traceability set).
- Delta scoping by import closure (addendum (d)'s "evidence import-closure ∩ diff = ∅"): the hit prompt asks
  the reviewer to re-run every non-cycle contract's evidence tests instead; no madge closure is computed.
- The plugin version bump/release (owner/orchestrator).
