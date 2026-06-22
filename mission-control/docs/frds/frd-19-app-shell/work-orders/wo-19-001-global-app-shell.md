---
id: WO-19-001
type: work-order
slug: global-app-shell
title: 'WO-19-001 — Global app shell (persistent topbar nav + active state + responsive drawer + gate seed)'
status: DRAFT
parent: FRD-19
implementation_status: VERIFIED
foundation: true
reopen_count: 0
artifacts:
  - 'src/components/modules/AppShell/**'
  - 'src/components/modules/Nav/**'
  - 'src/components/modules/GuildBar/GuildBar.tsx'
  - 'src/app/layout.tsx'
  - 'src/app/globals.css'
  - 'e2e/shell.ts'
  - 'public/brand/pandacorp.png'
source_requirements: [REQ-19-001, REQ-19-002, REQ-19-003, REQ-19-004]
last_updated: '2026-06-21'
---
# WO-19-001 — Global app shell (persistent topbar nav + active state + responsive drawer + gate seed)

> Source-of-truth: [`fdd.md`](../fdd.md) (the prototype `topbar()` anatomy + the `.tab` visual) ·
> [`blueprint.md`](../blueprint.md) (`CMP-19-app-shell`, `CMP-19-nav`, the `GuildBar embedded` variant,
> the responsive CSS, the layout wiring) · [`docs/design/components.md`](../../../design/components.md).
> Visual reference: `docs/design/prototype/index.html` → `topbar()` / `tab()` / `tabProp()` (~L646–652),
> `.tab`/`.tab.on` (L62–63).

## Goal
Port the prototype's **persistent global topbar** — the navigation menu the per-FRD sharding (DR-056)
left orphaned — as ONE coarse **foundation** work order. After this, every top-level surface renders
inside a shell with the six destinations reachable from anywhere, an active-state indicator, and a
responsive structure (inline topbar on desktop / drawer on mobile). Flips the Shell-Presence Gate
(DR-075) from a vacuous pass to a real fidelity check.

## Scope
- **`Nav`** (`src/components/modules/Nav/Nav.tsx`, client): six `next/link` destinations styled with
  the `.tab` visual; active via `usePathname()` (`aria-current="page"` + active treatment); one active
  at a time; exact match (`/` exact, the other five by path). `NAV_ITEMS` is a module-scope `readonly`
  const matching the FDD destination table.
- **`AppShell`** (`src/components/modules/AppShell/AppShell.tsx`, client): semantic
  `<header role="banner" data-app-shell>` with the rpgpanel signature inlined; brand (logo + title) +
  `{levelBar}` slot on the left, `[data-nav-toggle]` + nav region (`<Nav/>` + `{proposalsBadge}` slot)
  on the right; skip link first; wraps content in `#main-content`. Owns the drawer `useState` and the
  scope check (`isShellExempt(pathname)` → no topbar on `/projects/**` and `/configuration`).
- **`GuildBar`** (`src/components/modules/GuildBar/GuildBar.tsx`): add an `embedded` variant (drops the
  panel chrome + margin) — DR-057 extend, not a fork; default behavior + existing tests unchanged.
- **`layout.tsx`**: keep the profile guard; when present, render `<AppShell levelBar={…}
  proposalsBadge={…}>{children}</AppShell>` (server data read as today), keeping `CelebrationWatcher`.
- **`globals.css`**: the shell responsive media query (toggle hidden on desktop / nav drawer on mobile).
- **`e2e/shell.ts`**: fill the contract — `NAV_DESTINATIONS` (the six), `SHELL_EXEMPT`
  (`['/projects/**','/configuration']`), `NAV_TOGGLE` (`[data-nav-toggle]`). `SHELL_SELECTOR` stays
  `[data-app-shell]`.
- **`public/brand/pandacorp.png`**: the brand logo (copied from the prototype asset) for a production
  reference independent of the prototype mirror.

## Acceptance (maps to FRD-19)
- AC-19-001.1/.2/.3/.4/.5 — persistent `[data-app-shell]` on every top-level surface; six correct
  destination links; brand+GuildBar+ProposalsBadge hosted; client-side nav; skip link first focusable.
- AC-19-002.1/.2 — active destination via `aria-current` + `.tab` active; exactly one; none on exempt/unknown.
- AC-19-003.1/.2/.3 — desktop inline nav; mobile toggle+drawer (`[data-nav-toggle]`, `aria-expanded`);
  no 390px overflow (manually verified Phase A; gate-enforced in the responsive follow-up).
- AC-19-004.1/.2 — no global topbar on `/projects/**` + `/configuration`; app exempt set mirrors `e2e/shell.ts`.

## Tests (TDD)
- `Nav/_tests/Nav.test.tsx` — renders six links with correct hrefs; active state by mocked
  `usePathname` (`/` exact vs `/board`); `aria-current` on the active link only; none active on an
  unmatched/exempt path.
- `AppShell/_tests/AppShell.test.tsx` — landmark `[data-app-shell]` present when not exempt and absent
  on `/projects/x` + `/configuration`; skip link first focusable; toggle has `aria-expanded`; renders
  the `levelBar`/`proposalsBadge` slots + `<Nav/>`; `#main-content` wraps children.
- `GuildBar` — existing tests stay green; add one for the `embedded` variant (no panel chrome).
- The **Shell-Presence Gate** (`e2e/shell.spec.ts`) becomes real and must be GREEN; the browser smoke
  renders the shell at desktop and 390px.

## Status Note
**VERIFIED** — built by hand (hybrid) in the Phase-A re-anchor session (2026-06-21/22), reusing
`GuildBar`/`ProposalsBadge` and the `.tab`/`Panel` visual (DR-057). Full `verify.sh` GREEN (vitest
7088✓, smoke 14✓, visual 14✓ re-blessed for the topbar, responsive 4✓ — mobile vacuous at
`target_platforms: desktop`, **Shell-Presence Gate 28✓**) + browser-verified at desktop and 390px
(topbar inline on desktop; collapses to a `[data-nav-toggle]` drawer on mobile).

**Cross-FRD reconciliation (CMP-17-badge):** the prototype's `tabProp()` is ONE Propuestas pill that
IS the badge, not a tab + a separate badge. The Shell-Presence Gate matches destinations by exact
accessible name ("Propuestas"), which conflicts with FRD-17's prior `aria-label`-carries-the-count
assertion on the same link. Resolved by making `ProposalsBadge` the Propuestas destination: a client
`.tab` link, active by `usePathname()`, accessible name "Propuestas", with the count as a visible
aria-hidden `CountBadge` (count not color-alone — AC-17-007.5 satisfied as visible text). The two
FRD-17 reviewer gate tests + the badge unit test were updated to the new contract.

`target_platforms` stays `desktop`; the mobile drawer is built but the mobile-width gate is deferred to
the responsive follow-up (Phase B, which flips it to `responsive`).
