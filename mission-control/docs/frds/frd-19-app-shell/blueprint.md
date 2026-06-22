---
id: BP-19
type: blueprint
title: 'Blueprint — FRD-19 global app shell'
frd: FRD-19
status: ACTIVE
last_updated: '2026-06-21'
---
# Blueprint — FRD-19 global app shell

Implementation design for [FRD-19](./frd.md) / [FDD-19](./fdd.md). Platform stack and cross-cutting
decisions live in [`docs/product/architecture.md`](../../product/architecture.md); this file is the
feature-level design only. No new platform decision — this is a foundation re-anchor that ports the
prototype `topbar()` the per-FRD sharding skipped.

## 1. Components & files

| Id | Component | Path | Kind |
|---|---|---|---|
| `CMP-19-app-shell` | `AppShell` | `src/components/modules/AppShell/AppShell.tsx` | new, **client** |
| `CMP-19-nav` | `Nav` | `src/components/modules/Nav/Nav.tsx` | new, **client** |
| `CMP-09-guild-bar` | `GuildBar` (+ `embedded` variant) | `src/components/modules/GuildBar/GuildBar.tsx` | extend |
| `CMP-17-badge` | `ProposalsBadge` | `src/components/modules/ProposalsBadge/ProposalsBadge.tsx` | extend (→ Propuestas nav-pill: client + active + `.tab` + name "Propuestas") |
| — | shared `.tab` visual + active-match | `src/components/modules/Nav/navTab.ts` | new (reused by Nav + ProposalsBadge) |
| — | shell scope (exempt mirror) | `src/components/modules/AppShell/shellScope.ts` | new |
| — | shell responsive CSS | `src/app/globals.css` | extend (app-wide pattern) |
| — | root layout wiring | `src/app/layout.tsx` | edit |
| — | gate seed | `e2e/shell.ts` | fill (per-project seed) |
| — | brand asset | `public/brand/pandacorp.png` | add (copied from prototype) |

## 2. Design

### `Nav` (CMP-19-nav) — client
- A `"use client"` component (needs `usePathname()`).
- Renders a `<nav aria-label="Navegación principal">` of six `next/link`s from a module-scope
  `readonly` `NAV_ITEMS` const (`{ label, href }`), matching the FDD destination table.
- Active: `const active = href === "/" ? pathname === "/" : pathname === href`. The active link gets
  `aria-current="page"` and the `.tab` active treatment (`--color-accent-bg` / `--color-accent-text`);
  inactive links use `--color-text2`. Visual replicated from `Tabs.topTabStyle()` (the `.tab` pill) —
  not a `<button role="tab">` (those switch tab panels; nav needs real links). One active at a time;
  unmatched route → none active.
- `data-testid="app-nav"`, each link `data-testid="app-nav-<slug>"`.

### `AppShell` (CMP-19-app-shell) — client
- A `"use client"` component (owns the mobile drawer `useState` and reads `usePathname()` for the
  scope check).
- Props (slot nodes + children from the Server layout): `levelBar: ReactNode` (a server-rendered
  `<GuildBar embedded outcomes=… />` — stays server-rendered via the "server-in-client via props"
  pattern), `proposalsBadge: ReactNode` (`<ProposalsBadge openCount=… />` — a client component now,
  since it reads `usePathname()` for its active state; instantiated in the server layout and rendered
  client-side), `children: ReactNode`. `Nav` places `proposalsBadge` in its 4th (prototype) position.
- Scope: `const showShell = !isShellExempt(pathname)`, where `SHELL_EXEMPT_PREFIXES` /
  `SHELL_EXEMPT_EXACT` is an app-side constant mirroring `e2e/shell.ts` `SHELL_EXEMPT`
  (`/projects/**`, `/configuration`). `usePathname()` is correct at SSR in the App Router → no flicker.
- Render when `showShell`:
  - Skip link `<a href="#main-content">Saltar al contenido</a>` (first focusable; visually offscreen
    until focused).
  - `<header role="banner" data-app-shell data-testid="app-shell">` with the rpgpanel signature
    **inlined** (same box-shadow + 22px dot-grid + tokens as `GuildBar`/`Panel` — consistent with the
    existing GuildBar approach, keeps the landmark semantic; the `Panel` primitive is a non-semantic
    `<div>` and does not forward `role`/`data-*`).
    - Left: brand (logo `/brand/pandacorp.png` 44×44 + "Pandacorp Mission Control") + `{levelBar}`.
    - Toggle `<button data-nav-toggle aria-expanded aria-controls="app-nav-region" …>` (CSS-hidden on
      desktop).
    - Nav region `<div id="app-nav-region" data-nav-region data-open={open}>` containing `<Nav />` +
      `{proposalsBadge}`.
  - Always: `<div id="main-content" tabIndex={-1}>{children}</div>` (the skip target; each page keeps
    its own single `<main>` inside).
- When NOT `showShell` (exempt drill-in): render `<div id="main-content" tabIndex={-1}>{children}</div>`
  only — no global topbar (the workspace/config bring their own header + back).

### `GuildBar` `embedded` variant (DR-057 extend, not fork)
- Add `embedded?: boolean`. Default (`false`) keeps today's standalone rpgpanel block (existing tests
  unchanged). When `true`, render only the inner row (NV pill + rank title + compact XpBar) — no
  rpgpanel wrapper styling, no `marginBottom` — so it sits inside the shell's own surface.

### Responsive (globals.css)
App-wide pattern (styling-and-ui.md). Media query at the shell breakpoint:
```
[data-nav-toggle]{ display:none }                       /* desktop: no toggle */
@media (max-width: <bp>){
  [data-nav-toggle]{ display:inline-flex }              /* mobile: toggle shows */
  [data-nav-region][data-open="false"]{ display:none }  /* mobile: nav hidden until opened */
  [data-nav-region][data-open="true"]{ … drawer column … }
}
```
Desktop nav stays inline (the media query only affects the mobile width). The React `open` state drives
`data-open`; on desktop the CSS keeps the nav visible regardless. Breakpoint chosen so the wide topbar
(brand + 6 pills + badge) never overflows between 391px and desktop.

### `layout.tsx` wiring
- Keep the profile guard: `profileResult.present ? <AppShell …>{children}</AppShell> : <OnboardingGate/>`.
- The layout (Server Component) reads the same data it reads today (`deriveGuildOutcomes`,
  `countOpenProposals`) and passes `levelBar={<GuildBar embedded outcomes={…}/>}` +
  `proposalsBadge={<ProposalsBadge openCount={…}/>}` + `children` to `AppShell`. `CelebrationWatcher`
  stays mounted.

## 3. The contract & the gate (DR-075)

`e2e/shell.ts` (per-project seed, never byte-diffed) is filled with this FRD's contract:
- `SHELL_SELECTOR = "[data-app-shell]"`
- `NAV_DESTINATIONS` = the six rows from the FDD table (label + path), exact.
- `SHELL_EXEMPT = ['/projects/**', '/configuration']` — the single source the app mirrors.
- `NAV_TOGGLE = "[data-nav-toggle]"`.

This flips the Shell-Presence Gate from a vacuous pass (empty `NAV_DESTINATIONS`) to **real**: it
asserts the landmark is visible on every non-exempt surface and every destination is a reachable link
with the correct href. The gate is the author-independent fidelity check.

## 4. Build Plan (DR-050)

One coarse **foundation** work order (`WO-19-001`), foundation-first: the shell is infrastructure every
top-level surface renders inside.

| State | Meaning |
|---|---|
| `PLANNED` | authored; not yet built |
| `IN_PROGRESS` | building the components |
| `IN_REVIEW` | built; FRD gate (reviewer + Shell-Presence Gate + browser smoke) pending |
| `VERIFIED` | gate green (static + shell gate + desktop & mobile browser smoke) |

Phase A stops when: `verify.sh` green, the Shell-Presence Gate green (real, not vacuous), and the
browser smoke renders the shell with all six destinations active-correct at desktop and at 390px.

## 5. Risk & test focus
- **Server-in-client boundary.** `GuildBar`/`ProposalsBadge` are passed as slot nodes so they stay
  server-rendered; `Nav`/`AppShell` are the only new client components. Verify no server-only import
  leaks into a client module.
- **Active-state correctness.** Exact-match logic (especially `/` vs the others) — unit-tested in
  `Nav/_tests/`.
- **Scope drift.** App `SHELL_EXEMPT` mirror vs `e2e/shell.ts` — both reference the same destinations;
  a code comment cross-links them.
- **Double `main`.** The shell must NOT add a `<main>` (pages own theirs) — it wraps in a `div#main-content`.
