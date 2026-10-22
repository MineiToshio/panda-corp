---
id: WO-13-011
type: work-order
slug: leaf-primitives
title: 'WO-13-011 — Órbita leaf primitives (buttons, chips, command box, fields, state, progress)'
status: ACTIVE
parent: FRD-13
foundation: true
implementation_status: PLANNED
blocked_reason:
difficulty: medium
reopen_count: 0
artifacts:
  - "src/components/core/{Button,Chip,CountBadge,TierBadge,CmdRow,CopyButton,CopyText,Field,MoreBar,StateBadge,StateDot,Avatar,Ring,ProgressBar,PhaseStepper,KeyValue,Toast,Segmented,BadgeIcon}/**"
source_requirements: [REQ-13-002, REQ-13-003, REQ-13-007, REQ-13-008, REQ-13-009, REQ-13-010, AC-13-010.1]
dependsOn: [WO-13-010]
last_updated: 2026-10-22
---

# WO-13-011 — Órbita leaf primitives (buttons, chips, command box, fields, state, progress)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Blueprint: [`../blueprint.md`](../blueprint.md) (CMP-13-leaf, IF-13-vocabulary). Inventory:
> [`docs/design/components.md`](../../../design/components.md) § Primitives and § Framing patterns.

## Summary

Builds or restyles in place every leaf primitive of the Órbita inventory, the building blocks the
composite primitives (WO-13-012) and every surface work order assemble from: `Button` (with
`IconButton` and `Link`), the one `Chip` family (count pill, filter chip, rarity, illustrative),
`CommandBox` (`CmdRow` + `CopyButton`, `CommandCompact`), `CopyText`, the fields (`SearchField`,
`SelectField`, `Switch`), `MoreBar`, `StateDot`, `Avatar`, `Ring`, `ProgressBar` / `StackBar`,
`PhaseStepper`, `KeyValue`, `Toast`, `Segmented`, `BadgeIcon`, plus the shared phase / work-order-state
/ return vocabulary every surface reads its tone, icon and label from. It owns the colour rule
AC-13-010.1.

## In Scope

1. **Shared vocabulary (IF-13-vocabulary)** in `src/components/core/Chip/vocabulary.ts`: the `Tone`
   union (the nine hues), the split `StatusTone` (green, amber, coral) / `CategoryTone` (blue, teal,
   violet, pink, slate, gold), and the single maps the prototype defines once: phase → tone, icon and
   copy key (Investigación teal, Producto blue, Diseño pink, Arquitectura amber, Construcción violet,
   Lanzamiento green, unknown slate), work-order state → tone, icon and copy key (todo slate `circle`,
   in progress blue `loader`, review amber `eye`, done green `check`, blocked coral `alert`), return
   type → tone. Labels come from `t()` (`common.phases.*`, `common.workOrderStates.*`,
   `common.returnTypes.*`). No surface re-derives these (DR-115). The work-order state map is exported
   as one presentation keyed by the work-order state union (`todo · in_progress · review · done ·
   blocked`, the reader's failed state mapping to `blocked`) → word key `common.workOrderStates.*`
   (`todo`, `inProgress`, `review`, `done`, `blocked`), hue slate / blue / amber / green / coral, icon `circle` / `loader` / `eye` /
   `check` / `alert`, the DESIGN.md state table) and consumed through `StateDot` and `Chip`, so FRD-05
   rows, cards and tiles, FRD-06 tokens and FRD-12 nodes keep no copy of it (REQ-05-002, AC-06-001.6,
   AC-12-004.2; LESSON-0077).
2. **Primitives**, each a typed component with a short JSDoc, tokens only (Tailwind utilities on the
   WO-13-010 registry), keeping the prototype class hooks on the root element (`.btn`, `.chip`, `.cmd`,
   `.ring`, `.bar`, `.stackbar`, `.stepper`, `.kv`, `.seg`, `.badge-icon`, `.copy-text`, `.morebtn`,
   `.field`, `.switch`, `.state-dot`, `.pav`, `#toast`) and `data-tone` where the prototype sets it:
   - `Button` (restyle, `Button/Button.tsx`): variants default, primary (inverts on
     `--primary-bg`/`--primary-fg`), ghost, toned, danger (outlined coral, never an attractive primary);
     `size` md 40 px / sm 32 px; `IconButton` 40 px square with a required Spanish `aria-label`; `Link`
     inline action. One primary per screen is a usage rule recorded in the JSDoc.
   - `Chip` family (restyle, `Chip/Chip.tsx`): 24 px, 12 px / 600, hue on `--tint-strong`; `plain`,
     `outline`, `CountPill` (beside a title, inherits `--tone`), `FilterChip` (34 px button,
     `aria-pressed`, selected = neutral `--surface-3`, never a hue), the dashed illustrative variant,
     and the rarity fold (Común … Leyenda → tone, text always shown). `CountBadge` and `TierBadge`
     become thin compatibility wrappers over `Chip` (same exports, so v1 consumers keep compiling;
     deleted by WO-13-013).
   - `CommandBox` (restyle in place: the module and export stay `CmdRow/CmdRow.tsx` / `CmdRow`, the
     blueprint records CommandBox = `CmdRow`): terminal icon, mono `code` that breaks only after «:» and
     at spaces (ids never split), 36 px copy `IconButton` whose accessible name is «Copiar <comando>»
     (`common.copy.command`), 5 % tint of the container's hue; `CommandCompact` for list rows.
     `CopyButton` (restyle) keeps its export and contract; copying raises the `Toast` with the
     catalogue's copied / clipboard-blocked messages. Mission Control never runs a command.
   - `CopyText` (new): click-to-copy text, light sweep, «Copiar» hint only on hover-capable pointers.
   - `Field` (new, `Field/Field.tsx`): `SearchField` (40 px, at most 480 px, full width on phones,
     labelled), `SelectField` (`.field` with chevron, labelled), `Switch` (`role="switch"`,
     `aria-checked`).
   - `MoreBar` (new): full-width dashed 40 px button; the caller passes the already-resolved label
     (the catalogue's «Mostrar N más · quedan M» family), so the primitive holds no copy. It also owns
     the reveal arithmetic both drawn modes need (reconciliation 2026-10-22): **paged** (default):
     `pageSize` from the consumer, each press reveals `step` more items, `step` defaulting to
     `2 × pageSize` (prototype `moreList`: «Mostrar 14 más · quedan 14» with 24 candidates at page 10,
     «Mostrar 2 más · quedan 2» at page 15), N = min(step, remaining) and M = remaining before the press,
     both handed to the caller's label; a consumer whose FRD fixes another step passes it explicitly
     (FRD-10's «Por conquistar» passes `pageSize` 12 and `step` 24: the first 12, then up to 24 per press,
     AC-10-028.3; FRD-10's phase transitions pass `step` 10, AC-10-028.5); **reveal-all**: one press shows the whole remainder
     (label «Mostrar {count} más»), then «Mostrar menos» collapses (FRD-05's Tablero,
     `workspace.observabilidad.kanban.showMore` / `showLess`, AC-05-008.3). (drawn in FRD-05's captured states)
   - `StateDot` (new): 7 px dot plus the state word (never colour alone). `StateBadge` keeps its
     export and icon-plus-label contract (the FRD-13 reviewer test pins it) and adopts Órbita styling;
     new code uses `StateDot`; WO-13-013 deletes `StateBadge`.
   - `Avatar` (restyle): project initials tile `.pav` in the phase hue (`md`); agent sprite
     (`image-rendering: pixelated`) or initials when no sprite exists (REQ-13-008).
   - `Ring` (new): conic ring 52 px (`lg` 76 px) driven by the `--p` custom property, centred
     percentage with tabular figures, green at 100 %; `role="img"` whose accessible name is the `tip`
     sentence (or the catalogue's default percentage label); with a `tip` it is focusable
     (`tabindex="0"`) and carries `data-tip`, so the global tooltip rule (WO-13-010) shows the same
     sentence on focus and, on hover-capable pointers, on hover (REQ-13-009).
   - `ProgressBar` / `StackBar` (restyle, `ProgressBar/ProgressBar.tsx`): 6 px bar in a hue; 8 px stack
     of work-order states from `{ state, count }[]`; both with a text alternative
     (`common.stackbar.item`).
   - `PhaseStepper` (new): six segments (past 55 % hue, current full hue with halo, future neutral)
     with labels, `compact` variant, per-phase tooltips and screen-reader text from
     `common.phaseSteps.*` (state by text, REQ-13-007).
   - `KeyValue` (new), `Segmented` (new; `aria-pressed` buttons, neutral selected state), `BadgeIcon`
     (new; 32 px, `sm` 26, `lg` 44), `Toast` (restyle; inverted pill, bottom centre, 2.6 s,
     `role="status"`).
3. **Restyle in place** (components.md "restyle"): a v1 component keeps its file and exported name;
   new props are optional so the un-migrated v1 consumers keep compiling until their surface WO
   rebuilds them.

Removals in this WO: none (the retired names are deleted by WO-13-013 once unreferenced).

## Out of Scope

- Composite primitives and framing patterns (`Card`, `PageHead`, `Tabs`, `Dialog`, `Table`, …:
  WO-13-012); the shell (WO-19-002); `AchievementToast` (WO-19-003).
- Migrating any consumer to the new primitives (each surface WO does it).

## Requirements & Acceptance Criteria

Delivers REQ-13-002 and REQ-13-007 at the primitive level, the tabular-figures part of REQ-13-003,
REQ-13-008's avatar rule and the accessible-name / ring parts of REQ-13-009. AC-13-010.2..4 are
WO-13-010's.

- **AC-13-010.1** — THE UI SHALL keep its chrome neutral and SHALL use hue only to carry meaning, always together with text or an icon and never as an edge stripe; green, amber and red SHALL mean status or severity only (a project's phase counts as status, the deliberate exception for phase colours).

**Fidelity criterion.** Each primitive's computed styles match its `computed-styles.json` record
(L1 exact, L2 geometry ±1 px) on the frozen tokens in both themes, and its markup keeps the recorded
class hooks; checked at close-out by the Visual QA fidelity diff, here by the component tests.

**Completeness (DR-100).** Keyboard: every interactive primitive is a native `button` / `input` /
`a`, reachable and operable by keyboard, with a visible focus ring; `FilterChip`, `Segmented`,
`Switch` expose their state through ARIA, not colour. Copy failure (clipboard blocked) shows the
catalogue's blocked toast, never silence. Touch targets 44 px by design where the inventory says so
(the drawn sub-44 px controls bind as drawn, DESIGN.md «Where the drawn prototype departs»). Reduced
motion: the copy sweep and toast entrance are transform/opacity only and switch off.

## Reuse (components.md)

Restyle in place: `Button`, `Chip` (absorbs `CountBadge`, `TierBadge`), `CmdRow` + `CopyButton`
(CommandBox), `StateBadge` → `StateDot`, `Avatar`, `ProgressBar`, `Toast`. Create (rows with status
new): `CopyText`, `Field`, `MoreBar`, `StateDot`, `Ring`, `PhaseStepper`, `KeyValue`, `Segmented`,
`BadgeIcon`. Each new primitive lives in its own folder because it owns tests (relocation of the
components.md single-file path, recorded in the blueprint). Uses `Icon`, `t()` and the tokens of
WO-13-010.

## Installs

None.

## Visual reference

- **Mock screens:** `docs/design/prototype/components.html` (the catalogue rows of every primitive
  above); `docs/frds/frd-13-visual-system-accessibility/mocks/visual-system-accessibility.html#a11y-ring-tooltip-focus`
  (the `Ring` with its focus tooltip, oracle state `a11y-ring-tooltip-focus`, drawn on FRD-18's Inicio
  cards). Measured styles: `docs/design/prototype/reference/computed-styles.json`; portable CSS by family
  `docs/design/prototype/reference/css/07-chip.css`, `08-button.css`, `09-form-field.css`,
  `10-segmented.css`, `11-progress.css`, `12-command.css`, `15-key-value.css`, `21-phase-stepper.css`.
- **Token slice:** hues and `--tone`, `--tint` / `--tint-strong`, `--surface-2/3`, `--line`,
  `--line-strong`, `--text-2/3`, `--primary-bg/fg`, `--focus`, radii `--r-xs`..`--r-md` and
  `--r-pill`, `--fs-xs`..`--fs-base`, `--font-mono`, `--shadow-toast`, `--dur`, `--ease`.
- **FDD pointer:** `docs/frds/frd-13-visual-system-accessibility/fdd.md` (Ring state, colour rules).

## Tests (owned)

Component tests with `getByRole` first, one `_tests/` folder per primitive; the existing v1 tests of
the restyled primitives are updated in the same change (behaviour that stays) or deleted (behaviour
removed).

- Vocabulary: every phase and work-order state maps to a tone, an icon and a catalogue label; status
  tones are only green / amber / coral and categories never use them (AC-13-010.1).
- AC-13-010.1 per primitive: a toned `Chip`, `StateDot`, `CountPill`, `PhaseStepper` segment and
  `BadgeIcon` always render text or an icon with an accessible name; no primitive declares a coloured
  edge border (static check over `src/components/core/**` for left/right border utilities in a hue).
- `Ring`: `getByRole("img", { name: "39 de 48 work orders verificadas" })` (the sentence drawn in
  FRD-13's ring state) is focusable and carries `data-tip`; without a tip it is not focusable.
- `CommandBox`: the copy button's name is «Copiar <comando>»; clicking copies the exact text; a blocked
  clipboard shows the blocked toast; the command breaks only at «:» and spaces.
- `FilterChip`, `Segmented`, `Switch`: state via `aria-pressed` / `aria-checked`, operable by keyboard.
- `Button`: variants and `IconButton` requires an accessible name (type-level and runtime).

### Derogated tests (map §3.3, BL-0051)

- Implementer-authored tests of the restyled primitives (`Button`, `Chip`, `CountBadge`, `TierBadge`,
  `CmdRow`, `CopyButton` incl. `CopyButton.tokens.test.tsx`, `StateBadge`, `Avatar`, `ProgressBar`,
  `Toast`): updated here where they pin v1 visuals (pixel-RPG tokens, `--color-*` names); behaviour
  assertions stay.
- Reviewer-authored, never edited: `src/app/_design/tokens/_tests/frd13-wo06-09.adversarial.reviewer.test.tsx`
  and `frd13-wo07-09.adversarial.reviewer2.test.tsx` probe the v1 foundation primitives (and the
  `party/*` set). Their ending is single: WO-04-010 (W5) `git rm`s both with the `party/*` set they import,
  and nothing re-blesses them. Until then they MUST stay green: they mostly pin behaviour and `data-testid`s
  (`banner-icon`, `progress-bar`) that a restyle in place keeps; if this restyle would turn one red, stop and
  report (other FRDs' whole-project gates in W2 to W4 would see it), never edit or weaken it.
  `frd13.integration.reviewer.test.tsx` must stay green (`StateBadge`
  keeps its contract). If a restyle cannot keep a reviewer test's import or prop shape compiling,
  stop and report rather than editing the test.

## Definition of done

- All owned tests green; `.pandacorp/verify.sh` green; no arbitrary values, no literal colours, no
  per-component shadow or radius (REQ-13-004).
- Every v1 consumer of a restyled primitive still compiles and renders (tsc + vitest green).
- Status Note lists each primitive's export, path and props (the contract the surface WOs build on).

## Dependencies

WO-13-010 (tokens, registry, `Icon`, `t()`). Consumers: WO-13-012 and every surface WO. Cites
LESSON-0484 (no edge stripes; red / amber / green for status only) and LESSON-0007 (Biome a11y:
no `aria-label` on bare spans, interactive roles need focusability).

## Status Note
