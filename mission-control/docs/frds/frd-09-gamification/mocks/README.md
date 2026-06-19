# FRD-09 mocks — Gamification (RPG theme)

**Visual source:** `docs/design/prototype/index.html` — the **shared gamified elements** (not a single
screen), specifically the render functions:

- `topbar()` — the guild bar (level · title · XP) at the top of every view.
- `logrosHero()` — the guild hero / character-sheet panel (shield crest + XP bar + party roster).
- the `dashboardView()` footer block — the compact guild-progress strip.
- `statRadar()` — the "Atributos del gremio" radar.
- `toast()` — the small work-order celebration toast.

These are **cross-cutting** elements rendered inside host surfaces owned by other FRDs (FRD-10 Hall,
FRD-06 Party, FRD-12 dashboard). FRD-09 owns their visual contract on the frozen tokens
(`docs/design/design-tokens.json`, `rpgSkin` + `tiers` groups).

## Baseline

No standalone scoped screenshot is staged here yet — the gamified elements are baselined **in context**
by the Preview Smoke Gate / visual-fidelity gate (DR-055/056) on their host routes (top bar on every
route; hero on the Hall route). When the build runs, the gate captures the guild bar + hero panel and
compares them to the corresponding regions of `index.html`. A scoped slice
(`mocks/gamification-elements.html`) carrying the guild bar + hero + XP bar + a tier medal row may be
extracted at build time if an isolated baseline is needed.

## Token slice this feature uses
`rpgSkin` (rpgpanel, rpggrid, shield, xpbar, herostat, itemslot, node, anim) ·
`tiers.tier1..tier5` · `accent.*` · `typography.families.pixel` + `display` · `motion`.
