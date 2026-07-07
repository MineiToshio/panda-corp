---
id: BL-0051
type: bug
area: build-engine
title: "Reopened-FRD WO that derogates a blessed reviewer test deadlocks the build (gate-test repair can't run before its dependent WO)"
status: open
severity: p1
opened: 2026-07-07
closed:
source: "owner/conversation — Mission Control FRD-23 SSOT split, build run wf_3215e43e-5c1 (2026-07-07)"
closes:
links: [LESSON-0002, DR-080]
---

## Problem

When a build REOPENS an FRD with a change that **derogates a contract already blessed by a reviewer gate test**, and the fix is split so that the **re-blessing lives in a WO that `dependsOn` the derogating WO**, the build **deadlocks** and stops with `blockedReasons: {<frd>: "error"}` — requiring a human to apply the gate-test repair by hand.

**Concrete evidence (Mission Control, 2026-07-07):**
- FRD-23 was reopened to fix an SSOT flaw (the per-project portada held factory-wide facts). The architect split it into **WO-23-005** (do the split — this *derogates* the old contract) and **WO-23-006** (recompose the reader + *re-bless* the chain test), with `WO-23-006 dependsOn: WO-23-005`.
- WO-23-005 built green in isolation (tsc/biome/knip/madge clean, read-model 105/106), but the FRD gate blocked it: the sole red was the **blessed** reviewer test `src/lib/achievements/read-model/_tests/aggregateChain.reviewer.test.ts` (authored/blessed in the FRD-23 VERIFIED commit `1018826d`, DR-080 forbids the implementer editing it). It asserts `expect(spy.phaseTransitions).not.toHaveBeenCalled()` for a fresh portada — the **pre-split** contract. The split intentionally derogates it (factory-wide facts left the portada, so a fresh portada MUST source them from live) → the assertion is **unsatisfiable by any correct implementation**.
- The engine correctly classified this `gate-test-defective` (BL-0001 / LESSON-0002), refused to edit the blessed test or commit over red, and **preserved the correct code** — but could NOT resolve it: WO-23-006 (which recomposes + re-blesses the chain) can't run until WO-23-005 is VERIFIED, and WO-23-005 can't be VERIFIED until the test is re-blessed. **Circular.** Run `wf_3215e43e-5c1` ended `blockedReasons: {frd-23: "error"}` after 11 agents; a human had to apply the gate-test repair (update the assertion to the split contract) and relaunch.

**Impact:** a *correct* SSOT/contract-change build stalls and needs manual intervention (a hand-edited blessed test — exactly the DR-080-sensitive action the automation is supposed to own), burning a full build pass on a `error` block. The engine did the right things individually; the plan shape made them insufficient.

## Root cause

Two compounding gaps:
1. **Planning.** When the architect/iterate engine splits a REOPENED FRD in which a WO derogates a contract that a *blessed reviewer test* encodes, it may place the re-blessing in a **dependent** WO. A blessed test that asserts the OLD contract then blocks the derogating WO, and the re-blessing WO can't run first — the dependency ordering makes the two mutually unsatisfiable.
2. **Recovery.** The `gate-test-defective` lane (BL-0001) is meant to have an independent reviewer **update the defective/stale test**, but in this shape it does not fire to completion — it blocks with `error` instead of either (a) updating the blessed test to the derogated contract, or (b) recognizing the deadlock and building the re-blessing WO in the same wave.

## Fix plan

Target both gaps (files in `plugin/`):
1. **Planning rule (prevention)** — in the architecture/iterate planning prompt (`plugin/skills/architecture/SKILL.md` + `plugin/skills/iterate/SKILL.md`, wherever WO decomposition for a reopened FRD is specified): when a WO **derogates a contract asserted by an existing blessed reviewer test**, the re-bless MUST be either (a) folded into the SAME WO as the derogation, or (b) placed in a WO that does **NOT** `dependsOn` the derogating WO (so both build in one wave and the FRD gate sees the recomposed + re-blessed chain together). Add this to the "reopened FRD / supersession" planning guidance (DR-116 already governs the doc-side supersession; this is its test-side analogue).
2. **Recovery rule (backstop)** — in the engine's gate-test-defective handling (`.claude/engines/pandacorp-build.js` recovery ladder, BL-0001 branch): when the defective red is a **blessed** test whose contract a same-FRD WO derogates, allow the gate-test-repair reviewer to **update the blessed test to the derogated contract** (independent reviewer, not the implementer — DR-080-compatible) instead of terminating with `error`. Detect the deadlock (blocked WO + a dependent WO that would re-bless) and break it rather than block.

Bump plugin semver (and `OVERLAY_VERSION` if the engine template changes); regenerate the Codex agent mirrors if any agent prompt changes.

## Tests (prove the fix — TDD, RED → GREEN)

Add a `plugin/scripts/test-pandacorp-build.mjs` scenario that reproduces the shape: a reopened FRD with (i) a WO that derogates a contract, (ii) a blessed reviewer test asserting the OLD contract, (iii) a re-blessing WO that `dependsOn` the derogating WO. **Before:** the run ends `error`-blocked. **After:** the engine either plans them un-deadlocked (same wave / no cross-dependency) OR the gate-test-repair lane updates the blessed test and the FRD verifies — **no manual intervention, no `error` block**. Keep the DR-080 guarantee: the *implementer* still never edits the blessed test; only the independent gate-test-repair reviewer does.

## Done when

- The new `test-pandacorp-build.mjs` scenario passes (RED before, GREEN after).
- The planning rule is documented in `plugin/skills/architecture/SKILL.md` (+ `iterate`), and the recovery rule in the engine.
- Plugin semver bumped (+ `OVERLAY_VERSION` if the engine/template changed); Codex mirrors regenerated if agents changed.
- LESSON-0002 back-linked (this is the deadlock-shaped sibling of the defective-gate-test case); a new lesson candidate on "reopened-FRD contract derogation must re-bless in the same wave" harvested.

## Out of scope

The DR-080 rule itself (the implementer never edits its own judge) stays — this item does NOT relax it; it routes the edit to the *independent* gate-test-repair reviewer. Does not touch the per-WO patch-first / model-escalation ladder beyond the gate-test-defective branch.
