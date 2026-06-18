---
id: WO-17-003
type: work-order
slug: self-suggest
title: WO-17-003 — `lib/self-suggest` derivations (6 kinds)
status: DRAFT
parent: FRD-17
implementation_status: IN_PROGRESS
source_requirements: []
last_updated: '2026-06-16'
---
# WO-17-003 — `lib/self-suggest` derivations (6 kinds)

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-17-suggest`, §4) · [architecture §4, §6, §7](../../../product/architecture.md).

## Goal
`computeSuggestions(): Suggestion[]` — the six local, no-Claude derivations from already-read files.
New module `lib/self-suggest.ts`.

## Scope
Each derivation is a pure function over an existing reader; `computeSuggestions` composes them.
Thresholds (bottleneck N, velocity factor, launch-review age, memory staleness) in `lib/constants.ts`.

| Kind | Derivation |
|---|---|
| `bottleneck` | ≥ N ideas in the same phase (board derivation) |
| `velocity` | a phase running ≫ portfolio median (events + `status.phase` age) |
| `unused-capability` | a skill/agent (from `lib/reference`) with zero `agent`/`session` hits in the event tail |
| `policy-friction` | a `requiere_humano:false` rule recurring in `.pandacorp/inbox/decisions.md` |
| `recurring-lesson` | a lesson with `projects.length >= 2` (from `lib/memory`) → propose promotion |
| `launch-review` | a shipped project past the age threshold → `/pandacorp:review-launch` |

## Acceptance criteria (REQ-17-004)
- **AC-17-003.1** Each of the six derivations emits a `Suggestion` (correct `kind`, `command`,
  `evidence`, optional `target`) when its rule fires, and nothing when it does not — one fixture per kind.
- **AC-17-003.2** `command` is the exact `/pandacorp:*` per the FRD: `bottleneck`→`/pandacorp:recommend`
  (or board), `policy-friction`→`/pandacorp:decide`, `recurring-lesson`→`/pandacorp:learn`,
  `launch-review`→`/pandacorp:review-launch`, memory-related → `/pandacorp:memory`.
- **AC-17-003.3** (architecture §7) No derivation calls Claude or the network — pure over the readers;
  asserted by the absence of any fetch/exec in the module.
- **AC-17-003.4** The event tail is the **capped** tail (≤200) — velocity/unused-capability never read
  the full history.
- **AC-17-003.5** `recurring-lesson` fires only at `projects.length >= 2` (never on a single-project
  guess — LESSON-0001/DR-047).
- **AC-17-003.6** All thresholds come from `lib/constants.ts` (no magic numbers).
- **AC-17-003.7** Missing inputs (no events, no projects, empty registry) → `computeSuggestions` returns
  the still-valid subset, never throws (fresh-factory tolerant).

## TDD
`lib/self-suggest.test.ts`; one fixture scenario per kind (firing + not-firing) + a fresh-factory
empty case. Drive the underlying readers with fixtures / mocks.

## Definition of done
- All six derivations RED → GREEN; thresholds centralized; no Claude/network; empty-tolerant.
  `.pandacorp/verify.sh` green.

## Dependencies
- FRD-01 `lib/status`, `lib/portfolio`; FRD-02 `lib/board`; FRD-06/12 `lib/events`;
  FRD-07 `lib/registry`, `lib/reference`; WO-17-001 `lib/memory`.
- If a reader is unshipped, stub its derivation behind it and light it up on landing (each derivation
  is independently testable).
