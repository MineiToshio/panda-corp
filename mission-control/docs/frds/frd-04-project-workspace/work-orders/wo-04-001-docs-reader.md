# WO-04-001 — `lib/docs.ts`: project document tree + raw read

**Feature:** FRD-04 · **Implements:** IF-04-docs (`listProjectDocs`, `readDoc`) · **REQ-04-006**
**Deploy unit:** `lib/docs.ts` (+ `lib/docs.test.ts`). One library module, no UI.

## Acceptance criteria (copied)
- **AC-04-006.1** The Documents tab SHALL render the feature-centric document tree (nav) from `lib/docs.ts`.
- **AC-04-006.2** WHEN a document is selected, the Documents tab SHALL render its markdown body; the first available document is selected by default.
- **AC-04-006.3** WHEN the project has no readable documents, the Documents tab SHALL show a graceful empty state.

> This WO covers the **reader half** (AC-04-006.1 discovery, AC-04-006.2 body, AC-04-006.3 empty set).
> The UI half is WO-04-006.

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
- **Out of scope:** `.pandacorp/` comms readers (WO-04-002), markdown rendering (UI, WO-04-006),
  per-FRD work-orders discovery (FRD-05's `lib/work-orders.ts`).

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

## Definition of done
- [ ] `lib/docs.test.ts` written first and green for all cases above.
- [ ] No `any`, no `@ts-ignore`; pure read-only (no `fs.write*`).
- [ ] `bash .pandacorp/verify.sh` passes (biome + tsc + vitest).
