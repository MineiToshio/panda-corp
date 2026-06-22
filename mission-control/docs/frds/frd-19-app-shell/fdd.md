---
id: FDD-19
type: fdd
title: 'FDD-19 — Global app shell (feature design)'
frd: FRD-19
status: ACTIVE
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-21'
---
# FDD-19 — Global app shell (feature design)

Feature design for [FRD-19](./frd.md). The visual contract is the prototype `topbar()`
(`docs/design/prototype/index.html` ~L646–652) — see [`mocks/`](./mocks/README.md). Nothing here is
invented; this FDD shards the prototype's persistent topbar into the components MC will assemble,
reusing existing primitives (DR-057).

## Anatomy (prototype `topbar()`)

One `rpgpanel` surface, `display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap`,
margin-bottom 16px. Two groups:

1. **Brand + guild (left).** Logo (44×44, radius 10, hairline border, soft accent glow) + a stacked
   block: title "Pandacorp Mission Control" over the guild line (NV pill · rank title · compact XP
   bar). The guild line IS the existing `GuildBar` module (FRD-09) — reused, rendered without its own
   panel chrome (see `embedded` variant below).
2. **Nav + proposals (right).** `display:flex; gap:5px; flex-wrap:wrap` of the six destination pills
   (`tab()`), with the Propuestas pill carrying its open-count badge (`tabProp()` = the existing
   `ProposalsBadge`).

### The `.tab` pill visual (prototype L62–63, already in `Tabs.topTabStyle()`)
```
.tab    { padding:7px 13px; border-radius:8px; font-size:13px; border:1px solid transparent;
          color:var(--text2); font-family:var(--display); font-weight:500 }
.tab.on { background:var(--accent-bg); color:var(--accent-text) }   /* active */
```
The nav links replicate this exact treatment (tokens only — `--color-accent-bg` / `--color-accent-text`
/ `--color-text2`). Active = the route the operator is on.

## Components (what gets built vs reused)

| Component | New / reused | Role |
|---|---|---|
| `CMP-19-app-shell` (`AppShell`) | **new** (module) | The `[data-app-shell]` topbar surface. Semantic `<header role="banner">` with the rpgpanel signature (inlined, exactly as `GuildBar` already does — consistent), composing the brand + GuildBar + Nav + ProposalsBadge, the mobile toggle + drawer, and the skip link; wraps page content in `#main-content`. |
| `CMP-19-nav` (`Nav`) | **new** (module) | The six `next/link` destinations styled with the `.tab` visual; active by `usePathname()` (`aria-current="page"` + active treatment). |
| `GuildBar` (`CMP-09-guild-bar`) | **reused, extended** | Brand/level/XP. Gains an `embedded` variant that drops its own panel chrome + margin so it sits inside the shell (DR-057 "adapt/extend (add a variant)", not a fork). |
| `ProposalsBadge` (`CMP-17-badge`) | **reused, extended** | The Propuestas destination + open-count badge (`tabProp()` = ONE pill, not a tab + a separate badge). Extended to a client `.tab` link: active by `usePathname()`, accessible name "Propuestas" (Shell-Presence Gate matches by exact label), count as a visible aria-hidden `CountBadge`. Placed by `Nav` in its 4th (prototype) position. |
| `Panel`/rpgpanel visual (`CMP-13-panel`), `.tab` (`CMP-13-tabs`) | **reused (visual)** | The embossed surface signature and the pill treatment. |

## Behavior

- **Active state.** `usePathname()` → exact match per destination (`/` exact; the other five by exact
  path). One active at a time; exempt/unknown routes → none active. Active link gets
  `aria-current="page"` (meaning is not color-alone — accessibility.md).
- **Responsive.** Desktop: the nav group is inline, the toggle is hidden. Mobile (≤ the shell
  breakpoint): the inline nav collapses; a `[data-nav-toggle]` button (`aria-expanded`, accessible
  label) reveals/hides the nav as a drawer. Breakpoint via a media query in `globals.css` (app-wide
  pattern, styling-and-ui.md); the open/closed state is React state driving a `data-open` attribute.
  *(Phase A: `target_platforms: desktop` → the drawer is built but the mobile-width gate stays
  deferred to the responsive follow-up.)*
- **Scope.** The shell renders on the six top-level surfaces; it is NOT rendered on the exempt
  drill-ins (`/projects/**`, `/configuration`), which carry their own in-context header + back control.
  The exempt match is computed from a single app-side constant mirrored in `e2e/shell.ts`.
- **Onboarding gate.** When the profile is absent, `layout.tsx` renders `OnboardingGate` instead of
  the shell (FRD-01) — the shell never sits behind the gate.

## Accessibility
- Landmarks: `<header role="banner">` for the shell, `<nav aria-label="Navegación principal">` for the
  destinations; page content stays in each page's own single `<main>` (the shell does not add a second
  `main`; it wraps content in `#main-content` as the skip target).
- Skip link is the first focusable element → `#main-content` (WCAG 2.4.1).
- Toggle: real `<button>`, `aria-expanded`, `aria-controls`, Spanish accessible label; the drawer is
  keyboard-operable.
- Active destination conveyed by `aria-current`, not color alone.
- Tokens only — zero hardcoded colors; light + dark both first-class (inherited from the tokens).

## Out of scope (this FDD)
- Per-surface responsive behavior (kanban/table/canvas overflow) — the responsive follow-up.
- Any change to the destinations' own pages beyond exposing a skip target.
