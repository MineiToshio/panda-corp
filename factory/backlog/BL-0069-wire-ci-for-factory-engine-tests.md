---
id: BL-0069
type: change
area: build-engine
title: "Wire a CI workflow to continuously run the factory's own engine test suite"
status: open
severity: p2
opened: 2026-07-12
closed:
source: "external-repo mining of github.com/NateBJones-Projects/ringer, 2026-07-10 (factory/decision-log.md same-date entry: 'the factory has no CI today'); confirmed live 2026-07-12 — no .github/workflows/ directory in the repo, while plugin/scripts/test-*.mjs already has 12 engine test scripts (test-pandacorp-build.mjs, test-build-state.mjs, test-runtime-switch.mjs, test-codex-enforcement.mjs, test-codex-unattended.mjs, test-codex-executor.mjs, test-engine-lease-lifecycle.mjs, test-build-run-id.mjs, test-event-transport.mjs, test-executor-contract.mjs, test-pandacorp-backlog.mjs, test-build-engine.mjs) that only ever run when an agent remembers to invoke them by hand"
closes:
links: [LESSON-0151, LESSON-0074]
---

## Problem
The factory's own engine correctness (`pandacorp-build.js` and its dozen `test-*.mjs` suites, which are
the only proof for load-bearing behavior like DR-117 recovery classes, DR-118 gate-worktree lifecycle,
DR-060 serialization, R10/R11 runtime-switch contracts) is verified ONLY when an agent or the owner
manually runs the relevant script during a change. There is no scheduled or push-triggered run. A test
that regresses between manual invocations (a machine-specific path, a drifted fixture, a date-bomb) can
sit broken indefinitely without anyone noticing, producing false assurance exactly when the engine is
touched by an unrelated change.

## Fix plan
Add a `.github/workflows/` CI workflow (or, if GitHub Actions minutes/cost is undesirable for a
public-repo solo-operator factory, a scheduled local routine analogous to `pandacorp-memory-review`/
`review-launch`) that runs the full `plugin/scripts/test-*.mjs` corpus:
1. Trigger on push to `main` touching `plugin/**` (at minimum), plus a daily/weekly schedule to catch
   environment drift even without a push.
2. Run every `test-*.mjs` script under `plugin/scripts/` and fail the job on any non-zero exit.
3. Surface a failure visibly (GitHub Actions status check, or — if run as a local scheduled routine — a
   Mission Control banner / owner-facing notification per the existing routine pattern).
4. Decide and document (owner call) whether GitHub Actions or a local scheduled routine is the vehicle —
   this item should record the choice in `factory/decision-log.md`, not assume it.

## Tests (prove the fix — TDD, RED → GREEN)
RED = today, `git push` or an unrelated engine change can land with a broken `test-*.mjs` and nothing
fails. GREEN = a deliberately broken fixture test (temporarily) causes the new CI/routine to report
failure within one trigger cycle; a passing corpus reports success.

## Done when
A CI workflow or scheduled routine runs the complete `plugin/scripts/test-*.mjs` corpus on a trigger
that does not depend on an agent remembering to invoke it by hand, failure is visible to the owner, and
the choice of vehicle (GitHub Actions vs. local scheduled routine) is recorded in a decision log.

## Out of scope
Adding NEW test coverage for currently-untested engine behavior (e.g. BL-0063's mock-worker harness) —
this item only wires a TRIGGER for what already exists.
