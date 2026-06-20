---
id: WO-13-007
type: work-order
slug: foundation-banner-base
title: 'WO-13-007 — Foundation (FND-2): the one Banner (dup-fix) + base pills/surfaces/command-row'
status: DRAFT
parent: FRD-13
implementation_status: PLANNED
foundation: true
artifacts:
  - 'src/components/core/Banner/**'
  - 'src/components/core/Chip/**'
  - 'src/components/core/CountBadge/**'
  - 'src/components/core/Panel/**'
  - 'src/components/core/CmdRow/**'
  - 'src/components/core/Button/**'
  - 'src/components/core/Toast/**'
  - 'src/components/core/ProgressBar/**'
  - 'src/components/core/DocHeading/**'
source_requirements: [CMP-13-banner, CMP-13-chip, CMP-13-panel, CMP-13-cmdrow]
last_updated: '2026-06-19'
---
# WO-13-007 — Foundation (FND-2): the one Banner + base primitives (DR-057 dup-fix)

> **FOUNDATION WO (DR-057).** This WO ELIMINATES the duplicate-banner defect (the bug that started
> DR-057): `PluginSyncBanner` (FRD-15) and `OrphansBanner` (FRD-16) each re-declare an identical banner
> style block. After this WO there is **exactly one `Banner`**; FRD-15/16/03/17/18 refactor onto it.
> Source-of-truth: [`docs/design/components.md`](../../../design/components.md) §1 + ⚠ note.

## Goal
The single shared `Banner` + the base pill/surface/command-row/button primitives, on frozen tokens.

## Scope (one component per folder; tokens only — no hardcoded visuals)
- **`Banner`** — THE shared warn/info/ok/danger banner strip: left status icon + heading + detail +
  optional command row, dismissible, multi-item + collapse. Props: `tone` (warn/info/ok/danger),
  `kind` (drift/orphan/gate/error/inline), `commandRow?`, `dismissible?`, `items[]` + `collapseAfter`.
  **This is the ONLY banner in the app.** Convey state by icon+shape+text, never color alone.
- **`Chip`** — the one pill (`.chip`): `tone` (ok/warn/danger/info/accent/secondary). `frd`/`verde`/`live`
  are tone presets, NOT new components.
- **`CountBadge`** — numeric pill (decisions/bugs/proposals counts): `count`, `tone`; `tabular-nums`,
  canvas-colored numeral, 17px min. A `Chip` count preset.
- **`Panel`/`RpgPanel`** — the app-wide surface (`.panel`) + the RPG embossed override (`rpgpanel`/
  `rpggrid`); `.secondary` resting-tile variant. Props: `variant`, `grid?`, `glow?`, `spot?`, elevation.
- **`CmdRow`** — mono command row (`.cmd`): inset on canvas, `bd2` hairline, `mono` + `tabular-nums`,
  with a `CopyButton` (already real). THE command-chip primitive (aliases: docCmd/CommandChip/CommandClip).
- **`Button`** — primary/secondary/ghost, `size`, ≥44px hit area (1 primary per screen).
- **`Toast`** — transient sober bottom confirmation ("copiado"); reduced-motion. Distinct from the
  Party `AchievementToast`.
- **`ProgressBar`** — accent fill, `var(--ok)` at 100%, `done/tot · pct%`.
- **`DocHeading`** — reading heading: accent ledge + title (`docH`).

## Acceptance criteria
- ONE `Banner`; the prior `BANNER_STYLE`/`ICON_STYLE`/`CMD_ROW_STYLE` duplication does not reappear.
- Every primitive: light+dark first-class, WCAG AA, `tabular-nums` on numbers, tokens only, focus rings.
- `Banner` dismiss is keyboard-operable; `Toast`/`Banner` respect `prefers-reduced-motion`.
- Appended to `docs/design/components.md` as **real**.

## Visual reference
[`docs/design/prototype/index.html`](../../../design/prototype/index.html) — the health banners, chips,
`.panel`/`.rpgpanel`, `.cmd` rows; [`components.md`](../../../design/components.md) §1 + the ⚠ Banner note.
