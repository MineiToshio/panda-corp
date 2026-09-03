---
id: BL-0115
type: change
area: build-engine
title: "test-writer is never escalated when its paired implementer is — decide the asymmetry either way and write it down"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-02
source: "docs/proposals/33-model-era-audit.md §6 R-09 (owner decision §12.7)"
closes: "the asymmetry is recorded as INTENTIONAL at the engine site with its DR-015 rationale; the silence that was the actual defect is gone"
links: [DR-015, DR-073]
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

## Resolution — 2026-09-02 (owner decision, proposal 33 §12.7)
Option **(b): keep the asymmetry, record it as INTENTIONAL.** Rationale, now written at the engine site: **DR-015 builder/verifier diversity.** When `pickWorkerModel()` escalates the implementer to opus on a `difficulty: high` or reopened work order, holding `test-writer` at the worker model is what keeps the builder and the verifier on *different* models. Escalating both in step would collapse that diversity exactly on the work orders where it is worth the most — the hard ones. The effort asymmetry follows from the same choice. It also happens to avoid +$0.468 per escalated WO, but that is not the reason.

Landed as a comment at the `test-writer` dispatch in `plugin/templates/shared/.claude/engines/pandacorp-build.js` (the canonical engine; the project overlay copy is generated from it by `/pandacorp:upgrade`). No behavior change, so no re-run baseline is needed — the "Tests" clause's branch (b) applies: the grep assertion for the rationale comment.
