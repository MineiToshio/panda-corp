---
id: LESSON-0310
type: pattern
domain: accessibility
tags: [hover, touch-target, discoverability, responsive, pointer-media-query]
context: designing a per-item control (a toggle, an action button) that is meant to stay visually quiet and only reveal on hover/focus, on a product that is also used on touch devices
trigger: use this when designing a per-card/per-row hover-reveal control (shown only on `:hover`/`:focus`) for a UI that must also work on touch devices with no hover state
source: "funko-tracker .pandacorp/comms/iteration.md ronda 4, 2026-10 (owner-stated the quiet-by-default behavior; the touch-fallback adaptation was agent-inferred): the owner wanted a per-item ownership toggle to stay discreet, revealed on hovering/focusing the item image rather than as a persistent visible button"
provenance: owner-stated
created: 2026-10-13
status: active
promotion: proposed   # 2026-10-17 (librarian review) — target: factory/standards/accessibility.md (add a "hover-reveal controls need a touch fallback" rule alongside the existing a11y review checklist). Corroborated across 2 distinct projects (funko-tracker, pandasaga) with zero contradicting evidence — `:hover`-only controls are silently undiscoverable on every touch device, a recurring class of bug worth a standing design-review rule.
confidence: medium
times_applied: 2
applied_in: [funko-tracker, pandasaga]
links: []
---

**Situation:** a per-item action (an ownership toggle, shown per card in a grid) needed to stay visually
quiet — revealed only when hovering or keyboard-focusing the item, rather than as an always-visible button
cluttering every card. The design had to also work correctly on touch devices, which have no hover state
at all.

**Lesson:** a hover-reveal control is a legitimate way to keep a dense grid visually calm, but `:hover`
alone is unreachable on touch — a design that stops at "reveal on hover/focus" silently breaks the
control for every touch user, who can never see or discover it. The fix is not "make it hover AND show a
button" (that reintroduces the clutter the hover-reveal was meant to avoid) but a `(hover: none)` branch
with its OWN always-visible but still-small affordance (a persistent check mark for already-active items,
a small always-visible corner control for inactive ones).

**Apply next time:** whenever specifying a hover-reveal per-item control, explicitly design its
`@media (hover: none)`/touch equivalent as a first-class variant (not an afterthought) — typically a
persistent-but-small affordance for the common/owned state, plus a small always-visible toggle for the
uncommon/action state — and verify both the keyboard-focus path AND the touch path during the same review
pass.
