---
id: WO-13-011
type: work-order
slug: leaf-primitives
title: 'WO-13-011 — Órbita leaf primitives (buttons, chips, command box, fields, state, progress)'
status: ACTIVE
parent: FRD-13
foundation: true
implementation_status: IN_REVIEW
difficulty: medium
reopen_count: 0
artifacts:
  - "src/components/core/{Button,Chip,CountBadge,TierBadge,CmdRow,CopyButton,CopyText,Field,MoreBar,StateBadge,StateDot,Avatar,Ring,ProgressBar,PhaseStepper,KeyValue,Toast,Segmented,BadgeIcon}/**"
source_requirements: [REQ-13-002, REQ-13-003, REQ-13-007, REQ-13-008, REQ-13-009, REQ-13-010, AC-13-010.1]
dependsOn: [WO-13-010]
last_updated: 2026-10-30
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

### 2026-10-30 — S1A round 2 review patches

- CopyButton delegates toast presentation when `onResult` is supplied; standalone copying keeps its
  internal success/failure toast. Toast instances now have unique HTML ids and retain `data-testid="toast"`.
- CommandBox inserts a break after every colon and protects hyphenated identifiers with non-wrapping
  spans while copying the original string. Neutral command frames use `--bg-2`; explicit hues retain
  the tint. CommandCompact supplies CSS variables for its 32 px frame, 6 px gap, `--r-sm`, `--fs-xs`
  and 26 px copy/mode controls, so inline styles no longer override the compact presentation.
- TierBadge is a thin Chip wrapper using the shared rarity hues, preserving tier/name/ARIA hooks and
  replacing the 9 px pixel text with the Chip's `--fs-xs`. ProgressBar's default track is 6 px with v2
  surface/radius/hue/type tokens and no stripes; its progress semantics and labels remain.
- No commits, staging, merges, pushes, merge queue, reviewer-test edits or baseline changes.

- Verification from `mission-control/`, with `export PORT=3941 PANDACORP_E2E_PORT=3941`:
  - `pnpm exec tsc --noEmit --project /private/tmp/mission-control-s1a-round2.tsconfig.json` passed.
    This temporary config extends this checkout's tsconfig, includes the eight affected core folders
    and their tests, vitest.setup.ts and installed Next CSS declarations; it is not a whole-app check.
  - `git diff --name-only --relative -- src/components/core | xargs pnpm exec biome check` passed
    (11 changed source/style files); `git diff --check` passed.
  - `pnpm exec vitest run src/components/core/{Tabs,Modal,CmdRow}/_tests/*.s1a.reviewer.test.tsx src/components/modules/BuildModePicker/_tests/BuildModePicker.reviewer.test.tsx --maxWorkers=2 --reporter=dot`
    passed: 36 tests, four files, including all eight new S1A reviewer tests.
  - `pnpm exec vitest run src/components/core/{CmdRow,CopyButton,Toast,TierBadge,ProgressBar,Tabs,Modal,Banner} --maxWorkers=2 --reporter=dot`
    passed: 169 tests, 18 files. This includes the restored stable Toast test hook; an earlier broad
    run caught the temporary accidental change to that hook before its restoration.
  - `pnpm exec vitest related src/components/core/{CmdRow/CmdRow.tsx,CopyButton/CopyButton.tsx,Tabs/Tabs.tsx,Modal/DialogConfirm.tsx,Toast/Toast.tsx,TierBadge/TierBadge.tsx,ProgressBar/ProgressBar.tsx,Banner/Banner.module.css,Modal/Dialog.module.css,Tabs/Tabs.module.css,CmdRow/CmdRow.module.css} --run --maxWorkers=2 --reporter=dot`
    completed with 2435 passed / 2 failed tests in 190 files before the final progress compatibility
    correction. Failures: `src/app/proposals/_tests/proposals-page.test.tsx:319` requires a standalone
    main landmark (B1, explicitly outside S1A); the unchanged legacy reviewer2 test requires the
    `--color-ok` completion token. ProgressBar now uses `var(--green, var(--color-ok))`, preserving
    the v2 hue with a legacy fallback. The full related suite was not repeated after this correction.
  - `pnpm exec vitest related src/components/core/ProgressBar/ProgressBar.tsx --run --maxWorkers=2 --reporter=dot`
    passed after the final correction: 140 tests, four files, including the unchanged reviewer2 test.
  - Node localStorage, legacy test act() and manual derivation warnings were emitted. B1 remains red.
    No full verify.sh, browser/Playwright, phone computed-style measurement, theme visual check or
    pixel/fidelity gate was run. Reviewer tests and blessed visual baselines are unchanged.


### 2026-10-30 — S1A completion (supersedes the deferred-restyle assumption below)

- Completed `Button/Button.tsx`: additive `variant` default/primary/secondary/ghost/toned/danger,
  `tone` hue/default/danger, `size` sm/md/lg, `icon`, `className`; existing event, type, disabled,
  accessible-label and test-id props remain. 40 px md, 32 px sm, neutral inverted primary and outlined
  coral danger. Root hooks are `btn`, variant and size. The old `pc-btn` hook is retired here because
  its compatibility CSS forces the v1 glow and filled-danger hover with `!important`; no caller edits.
  `Button/IconButton.tsx` additionally accepts `data-testid` for the native dialog close action.
- `CmdRow/CmdRow.tsx` is CommandBox (no second implementation or alias). `variant="box"` renders a
  terminal SVG, token-based 5% container hue, code that wraps at the first colon and spaces, a 36 px
  copy control named through `common.copy.command`, and preserves every mode-selection prop/callback.
  Additive `tone?: Tone`. The default compact v1 span retains its selectable/ellipsis contract for
  the kept reviewer probes. New `CommandCompact(props: Omit<CmdRowProps, "variant">)` composes it for
  list rows. Long unbroken identifiers in the box scroll rather than split.
- `CopyButton/CopyButton.tsx` preserves its props and two-second button confirmation/in-flight guard;
  success and failure now raise the shared `Toast` using the frozen catalogue. Pending results do
  not update an unmounted control. `Toast/Toast.tsx` keeps its props, uses inverted primary tokens,
  `#toast`, a 2.6-second default duration and message-sensitive dismissal independent of callback identity.
- `Avatar/Avatar.tsx` keeps agentId/size/test-suffix, adds optional name/initials/label/tone and makes
  agentId optional for project tiles. Project default is md (36 px); initials inherit the phase hue.
  Known agent sprites stay pixelated; unknown or failed sprites show initials rather than another role.
- Published the Button/Tabs/Modal API in blueprint §Published additive primitive API before coding
  the implementations. Attempted the required contract-first commit, but Git could not create
  `/Users/Shared/Proyectos/panda-corp/.git/worktrees/orch-s1a/index.lock` (`Operation not permitted`).
  No commit, merge, push or merge queue was performed; this remains an external handoff limitation.
- Verification from `mission-control/`, with `PORT=3941` and `PANDACORP_E2E_PORT=3941`:
  `pnpm exec tsc --noEmit --project /private/tmp/mission-control-s1a.tsconfig.json` passed. The temporary
  config extends this checkout's tsconfig, includes only the twelve touched core folders and their
  tests plus vitest.setup.ts, and loads installed Next CSS declarations and Node types; this checkout
  has no generated next-env.d.ts. It does not scan every app route.
  `pnpm exec biome check src/components/core/{Button,CmdRow,CopyButton,Toast,Avatar,Tabs,SectionHead,Banner,Modal,Markdown,PageTitle,PageLayout}`
  passed (52 files). `pnpm exec vitest run src/components/core/{Button,CmdRow,CopyButton,Toast,Avatar,Tabs,SectionHead,Banner,Modal,Markdown,PageTitle,PageLayout} --maxWorkers=2 --reporter=dot`
  passed (224 tests, 22 files). Includes unchanged header-marked CopyButton reviewer probes and native
  Modal focus reviewer tests. Node localStorage and legacy clipboard-test act() warnings were emitted.
  No full verify.sh, cross-surface suites, browser, Playwright or computed-style/fidelity verification
  was run, as explicitly scoped by S1A. Reviewer tests and visual baselines were not modified.

### Prior build record (superseded where the completion above differs)

**Built (extend in place, new folders for new primitives).** Styling for the hue-tinted primitives lives in a CSS module per folder that mirrors the prototype's reference CSS on the raw tokens (`color-mix(... var(--tint-strong) ...)` cannot be expressed as registry utilities); hover is gated in `@media (hover: hover)`; prototype class hooks (`chip`, `seg`, `ring`, `stepper`, `kv`, `copy-text`, `morebtn`, `field`, `switch`, `state-dot`, `badge-icon`, `bar`, `stackbar`) are on the root elements and `data-tone` sets `--tone` (rules from WO-13-010).

**Exports and contracts.**
- `Chip/vocabulary.ts`: `Tone`, `StatusTone` (green, amber, coral), `CategoryTone`, `isTone`, `PHASES`/`Phase`, `PHASE_PRESENTATION`, `phasePresentation(id)`, `WORK_ORDER_STATES`/`WorkOrderState` (`todo|in_progress|review|done|blocked`), `WORK_ORDER_STATE_PRESENTATION`, `statePresentation(state)`, `RETURN_PRESENTATION`, `RARITY_TONE`; every entry is `{ tone, icon, labelKey }` (labelKey is a `CopyKey`; call `t(labelKey)`). Unknown phase / state fall back to neutral slate «Sin fase» / «Sin estado».
- `Chip` (`Chip/Chip.tsx`): `tone` is now a v1 tone OR a `Tone` hue; new optional `variant: "tint"|"outline"|"plain"|"dashed"` and `icon: IconName` (hue tones only). v1 tones render exactly as before. `CountPill({ count })`, `FilterChip({ pressed, onClick, children })` in the same folder.
- `Button/IconButton.tsx` `IconButton({ icon, label, onClick?, disabled? })` (throws on an empty label), `Button/ButtonLink.tsx` `ButtonLink({ href, children, look?: "inline"|"button" })`.
- `StateDot({ state })`, `Ring({ percent, size?: "md"|"lg", tone?, tip? })` (tip: focusable + `data-tip` + accessible name; no tip: named by `common.ring.defaultAria`), `PhaseStepper({ phase, compact? })`, `KeyValue({ items: {id,label,value}[] })`, `Segmented({ label, options, value, onChange })` (a `fieldset`), `BadgeIcon({ icon, tone?, size?, label? })`, `CopyText({ text, onResult? })`, `SearchField`/`SelectField`/`Switch` in `Field/Field.tsx`, `MoreBar({ label, onClick })` plus `pagedReveal(total, pressed, pageSize, step?)` and `allReveal(total, pageSize, expanded)` returning `{ visible, remaining, next }` in `MoreBar/MoreBar.tsx`.
- `ProgressBar` gains optional `tone` (6 px hue bar, same progressbar semantics and `data-testid`); `StackBar({ segments: {label,count,tone}[] })` in `ProgressBar/StackBar.tsx`.

**Decisions and assumptions a consumer inherits.** The v1 `Button`, `CountBadge`, `TierBadge`, `CmdRow`, `CopyButton`, `StateBadge`, `Avatar`, `Toast` and the v1 look of `ProgressBar` were NOT rewritten: they keep their contracts and the pinned tests and already take the Órbita palette through WO-13-010's compatibility mapping; the surface work orders that need the drawn Órbita command box («Copiar <comando>» name, `CommandCompact`), toast and avatar rebuild them there (carried forward, recorded in components.md as v1 until then). `CopyText` reports the result through `onResult` instead of raising a toast itself (no global toast bus exists yet); the caller shows `states.toast.copied` / `states.toast.clipboardBlocked`. A hue never travels alone: hue `Chip` takes text or an icon, `StateDot`/`PhaseStepper` write the state word; the static check forbids edge-stripe borders in the new primitives. The `Switch` is a `button[role=switch]`.

**Tests.** `Chip/_tests/vocabulary.test.tsx`, `Ring/_tests/Ring.test.tsx`, `PhaseStepper/_tests/PhaseStepper.test.tsx`, `Field/_tests/Field.test.tsx`, `Button/_tests/IconButton.test.tsx`.
