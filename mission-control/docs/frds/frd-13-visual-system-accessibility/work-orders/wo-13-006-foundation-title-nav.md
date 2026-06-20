---
id: WO-13-006
type: work-order
slug: foundation-title-nav
title: 'WO-13-006 — Foundation (FND-1): cohesion title/nav set — PageTitle · SectionHead · Tabs'
status: DRAFT
parent: FRD-13
implementation_status: PLANNED
foundation: true
artifacts:
  - 'src/components/core/PageTitle/**'
  - 'src/components/core/SectionHead/**'
  - 'src/components/core/Tabs/**'
source_requirements: [CMP-13-pagetitle, CMP-13-sectionhead, CMP-13-tabs]
last_updated: '2026-06-19'
---
# WO-13-006 — Foundation (FND-1): the cohesion title/nav primitives (DR-062)

> **FOUNDATION WO (DR-057).** Built BEFORE any surface fans out. These three primitives are the
> single visual vocabulary every top-level surface and the project workspace assemble from — there is
> **one of each, everywhere** (DR-062). A bespoke per-screen title/section-header/switcher is a defect.
> Source-of-truth: [`docs/design/components.md`](../../../design/components.md) §1 ·
> [`blueprint.md`](../blueprint.md) (Build Plan).

## Goal
The three cohesion primitives, on the frozen tokens, light+dark first-class, reused by ALL surfaces.

## Scope (one component per folder; consume tokens only — no hardcoded visuals)
- **`PageTitle`** (`src/components/core/PageTitle/PageTitle.tsx`) — the ONE light page-title block:
  accent `itemslot` icon + **H1 = the nav/menu label** + optional subtitle + optional `tail` (count
  pill / status slot). **NOT a heavy panel.** Props: `icon`, `title`, `subtitle?`, `tail?`. The
  Referencia `gxHero` and the workspace's compact header delegate to / build on this — never a 2nd title.
- **`SectionHead`** (`SectionHead/SectionHead.tsx`) — the ONE section header: display-font label +
  trailing 1px rule + optional right count (`.secthead`). Props: `label`, `count?`, `icon?`, `rightHtml?`.
- **`Tabs`** + **`SubTabs`** (`Tabs/Tabs.tsx`) — the ONE tab/sub-tab pill switcher (`.tab`/`.stab`),
  with real ARIA tab semantics (`role=tablist/tab`, `aria-selected`, arrow-key nav). Props: `level`
  (top/sub), `tabs`, `active`, `onChange`. Distinct from `RailItem`/`.navitem` (don't fork those).

## Acceptance criteria
- Each primitive renders correctly in **light AND dark** with WCAG AA contrast; numbers `tabular-nums`.
- `Tabs` is keyboard-operable (arrow keys move selection, focus ring visible) and exposes tab a11y roles.
- Zero hardcoded colors/spacing/radii — only `@theme` tokens (`docs/design/design-tokens.json`).
- Appended to `docs/design/components.md` as **real** with the cited paths.

## Visual reference
The whole-app prototype [`docs/design/prototype/index.html`](../../../design/prototype/index.html)
(canonical) — the `.secthead`, `.tab`/`.stab`, and the light page-title blocks on every surface;
[`docs/design/components.md`](../../../design/components.md) §1 rows for `PageTitle`/`SectionHead`/`Tabs`.
