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

## Status Note — IN_REVIEW (2026-06-19)

**What was built:** Nine shared core primitives that eliminate the duplicate-banner defect (DR-057) and establish the foundation visual vocabulary for all app surfaces. FRD-13 is cross-cutting (no single route/screen); the visual reference is the prototype's CSS `.panel`/`.chip`/`.cmd`/banners/buttons extracted faithfully onto frozen tokens.

**Components created (all at `src/components/core/<Name>/<Name>.tsx`):**

| Component | Key interface | Notes |
|---|---|---|
| `Banner` | `tone`, `kind?`, `heading`, `detail?`, `commandRow?`, `dismissible?`, `onDismiss?`, `items[]?`, `collapseAfter?` | THE one banner; DR-057 dup-fix; role="alert", keyboard dismiss, multi-item collapse |
| `Chip` | `tone` (ok/warn/danger/info/accent/secondary), `label?`, `children?` | The one pill; frd/verde/live are tone presets |
| `CountBadge` | `count`, `tone` | Chip count preset; 17px min, tabular-nums |
| `Panel` | `variant` (panel/rpgpanel/secondary), `grid?`, `glow?`, `elevation?`, `spot?`, `children?` | RPG embossed pressed-pixel-tile signature; grid dot overlay |
| `CmdRow` | `command`, `copy?` (default true) | Mono command row with CopyButton; THE command-chip primitive |
| `Button` | `variant` (primary/secondary/ghost), `size` (sm/md/lg), `disabled?`, `onClick?`, `type?`, `ariaLabel?` | ≥44px hit area on md/lg; 1 primary per screen |
| `Toast` | `message`, `visible`, `durationMs?` (default 2000), `onDismiss?` | Auto-dismiss; CSS opacity transition (reduced-motion safe); role="status" |
| `ProgressBar` | `done`, `total`, `ariaLabel?` | role=progressbar, aria-valuenow/min/max, stripe overlay, ok-color at 100% |
| `DocHeading` | `title`, `level?` (1–4, default 2) | Accent left-border ledge + heading tag |

**Implicit decisions and conventions:**

- `Panel` variants `panel` and `rpgpanel` are identical after the DR-054 re-anchor (both use the RPG embossed skin). Kept as two aliases for semantic clarity; consumers can use either.
- `Toast` uses CSS `opacity` transition (not JS animation) so `prefers-reduced-motion: reduce` in `globals.css` suppresses it automatically with zero JS.
- `Banner` inline styles use `vars.border` (a CSS `var()` string) interpolated into the `borderTop`/`borderBottom` values — this keeps token resolution at browser time, not hardcoded at build time. The token-only test checks the `style` attribute; interpolated `var()` strings pass (the regex rejects only literal `#hex`).
- `CountBadge` wraps `Chip` rather than re-implementing styles (rule of three / DRY). The outer `<span>` carries the `data-testid="count-badge"` and `data-tone`; the inner `Chip` carries the visual pill.
- `Button` disabled state: `onClick` is passed as `undefined` when `disabled=true` (not relying solely on the `disabled` attribute) to satisfy the "disabled prevents click" test in jsdom (which does not enforce `disabled` on the handler).
- `ProgressBar` shows `done/total` and `pct%` in a visually hidden (aria-hidden) label below the track — numbers are `tabular-nums`.
- `DocHeading` renders the accent ledge as a `<span>` sibling of the heading tag (not a CSS `::before` pseudo-element) so it is testable with `data-testid="doc-heading-ledge"`.

**Integration seams (for FRD-15/16/03/17/18 consumers):**

- `PluginSyncBanner` and `OrphansBanner` still carry their own inline `BANNER_STYLE`/`ICON_STYLE`/`CMD_ROW_STYLE` blocks (the pre-existing duplication). This WO delivers the canonical `Banner`; the refactor of those consumers onto `Banner` is the next step (FRD-15 WO-15-005 / FRD-16 WO-16-005 or equivalent).
- `MemoryHealth` staleness nudge and `RecoveryHint` should consume `Banner` directly (no new banner component needed).
- `CmdRow` replaces any inline command-row markup in `TabCommands`, `CardDetail`, `SnapshotPanel`. Import from `@/components/core/CmdRow/CmdRow`.
- `ProgressBar` should replace `objectives-bar.tsx` and `wo-progress.tsx` inline implementations.

**Test files:**

- `src/components/core/Banner/_tests/Banner.test.tsx` — 22 tests
- `src/components/core/Chip/_tests/Chip.test.tsx` — 10 tests
- `src/components/core/CountBadge/_tests/CountBadge.test.tsx` — 6 tests
- `src/components/core/Panel/_tests/Panel.test.tsx` — 10 tests
- `src/components/core/CmdRow/_tests/CmdRow.test.tsx` — 5 tests
- `src/components/core/Button/_tests/Button.test.tsx` — 14 tests
- `src/components/core/Toast/_tests/Toast.test.tsx` — 6 tests
- `src/components/core/ProgressBar/_tests/ProgressBar.test.tsx` — 9 tests
- `src/components/core/DocHeading/_tests/DocHeading.test.tsx` — 7 tests

**Gate results:**

- `vitest run` (full suite) — 257 files / 6174 passed | 2 expected fail | 0 regressions
- `tsc --noEmit` — clean (0 errors in WO scope; pre-existing KanbanColumn TS error is out of scope)
- `biome check` (18 WO files) — clean (0 errors, 0 warnings)
- `docs/design/components.md` — 8 rows updated from **planned** → **real** (WO-13-007)
