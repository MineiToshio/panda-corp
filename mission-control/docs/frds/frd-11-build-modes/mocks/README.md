# FRD-11 mocks — Per-project build modes

**Visual source:** `docs/design/prototype/index.html` — the **Modo de construcción** panel, render fn
`buildModePanel()` inside `projComandos()`. Frozen tokens: `docs/design/design-tokens.json`.

To preview in the prototype: open `index.html`, open a building project, go to the **Comandos** tab.
The four mode chips (Pro / Equilibrado / Potente / Profundo) toggle the description + the copyable
`/pandacorp:implement [mode]` command below.

## Baseline

The build's Preview Smoke / visual-fidelity gate (DR-055/056) renders a project's Comandos route and
compares the mode panel against the `buildModePanel` region of `index.html`. A scoped self-contained
slice (`mocks/build-modes.html`, the mode panel + command row only) + a 375px and 1280px screenshot
are to be extracted at build time as the per-FRD fidelity baseline.

## DR-061 note
This is a **real read/copy-command** surface, not a demo-preview — the mode chips and command row are
**not** DEMO-wrapped. MC is read-only: selecting a mode persists/reads per-project state and copies the
command; the human runs `/pandacorp:implement [mode]` in the project folder. Do not add any run/launch
control.

## Token slice this feature uses
`rpgSkin.overrides.panel` · `.stab`/`.stab.on` · `rpgSkin.cmd` · `typography.families.mono` + `display`
· `accent.*` · `secondary`/`text.t2`/`text.t3`.
