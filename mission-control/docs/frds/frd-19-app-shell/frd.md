---
id: FRD-19
type: frd
title: 'FRD-19 — Global app shell (persistent top navigation)'
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-10-17'
---
# FRD-19 — Global app shell (persistent top navigation)

The persistent **top navigation shell** that frames every top-level surface of Mission Control: the
brand + guild identity on the left, the six top-level destinations in the middle/right, and the
proposals badge — exactly the prototype's `topbar()` (`docs/design/prototype/index.html`, the
`topbar()` / `tab()` / `tabProp()` functions, ~L646–652). It is the answer to *"how do I get from
any surface to any other surface"* — the menu the operator opens the app expecting to see.

**Why this FRD exists (the re-anchor).** The per-FRD sharding (DR-056) built each surface in
isolation but left the **global shell orphaned**: `layout.tsx` only mounted `GuildBar` + a loose
`ProposalsBadge`, with **no navigation at all** — opening the app, "the menu doesn't even appear."
The visual gate verified *consistency* (each surface matches its own baseline), not *fidelity* to the
prototype, so a whole missing menu shipped green. DR-075 introduced the **Shell-Presence Gate**
(`e2e/shell.spec.ts`) that asserts the app against the prototype's nav contract; this FRD is the
canonical owner of that contract and of the shell that satisfies it. It is a deliberate app-shell FRD
anchored to the PRD (DR-076 wording: a deliberate, PRD-anchored shell FRD with foundation work orders
is correct — only an orphan auto-emitted greenfield `frd` is forbidden).

It composes existing layers — the guild level/XP block ([FRD-09](../frd-09-gamification/frd.md), the
`GuildBar` module), the proposals inbox badge ([FRD-17](../frd-17-proposals-inbox/frd.md), the
`ProposalsBadge` module), and the visual/accessibility system ([FRD-13](../frd-13-visual-system-accessibility/frd.md):
the `.tab` pill visual, the `Panel`/`rpgpanel` surface, design tokens, WCAG). Every top-level
surface ([FRD-18](../frd-18-dashboard/frd.md) Inicio, [FRD-02](../frd-02-ideas-board/frd.md) Tablero,
[FRD-03](../frd-03-portfolio/frd.md) Portfolio, FRD-17 Propuestas,
[FRD-10](../frd-10-achievements-hall/frd.md) Logros, [FRD-08](../frd-08-documentation/frd.md)
Documentación) renders inside this shell.

## Scope (Phase A)

This FRD covers the global shell: persistent identity, six destinations and responsive navigation. The 2026-10-17 owner correction explicitly qualifies phone/tablet shell behavior through dedicated browser cases; it does not certify every surface's tables/kanban/canvas or mutate `target_platforms`/build state. Historical Phase A desktop-only gate coverage remains historical.

## Layout (the prototype `topbar()`)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [logo]  Pandacorp Mission Control          Inicio Tablero Portfolio          │
│         NV n · rank · ▭▭▭ xp           Propuestas◦n Logros Documentación      │
└─────────────────────────────────────────────────────────────────────────────┘
   ↑ brand + GuildBar (level/XP)                    ↑ Nav (6 destinations) + ProposalsBadge
```
- **Left** — the brand (logo + "Pandacorp Mission Control") and the guild identity (`GuildBar`: NV
  level pill + rank title + compact XP bar).
- **Right** — the six top-level destinations (`Nav`) and the proposals badge (`ProposalsBadge`).
- At phone/tablet widths the right group collapses behind a top-right toggle and opens across the same header.

## Acceptance criteria (EARS)

### REQ-19-001 — Persistent global navigation shell
- **AC-19-001.1** The app SHALL render a single persistent navigation shell (the landmark
  `[data-app-shell]`) at the top of every top-level surface (Inicio, Tablero, Portfolio, Propuestas,
  Logros, Documentación), so all six destinations are reachable from any surface without using the
  browser back button.
- **AC-19-001.2** The shell SHALL contain exactly the six prototype top-level destinations, each a
  link to its correct route: Inicio→`/`, Tablero→`/board`, Portfolio→`/portfolio`,
  Propuestas→`/proposals`, Logros→`/achievements`, Documentación→`/manual`. No dead hrefs
  (`#`/`/`-placeholders), no extra top-level destinations.
- **AC-19-001.3** The shell SHALL host the guild identity block (brand + level/XP, reusing the
  `GuildBar` module — DR-057) and the proposals badge (reusing the `ProposalsBadge` module) alongside
  the nav, matching the prototype `topbar()`.
- **AC-19-001.4** Navigation between destinations SHALL be client-side (`next/link`), not a full page
  reload.
- **AC-19-001.5** A keyboard-reachable **skip link** SHALL be the first focusable element of the page
  and SHALL move focus to the main content region (WCAG 2.2 SC 2.4.1).

### REQ-19-002 — Active destination indication
- **AC-19-002.1** WHEN the current route matches a destination, that destination SHALL be marked
  active — both programmatically (`aria-current="page"`) and visually (the `.tab` active treatment) —
  and **exactly one** destination SHALL be active at a time (not color-alone — `aria-current` carries
  the meaning).
- **AC-19-002.2** The active match SHALL be exact for Inicio (`/`) and exact-per-path for the other
  five; WHEN the route is an exempt drill-in (see REQ-19-004) or otherwise unmatched, no destination
  SHALL be marked active (no false highlight).

### REQ-19-003 — Responsive integrated navigation and bounded frame
- **AC-19-003.1** WHEN the viewport is wider than 1100px, THE shell SHALL display all six destinations inline and hide the disclosure toggle.
- **AC-19-003.2** WHEN the viewport is 1100px or narrower, THE shell SHALL place a minimum 44px toggle beside the brand at the top-right of the same header, hide the closed navigation, and reveal all destinations in a full-width row within that header; the toggle SHALL expose an accessible open/close label, `aria-expanded` and `aria-controls`.
- **AC-19-003.3** WHEN the navigation is open at 600px or narrower, THE shell SHALL use two destination columns; from 601px through 1100px it SHALL use three. Every link, including the nested Propuestas badge destination, SHALL have a minimum 44px target height and remain within the header bounds at 320px, 390px, 768px and 1024px.
- **AC-19-003.4** WHEN Escape is pressed with the menu open, THE shell SHALL close it and restore toggle focus; outside pointer-down, destination activation (including the current route) and route changes SHALL also close it.
- **AC-19-003.5** WHEN rendering page content, THE shell SHALL retain the original centered 1240px maximum outer application frame, including its consistent header/content gutters, and shrink to narrower viewports; shared digest panels SHALL fill their host without the narrower 920px inner panel cap, while prose MAY retain a readable line-length cap. Model-only fullscreen SHALL continue to fill the browser viewport.

### REQ-19-004 — Shell scope and exemptions
- **AC-19-004.1** The drill-in surfaces that navigate via their own in-context header + back control —
  the project workspace (`/projects/**`) and Configuration (`/configuration`) — SHALL render WITHOUT
  the global topbar (they are sub-destinations reached from inside another surface, not top-level
  nav), matching the prototype where entering a project/config replaces the top nav with a contextual
  header.
- **AC-19-004.2** The exempt set SHALL be the single contract mirrored by the Shell-Presence Gate
  (`e2e/shell.ts` `SHELL_EXEMPT = ['/projects/**', '/configuration']`); the app and the gate SHALL not
  drift.

## Edge cases
- **Onboarding gate (FRD-01).** WHEN the factory profile is absent, the `OnboardingGate` is the entire
  view (AC-01-001.1) and the shell SHALL NOT render behind it.
- **Unknown route.** A route that matches no destination (e.g. `not-found`) SHALL render with no
  destination active — never a stray highlight.
- **Empty proposals.** The proposals badge stays present for navigation in its calm/al-día state when
  the open count is 0 (FRD-17 AC-17-007.4); the shell does not manufacture urgency.

## Traceability
- REQ-19-001 → AC-19-001.1..5 → `CMP-19-app-shell`, `CMP-19-nav` → WO-19-001
- REQ-19-002 → AC-19-002.1..2 → `CMP-19-nav` → WO-19-001
- REQ-19-003 → AC-19-003.1..5 → `CMP-19-app-shell` (responsive) → WO-19-001
- REQ-19-004 → AC-19-004.1..2 → `CMP-19-app-shell` (scope), `e2e/shell.ts` → WO-19-001
- Reuses: `CMP-09-guild-bar` (GuildBar, extended with an `embedded` variant), `CMP-17-badge`
  (ProposalsBadge, **realized as the Propuestas nav destination** — the prototype's `tabProp()`: one
  pill that IS the badge, not a tab plus a separate badge; client + active by route + the `.tab`
  visual + accessible name "Propuestas" + the count as a visible aria-hidden `CountBadge`),
  `CMP-13-panel` (Panel/rpgpanel visual), `CMP-13-tabs` (the `.tab` pill visual).

## Notes
- **Visual source:** the approved whole-app prototype `topbar()` (`docs/design/prototype/index.html`
  ~L646–652) — the frozen design contract (DR-054). This FRD does not invent new visuals; it ports the
  prototype's persistent topbar that the per-FRD sharding skipped.
- **Independent verification:** the Shell-Presence Gate (`e2e/shell.spec.ts`, DR-075) is the
  author-independent fidelity check — it asserts the rendered app against this FRD's nav contract
  seeded into `e2e/shell.ts`, so the contract here and the running shell cannot silently diverge.
