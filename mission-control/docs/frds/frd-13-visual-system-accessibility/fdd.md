---
id: FDD-13
type: fdd
slug: visual-system-accessibility
title: Visual system and accessibility
status: ACTIVE
parent: FRD-13
last_updated: '2026-10-22'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-13 Visual system and accessibility

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> FRD-13 is the cross-cutting layer, not a screen: the visual system frozen FROM the approved Órbita prototype (`docs/design/prototype/index.html`, owner approval 2026-10-21) into `docs/design/design-tokens.json` and root `DESIGN.md`, plus the accessibility behaviour every surface shares. Its two captured states show the two accessibility behaviours that have a picture: the focused skip link and the progress ring that explains itself on focus. Both are drawn on Inicio (a surface owned by FRD-18); the rules in this FDD apply to every FRD's screens. The tokens and the component inventory (`docs/design/components.md`) are defined elsewhere; this FDD uses them and defines none.
>
> The captured states are in `docs/frds/frd-13-visual-system-accessibility/mocks/visual-system-accessibility.html`, screenshots in `mocks/screenshots/` (viewport captures).

## Screens

| Screen | Purpose | Captured state | Acceptance criteria |
|---|---|---|---|
| Skip link focused | The first Tab stop of every page: the skip link appears at the top left over the sidebar, with the visible focus ring, so a keyboard user can jump the navigation. | `a11y-skip-link-focus` | REQ-13-009, AC-13-010.3 |
| Progress ring explains itself on focus | A project card's progress ring, reached by keyboard, shows a dark tooltip with its meaning, "39 de 48 work orders verificadas", with the same text as its accessible name. | `a11y-ring-tooltip-focus` | REQ-13-007, REQ-13-009 |

### Skip link focused (`a11y-skip-link-focus`)

- The link is the first focusable element of the page, before the sidebar. At rest it sits off-screen above the frame; on focus it drops into view at the top left (`SkipLink`): its label (the Spanish skip text of `SkipLink`, see `docs/design/microcopy.es.json`), a surface fill, a hairline border and radius 10, over the brand block of the sidebar.
- A 2px focus ring in the focus token, with 2px offset, surrounds it and follows its border radius (REQ-13-009). No hover effect is involved.
- Activating it moves focus to the content region in place (`main#content`); it does not navigate to another screen.
- Behind it the page is Inicio at 1280 (page title "Inicio", the plugin banner, "Tu turno", "Pulso", "Gremio"); those regions belong to FRD-18 and the shell, and only the focus behaviour belongs here.

### Progress ring explains itself on focus (`a11y-ring-tooltip-focus`)

- On the Funko Tracker card of "Tu cartera", the conic progress ring (`Ring`, 52px, "81%") has the focus ring around it and an inverted tooltip pill above it reading "39 de 48 work orders verificadas".
- The ring is `role="img"` and focusable (`tabindex="0"`); its accessible name and its tooltip are the same sentence, so the meaning is available to a keyboard user and a screen reader, not only to a pointer (REQ-13-009). Other rings carry their own sentence ("109 de 110 work orders verificadas").
- The percentage is real text inside the ring, with tabular figures (REQ-13-003).

## States

| State | What it shows | Captured state | Acceptance criteria |
|---|---|---|---|
| Keyboard focus on the skip link | The link is visible and ringed; every other element is at rest. This is the focus-visible state the whole app uses (2px ring, 2px offset, radius follows the element). | `a11y-skip-link-focus` | REQ-13-009 |
| Keyboard focus on a ring | The ring has the focus ring and the tooltip is open; moving focus away closes it. The tooltip is not hover-only. | `a11y-ring-tooltip-focus` | REQ-13-009, AC-13-010.3 |

No loading, empty or error state exists for this FRD: it owns no data. The surfaces that consume the rules design their own.

## Rules without a picture

These rules of the FRD have no captured state because they are values in tokens and CSS, behaviour, or properties of every screen at once. The build verifies them with the frozen tokens (`docs/design/design-tokens.json`, root `DESIGN.md`), the round preflight, the computed styles (`docs/design/prototype/reference/computed-styles.json`), axe-core and the fidelity gate on the other FRDs' states; none is specified as UI here.

| Rule | Where it is fixed and checked |
|---|---|
| REQ-13-001 few tokens, two committed themes (light and dark, both first-class), authored in hex, no high-contrast layer (owner default O1, 2026-10-22) | `design-tokens.json` (custom properties per theme), `DESIGN.md` § Tokens; the build mirrors them in `src/app/globals.css` `@theme` |
| REQ-13-002, AC-13-010.1 neutral chrome, hue only with meaning and always with text or an icon, green / amber / red only for status or severity (phase counts as status), no edge stripes | `DESIGN.md` § Colour rules; every FRD's screens show it (this FRD's own states: the neutral chrome and the single coral banner) |
| REQ-13-003 tabular figures on every number | CSS (`.num`, `font-variant-numeric: tabular-nums`); visible in the ring percentage of `a11y-ring-tooltip-focus` |
| REQ-13-004 elevation and radius from the token scales, no per-component shadow or radius | `design-tokens.json` shadows (`shadow`, `shadow-sm`, `node`, `drop`, `panel`, `dialog`, `toast`) and radii (6, 8, 10, 12, 16, 22, 28, pill) |
| REQ-13-005 motion: transforms only, under 300ms (160ms base, ease token), the frequency test; the sidebar collapse is a transform and a dialog's text never fades | `DESIGN.md` § Motion; the M1 decision of 2026-10-22 keeps this rule and the prototype animates transforms only |
| REQ-13-006 `prefers-reduced-motion` disables La Fragua and every non-essential motion | one CSS rule in `base.css`; checked in a reduced-motion run |
| REQ-13-007 no state by colour alone: icon or shape plus label | every state chip in the app; for example the label "Construcción: fase actual" in the phase stepper of `a11y-ring-tooltip-focus`, "Conseguido" with a check in FRD-10's `achievements-ranks`, "En revisión" in FRD-12's `observability-legacy-link` |
| REQ-13-008 agent identity by sprite or initials plus the model tier chip; no per-role colour set; the roster excludes the `guild` aggregate | FRD-07's agent catalogue; no picture in this FRD |
| REQ-13-009 Spanish `aria-label` on icons ("Abrir menú", "Colapsar la barra lateral", "Copiar claude plugin update pandacorp@panda-corp"), `aria-live="polite"` for events, arrow-key navigation on tab strips, contrast at least 4.5:1 | axe-core and the round preflight on every state; the labels above are drawn in both states of this FRD |
| AC-13-010.2 the three self-hosted families (Space Grotesk, Inter, JetBrains Mono), no product text below 12px, monospace only for ids, code, commands and paths | `DESIGN.md` § Typography; files in `docs/design/prototype/assets/` |
| AC-13-010.3 no hover effect where the pointer cannot hover; a focused element is never under a sticky bar | hover rules sit inside `@media (hover: hover)`; focus is scrolled clear with `scroll-margin`; the ring state above shows the tooltip opening on focus |
| AC-13-010.4 La Fragua and the Campaña map use the always-dark scene tokens in both themes | `--scene-*` and `--map-*` tokens, defined once; drawn in the FRD-06 and FRD-02 states |
| Shared modal focus (2026-10-16): the Modal returns focus to its opener on close if the opener is still in the document | `Dialog` behaviour in `components.md`; exercised by the dialog states of other FRDs |

## Components used

From `docs/design/components.md`; nothing new is introduced by this FRD.

| Part | Components |
|---|---|
| Skip link | `SkipLink` (first focusable element of `AppShell`, in-page anchor to `main#content`) |
| Progress ring and its tooltip | `Ring` (`pct`, `tone`, `size`, `tip`; `role="img"` with the sentence as label) inside `ProjectCard` |
| Surroundings | `AppShell`, `Nav`, `PageHead` (FRD-19 and FRD-18 own them) |

## Interaction & flow

- Keyboard path: Tab from the address bar lands on the skip link; Enter moves focus to the content; the next Tab stops are inside the page. On Inicio the rings of "Tu cartera" are Tab stops and each shows its sentence on focus.
- The tooltip opens on focus and on hover (hover only where the pointer can hover) and closes on blur or Escape.
- Focus ring, contrast, motion and tabular figures are not interactions of this feature: they are the properties every other FDD inherits.

## Responsive & accessibility

- Captured at 375, 768 and 1280, light and dark. At 375 the skip link appears over the top bar; the ring tooltip is clamped inside the viewport.
- The focus ring is 2px with a 2px offset and uses the focus token in both themes; it must stay visible on every surface (cards, command boxes, chips, tabs).
- Contrast is at least 4.5:1 for text and 3:1 for the ring and UI components in both themes; touch targets 44px as a design target, 24px as the gated floor.
- Motion: only transforms animate; text never fades; `prefers-reduced-motion: reduce` turns animation and transitions off.

## Copy

Interface strings are Spanish (`docs/design/microcopy.es.json`); accessible names are Spanish; content the app only shows (documents, skill and agent descriptions) keeps its source language. No em dash in product copy.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar): the frozen tokens `docs/design/design-tokens.json` and its history, root `DESIGN.md`, the component catalogue `docs/design/prototype/components.html`, measured styles `docs/design/prototype/reference/computed-styles.json`, portable CSS `docs/design/prototype/reference/css/`, fonts and icons under `docs/design/prototype/assets/` and `docs/design/prototype/icons/`, `docs/design/components.md` (rows `SkipLink`, `Ring`, `AppShell`, `Dialog`), `docs/design/freeze/m1-decisions.md` and `docs/design/freeze/reconciliation.md`.

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-13-visual-system-accessibility/mocks/visual-system-accessibility.html`; screenshots `docs/frds/frd-13-visual-system-accessibility/mocks/screenshots/<id>-<width>-<theme>.jpg` (375, 768, 1280; light and dark; viewport captures).
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#inicio`, then the actions listed for each state in `docs/design/freeze/fidelity.config.json` (focus the skip link; scroll to the ring and focus it).
- **Oracle states of this FRD** (`oracle-states.json`): `a11y-skip-link-focus`, `a11y-ring-tooltip-focus`.
