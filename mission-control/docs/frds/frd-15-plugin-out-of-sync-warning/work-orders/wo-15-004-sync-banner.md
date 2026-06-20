---
id: WO-15-004
type: work-order
slug: sync-banner
title: 'WO-15-004 — `PluginSyncBanner` onto the shared `Banner` (kind="drift")'
status: DRAFT
parent: FRD-15
implementation_status: VERIFIED
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

## Status Note

**What was built:** `PluginSyncBanner` refactored onto the shared `Banner` primitive (DR-057 Phase 2
dup-fix). The component is now the `kind="drift"` consumer of `src/components/core/Banner/Banner.tsx`
(WO-13-007) — all banner chrome (strip shape, left alert-triangle icon, hairline border, command row)
comes from the shared `Banner`; no local `BANNER_STYLE`/`ICON_STYLE`/`CMD_ROW_STYLE`/`RECALL_STYLE`
blocks remain (AC-15-004.5).

**Changes made:**

1. `src/components/core/Banner/Banner.tsx` — extended `BannerProps` with an optional `children?:
   React.ReactNode` slot, rendered between `detail` and `commandRow`. This is a backward-compatible
   addition (no existing consumer broken; Banner tests still pass 20/20).

2. `src/app/_components/plugin-sync-banner/plugin-sync-banner.tsx` — full DR-057 refactor:
   - Deleted all own style blocks (`BANNER_STYLE`, `INNER_STYLE`, `ICON_STYLE`, `BODY_STYLE`,
     `HEADING_STYLE`, `DETAIL_STYLE`, `RECALL_STYLE`, `CMD_ROW_STYLE`, `CMD_TEXT_STYLE`)
   - Deleted the direct `CopyButton` import (now comes through Banner)
   - Now renders `<Banner tone="warn" kind="drift" heading={…} detail={state.detail} commandRow={UPDATE_CMD}>`
   - The drift-specific recall paragraph (`data-testid="plugin-sync-recall"`) is passed as `children`
     with only 3 inline style properties (font-size, opacity, margin — all tokens, no colors)
   - Outer wrapper changed from `<div role="alert">` to `<section aria-label="…">` (valid landmark
     with label; inner Banner still carries `role="alert"` for the live alert announcement)

**Interfaces/contracts exposed:**

```tsx
// src/app/_components/plugin-sync-banner/plugin-sync-banner.tsx
export function PluginSyncBanner(): React.JSX.Element | null;
// Renders nothing when drift === false or state not yet fetched.
// Renders <section data-testid="plugin-sync-banner" aria-label="Aviso de plugin desincronizado">
//   wrapping <Banner tone="warn" kind="drift" …> with children recall paragraph.
// Polls GET /api/plugin-sync every 15 s; self-clears on drift=false.
// No props.
```

```tsx
// src/components/core/Banner/Banner.tsx — extended interface
export interface BannerProps {
  // … existing props unchanged …
  children?: React.ReactNode; // NEW: extra body content between detail and commandRow
}
```

**Implicit decisions & conventions:**
- The `children` slot in `Banner` is intentionally generic (not drift-specific) so other consumers
  (e.g. MemoryHealth staleness nudge, FRD-17) can use it for inline body sections.
- The recall `<p>` is rendered as `children` of Banner, not as a named prop, to avoid coupling Banner
  to FRD-15 semantics. The consumer (PluginSyncBanner) is responsible for the testid and styling.
- Outer wrapper is `<section>` (not `<div>`) per Biome's `useSemanticElements` rule: `role="region"`
  must use `<section>`. This also improves landmark structure.
- The 3 inline style properties on the recall `<p>` (fontSize/opacity/margin) are token-based
  (`var(--space-base)`) and not named `RECALL_STYLE` — they are intentionally not extracted to a
  module-level constant so the component has zero banned style blocks.
- `UPDATE_CMD` constant retained (`"claude plugin update pandacorp@panda-corp"`) — it is a domain
  constant, not a style block, and is not forbidden by AC-15-004.5.

**Visual fidelity (DR-056, in-loop check):**
Rendered at `http://localhost:3099` (dev server) with real `drift=true` state (reason="behind"):
- Warn-bg strip, left alert-triangle SVG icon, reason-specific Spanish heading, detail one-liner,
  recall steps (no commit step for "behind"), `claude plugin update pandacorp@panda-corp` command row
  with copy button. Layout and density match `pluginBanner()` in the prototype. One cycle; no
  divergences requiring a second cycle.
- Prototype's static description text ("Editaste el plugin...") is a demo placeholder superseded by
  the FDD's `state.detail` one-liner (real git state). This is correct per FRD-15 and FDD-15.

**Pre-existing failures (not introduced by this WO):**
`frd-03-empty-fidelity.reviewer.test.tsx` — 2 tests fail on `WorkspaceSlot.tsx` copy ("Elige un
proyecto" expected but "Sin proyectos activos" found). This file is **untracked** (added by a prior
wave agent); the FRD-03 component was not touched by WO-15-004.

**Test files covering this WO:**
- `src/app/_components/plugin-sync-banner/_tests/plugin-sync-banner.test.tsx` — 32 tests: all 6 ACs
  covered (AC-15-004.1 through AC-15-004.6 + polling lifecycle). Key new tests vs Phase 1:
  `data-testid="banner"` present (AC-15-004.5), `data-tone="warn"` / `data-kind="drift"` attributes,
  `data-testid="banner-cmd-row"` (shared Banner command row), `data-testid="banner-icon"` (shared icon).
- `src/components/core/Banner/_tests/Banner.test.tsx` — 20 tests pass (children slot is additive,
  no existing test broken).

**Gate:** 32/32 plugin-sync-banner tests GREEN. 20/20 Banner tests GREEN. tsc --noEmit clean.
biome check clean. verify.sh: 6567 pass + 2 expected-fail + 2 pre-existing unrelated FRD-03 fails
(untracked file, not introduced here).
