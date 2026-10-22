---
id: WO-17-005
type: work-order
slug: loop-v2-fields
parent: FRD-17
title: 'WO-17-005 — Loop v2 fields & signals: trigger/applied_in in the reader, real sweep + harvest orphans in memory-health'
status: ACTIVE
foundation: false
implementation_status: VERIFIED
reopen_count: 0
difficulty: medium
artifacts: ["src/lib/memory/memory.ts", "src/lib/memory/memory-health.ts", "src/lib/memory/_tests/memory-loop-v2.test.ts", "src/lib/memory/_tests/memory-health.test.ts", "src/components/modules/MemoryHealth/MemoryHealth.tsx", "src/components/modules/MemoryHealth/_tests/memory-health.loop-v2.test.tsx", "src/app/proposals/_components/LessonDetail.tsx", "src/app/proposals/_tests/wo-17-005-lesson-detail-v2.test.tsx"]
source_requirements: [REQ-17-009]
dependsOn: [WO-17-001]
last_updated: '2026-10-22'
---

# WO-17-005 — Loop v2 fields & signals

> v2 note: kept live as history. The reader fields (`trigger`, `appliedIn`) and the health facts (`lastSweepAt`,
> `harvestOrphans`) this work order delivered stay reported by `src/lib/memory`, because FRD-17 (REQ-17-009)
> still requires them. The UI it added is superseded in v2: the `MemoryHealth` panel and its orphan banner are
> removed by WO-17-008, and `LessonDetail` no longer shows the trigger ("Úsala cuando") but keeps "Aplicada en".
> `dependsOn` was pruned of the superseded WO-17-002 and WO-17-004 (their code is still in the tree until
> WO-17-008 rewrites it). Its `memory.ts` edit (the two reader fields) comes one wave after WO-17-001's
> original file, hence the shared path in both work orders' `artifacts`.

The factory's self-learning loop v2 (panda-corp proposal 23, plugin v9.49.0, 2026-07-02) extended
the lesson schema and the loop's health signals. FRD-17's surfaces (shipped VERIFIED in June per the
v1 spec) must read the new data. Source: the queued change
`mc-frd17-propuestas-memory-health-loop-v2` (owner-ordered direct implementation, DR-097 applies).

## Scope

1. **`lib/memory` reader** (`memory.ts`): parse optional `trigger:` (string, "" when absent) and
   `applied_in:` (string[], [] when absent) into `Lesson.trigger` / `Lesson.appliedIn`. Fail-soft
   per lesson (old lessons lack them); the existing skip-on-malformed behavior is unchanged.
   `appliedIn` is a USAGE signal (which projects cited the lesson) — it does NOT feed `evalGate`
   (corroboration keeps deriving from `source`, conservative AC-17-001.5).
2. **`lib/memory/memory-health.ts`**: add `lastSweepAt: string | null` (ISO content of
   `factory/memory/_last-sweep`, the daily routine's marker; null when absent/invalid — the mtime
   proxy stays as fallback) and `harvestOrphans: string[]` (portfolio projects whose
   `.pandacorp/status.yaml` has `phase: release` but NO `last_harvest:` — a build that closed
   without harvesting). Read-only, never throws, honest-empty.
3. **UI**: `MemoryHealth` shows the real sweep date when present (replacing the "approximate" mtime
   label) and a danger banner listing harvest orphans with the fix command; raw-notes nudge
   threshold moves 10 → 20 (the loop v2 sweep threshold, `MEMORY_RAW_NOTES_THRESHOLD`).
   `LessonDetail` shows the trigger ("Úsala cuando…") and the applied-in projects row.

## v1 delivery record

Acceptance criteria as delivered in v1. They are history, not owned criteria (the FRD defines no
`AC-17-006.K`; they were work-order ids).
- v1 AC-17-006.1: a lesson with `trigger`/`applied_in` exposes them typed; one without them parses with `trigger: ""` / `appliedIn: []` (no skip, no throw).
- v1 AC-17-006.2: `memoryHealth().lastSweepAt` reflects `_last-sweep` (null honest when missing); `harvestOrphans` lists exactly the release-without-harvest projects (empty honest otherwise).
- v1 AC-17-006.3: MemoryHealth renders the orphan banner only when orphans exist; LessonDetail renders trigger/applied rows only when the data exists.
- v1 AC-17-006.4: gate green (`verify.sh`): tests, tsc, biome, knip.
