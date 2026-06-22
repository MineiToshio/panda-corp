---
id: FDD-NN                # NN = owning FRD number
type: fdd
slug: descriptive-slug
title: Replace with the feature title
status: DRAFT             # DRAFT | ACTIVE | BLOCKED | SUPERSEDED
parent: FRD-NN
last_updated: YYYY-MM-DD
---

# FDD — FRD-NN Replace with the feature title

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> **CONDITIONAL — UI features only (`ui: true`).** A backend-only feature has no FDD. This is THIS
> feature's UI design, built on the **global** design system (`docs/design/` + root `DESIGN.md`,
> the frozen tokens). It does **not** redefine tokens or components — it *uses* them.

## Screens

Each screen this feature has, and the `mocks/` file it realizes (the binding visual spec the build
**reproduces**, DR-054). One row per screen: name · purpose · `mocks/<file>`.

## States

For each screen: the **empty / loading / error / success** states and how they look. Don't leave
states to improvisation — they are part of the contract.

## Components used

Which components from the inventory (`docs/design/components.md`) each screen uses. **Reuse before
creating** — flag any genuinely new component so it gets added to the inventory.

## Interaction & flow

The user flow through the feature (entry → actions → outcome), key interactions, transitions.

## Responsive & accessibility

Behavior across breakpoints (or "desktop-only", if declared) and the a11y notes specific to this
feature (focus order, labels, keyboard) beyond the global baseline in `DESIGN.md`.

## Copy

Pointer to the microcopy / voice for this feature (the global voice lives in
`docs/design/voice-and-tone.md`). *Omit if there's nothing feature-specific.*
