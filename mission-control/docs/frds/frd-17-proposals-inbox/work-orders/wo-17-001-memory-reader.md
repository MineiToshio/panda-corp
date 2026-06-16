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

## Definition of done
- ACs RED → GREEN; defensive parsing; no `any`. `.pandacorp/verify.sh` green.

## Dependencies
- FRD-01 `lib/config.ts`; `gray-matter` (stack).
