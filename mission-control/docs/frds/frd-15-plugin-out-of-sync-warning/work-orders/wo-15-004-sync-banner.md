---
id: WO-15-004
type: work-order
slug: sync-banner
title: 'WO-15-004 — `PluginSyncBanner` onto the shared `Banner` (kind="drift")'
status: DRAFT
parent: FRD-15
implementation_status: PLANNED
artifacts:
  - 'src/app/_components/plugin-sync-banner/**'
source_requirements: [REQ-15-001, REQ-15-002, REQ-15-003, REQ-15-004, REQ-15-005]
last_updated: '2026-06-19'
---
# WO-15-004 — `PluginSyncBanner` onto the shared `Banner` (kind="drift")

> Source-of-truth: [`fdd.md`](../fdd.md) (`CMP-15-banner`, the 3 drift-reason variants, DR-057 shared
> `Banner`) · [`blueprint.md`](../blueprint.md) · [`docs/design/components.md`](../../../design/components.md)
> (`Banner`, `PluginSyncBanner` rows).
> Visual reference: `docs/design/prototype/index.html` → `pluginBanner()` (~L612), `DRIFT_REASONS`
> (~L607), shared `bBanner`/`cmdRow` (~L566/L600).

## Goal
Re-implement the read-only plugin-drift banner as the **`kind="drift"` consumer of the ONE shared
`Banner`** primitive — NOT a second banner with its own style block. It polls `/api/plugin-sync`
(VERIFIED lib + route), renders ONLY on `drift === true`, shows the reason-appropriate heading + recall
steps + copyable recovery command, and self-clears when sync is restored. This is the **DR-057
duplicate-banner dup-fix consumer**: the current `BANNER_STYLE`/`ICON_STYLE`/`CMD_ROW_STYLE`/
`RECALL_STYLE` blocks in `plugin-sync-banner.tsx` are deleted and replaced by the shared `Banner`.

## Scope
- Refactor `src/app/_components/plugin-sync-banner/plugin-sync-banner.tsx` (`"use client"`) to render
  through `Banner` (`src/components/core/Banner/Banner.tsx`, WO-13-007) with `tone="warn"` and
  `kind="drift"`. **Delete all locally re-declared banner/icon/cmd-row/recall style blocks** — the strip
  shape, the left alert-triangle icon, the hairline border and the command-row chrome all come from the
  shared `Banner`. The component contributes only the drift-specific body (heading + the 3-reason recall
  copy) and the polling loop.
- Keep the existing poll behavior: fetch `/api/plugin-sync` on mount + on an interval; render `null`
  unless `drift === true`; self-clear on the next poll that returns `drift === false` / `reason ===
  "unknown"`.
- The **3 drift-reason variants** map to `Banner` body content (`DRIFT_REASONS`): `uncommitted` ("Sin
  commitear" → commit → run → restart), `behind` ("Instalado atrasado" → run → restart), `both` (combined
  → commit → run → restart). The command is always `claude plugin update pandacorp@panda-corp`, shown via
  the shared `Banner` command row (which reuses `CmdRow` + `CopyButton`).
- **No demo toggler in the app** (DR-061): the reason is real read-only data from `getPluginSyncState()`;
  the prototype's reason-cycle toggler does not ship.

## Acceptance criteria
- **AC-15-004.1** (REQ-15-001/002) WHEN the probe returns `drift === true`, the banner renders **through
  the shared `Banner`** (`kind="drift"`) with reason-appropriate copy (uncommitted vs behind vs both).
- **AC-15-004.2** (REQ-15-004) WHEN the probe returns `drift === false` (or `unknown`), the banner renders
  nothing; a re-poll that flips to `false` removes a previously shown banner (self-clear).
- **AC-15-004.3** (REQ-15-003) The command `claude plugin update pandacorp@panda-corp` is shown via the
  shared `Banner` command row; clicking copies it to the clipboard.
- **AC-15-004.4** (REQ-15-005) The banner has NO action that executes anything — only copy + navigate;
  no fetch with a non-GET method.
- **AC-15-004.5** (DR-057) The component declares **no `BANNER_STYLE`/`ICON_STYLE`/`CMD_ROW_STYLE`/
  `RECALL_STYLE`** block of its own — it is verified as a *consumer* of `Banner`, not a re-implementation.
  A second banner shape is a reuse-before-create defect, rejected at the gate.
- **AC-15-004.6** All user-facing copy and `aria-label`s are Spanish (DR-009); state is not conveyed by
  color alone (icon + heading text, FRD-13). The rendered banner matches `pluginBanner()` in the prototype
  on the frozen tokens (visual-fidelity gate).

## Dependencies
- WO-15-001/002/003 (VERIFIED): `lib/plugin-sync` + `GET /api/plugin-sync` — the read-only verdict the
  banner polls. **Do not re-plan or re-touch these.**
- **WO-13-007** (FRD-13, foundation): the ONE shared `Banner` (+ `CmdRow`/`CopyButton`). This WO
  **consumes** it; it never re-declares a banner style.
- Cross-FRD: `frd-13`.

## Visual reference
`docs/design/prototype/index.html` → `pluginBanner()` (~L612), `DRIFT_REASONS` (~L607), the shared
`bBanner`/`cmdRow` helpers (~L566/L600), placement under the dashboard `PageTitle` per `dashboardView()`
(~L745). On the frozen tokens (`docs/design/design-tokens.json`). The engine injects the fdd + mocks +
tokens + in-loop visual fidelity + the components.md reuse check into this WO.
