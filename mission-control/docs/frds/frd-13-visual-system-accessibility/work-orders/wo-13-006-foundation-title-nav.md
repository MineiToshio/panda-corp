---
id: WO-13-006
type: work-order
slug: foundation-title-nav
title: 'WO-13-006 — Foundation (FND-1): cohesion title/nav set — PageTitle · SectionHead · Tabs'
status: DRAFT
parent: FRD-13
implementation_status: VERIFIED
foundation: true
artifacts:
  - 'src/components/core/PageTitle/**'
  - 'src/components/core/SectionHead/**'
  - 'src/components/core/Tabs/**'
source_requirements: [CMP-13-pagetitle, CMP-13-sectionhead, CMP-13-tabs]
dependsOn: [WO-13-001, WO-13-002, WO-13-003]
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

## Status Note — IN_REVIEW (2026-06-19)

**What was built:** Three foundation cohesion primitives extracted faithfully from the prototype's
`pageHead()`, `secthead()`, `.tab`/`.stab` CSS (DR-062 / DR-054). All three are now `real` in
`docs/design/components.md`. Tabler Icons webfont (same CDN version as the prototype, `@3.31.0`)
was added to `src/app/layout.tsx` — this is a shared infrastructure change that enables `.ti .ti-*`
class icons across all components that accept an `icon` prop.

**Interfaces/contracts exposed:**

```ts
// src/components/core/PageTitle/PageTitle.tsx
export interface PageTitleProps {
  icon: string;       // Tabler icon class, e.g. "ti-home" (decorative, aria-hidden)
  title: string;      // H1 text = the nav/menu label
  subtitle?: string;  // Optional — 12px text2, indented 45px below title row
  tail?: React.ReactNode; // Optional inline slot after H1 (count pill, status chip)
}
export function PageTitle(props: PageTitleProps): React.JSX.Element;
// data-testid="page-title" on root; "page-title-subtitle" / "page-title-tail" on optionals

// src/components/core/SectionHead/SectionHead.tsx
export interface SectionHeadProps {
  label: string;            // Required section heading text
  count?: number;           // Optional numeric count, right-aligned after rule (tabular-nums)
  icon?: string;            // Optional Tabler icon class, 15px accent-text
  rightHtml?: React.ReactNode; // Optional arbitrary right slot (overrides count when both given)
}
export function SectionHead(props: SectionHeadProps): React.JSX.Element;
// data-testid="section-head" / "section-head-rule" / "section-head-count" / "section-head-right"

// src/components/core/Tabs/Tabs.tsx
export interface TabDef {
  id: string;
  label: string;
  icon?: string;   // Optional Tabler icon class shown before label
  count?: number;  // Optional count badge (accent pill, tabular-nums)
}
export interface TabsProps {
  level: "top" | "sub"; // "top" → .tab style; "sub" → .stab style
  tabs: TabDef[];
  active: string;        // id of currently active tab
  onChange: (id: string) => void;
  ariaLabel?: string;
}
export function Tabs(props: TabsProps): React.JSX.Element;
export function SubTabs(props: Omit<TabsProps, "level">): React.JSX.Element; // alias level="sub"
// data-testid="tabs-root" (data-level="top"|"sub") / "tab-<id>" on each button
// Keyboard: ArrowRight/ArrowLeft cycle focus with wrap; role="tablist"/role="tab"/aria-selected
```

**Integration seams:**
- `PageTitle` replaces all bespoke per-screen `<h1>` / `pageHead()` markup. Every top-level route
  (`/`, `/board`, `/portfolio`, `/proposals`, `/achievements`, `/manual`, `/configuration`) MUST
  import `PageTitle` and pass `icon` + `title` (= the nav label). The `gxHero` / `SectionHero`
  module pattern delegates to `PageTitle` for its heading — not a second title component.
- `SectionHead` replaces all inline `.secthead` divs. Call sites: dashboard sections (Tu turno /
  Pulso / Cartera / Progreso), achievements hall (En ascenso / Comunes / Legendarias / Conquistados /
  Por conquistar / Secretos), proposals page (Salud de la memoria), configuration/manual page sections.
- `Tabs` (level="top") replaces the top-nav `tab()` function in GuildBar or the top-level nav area.
  `SubTabs` (= level="sub") replaces `stab` patterns in CardDetail (Campaña/Documentos/Comandos),
  workspace Tabbar (Resumen/Work orders/Party/Observabilidad/Documentos/Comandos), `SectionTabs`
  in ConfigurationShell (Habilidades/Agentes/Reglas/Estándares), achievements sub-tabs.
  **Note (implicit decision):** `SectionTabs` (`src/app/configuration/SectionTabs.tsx`) is a
  pre-existing component with a different visual style (bottom-border underline, not pill).
  Downstream consumers SHOULD migrate to `Tabs`/`SubTabs` but this WO does NOT refactor
  existing consumers — that is a future clean-up task; scope is the new primitives only.
- `src/app/layout.tsx` now loads `@tabler/icons-webfont@3.31.0` from jsDelivr CDN (same URL as
  prototype line 8). This is the only place icon CSS is loaded; do not add it a second time.

**Implicit decisions and assumptions:**
- `Tabs` uses **roving tabindex** (active tab = `tabIndex=0`, others = `-1`). Arrow keys move
  *focus* only; selection only changes on click or Enter/Space (standard ARIA tabs pattern). This
  differs from `SectionTabs` which activates on arrow key — the ARIA pattern is more correct.
- `SubTabs` active style uses `var(--color-card2)` background to match prototype `.stab.on`
  (`var(--secondary)` in the prototype maps to the panel/card2 level in the token system).
- `SectionHead` precedence: when both `count` and `rightHtml` are provided, `rightHtml` wins
  (the more expressive slot takes priority). This was not explicit in the WO but is the natural
  composition order matching the prototype's `secthead()` signature.
- Icon prop is a Tabler CSS class string (e.g. `"ti-home"`). This requires the webfont to be
  loaded. Alternative: inline SVG per `StateBadge` pattern. Chose webfont to match the prototype
  exactly and to remain consistent with `ConfigurationShell`/`SectionHero` which already pass
  Tabler class strings. If the app goes offline/self-hosted, the CDN link must change to a local
  asset in `public/`.
- `PageTitle` does NOT add the RPG panel/grid background — it is a **light** title block. Routes
  that want the RPG embossed treatment (like the workspace header) build their own panel wrapper
  around `PageTitle` or use `SectionHero`; `PageTitle` itself stays unstyled.

**Test files:**
- `src/components/core/PageTitle/_tests/PageTitle.test.tsx` — 9 tests (all pass, AC-13-006.1..7)
- `src/components/core/SectionHead/_tests/SectionHead.test.tsx` — 10 tests (all pass, AC-13-006.8..14)
- `src/components/core/Tabs/_tests/Tabs.test.tsx` — 17 tests (all pass, AC-13-006.15..23)
- Total: 36 tests, all green.

**Visual fidelity (DR-056):** 3 in-loop fidelity cycles at `http://127.0.0.1:3000/preview-wo13006`
(preview route `src/app/preview-wo13006/page.tsx`). Screenshots confirmed both light and dark
themes match the prototype `pageHead()` / `secthead()` / `.tab`/`.stab` patterns exactly — accent
icon slot 34×34, H1 at 21px, subtitle indented 45px, trailing 1px rule, tab pills with correct
radius/font/active-state. No divergences remain.

**Gate results:**
- `npx vitest run` — 36 new tests pass; 6 pre-existing failures (WO-13-007/008 PLANNED components
  Banner/Chip/CountBadge/ItemSlot/Shield/TierBadge — modules not yet implemented, out of scope)
- `tsc --noEmit` — 0 new errors (pre-existing errors are missing PLANNED components)
- `npx @biomejs/biome check` — 0 errors on WO-13-006 files; pre-existing errors in PLANNED files
- Visual fidelity: PASS (3 cycles, light + dark both confirmed)
