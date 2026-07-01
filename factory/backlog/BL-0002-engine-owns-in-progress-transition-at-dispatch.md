---
id: BL-0002
type: bug
area: build-engine
title: Engine must write IN_PROGRESS at WO dispatch (parallel waves skip it → board under-reports)
status: open
severity: p1
opened: 2026-06-30
closed:
source: LESSON-0003
closes:
links: [LESSON-0003, DR-097, DR-050]
---

**Problem:** In a parallel build wave, work orders are actively built (artifact files exist on disk) while
their `implementation_status` frontmatter still says PLANNED — implementers go PLANNED → (write artifacts)
→ IN_REVIEW, skipping the visible IN_PROGRESS phase. The board derives its column purely from
`implementation_status`, so five actively-building WOs show as "To Do" / "EN PROGRESO 0". Verified on
personal-page-v2 (run wf_b01c0efe-146): all of Wave-1's route subtrees existed ~3h in while every WO still
carried `implementation_status: PLANNED`. Violates DR-097 ("while building → IN_PROGRESS") and makes the
live board and every consumer of `implementation_status` under-report real in-flight work — the owner reads
a healthy fast build as stalled.

**Fix plan:**
1. **The ENGINE owns the IN_PROGRESS transition, atomically at dispatch — not the agent.** When the engine
   dispatches a WO to an implementer (each wave slot) it writes `implementation_status: IN_PROGRESS` +
   `last_updated: <now>` BEFORE/independent of the agent starting, and only flips it onward to IN_REVIEW on
   the agent's clean self-test. Edit `plugin/templates/shared/.claude/workflows/pandacorp-build.js` (the
   per-wave dispatch loop — set IN_PROGRESS where it spawns the implementer, symmetric to where it already
   sets IN_REVIEW).
2. **Keep the agent-side flip as belt-and-suspenders** in `plugin/agents/implementer.md`, but do not depend
   on it (§1 is the reliable fix; the engine controls dispatch timing).
3. **Optional cheap drift check:** a WO with `implementation_status: PLANNED` whose `artifacts` globs
   already match files on disk is a detectable inconsistency — surface it (doc-lint / MC "stale state" hint).

**Done when:** the engine sets IN_PROGRESS at dispatch; a parallel wave shows in-flight WOs correctly on the
board; noted as an enforcement fix of DR-097 in `factory/standards/build-orchestration.md`; plugin MINOR +
`OVERLAY_VERSION` bumped; validated with the gate canary. Then set LESSON-0003 `promotion: approved` and
back-link this item.
