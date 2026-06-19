# FRD-10 mocks — Achievements Hall ("Salón del gremio")

**Visual source:** `docs/design/prototype/index.html` — the **Logros** view, render fn `logrosView()`
and its family (`logrosResumen` / `logrosMisiones` / `logrosTrofeos` / `logrosStats`, plus
`rpgChainCard`, `rpgChainSpot`, `rpgChainMini`, `rpgOneCard`, `rpgTrophyLock`, `heroStat`,
`statLedgerRow`, `statRadar`). Frozen tokens: `docs/design/design-tokens.json` (rpgSkin + tiers).

To preview in the prototype: open `index.html`, click the **Logros** tab, then walk the four
sub-tabs (Resumen / Misiones / Trofeos / Estadísticas). The locked-trophy **hover/focus reveal** is on
the "Por conquistar" cards in the Trofeos tab.

## Baseline

The build's Preview Smoke / visual-fidelity gate (DR-055/056) renders the Hall route and compares each
sub-tab against the corresponding region of `index.html`. A scoped self-contained slice
(`mocks/achievements-hall.html`, the Hall view only — never the whole app) + a 375px and 1280px
screenshot are to be extracted from `logrosView` at build time as the per-FRD fidelity baseline.

## Token slice this feature uses
`rpgSkin` (rpgpanel, rpggrid, spot, itemslot, node, lockchip/reveal, herostat, ledrow, secthead, anim,
glowwarn, xpbar) · `tiers.tier1..tier5` · `accent.*` · `warn`/`okBg` status · `typography.families.pixel`
+ `display` · `categories` (trophy category accents) · `motion`.
