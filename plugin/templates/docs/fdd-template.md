---
id: FDD-NN                # NN = owning FRD number
type: fdd
slug: descriptive-slug
title: Replace with the feature title
status: DRAFT             # DRAFT | ACTIVE | BLOCKED | SUPERSEDED
parent: FRD-NN
last_updated: YYYY-MM-DD
prototype_blessed_at: ''  # DR-080: git SHA of docs/design/prototype/ when the reviewer blessed this feature's visual baselines (the bless's independent oracle). Empty until blessed; a prototype change past this SHA flags the baseline as possibly stale.
---

# FDD — FRD-NN Replace with the feature title

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> **CONDITIONAL — UI features only (`ui: true`).** A backend-only feature has no FDD. This is THIS
> feature's UI design, built on the **global** design system (`docs/design/` + root `DESIGN.md`,
> the frozen tokens). It does **not** redefine tokens or components — it *uses* them.

## Screens

Each screen this feature has, and the `mocks/` file it realizes (the binding visual spec the build
**reproduces**, DR-054). One row per screen: name · purpose · `mocks/<file>`.

> **Bless provenance (DR-080) — the visual baseline's independent oracle.** When the reviewer blesses a
> screen's baseline, it records here the `mocks/<file>` / prototype shard it was blessed against + its
> Layer-B sign-off, and sets the frontmatter `prototype_blessed_at` to the git SHA of
> `docs/design/prototype/`. A baseline blessed with **no** provenance is a self-reference (the trap that
> let a menu-less baseline ship green) — `verify.sh` flags it (advisory); a prototype edit past that SHA
> surfaces a staleness reminder.

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
