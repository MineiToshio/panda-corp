# Accessibility (web UI)

> Domain: Design/Quality · Severity: **MUST** (web UI). Enforcement: lint (Biome `a11y` group) + CI gate (axe-core over the real built pages; `target-size` wired fail-closed in the Responsive Gate, DR-074) + `reviewer` check (focus/contrast, which linters can't see). The project-injectable operative form is `plugin/templates/rules/accessibility.md` (DR-051).

## Target

**WCAG 2.2 AA** is the target for every web UI the factory ships. Automation covers ~30-40% of it; the rest is the `reviewer`'s lens plus these rules baked into how components are built.

## Tap targets — two tiers, explicitly related

- **44px is the design TARGET** (what `/pandacorp:design` mockups and built UIs aim for — comfortable touch).
- **24px is the wired, fail-closed gate FLOOR** (WCAG 2.2 SC 2.5.8 `target-size`, enforced by axe in the Responsive Gate at the mobile width — DR-074).

The relationship: design to 44, the gate REDs below 24. A 30px target passes the gate but is a design shortfall the reviewer may nit; below 24px is a hard failure, never shippable. (Two docs previously said "44" with no relation to the wired 24 — this section is the single canonical statement.)

## Semantic HTML & ARIA discipline

- Semantic elements first: `<button>` for actions, `<a>`/`<nav>` for navigation, `<main>/<section>/<header>/<article>` for structure. **No `<div onClick>`.**
- Landmarks (`main`/`nav`/`header`/`footer`), exactly one `<h1>`, no skipped heading levels.
- ARIA only where semantics fall short (`aria-*` to describe state, never to patch a wrong element choice).
- Never convey meaning by color/shape/position alone — add text or an icon.
- Every form field has a programmatic label; errors set `aria-invalid` + `aria-describedby` and are conveyed by text.

## Keyboard & focus management

- Everything mouse-operable is keyboard-operable, in a logical tab order; visible focus states everywhere.
- **Modals trap focus**: focus moves in on open, Tab/Shift+Tab cycle inside, Escape closes, focus returns to the trigger on close.
- A keyboard-reachable **skip link** is the first focusable element.
- **Focus is never obscured** by sticky headers/banners (SC 2.4.11) — use `scroll-margin`.

## WCAG 2.2 specifics

- **SC 2.4.11** (focus not obscured) — see above; also enforced structurally by the Responsive Gate's `<main>`-occlusion check.
- **SC 2.5.7** (dragging) — every drag interaction (reorder, sliders, kanban) has a single-pointer alternative.
- **SC 2.5.8** (target size) — the 24px gated floor above.
- **SC 3.3.8** (accessible authentication) — no cognitive-test-only login; password/OTP fields allow paste and don't block password managers (`autocomplete` set).

## Motion

- Respect **`prefers-reduced-motion: reduce`**: disable/soften animations, parallax and autoplay motion. (The canonical `biome.json` keeps `noImportantStyles: "off"` precisely because the reduced-motion reset needs `!important` — DR-076.)

## How it is verified

- **Lint**: Biome's `a11y` rule group, enabled as error in the canonical `biome.json` (DR-059).
- **CI gate**: `@axe-core/playwright` over the REAL built pages (not just mockups); `target-size` runs fail-closed inside the Responsive Gate at the mobile width (DR-074).
- **Reviewer**: focus order, contrast in context, and everything automation can't detect — plus the design-target (44px) nits.
- **Design phase**: `/pandacorp:design` verifies mockups with axe-core before the owner's visual gate (constitution §16).

## Why

Accessibility failures are quality failures that exclude users and create legal exposure; catching them at lint/gate time is orders of magnitude cheaper than retrofitting. The two-tier tap-target rule exists because a single number was ambiguous: the standard needs both an aspiration the designer works to and a floor a machine can enforce.
