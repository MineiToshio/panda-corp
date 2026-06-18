---
id: WO-17-001
type: work-order
slug: memory-reader
title: WO-17-001 — `lib/memory` lesson reader
status: ACTIVE
parent: FRD-17
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-18'
---
# WO-17-001 — `lib/memory` lesson reader

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-17-memory`) · [architecture §4.6, §6](../../../product/architecture.md).

## Goal
Parse `factory/memory/LESSON-*.md` into typed `Lesson` objects (frontmatter + body), with the
`projects` list and `evalGate` derived defensively.

## Scope
- `readLessons(): Lesson[]` — read all `factory/memory/LESSON-*.md` via `gray-matter`; skip
  `_lesson-template.md`, `README.md`, `_inbox.md`.
- Map frontmatter: `id`, `type`, `domain`, `status`, `promotion`, `source`, `links`, `body`.
- Derive `projects: string[]` (distinct project names parsed from `source`/`links`).
- Derive `evalGate`: `"corroborated"` if `status === "active"` OR `projects.length >= 2`, else `"awaiting-2nd"`.

## Acceptance criteria (REQ-17-002, REQ-17-007)
- **AC-17-001.1** GIVEN fixture lessons, `readLessons` returns one `Lesson` per `LESSON-*.md`, with
  frontmatter mapped and the body captured.
- **AC-17-001.2** Templates / `README.md` / `_inbox.md` are skipped.
- **AC-17-001.3** A lesson missing optional fields (`links`, `promotion`) defaults safely
  (`promotion: "none"`, `links: []`); malformed frontmatter → that file is skipped, not a throw.
- **AC-17-001.4** `evalGate === "corroborated"` for `status: active`; `"awaiting-2nd"` for a single-project
  `status: candidate` lesson.
- **AC-17-001.5** `projects` parses ≥2 distinct projects from a multi-project `source` and, when the
  format is ambiguous, yields a conservative count (does not over-count) — anchored to LESSON-0001.

## TDD
`lib/memory.test.ts` with a fixture `factory/memory/` tree (active lesson, candidate lesson,
multi-project lesson, malformed file, template files).

## Status

**IN_REVIEW** — reconciled out of stale BLOCKED by the repair engineer (2026-06-18).

The `parseProjects` over-count bug that blocked cycle-2 (DR-015) was fixed in commit `0b4aab1`:
`parseProjects` now strips closed parentheticals, drops everything from a stray unclosed `(`
onward, and stops at the first trailing free-text prose after a slug (conservative,
AC-17-001.5). The frontmatter was never moved out of BLOCKED after that fix — it was stale, not
a live blocker. Verified now: `src/lib/memory/_tests/memory.adversarial.test.ts` cases 4 and 5
(unclosed parenthetical, trailing free text) pass; full `lib/memory` suite 74/74 green;
`.pandacorp/verify.sh` green end-to-end (205 files, 5426 tests, biome + tsc clean).

## Status Note

Built: `src/lib/memory/memory.ts` — the `lib/memory` lesson reader (IF-17-memory), foundation for
all six reviewed WOs (WO-17-002..007).

Interfaces/contracts exposed:
```ts
import { readLessons, type Lesson } from "@/lib/memory/memory";
// readLessons(): Lesson[] — reads factory/memory/LESSON-*.md via gray-matter; skips templates,
//   README.md, _inbox.md. Maps frontmatter (id/type/domain/status/promotion/source/links/body).
//   Never throws: malformed frontmatter → that file is skipped. Reads via resolveFactoryRoot()
//   (override with PANDACORP_FACTORY_ROOT for fixtures).
// Lesson.projects: string[]  — distinct projects parsed conservatively (no over-count, AC-17-001.5).
// Lesson.evalGate: "corroborated" | "awaiting-2nd" — "corroborated" when status==="active" OR
//   projects.length >= 2; else "awaiting-2nd".
```

Integration seam: WO-17-002 (`candidateLessons`/`promotionQueue`/`prunable`/`memoryHealth`)
consumes `readLessons()`; WO-17-003 (`computeSuggestions`) consumes the derived lesson views;
WO-17-004/006/007 render them. The DR-047 corroboration gate (`evalGate`) is the highest-leverage
invariant and is exercised end-to-end by the reviewer's adversarial integration test.

Tests covering it: `src/lib/memory/_tests/memory.test.ts`, `src/lib/memory/_tests/memory.adversarial.test.ts`,
and the cross-WO integration in `src/app/proposals/_tests/proposals-integration.reviewer.test.tsx`.

## Definition of done
- ACs RED → GREEN; defensive parsing; no `any`. `.pandacorp/verify.sh` green.

## Dependencies
- FRD-01 `lib/config.ts`; `gray-matter` (stack).
