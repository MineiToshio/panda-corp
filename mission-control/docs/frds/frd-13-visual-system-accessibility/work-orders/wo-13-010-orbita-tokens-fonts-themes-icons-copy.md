---
id: WO-13-010
type: work-order
slug: orbita-tokens-fonts-themes-icons-copy
title: 'WO-13-010 — Órbita tokens, fonts, themes, icons, copy accessor and assets'
status: ACTIVE
parent: FRD-13
foundation: true
implementation_status: VERIFIED
difficulty: high
reopen_count: 0
artifacts:
  - "src/app/globals.css"
  - "src/app/layout.tsx"
  - "src/app/_design/**"
  - "src/app/_tests/layout.theme*.test.tsx"
  - "src/app/_tests/globals.css*.test.ts"
  - "src/lib/{theme,copy}/**"
  - "src/components/core/Icon/**"
  - "public/fonts/**"
  - "public/brand/**"
  - "public/prototype/assets/**"
  - "public/ranks/**"
  - "e2e/visual-system.spec.ts"
source_requirements: [REQ-13-001, REQ-13-002, REQ-13-003, REQ-13-004, REQ-13-005, REQ-13-006, REQ-13-009, REQ-13-010, AC-13-010.2, AC-13-010.3, AC-13-010.4]
dependsOn: []
last_updated: 2026-10-22
---

# WO-13-010 — Órbita tokens, fonts, themes, icons, copy accessor and assets

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Blueprint: [`../blueprint.md`](../blueprint.md) (IF-13-tokens, IF-13-registry, CMP-13-globals,
> CMP-13-fonts, IF-13-theme, IF-13-copy, CMP-13-icon, CMP-13-assets). Platform:
> [`docs/product/architecture.md`](../../../product/architecture.md) §7 (visual system, i18n and copy),
> [ADR-0012](../../../adr/ADR-0012-adopt-orbita-design-system.md), [ADR-0013](../../../adr/ADR-0013-typed-copy-accessor.md).

## Summary

The first v2 work order: it replaces the pixel-RPG skin's foundation with the frozen Órbita contract.
It mirrors every token of `docs/design/design-tokens.json` into `globals.css` (light and dark through
`[data-theme]`, system default, always-dark scene and map tokens) and a Tailwind registry, self-hosts
the three font families, adds the theme preference util with a no-flash boot script, the typed copy
accessor `t()` over the frozen Spanish catalogue, the `Icon` component over the exported SVGs, and
stages the prototype art in `public/` as original bytes. Every later work order assumes this exists.

## In Scope

1. **Raw token layer (IF-13-tokens).** Every custom property of `design-tokens.json` declared under
   its own name (`--bg`, `--surface`, `--text-2`, `--blue`, `--tint`, `--shadow-panel`, `--r-xl`,
   `--fs-h1`, `--s10`, `--sidebar`, `--content`, `--ease`, `--dur`, `--hairline`, `--rule`, …):
   light values on `:root`, dark values on `:root[data-theme="dark"]` (exactly the groups the JSON
   gives per theme: `color`, `elevation`, `hue`, `tint`). Theme-agnostic groups (`typography`, `space`,
   `radius`, `motion`, `layout`, `stroke`, `scene`, `map`) are declared once. A no-JavaScript fallback
   applies the dark set under `@media (prefers-color-scheme: dark)` to `:root:not([data-theme])`.
   Every rule of the JSON `overrides` block is reproduced with its selector and context (the nine
   `[data-tone]` → `--tone` rules, `.ring`, `.ring.lg`, `.page` gutters at 1180/760, `.fragua` scene
   override, `.manual-live` mapping, `.card-head` chip, `.hero-stats .ring.lg`, `.stamp .dot`).
2. **Tailwind registry (IF-13-registry).** The Tailwind v4 theme registry exposes the raw tokens under
   Tailwind namespaces so components style with utilities on tokens (no arbitrary values): colour
   (`bg`, `bg-2`, `surface*`, `line*`, `text*`, `primary-bg/fg`, `focus`, `backdrop`, the nine hues,
   `tone`, `scene-*`, `map-*`), font families (`display`, `body`, `mono`), font sizes (exactly the
   eleven `--fs-*` steps; the default Tailwind size scale is reset so no utility can render text
   below 12 px), radii (the eight `--r*` steps), shadows (the seven elevation tokens), easing and
   duration. Registry entries resolve to the raw variable at use time (Tailwind `@theme inline`
   or equivalent per the installed Tailwind 4.3.1 docs), so a `[data-theme]` switch restyles every
   utility. Where a raw name already sits in a Tailwind namespace (`--font-display`, `--font-body`,
   `--font-mono`, `--shadow-sm`), the raw declaration is the registry entry: never a self-referencing
   alias. **Explicit exception:** the raw colour tokens `--text`, `--text-2` and `--text-3` collide with
   Tailwind 4's `--text-*` font-size namespace, so they stay declared only in the raw token layer (`:root` /
   `[data-theme]`), never inside `@theme`, and the colour registry aliases them under the colour namespace
   (`--color-text`, `--color-text-2`, `--color-text-3` → `var(--text…)`), so `text-text-2` is a colour and no
   font-size utility ever resolves to a colour value; the `--text-*: initial` reset of the size scale does
   not touch them. The `--font-*` and `--shadow-*` entries stay as written above. The raw names are the
   DESIGN.md / `design-tokens.json` names and are not renamed. Spacing keeps Tailwind's 4 px base, which maps
   1:1 onto `--s1`..`--s12`.
3. **Global base (CMP-13-globals).** Ported from `docs/design/prototype/reference/css/02-base.css`
   and the app-wide rules of the prototype CSS: box sizing, body font (`--font-body`, 15 px / 1.55,
   `font-feature-settings: "cv11","ss01"`), heading families and weights, `.mono` and `code` in
   `--font-mono`, `.num` with `tabular-nums` (REQ-13-003; numbers default to tabular figures where the
   prototype sets it), the 2 px `:focus-visible` outline in `--focus` with 2 px offset and the
   prototype's radius rule (REQ-13-009), `::selection`, `[hidden]`, `.sr-only`, `[data-tip]` tooltip
   (shows on `:focus-visible` always and on `:hover` only inside `@media (hover: hover)`), every
   other hover rule of the base inside `@media (hover: hover)` (AC-13-010.3; Tailwind 4's `hover:`
   variant already gates on hover-capable pointers, verify against the installed version),
   `scroll-padding` on `html` so focus clears the sticky phone top bar and bottom navigation
   (AC-13-010.3), and one `@media (prefers-reduced-motion: reduce)` block that turns every
   animation and transition off and hides decorative motion (REQ-13-006). Motion tokens are the
   JSON's (`--dur` 160 ms, `--ease`); nothing animates layout or colour (REQ-13-005).
4. **Fonts (CMP-13-fonts).** The seven `@font-face` rules of `docs/design/prototype/base.css`
   (lines 2 to 8) verbatim except the `src` URL, which points at `/fonts/<file>`; the files
   `SpaceGrotesk.ttf`, `inter-400/500/600/700/800.ttf`, `JetBrainsMono.ttf` and the three licence
   texts copied byte-identical into `public/fonts/`. The computed `font-family` stacks are the ones of
   `docs/design/fidelity-checklist.md` § Fonts, string-exact. `next/font` and Pixelify Sans are removed
   from `layout.tsx`; the Manrope files are not shipped.
5. **Theme (IF-13-theme, `src/lib/theme/`).** `Theme = "light" | "dark"`; the browser-local key
   `orbita-theme` (the prototype's key); the system default (`prefers-color-scheme: light` → light,
   otherwise dark, as the prototype); stored choice wins over the system; a pure resolver, an
   `applyTheme` that sets `data-theme` on `<html>`, a `persistTheme`, and the **boot script**: a
   blocking script in `<head>` (in the root layout only, never inside a dynamic segment, LESSON-0166)
   that, before first paint, sets `data-theme` from the stored choice or the system, and mirrors the
   stored sidebar preference (`orbita-sidebar`) onto `<html data-sidebar-pref>` so the collapsed rail
   of WO-19-003 also paints without a flash. `<html lang="es" suppressHydrationWarning>`. No
   high-contrast value is accepted or stored (REQ-13-001, owner default O1). The visible control
   (`ThemeToggle`) is WO-19-003's. **Mechanism under the canonical `biome.json`** (which nobody may edit and
   which sets `security.noDangerouslySetInnerHtml: "error"` and the `next` domain's `noImgElement`): the boot
   script is a static inline `<script>` in the root layout's `<head>` (a Server Component, so React hydrates
   it rather than creating it and the smoke gate sees no "Encountered a script tag" error), its source string
   rendered with a `biome-ignore lint/security/noDangerouslySetInnerHtml: <reason>` comment (precedent
   `src/app/projects/[slug]/_observability/TimelineView/TimelineView.tsx:677`) or as string children;
   `next/script` `beforeInteractive` is not used (not paint-blocking in the App Router). Every `<img>` of the
   staged original-bytes art (item 8; rendered by later WOs such as the shell's brand mark) carries the same
   kind of reasoned `biome-ignore lint/performance/noImgElement: <reason>`, never `next/image` (precedent
   `src/app/projects/[slug]/_party/FraguaScene/FraguaScene.tsx:1045`; both precedent files are deleted later in
   v2, so cite the pattern, not the file).
6. **Copy accessor (IF-13-copy, `src/lib/copy/`, ADR-0013).** `t(key, vars?) → string` over
   `docs/design/microcopy.es.json` read in place (no copy into `src/`). Keys are typed from the
   catalogue's shape, so an unknown key fails `tsc`. `vars` fill `{name}` placeholders; a placeholder
   left without a value throws (fail loud, DR-078 analogue). Entries shaped `{ one, other }` are plural
   keys selected by `vars.count` through `Intl.PluralRules("es")` (selection, not formatting).
   `tRich(key, vars?)` returns React nodes for the catalogue values that carry inline tags (`<b>`,
   `<code>`, `<i>`), parsed into elements without `innerHTML`. Works in Server and Client Components;
   no provider. Plural objects interpolate `{count}` as well as select the form.
   **Shared Spanish date formatters** (`src/lib/copy/dates.ts`, the one pair every surface uses; DR-115,
   reconciliation 2026-10-22): `formatDate(value)` → absolute short date «19 oct. 2026» (`es-PE`,
   date-only values read in UTC, the raw string returned unchanged when unparseable, never a thrown
   error or an invented date) and `formatRelative(then, now)` → «hoy · ayer · hace N días · hace N min»
   and the hour forms, from the catalogue's `common.relativeTime.*` keys (no literal). `now` is passed in
   (callers get it from WO-01-010's `now()`; this module reads no clock). In a Client Component `now` is an
   ISO string received from the server as a prop: `MC_CLOCK` is not a `NEXT_PUBLIC_*` variable and never
   reaches a client bundle, so a client-side clock read would break oracle mode. Consumers: FRD-04 Cambios and
   Resumen dates (REQ-04-011, AC-04-014.5/.7), FRD-14 no-signal age (AC-14-002.2), Inicio, Backlog, the
   worktrees dialog (whose «N h» / «N días» are their own catalogue keys); comparisons stay on `Date.parse`
   (LESSON-0009).
7. **Icon (CMP-13-icon).** `Icon({ name, size?: "sm" | "md" | "lg", label? })` renders the exported
   SVG of `docs/design/prototype/icons/<name>.svg` inline: 24×24 viewBox, `stroke="currentColor"`,
   width 1.8, round caps and joins, 15 / 18 / 22 px, class `i` (the prototype hook). The icon children
   live in a typed data module inside `src/components/core/Icon/` (element name + attributes, rendered
   as React SVG children, no `innerHTML`), and a test proves it corresponds exactly to the exported
   files (same name set, same child markup). Decorative by default (`aria-hidden`); with `label` it is
   `role="img"` with that Spanish accessible name. No icon library, no hand-drawn icon.
8. **Assets (CMP-13-assets).** From `docs/design/prototype/assets/`, original bytes (no re-encoding,
   no `next/image`): `pandacorp.png` → `public/brand/pandacorp.png` (the raster brand-mark exception,
   M2 decision 4); the agent sprites, `courier.png` and `panda-mascot.png` → `public/prototype/assets/`
   at the paths the consumers cite (agents under `agents/`); the six Campaña rooms `zones/*.png` →
   `public/prototype/assets/zones/`; `ranks/*.png` → `public/ranks/`. Unused v1 art is left in place
   for WO-13-013 (v1 surfaces still read it until rebuilt). A test
   asserts byte equality with the prototype files. `image-rendering: pixelated` is applied by the
   consumers where the prototype sets it.
9. **v1 compatibility layer.** Until every surface is rebuilt, the v1 token names the un-migrated v1
   components still read (`--color-base`, `--color-card`, `--color-text2`, `--color-accent*`, the
   status, category, tier, trace and agent colours, `--font-pixel`, `--radius`, `--shadow-0/1/2`,
   `--duration-*`, `--easing-*`, `--focus-ring`, and the v1 global classes) stay defined in one fenced
   block of `globals.css` marked as the v1 compatibility layer: re-pointed at the Órbita token that the
   frozen `.manual-live` override maps them to where one exists, kept at their v1 value otherwise (the
   per-agent colours keep their values: they are read by the v1 Party scene until WO-04-010 removes
   it). The block never redefines an Órbita name, and WO-13-013 deletes it. The Tabler Icons CDN
   `<link>` in `layout.tsx` also stays until WO-13-013 (v1 surfaces still render `.ti` icons).

Removals in this WO (map §6.C item 24, first half): the OKLCH pixel-RPG token set as the canonical
`@theme` (it survives only inside the fenced compatibility block), Pixelify Sans and the
`next/font/google` loaders, and the high-contrast override layer (`[data-theme="high-contrast"]`
and any rule keyed on it; REQ-13-001, O1). Their implementer-authored tests are rewritten here.

## Out of Scope

- Any component other than `Icon` (WO-13-011, WO-13-012), the shell (WO-19-002), the theme button
  (WO-19-003).
- Deleting the v1 compatibility layer, the Tabler CDN link, retired primitives, `AGENT_COLOR` and the
  v1 token-schema validator in `src/app/_design/tokens/tokens.ts` (all WO-13-013). `AGENT_ROLES`,
  `AGENT_STATES` and `STATE_BADGE` stay unchanged (REQ-13-008 keeps the roster).
- Editing `docs/design/**` (frozen), the catalogue, or `package.json` (no install, no script).

## Requirements & Acceptance Criteria

Delivers REQ-13-001, REQ-13-002, REQ-13-003, REQ-13-004, REQ-13-005, REQ-13-006 and the token,
focus and Spanish-name parts of REQ-13-009 at the foundation level; AC-13-010.1 is WO-13-011's.

- **AC-13-010.2** — THE UI SHALL render with the three self-hosted families Space Grotesk, Inter and JetBrains Mono, SHALL NOT render product text below 12 px, and SHALL use monospace only for ids, code, commands and paths.
- **AC-13-010.3** — WHERE the pointer cannot hover, THE UI SHALL apply no hover effect, and a focused element SHALL never sit under a sticky bar (focus is scrolled clear of it).
- **AC-13-010.4** — THE La Fragua scene and the Campaña map SHALL use the always-dark scene tokens in both themes.

**Fidelity criterion.** The token values, font stacks and focus ring computed by the built app equal
the prototype's (`docs/design/prototype/reference/computed-styles.json`, L1 exact) on the frozen tokens,
in both themes; verified by the round-trip unit test below and, at close-out, by the Visual QA fidelity
diff.

**Completeness (DR-100).** Error paths: an unknown copy key fails `tsc`; a missing placeholder throws;
an unreadable stored theme value falls back to the system preference; storage unavailable keeps the
choice for the view only (no throw). NFRs: no flash of the wrong theme on load (boot script before
paint), fonts with `font-display: swap` (no invisible text), the brand PNG served unoptimised (accepted
trade-off, ADR-0012), contrast is the frozen tokens' (AA in both themes), reduced motion honoured,
no layout shift from fonts beyond `swap`.

## Reuse (components.md)

Reuse: `LiveRegion` and `useKeyboardNav` (`src/components/a11y/`, carried over unchanged). Create:
`Icon` (components.md row `Icon`, status new; relocated to the `Icon/` folder because it owns tests).
Nothing else is created here.

## Installs

None.

## Visual reference

- **Mock screens:** `docs/frds/frd-13-visual-system-accessibility/mocks/visual-system-accessibility.html`
  (`#a11y-skip-link-focus`, `#a11y-ring-tooltip-focus`: the focus ring, the tooltip on focus, tabular
  figures, both themes); the token sheet is `docs/design/design-tokens.json` itself and
  `docs/design/prototype/components.html`. Oracle states (`oracle-states.json`): `a11y-skip-link-focus`,
  `a11y-ring-tooltip-focus` (their full rendering needs WO-19-002 and FRD-18's Inicio; this WO owns their
  tokens, focus ring and tooltip rule).
- **Token slice:** the whole `design-tokens.json` (this WO is the token mirror): `color`, `elevation`,
  `hue`, `tint` per theme; `typography`, `space`, `radius`, `motion`, `layout`, `stroke`, `scene`, `map`
  once; `overrides`. Portable references: `docs/design/prototype/reference/css/00-fonts.css`,
  `01-tokens.css`, `02-base.css`, `04-text-helpers.css`.
- **FDD pointer:** `docs/frds/frd-13-visual-system-accessibility/fdd.md` (§ Rules without a picture).
- **Assets staged:** the fonts and licences, `pandacorp.png`, the agent sprites, `courier.png`,
  `panda-mascot.png`, `zones/*.png`, `ranks/*.png` (item 8); every SVG file of `docs/design/prototype/icons/`
  (including `sun` and `moon` of the M2 theme button) becomes the `Icon` data (item 7).

## Tests (owned)

TDD, RED first. Unit tests in `_tests/` next to each module; fixtures are the frozen files themselves
(read-only).

- `src/app/_tests/globals.css.test.ts` (rewritten): **round trip** — every token of
  `design-tokens.json` appears in `globals.css` with the identical value in the right theme block;
  scene and map tokens are declared once and never redefined in a theme block (AC-13-010.4); the
  `.fragua` override maps the scene tokens; every `overrides` rule exists; no `high-contrast` selector;
  no hover rule outside `@media (hover: hover)`; `scroll-padding` present; the reduced-motion block
  zeroes animations and transitions; the font-size registry's smallest step is 12 px (AC-13-010.2);
  the `@font-face` rules equal `base.css` lines 2 to 8 except the URL. The two `globals.css.adversarial*`
  files are rewritten to the Órbita contract or deleted where they pinned removed v1 behaviour (the
  high-contrast and three-elevation assertions).
- `src/app/_tests/layout.theme.test.tsx`: `<html lang="es">`; the boot script is in `<head>` before any
  stylesheet-dependent content; no `next/font` import anywhere under `src/` (grep test).
- `src/lib/theme/_tests/theme.test.ts`: resolver matrix (stored light/dark/garbage/absent × system
  light/dark), `applyTheme`, storage failure, the boot script's behaviour run in jsdom.
- `src/lib/copy/_tests/copy.test.ts`: every leaf key resolves to its catalogue string; placeholders
  filled; a missing placeholder throws; plural selection for 1 and 2; `tRich` renders tags as elements
  with the right text; a type-level case proves an unknown key is a compile error.
- `src/components/core/Icon/_tests/Icon.test.tsx`: name set equals the files in
  `docs/design/prototype/icons/`; each icon's children equal the file's markup; sizes; decorative vs
  labelled (`getByRole("img", { name })`).
- `src/app/_design/tokens/_tests/assets.bytes.test.ts`: every staged public file is byte-identical to
  its prototype source.
- `e2e/visual-system.spec.ts` (the one behaviour spec): with `colorScheme: "light"` the document paints
  with `data-theme="light"` before hydration; with `colorScheme: "dark"` and no stored choice it is dark;
  a stored `orbita-theme` wins over the system; `document.fonts.check` succeeds for the three families;
  the computed `font-family` of body text equals the checklist stack. Hydration-safe (`gotoHydrated`),
  no hard waits.

### Derogated tests (map §3.3, BL-0051)

- Implementer-authored, updated or deleted here: `src/app/_tests/globals.css.test.ts`,
  `globals.css.adversarial.test.ts`, `globals.css.adversarial2.test.ts` (v1 OKLCH, high-contrast, three
  elevations, `--duration-*` naming).
- Reviewer-authored, not edited: `src/app/_tests/agentColorTokens.integration.reviewer.test.ts` stays
  green by design (the compatibility layer keeps `--color-agent-*`; WO-13-013 derogates it).
  `src/app/_design/tokens/_tests/frd13.integration.reviewer.test.tsx` is unaffected (`STATE_BADGE`
  unchanged). If the rewrite turns either red, stop and report: do not edit it.
- Visual baselines (`e2e/visual.spec.ts-snapshots/**`) change with the palette: never touched here; the
  close-out Visual QA re-blesses them (map §3.3.4).

## Definition of done

- Every owned AC test green; `.pandacorp/verify.sh` green (biome, tsc, knip, madge, vitest, smoke,
  shell). No arbitrary values or literal colours introduced outside `globals.css`'s token blocks.
- `pnpm build` succeeds (proves the root-relative `@font-face … url('/fonts/<file>')` rules pass through
  Turbopack to `public/`), and `document.fonts.check` succeeds for the three families in the e2e spec above
  against that build's server.
- The fenced v1 compatibility block exists and is the only place a v1 token name is defined.
- Status Note lists the final registry names (the table every later WO uses) and the `t()` /
  `tRich()` / `Icon` / theme signatures.

## Dependencies

None (W0). Consumers: every later v2 work order; directly WO-13-011 and WO-19-003 (theme util, boot
seam). Cites LESSON-0166 (boot script in the root layout), LESSON-0216 (assets checked by bytes, not by
presence), LESSON-0310 (hover gated on hover-capable pointers).

## Status Note

**Built.** `src/app/globals.css` is generated-then-hand-owned: font-face (7 rules, `/fonts/<file>`), a Tailwind registry (`@theme` for names that live in a Tailwind namespace: `--font-*`, `--shadow*`, `--text-*` size scale reset to the eleven `--fs-*`, `--radius-*` reset; `@theme inline` for the colour / radius / easing aliases), the raw token layer (light on `:root`, dark on `:root[data-theme="dark"]` and on `:root:not([data-theme])` under `prefers-color-scheme: dark`; scene and map tokens once), every `overrides` rule (the self-referencing `--font-*`/`--hairline` entries of `.manual-live` are dropped: they would be invalid), one fenced v1 compatibility layer, the global base (focus ring, `.num`, `[data-tip]`, `.i`, `scroll-padding`), the retained v1 surface rules with every `:hover` rule moved inside `@media (hover: hover)`, and ONE reduced-motion block. `layout.tsx` lost `next/font` and Pixelify; it renders `<html lang="es" suppressHydrationWarning>` and the boot script first in `<head>` (Tabler CDN link stays until WO-13-013). Assets in `public/` are original bytes (they were already staged; fonts, licences and the six zones / agent sprites are now covered by a byte test).

**Interfaces.**
- Registry names (Tailwind utilities): colours `bg bg-2 surface surface-2 surface-3 line line-strong text text-2 text-3 primary-bg primary-fg focus backdrop blue teal violet pink amber green coral slate gold tone scene-* map-*` (so `bg-surface`, `text-text-2`, `border-line`, `text-blue`); fonts `font-display font-body font-mono`; sizes `text-xs sm md base lg xl h3 h2 h1s h1m h1`; radii `rounded-xs sm md DEFAULT lg xl 2xl pill`; shadows `shadow shadow-sm node drop panel dialog toast`; `ease-orbita`; default transition duration / easing are `--dur` / `--ease`. Spacing is Tailwind's 4 px base (`p-1` = `--s1`).
- `Icon({ name: IconName, size?: "sm"|"md"|"lg", label?: string })` in `src/components/core/Icon/Icon.tsx`; data `ICON_NODES` / `IconName` in `iconData.ts`; class `i` (+ `sm`/`lg`), `data-icon`, decorative `aria-hidden` unless `label` (`role="img"`).
- `src/lib/theme/theme.ts`: `Theme`, `THEME_STORAGE_KEY="orbita-theme"`, `SIDEBAR_STORAGE_KEY="orbita-sidebar"`, `isTheme`, `resolveTheme(stored, systemPrefersLight)`, `currentTheme(storage?)`, `applyTheme(theme, root?)`, `persistTheme(theme, storage?) -> boolean` (false when storage is unavailable); `bootScript.ts`: `THEME_BOOT_SCRIPT`.
- `src/lib/copy/copy.ts`: `t(key: CopyKey, vars?)`, `tRich(key, vars?)`, `CopyKey`, `CopyVars`; `dates.ts`: `formatDate(value)`, `formatRelative(then, now)`. The catalogue is imported as `@/../docs/design/microcopy.es.json`.

**Decisions a consumer inherits.** A missing placeholder, a plural without numeric `count` or an unknown runtime key throws. `tRich` inserts variables as text (a variable can not inject a tag); it supports `<b>`, `<code>`, `<i>` (no nesting). Catalogue strings contain non-breaking spaces (e.g. «hace 5 días»): compare through `t()`, never a typed literal. `formatDate` reads date-only values in UTC, other timestamps in the local zone; `formatRelative` returns «sin registro» for an unparseable input and uses `common.build.minutesAgo/hoursAgo` for the sub-day forms. The sidebar preference is mirrored only when it is `collapsed` or `expanded`. v1 compat names live only in the fenced block (`:root` + dark/no-JS tier and trace overrides), mapped to Órbita like `.manual-live`; `--color-text`, `--color-surface`, `--color-backdrop` now come from the registry (Órbita values). The two `globals.css.adversarial*` tests were deleted (they pinned v1 high-contrast and three-elevation behaviour).

**Tests.** `src/app/_tests/globals.css.test.ts`, `src/app/_tests/layout.theme.test.tsx`, `src/lib/theme/_tests/theme.test.ts`, `src/lib/copy/_tests/copy.test.ts`, `src/components/core/Icon/_tests/Icon.test.tsx`, `src/app/_design/tokens/_tests/assets.bytes.test.ts`, `e2e/visual-system.spec.ts`.
