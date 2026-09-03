---
id: BL-0115
type: change
area: build-engine
title: "test-writer is never escalated when its paired implementer is — decide the asymmetry either way and write it down"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-09 (owner decision §12.7)"
closes:
links: []
---

## Problem
`.claude/engines/pandacorp-build.js:768` dispatches `test-writer` at `model: P.worker` **always**, while
`:770` and `:782` dispatch the implementers at `model: woModel, effort: woModel === 'opus' ? 'high' :
undefined`. So on a `difficulty:high` work order the implementer gets **both** the opus escalation and an
effort bump, and the test author gets **neither** — a *double* asymmetry. No DR or BL argues for it either
way. Impact: M. As the audit puts it, **the current silence is the actual defect.**

## Fix plan
Either (a) a one-line engine fix so tests for a hard work order get the same rigor as its code, or (b) a
one-line comment at `:768` recording the asymmetry as intentional with its reason. The owner picks
(§12.7); the item's job is to make sure one of the two is true afterwards. Cost of (a): **+$0.468 per
escalated WO**.

## Tests (prove the fix — TDD, RED → GREEN)
If (a): re-run one `difficulty:high` work order with `test-writer` escalated in step and compare the gate
outcome (first-pass rate, reopen count) against the unescalated baseline. If (b): a grep assertion that
`:768` carries the rationale comment.

## Done when
The engine either escalates `test-writer` in step with the implementer, or carries an explicit comment
saying it deliberately does not and why; `plugin/docs/decision-log.md` records the choice.

## Out of scope
Any change to `pickWorkerModel()`'s escalation triggers (that is BL-0110).
