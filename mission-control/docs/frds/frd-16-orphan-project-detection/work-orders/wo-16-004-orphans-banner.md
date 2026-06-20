---
id: WO-16-004
type: work-order
slug: orphans-banner
title: 'WO-16-004 — `OrphansBanner` onto the shared `Banner` (kind="orphan")'
status: DRAFT
parent: FRD-16
implementation_status: PLANNED
artifacts:
  - 'src/app/_components/orphans-banner/**'
source_requirements: [REQ-16-001, REQ-16-002, REQ-16-003, REQ-16-004, REQ-16-005, REQ-16-006]
last_updated: '2026-06-19'
---
# WO-16-004 — `OrphansBanner` onto the shared `Banner` (kind="orphan")

> Source-of-truth: [`fdd.md`](../fdd.md) (`CMP-16-banner`, `CMP-16-steps`, DR-057 shared `Banner`) ·
> [`blueprint.md`](../blueprint.md) · [`docs/design/components.md`](../../../design/components.md)
> (`Banner`, `OrphansBanner` rows).
> Visual reference: `docs/design/prototype/index.html` → `orphanBanner()` (~L633), `ORPHANS` (~L627),
> shared `bBanner`/`cmdRow` (~L566/L600).

## Goal
Re-implement the orphan/unlisted-project banner as the **`kind="orphan"` consumer of the ONE shared
`Banner`** primitive — multi-item, dismissible, with overflow collapse — NOT a second banner with its
own style block. It polls `/api/orphans` (VERIFIED lib + route), lists ONLY `.pandacorp/`-marked
projects (orphan → `/pandacorp:adopt`; unlisted → `/pandacorp:sync-portfolio`), remembers dismissals
client-locally, and self-clears when a candidate is reconciled. This is a **DR-057 duplicate-banner
dup-fix consumer**: the current `BANNER_STYLE`/`ICON_STYLE`/`CMD_ROW_STYLE`/`RECALL_STYLE` blocks in
`orphans-banner.tsx` are deleted and replaced by the shared `Banner`.

## Scope
- Refactor `src/app/_components/orphans-banner/orphans-banner.tsx` (`"use client"`) to render through
  `Banner` (`src/components/core/Banner/Banner.tsx`, WO-13-007) with `tone="warn"`, `kind="orphan"`,
  `dismissible`, and the multi-item + `collapseAfter` affordance. **Delete the locally re-declared
  banner/icon/cmd-row/recall style blocks** — the strip shape, folder-question icon, hairline border,
  command-row chrome and the collapse/dismiss affordances all come from the shared `Banner`. The
  component contributes only the orphan-specific per-item body (name + case `Chip` + path `code` + recall)
  and the polling/dismiss logic.
- Keep the existing behavior: poll `/api/orphans` on mount + interval; one item per candidate; dismissal
  persisted in `localStorage` keyed by absolute `path` (client-local UI state — NOT a factory write);
  self-clear when a candidate disappears from the probe (adopted/reconciled); empty list → render nothing.
- **Marker gate (REQ-16-001):** the banner lists **only `.pandacorp/`-marked folders** — foreign folders
  (personal code, other-AI projects) NEVER appear. This is enforced by the VERIFIED `lib/orphans` scan;
  the banner must not widen it.
- Per `kind`: `orphan` → "sin adoptar" chip + `/pandacorp:adopt` recall; `unlisted` → "falta en
  portfolio" chip + `/pandacorp:sync-portfolio` recall. Case is signaled by icon+text chip, not color
  alone.
- **Overflow collapse (REQ-16-003.2):** more than two candidates → show the first two + a "Ver N
  proyecto(s) más" / "Ver menos" toggle, via the shared `Banner` collapse — so orphans don't dominate the
  dashboard (the wall-of-banners regression).

## Acceptance criteria
- **AC-16-004.1** (REQ-16-001/002) WHEN the probe returns an `orphan`, the banner (through the shared
  `Banner`, `kind="orphan"`) shows the name, path, and the `/pandacorp:adopt` steps.
- **AC-16-004.2** (REQ-16-002) WHEN the probe returns `unlisted`, the banner shows `/pandacorp:sync-portfolio`
  (NOT adopt), tagged "falta en portfolio".
- **AC-16-004.3** (REQ-16-001) Only `.pandacorp/`-marked candidates are rendered; a foreign folder is never
  shown (the scan's marker gate is respected; the banner does not re-classify).
- **AC-16-004.4** (REQ-16-004) "Descartar" hides that item and persists the dismissal across refresh
  (localStorage by path); a candidate that disappears from the probe (adopted) is gone on next poll
  (self-clear).
- **AC-16-004.5** (REQ-16-003.2) More than two candidates → first two + a "Ver N más" / "Ver menos"
  toggle via the shared `Banner` collapse.
- **AC-16-004.6** (REQ-16-005) No action executes anything — copy/dismiss/navigate only; no non-GET fetch.
- **AC-16-004.7** (DR-057) The component declares **no `BANNER_STYLE`/`ICON_STYLE`/`CMD_ROW_STYLE`/
  `RECALL_STYLE`** block of its own — verified as a *consumer* of `Banner`, not a re-implementation. Empty
  list → renders nothing (no empty shell).
- **AC-16-004.8** Spanish copy + `aria-label`s (DR-009); case signaled by icon+text chip, not color alone
  (FRD-13). The rendered banner matches `orphanBanner()` in the prototype on the frozen tokens
  (visual-fidelity gate).

## Dependencies
- WO-16-001/002/003 (VERIFIED): `lib/orphans` bounded marker-gated scan + classify + `GET /api/orphans`.
  **Do not re-plan or re-touch these.**
- **WO-13-007** (FRD-13, foundation): the ONE shared `Banner` (+ `Chip`/`CmdRow`/`CopyButton`). This WO
  **consumes** it; it never re-declares a banner style.
- Cross-FRD: `frd-13`.

## Visual reference
`docs/design/prototype/index.html` → `orphanBanner()` (~L633), `ORPHANS` (~L627), shared `bBanner`/`cmdRow`
(~L566/L600), placement under the dashboard `PageTitle` per `dashboardView()` (~L745). On the frozen
tokens (`docs/design/design-tokens.json`). The engine injects the fdd + mocks + tokens + in-loop visual
fidelity + the components.md reuse check into this WO.
