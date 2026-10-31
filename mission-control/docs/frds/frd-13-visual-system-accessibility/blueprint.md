---
id: BP-13
type: blueprint
slug: visual-system-accessibility
title: 'Blueprint — FRD-13 Visual system and accessibility (v2 «Órbita»)'
status: ACTIVE
parent: FRD-13
implementation_status: VERIFIED
readiness_gate: passed 2026-10-22
grounding_gate: passed 2026-10-22
consistency_gate: passed 2026-10-22
last_updated: 2026-10-31
---

# Blueprint — FRD-13 Visual system and accessibility (v2 «Órbita»)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Per-feature blueprint (DR-049). The platform (stack, data layer, deploy, cross-cutting rules) is
> [`docs/product/architecture.md`](../../product/architecture.md) §7 (visual system, i18n and copy,
> motion and accessibility) and is not restated here. The frozen design contract sits ABOVE this
> blueprint: `docs/design/design-tokens.json`, root `DESIGN.md`, `docs/design/components.md`,
> `docs/design/microcopy.es.json` ([ADR-0012](../../adr/ADR-0012-adopt-orbita-design-system.md),
> [ADR-0013](../../adr/ADR-0013-typed-copy-accessor.md)). This blueprint defines how that contract is
> wired, enforced and retired-from-v1, never its values.

## Purpose

FRD-13 is the foundation every v2 surface stands on. It replaces the v1 pixel-RPG skin (OKLCH tokens,
Pixelify Sans, embossed panels, high-contrast layer) with the owner-approved Órbita system: a token
layer mirrored from `design-tokens.json` in two first-class themes, the three self-hosted font
families, the `Icon` set, the typed Spanish copy accessor, the theme preference with a no-flash boot,
the leaf and composite primitives of the component inventory, and, last of all, the removal of the
v1 skin once every surface is rebuilt. It owns no data and no route.

## Components & Interfaces

| ID | Kind | Name / location | Responsibility | Traces | WO |
|---|---|---|---|---|---|
| IF-13-tokens | contract | raw token layer in `src/app/globals.css` | Every `design-tokens.json` property under its own name; light on `:root`, dark on `:root[data-theme="dark"]`, theme-agnostic groups once, `overrides` rules verbatim; scene / map tokens declared once (always dark) | REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, AC-13-010.4 | WO-13-010 |
| IF-13-registry | contract | Tailwind v4 registry in `globals.css` | Tailwind namespaces resolving to the raw tokens at use time (colour, font family, font size reset to the `--fs-*` scale, radius, shadow, easing, duration); spacing on the 4 px base | REQ-13-001, REQ-13-003, REQ-13-004, AC-13-010.2 | WO-13-010 |
| CMP-13-globals | CSS | base layer of `globals.css` | Base typography, scoped tabular figures (`.tabular-nums`, `time`, table data and component numeric styles), proportional prose and `.num`/`.chip` display exceptions, focus ring, `[data-tip]` tooltip, hover gated to hover-capable pointers, `scroll-padding` for sticky bars, one reduced-motion block | REQ-13-003, REQ-13-005, REQ-13-006, REQ-13-009, AC-13-010.3 | WO-13-010 |
| CMP-13-fonts | assets + CSS | `public/fonts/`, `@font-face` | Space Grotesk, Inter, JetBrains Mono self-hosted with the prototype's rules; no `next/font` | AC-13-010.2 | WO-13-010 |
| IF-13-theme | interface | `src/lib/theme/` | `Theme`, storage key `orbita-theme`, system default, resolver, `applyTheme`, `persistTheme`, boot script (also mirrors `orbita-sidebar` for WO-19-003) | REQ-13-001 | WO-13-010 |
| IF-13-copy | interface | `src/lib/copy/` (`t`, `tRich`) | Typed accessor over the frozen catalogue; placeholders, plural selection, inline tags; Spanish accessible names come from it | REQ-13-009 (Spanish names), ADR-0013 | WO-13-010 |
| CMP-13-icon | component | `src/components/core/Icon/` | The exported SVG set as one component; decorative or labelled | REQ-13-007, REQ-13-009 | WO-13-010 |
| CMP-13-assets | assets | `public/brand/`, `public/prototype/assets/`, `public/ranks/` | Prototype art as original bytes | REQ-13-008 (sprites), ADR-0012 | WO-13-010 |
| IF-13-vocabulary | interface | `src/components/core/Chip/vocabulary.ts` | One map each for phase, work-order state and return type → tone, icon, copy key; status vs category tone split | REQ-13-002, REQ-13-007, AC-13-010.1 | WO-13-011 |
| CMP-13-leaf | components | `src/components/core/*` (leaf) | Button, Chip family, CommandBox, CopyText, Field, MoreBar, StateDot, Avatar, Ring, ProgressBar / StackBar, PhaseStepper, KeyValue, Toast, Segmented, BadgeIcon | REQ-13-002, REQ-13-003, REQ-13-007, REQ-13-008, REQ-13-009, AC-13-010.1 | WO-13-011 |
| CMP-13-composite | components | `src/components/core/*` (composite) | Card / CardHeader / CardFoot, PageHead / Crumbs, SectionHeading, Tabs, EmptyState, Notice, AlertBanner, Dialog / DialogConfirm / DialogSheet, Table, ListRow, Markdown | REQ-13-004, REQ-13-005, REQ-13-007, REQ-13-009 | WO-13-012 |
| CMP-13-retirement | change | cross-cutting deletions | Removes the v1 compatibility block, retired primitives, dead v1 code, per-agent colours, Tabler CDN, Dagre; flips `target_platforms` | REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-008 | WO-13-013 |
| (carried) | hooks | `src/components/a11y/` | `LiveRegion` (`aria-live="polite"`) and `useKeyboardNav` (arrow keys on tab strips), unchanged from v1 | REQ-13-009 | (no change) |

### Traceability (REQ → component → work order)

| REQ / AC | Components / interfaces | Work order(s) |
|---|---|---|
| REQ-13-001 few tokens, two themes, no high-contrast | IF-13-tokens, IF-13-registry, IF-13-theme, CMP-13-retirement; the visible toggle is FRD-19's CMP-19-theme-toggle | WO-13-010, WO-13-013 (WO-19-003 for the control) |
| REQ-13-002 neutral chrome | IF-13-tokens, IF-13-vocabulary, CMP-13-leaf, CMP-13-composite | WO-13-010, WO-13-011, WO-13-012 |
| REQ-13-003 tabular figures | CMP-13-globals (explicit tabular styles), IF-13-registry, CMP-13-leaf (component numeric styles; proportional `.num`/`.chip` exceptions) | WO-13-010, WO-13-011 |
| REQ-13-004 elevation and radius from tokens | IF-13-tokens, IF-13-registry, CMP-13-composite | WO-13-010, WO-13-012, WO-13-013 |
| REQ-13-005 transform/opacity motion < 300 ms | IF-13-tokens (`--dur`, `--ease`), CMP-13-globals, CMP-13-composite (dialog pop) | WO-13-010, WO-13-012 |
| REQ-13-006 reduced motion | CMP-13-globals | WO-13-010 |
| REQ-13-007 never state by colour alone | IF-13-vocabulary, CMP-13-leaf (StateDot, Chip, PhaseStepper), CMP-13-composite (Notice, EmptyState), CMP-13-icon | WO-13-011, WO-13-012 |
| REQ-13-008 agent identity by sprite or initials, roster without `guild` | CMP-13-assets (sprites), CMP-13-leaf (Avatar), `AGENT_ROLES` kept in `src/app/_design/tokens/tokens.ts`, per-role colours removed | WO-13-010, WO-13-011, WO-13-013 |
| REQ-13-009 accessibility | CMP-13-globals (focus ring, tooltip), IF-13-copy (Spanish names), CMP-13-icon, CMP-13-leaf (Ring name on focus), CMP-13-composite (Tabs keys, Dialog focus), carried a11y hooks; the skip link is FRD-19's CMP-19-skip-link | WO-13-010, WO-13-011, WO-13-012 (WO-19-002 for the skip link) |
| AC-13-010.1 | IF-13-vocabulary, CMP-13-leaf | WO-13-011 |
| AC-13-010.2 | CMP-13-fonts, IF-13-registry | WO-13-010 |
| AC-13-010.3 | CMP-13-globals | WO-13-010 |
| AC-13-010.4 | IF-13-tokens | WO-13-010 |

## Contracts

**Token contract (IF-13-tokens).** Input: `docs/design/design-tokens.json` (frozen). Output: one CSS
custom property per token, same name, same value, in the theme block the JSON puts it in. Invariants:
the JSON wins over any prose table; scene (`--scene-*`) and map (`--map-*`) tokens are never redeclared
inside a theme block; no value is invented, rounded or converted. Errors: a token missing from CSS, a
changed value or an extra Órbita-named property fails the round-trip unit test (WO-13-010).

**Registry contract (IF-13-registry).** Utilities are the only styling vocabulary for components
(tokens only, no arbitrary values, `calc()` on theme variables as the one exception, per
`docs/rules/styling-and-ui.md`). Names: Tailwind namespace + the Órbita suffix (for example
`bg-surface-2`, `text-text-3`, `border-line`, `rounded-xl`, `shadow-dialog`, `font-display`,
`text-h1`). The font-size scale is reset to the eleven `--fs-*` steps (smallest 12 px). The raw colour
tokens `--text`, `--text-2`, `--text-3` sit in Tailwind 4's `--text-*` font-size namespace, so they never
enter `@theme`: the colour registry aliases them (`--color-text-2` → `var(--text-2)`), which is what makes
`text-text-3` a colour utility. The final name table is published in WO-13-010's Status Note and is the
reference for every later WO.

**Theme contract (IF-13-theme).** `Theme = "light" | "dark"`. Resolution: stored `orbita-theme` if it is
`light` or `dark`; else the system (`prefers-color-scheme: light` → light, otherwise dark). Applying a
theme sets `<html data-theme>`; choosing one also stores it. The boot script runs in the root layout's
`<head>` before paint (never in a dynamic segment, LESSON-0166) and also mirrors `orbita-sidebar` onto
`<html data-sidebar-pref>`. Storage unavailable: the choice lasts the view; nothing throws. No other
theme value exists.

**Copy contract (IF-13-copy, ADR-0013).** `t(key, vars?) → string`; `tRich(key, vars?) → ReactNode`.
Keys typed from the catalogue (unknown key = compile error); `{name}` placeholders filled from `vars`
(missing value = thrown error); `{ one, other }` entries selected by `vars.count` with Spanish plural
rules; inline tags of a value rendered as elements, never via `innerHTML`. Shown content (documents,
descriptions, lessons, backlog items) and artifact names bypass it. A string the catalogue lacks is a
design defect reported to the ledger, never a literal (DR-130).

**Icon contract (CMP-13-icon).** `Icon({ name, size, label? })`; `name` is the union of the file stems
in `docs/design/prototype/icons/`; children identical to the files (test-guarded); decorative unless
`label`.

**Primitive contracts (CMP-13-leaf, CMP-13-composite).** Names, purposes, hooks and key props are the
rows of `docs/design/components.md`; exports are published in each WO's Status Note. Recorded decisions
of this blueprint:

- *Relocation, not renaming:* every primitive that owns tests lives in a folder named after it with a
  same-named main file (`src/components/core/Ring/Ring.tsx`, `Card/Card.tsx`, `PageHead/PageHead.tsx`,
  `Crumbs/`, `EmptyState/`, `Notice/`, `Table/`, `ListRow/`, `Field/`, `MoreBar/`, `StateDot/`,
  `CopyText/`, `PhaseStepper/`, `KeyValue/`, `Segmented/`, `BadgeIcon/`, `Icon/`), as
  `docs/rules/project-structure.md` requires; components.md lists some as single files.
- *Restyle in place keeps the v1 export:* four inventory rows are restyles of a v1 module whose export
  name differs from the canonical row name. The module and its export stay, and the canonical name is
  the concept: **Dialog = `Modal`** (`Modal/Modal.tsx`, plus new exports `DialogConfirm`, `DialogSheet`),
  **AlertBanner = `Banner`** (`Banner/Banner.tsx`), **CommandBox = `CmdRow`** (`CmdRow/CmdRow.tsx`, plus
  `CommandCompact`), **SectionHeading = `SectionHead`** (`SectionHead/SectionHead.tsx`). This avoids
  aliases and keeps reviewer tests that import the v1 names compiling.
- *Compatibility wrappers* (`CountBadge`, `TierBadge` over `Chip`; `StateBadge` keeping its icon +
  label contract; `PageTitle`, `PageLayout` over `PageHead`, with the shell owning the only main landmark) exist only for un-migrated v1 consumers
  and are deleted by WO-13-013.
- *Vocabulary (IF-13-vocabulary)* is the single source of phase, work-order-state and return-type tone,
  icon and label key (DR-115); surfaces never redefine them. The work-order-state presentation is one
  exported map consumed through `StateDot` / `Chip` by FRD-05, FRD-06 and FRD-12 (reconciliation
  2026-10-22).
- *`MoreBar` modes* (reconciliation 2026-10-22): paged (consumer `pageSize`, `step` default
  `2 × pageSize` as the prototype's `moreList`, a consumer may pass the step its FRD fixes) and
  reveal-all («Mostrar {count} más» / «Mostrar menos»); the label stays the caller's resolved catalogue
  string.
- *Dates (IF-13-copy)*: one shared Spanish formatter pair in `src/lib/copy/dates.ts` (absolute «19 oct.
  2026», relative «hoy · ayer · hace N días · hace N min»), `now` passed in; every surface uses it.

### Published additive primitive API (2026-10-30, S1A)

Existing imports and caller props remain valid; consumers may adopt these props without migrating
other callers. Canonical concepts remain `CommandBox = CmdRow`, `Dialog = Modal`.

- `Button` in `core/Button/Button`: `variant?: "default" | "primary" | "secondary" | "ghost" |
  "toned" | "danger"` (`secondary` remains a default-look compatibility value), `tone?: Tone |
  "default" | "danger"`, `size?: "sm" | "md" | "lg"`, `icon?: IconName`, `className?: string`,
  plus the existing `disabled`, `onClick`, `children`, `type`, `ariaLabel`, `data-testid`.
  Default/md is 40 px; sm is 32 px; primary inverts the neutral primary tokens; danger is outlined coral.
- `Tabs` in `core/Tabs/Tabs`: `level?: "top" | "sub"` (defaults to top),
  `tabs: readonly TabDef[]`, `active`, `onChange`, `ariaLabel?`, `testIdPrefix?`, `tabIdPrefix?`,
  `panelIdPrefix?`. Exported `TabDef` retains `id`, `label`, `icon?: string`, `count?` and adds
  `tone?: Tone`, `panelId?: string`, `disabled?: boolean`. SVG names and legacy `ti-*` icon strings
  are supported. `aria-controls` uses `panelId`, otherwise `${panelIdPrefix}${id}` only when the caller supplies `panelIdPrefix`; without either, it is omitted.
  Selection stays controlled; arrows/Home/End move focus, Enter/Space select. `SubTabs` stays exported.
- `Modal` in `core/Modal/Modal`: existing `open`, `onClose`, `title`, `testIdBase`, `ariaLabel?`,
  `badge?`, `width?`, `children` plus `tone?: Tone`, `kicker?: string`, `footer?: ReactNode`,
  `className?: string`. Native `dialog`, rendered in place; `testIdBase` hooks are preserved.
  Default width is the frozen 680 px cap. Open focuses the dialog; close restores a connected opener.
  Escape, backdrop dismissal and keyboard trapping remain supported. No caller changes required.

`PageLayout` becomes a section around `PageHead` and the existing content slot. The shell owns the
single main landmark, avoiding nested main elements during the migration (plan risk R16).

**v1 compatibility layer.** From WO-13-010 to WO-13-013, one fenced block of `globals.css` keeps the v1
token names and global classes that un-migrated v1 components read, re-pointed at the Órbita token the
frozen `.manual-live` override maps them to where one exists (v1 per-agent colours keep their values).
It never redefines an Órbita name. The Tabler CDN link lives for the same window.

## Visual spec per UI work order

| WO | Mocks and oracle states | Assets |
|---|---|---|
| WO-13-010 | `mocks/visual-system-accessibility.html` (`a11y-skip-link-focus`, `a11y-ring-tooltip-focus`: focus ring, tooltip, tabular figures, both themes); `docs/design/design-tokens.json`; `reference/css/00-fonts.css`, `01-tokens.css`, `02-base.css` | fonts and licences, brand PNG, agent sprites, courier, mascot, six Campaña zones, rank emblems, the SVG icon set |
| WO-13-011 | `docs/design/prototype/components.html` leaf rows; `a11y-ring-tooltip-focus` for `Ring`; `computed-styles.json` | none beyond WO-13-010 |
| WO-13-012 | `docs/design/prototype/components.html` composite rows; exercised by every surface's states; `computed-styles.json` | none |
| WO-13-013 | N/A (removal) | deletes unused v1 art only |

FRD-13's two oracle states render on Inicio inside the shell, so their full comparison needs WO-19-002
and FRD-18's WO-18-002; the close-out Visual QA compares them with the app in oracle mode.

## Test-side supersession (map §3.3, BL-0051)

Each WO lists its derogated tests in its body. Summary for this FRD:

- WO-13-010 rewrites the implementer tests that pin the v1 palette (`src/app/_tests/globals.css*.test.ts`).
  The v1 compatibility block keeps `src/app/_tests/agentColorTokens.integration.reviewer.test.ts`
  green until WO-13-013.
- WO-13-011 / WO-13-012 update their primitives' implementer tests; the two v1 foundation reviewer
  suites (`src/app/_design/tokens/_tests/frd13-wo06-09*`, `frd13-wo07-09*`) stay green through W1 to W4
  (the restyles in place keep the behaviour and `data-testid`s they pin; a WO that would turn one red stops
  and reports); they import the `party/*` set that FRD-04's WO-04-010 deletes in W5, so WO-04-010 `git rm`s
  them, their only ending (nothing re-blesses them) (map §3.3 rule 3; reconciliation 2026-10-22: they only probe the superseded WO-13-006..009, one
  owner, not WO-13-010 and not WO-13-013).
- WO-13-013 removes the reviewer suites whose subject it deletes and derogates the per-agent colour
  sync suite; the FRD-13 gate reviewer, in the same final wave, re-authors any surviving case.
- Visual baselines: never touched by implementers; re-blessed at the close-out Visual QA.

## Dependencies & Risks

- **Upstream:** none (FRD-13 is the root of the DAG). The frozen contract must not change during the
  build (DR-080).
- **Downstream:** every v2 work order depends, directly or transitively, on WO-13-012; FRD-19's
  WO-19-002 / WO-19-003 consume IF-13-theme, IF-13-copy, CMP-13-icon and the primitives.
- **Risk: v1 surfaces between W0 and their rebuild.** Mitigated by the v1 compatibility block, the kept
  Tabler link and restyle-in-place with optional props; v1 screens look transitional (advisory visual
  gate, DR-106) but render and test green.
- **Risk: catalogue gaps.** A string a primitive needs that the catalogue lacks is reported, not typed
  inline (callers pass resolved labels where the catalogue scopes the string to a surface, as `MoreBar`).
- **Risk: Tailwind registry naming collisions** with raw token names (`--shadow-sm`, `--font-*`):
  contract above (no self-referencing aliases), verified by the round-trip test.
- Lessons applied: LESSON-0166 (boot script in the root layout), LESSON-0216 (assets checked by bytes),
  LESSON-0310 (hover only on hover-capable pointers), LESSON-0484 (no edge stripes; status hues for
  status), LESSON-0278 (consumer count before deleting a shared helper).

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-13-010 | — | `src/app/globals.css`, `src/app/layout.tsx`, `src/app/_design/**`, `src/app/_tests/layout.theme*.test.tsx`, `src/app/_tests/globals.css*.test.ts`, `src/lib/{theme,copy}/**`, `src/components/core/Icon/**`, `public/fonts/**`, `public/brand/**`, `public/prototype/assets/**`, `public/ranks/**`, `e2e/visual-system.spec.ts` | true | W0 · WO-22-001, WO-25-001, WO-02-019 (+ legacy W0 readers) |
| WO-13-011 | WO-13-010 | `src/components/core/{Button,Chip,CountBadge,TierBadge,CmdRow,CopyButton,CopyText,Field,MoreBar,StateBadge,StateDot,Avatar,Ring,ProgressBar,PhaseStepper,KeyValue,Toast,Segmented,BadgeIcon}/**` | true | W1 · legacy W1 readers only |
| WO-13-012 | WO-13-011 | `src/components/core/{Card,PageHead,PageTitle,PageLayout,Crumbs,SectionHead,Tabs,EmptyState,Notice,Banner,Modal,Table,ListRow,Markdown}/**` | true | W2 · WO-01-010, WO-11-003 (+ legacy W2) |
| WO-13-013 | WO-01-011, WO-02-015, WO-02-016, WO-02-018, WO-02-020, WO-03-007, WO-04-011, WO-04-012, WO-05-008, WO-05-009, WO-07-006, WO-08-003, WO-08-004, WO-10-017, WO-11-004, WO-17-008, WO-18-002, WO-19-003, WO-22-002 | `src/components/core/{Panel,ItemSlot,Shield,XpBar,DocHeading,KanbanColumn,TierBadge,CountBadge,StateBadge,PageTitle,PageLayout,CelebrationSurface}/**`, `src/components/modules/ProposalsBadge/**`, `src/components/modules/Nav/navTab.ts`, `src/components/modules/GuildBar/GuildBar.tsx`, `src/components/modules/GuildBar/_tests/{GuildBar,GuildBar.embedded,wo-09-003-guildbar}.test.tsx`, `src/app/_observability/**`, `src/app/_design/**`, `src/lib/gamification/{gamification.ts,agents.ts}`, `src/lib/gamification/_tests/**`, `src/lib/pendingMerge/**`, `src/components/modules/manual-diagrams/FlowGraph.tsx`, `src/components/modules/manual-diagrams/_tests/FlowGraph.test.tsx`, `src/lib/manual/skill-flows.ts`, `src/app/manual/{ManualNavContext,ManualShell}.tsx`, `src/components/modules/FreshnessBadge/**`, `src/lib/portfolio/**`, `src/app/projects/[slug]/_components/_tests/workspace-navigation.test.tsx`, `src/app/projects/[slug]/_components/wo-detail/_tests/wo-detail.integration.test.tsx`, `src/lib/constants.ts`, `src/lib/command-modes.ts`, `src/lib/_tests/command-modes*.test.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `public/prototype/assets/**`, `package.json`, `pnpm-lock.yaml`, `README.md`, `.pandacorp/status.yaml` | false | W7 · none (alone) |

- **Order.** W0 tokens → W1 leaf primitives → W2 composite primitives (the split follows the real
  import direction: `CardHeader` uses the count chip, `Dialog` uses `Button`, `AlertBanner` hosts the
  command box) → FRD-19's W3 shell → surfaces W3..W6 → W7 retirement.
- **Disjointness.** WO-13-010's files are touched by no other W0 work order (no v2 W0 WO writes
  `package.json`, `layout.tsx` or `public/`). WO-13-011 is the only v2 WO in W1. WO-13-012's component
  folders are disjoint from WO-01-010 (`src/lib/{clock,git,config}`, env, README, `package.json`) and
  WO-11-003 (`BuildModePicker`). WO-13-013 is alone in W7.
- **Shared files (map §0.1).** `globals.css`: WO-13-010 then WO-13-013. `layout.tsx`: WO-13-010 (W0),
  WO-19-002 (W3), WO-19-003 (W6), WO-13-013 (W7). `public/**`: WO-13-010, WO-13-013.
- **Cross-FRD.** Downstream of everything: FRD-19 (WO-19-002 depends on WO-13-012), every surface FRD.
  WO-13-013 waits for the last surface WO of every FRD.

## Work Orders

Build order: WO-13-010 (W0) → WO-13-011 (W1) → WO-13-012 (W2) → … → WO-13-013 (W7). Index:
[`work-orders/README.md`](work-orders/README.md).

## Superseded (v1 history)

The v1 work orders stay on disk as history (`status: SUPERSEDED`, `implementation_status` unchanged):

- WO-13-001 token schema and key maps → WO-13-010
- WO-13-002 globals.css wiring → WO-13-010
- WO-13-003 tabular-nums and a11y primitives → WO-13-010 (`LiveRegion` and `useKeyboardNav` carried over unchanged)
- WO-13-004 ThemeToggle with high-contrast → WO-13-010, WO-19-003
- WO-13-005 StateBadge → WO-13-011
- WO-13-006 PageTitle, SectionHead, Tabs → WO-13-012
- WO-13-007 Banner and base primitives → WO-13-011, WO-13-012
- WO-13-008 RPG primitives → WO-13-011, WO-13-013
- WO-13-009 Party canvas primitives → WO-06-013 (La Fragua v2; the `party/*` set is deleted by WO-04-010)

## Readiness check (DR-100)

Every REQ-13-001..010 maps to a component above; AC-13-010.1 is owned by WO-13-011 and
AC-13-010.2..4 by WO-13-010 (no gap, no duplicate); `dependsOn` is acyclic and names only live work
orders; same-wave artifacts are disjoint by design; the foundation (WO-13-010..012) covers every
primitive of `docs/design/components.md` § Primitives and § Framing patterns; no open clarification
marker remains.
