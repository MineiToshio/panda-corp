---
id: WO-04-001
type: work-order
slug: docs-reader
title: 'WO-04-001 — `lib/docs.ts`: doc tree + raw read + comms readers'
status: DRAFT
parent: FRD-04
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-04-001 — `lib/docs.ts`: doc tree + raw read + comms readers

**Feature:** FRD-04 · **Implements:** IF-04-docs (`listProjectDocs`, `readDoc`, `readActivityLog`, `readDecisions`) · **REQ-04-003, REQ-04-004, REQ-04-006**
**Deploy unit:** `lib/docs.ts` (+ `lib/docs.test.ts`). One library module, no UI.

> This is the **whole `lib/docs.ts` reader**: the document tree + raw read, plus the activity-log and
> decisions comms readers. They share the same module, so they are built together (one WO) to avoid
> same-file collisions. The UI halves are WO-04-005 (Summary tab) and WO-04-006 (Documents tab).

## Acceptance criteria (copied)
- **AC-04-006.1** The Documents tab SHALL render the feature-centric document tree (nav) from `lib/docs.ts`.
- **AC-04-006.2** WHEN a document is selected, the Documents tab SHALL render its markdown body; the first available document is selected by default.
- **AC-04-006.3** WHEN the project has no readable documents, the Documents tab SHALL show a graceful empty state.
- **AC-04-003.2** The Summary tab SHALL render the activity log read from `.pandacorp/comms/progress.md`; WHEN the file is absent it SHALL show a graceful "no activity yet" empty state.
- **AC-04-003.3** The Summary tab SHALL render the decision points read from `.pandacorp/inbox/decisions.md`, each highlighted, with a total count badge.

## Scope
- `listProjectDocs(projectPath): DocNode[]` — discover the feature-centric tree per
  [architecture §4.5](../../../product/architecture.md#45-per-project-docs-feature-centric-dr-049---projectpathdocs-and-pandacorp):
  - Product: `docs/product/prd.md`, `docs/product/architecture.md` → group `"Product"`.
  - Per feature: `docs/frds/frd-NN-<slug>/{frd.md, fdd.md, blueprint.md}` → group `"Feature: frd-NN-<slug>"`.
  - Global: `docs/adr/*.md`, `docs/decision-log.md` → group `"Global"`.
  - Stable `id` per node; `label` = filename; `relPath` relative to project root.
- `readDoc(projectPath, relPath): string | null` — return raw markdown only for a `relPath` that
  `listProjectDocs` surfaces (validate against the discovered set — **no arbitrary traversal**);
  `null` if not found.
- `readActivityLog(projectPath): ActivityLog` — parse `.pandacorp/comms/progress.md` into a list of
  high-level entries (bullet lines / log items). Absent file → `{ entries: [] }` (no throw).
- `readDecisions(projectPath): DecisionPoint[]` — parse `.pandacorp/inbox/decisions.md` into
  `{ title, recommendation?, resolved }`. Absent file → `[]`. A pending count is derived by the
  caller as `filter(!resolved).length` (and cross-checked against `status.pending_decisions`).
- The `.pandacorp/comms/progress.md` and `.pandacorp/inbox/decisions.md` files are **Spanish,
  gitignored** owner-facing comms (architecture §4.5) — read as-is.
- **Out of scope:** markdown rendering / highlighting / UI (Summary tab WO-04-005, Documents tab
  WO-04-006), the `pending_decisions` status field (FRD-01), per-FRD work-orders discovery (FRD-05's
  `lib/work-orders.ts`).

## Dependencies
- **Intra:** none.
- **Cross:** FRD-01 `lib/config.ts` (path constants / `resolveFactoryRoot`).

## TDD (RED → GREEN → refactor)
Write `lib/docs.test.ts` first against a **fixture project tree** (point a temp dir or use
`PANDACORP_FACTORY_ROOT`-style fixtures), covering:
1. Discovers product + per-feature + global docs into the right groups (AC-04-006.1).
2. `readDoc` returns the raw markdown of a surfaced node (AC-04-006.2 default-first ordering is stable).
3. `readDoc` returns `null` for a path not in the discovered set (no traversal) (security).
4. Empty/absent `docs/` → `[]`, never throws (AC-04-006.3).
5. `readActivityLog` parses entries from a sample `progress.md` (AC-04-003.2); absent `progress.md` → `{ entries: [] }`, no throw.
6. `readDecisions` parses pending vs resolved points, with optional recommendation (AC-04-003.3); absent `decisions.md` → `[]`, no throw.

## Definition of done
- [ ] `lib/docs.test.ts` written first and green for all cases above.
- [ ] No `any`, no `@ts-ignore`; pure read-only (no `fs.write*`).
- [ ] `bash .pandacorp/verify.sh` passes (biome + tsc + vitest).
</content>
