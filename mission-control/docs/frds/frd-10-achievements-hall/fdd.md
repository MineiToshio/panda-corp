# FDD-10 — Achievements Hall ("Salón del gremio") — feature design

> **Visual source:** `docs/design/prototype/index.html` — the **Logros** view (`logrosView()`).
> Frozen tokens: `docs/design/design-tokens.json` (Atelier — pixel-RPG / guild). This FDD scopes the
> Hall screen onto those tokens. No hardcoded visuals.

## Screen shape

A single full-width page (`.rpghall`) reached from the **Logros** tab. Layout, top to bottom:

1. **Hall header** — an `.itemslot` award medal (warn-bordered) + the title **"Salón del gremio"**
   (`.ttl`, 21px display) + a feats-count pill (`px` pixel font on `warn` chip).
2. **Sub-tab bar** — five `.stab` tabs: **Resumen · Misiones · Trofeos · Estadísticas · Rangos**, each
   with its **icon** and a small pixel count where relevant (Misiones = chains in progress, Trofeos =
   unlocked). Active = `.stab.on` (`secondary` fill). (Reconciled 2026-06-25: the **Rangos** tab is the
   new guild-rank-ladder surface, FRD-09.)
3. **Body** — switches on the active sub-tab:
   - **Resumen** (`logrosResumen`): the guild **hero panel** (`logrosHero`, shared with FRD-09) →
     **"Próximas hazañas · a un paso de caer"** (`questsNear`, the Zeigarnik "Almost there" — the
     top-3 chains by % to next tier) → **"Vitrina del gremio · tus últimos trofeos"**
     (`recentTrophies`, the 4 most recent unlocked one-time trophies).
   - **Misiones** (`logrosMisiones`, **v2 2026-06-29**): the **chains** (cumulative tier ladders),
     **grouped by saga** (narrative section headers — La Construcción · Las Ideas · El Oficio · El
     Gremio · El Tiempo). One **spotlight** chain (`SpotCard`, "A UN PASO DE SUBIR", the highest-%
     active chain) sits on top; then **one `SagaSection` per saga** (header + uniform `StandardCard`
     grid). This replaced the old bucket grouping ("En ascenso / Comunes / Legendarias"), which—with
     low real data—dumped every chain into "Comunes" and felt empty. **All chain cards share ONE
     standardized layout** (see *Standardized chain card* below): there is no longer a big/mini/spot
     divergence in the body block.
   - **Trofeos** (`logrosTrofeos`, **v2 2026-06-29**): a conquered-count strip (`.xpbar`) → the
     **8-axis** filter chips (Descubrimiento · Velocidad · Calidad · Consistencia · Maestría ·
     **Producción · Gremio · Temple**) → "Conquistados" grid + "Por conquistar" grid
     (`UniquesSection`, each trophy carrying a **rarity gem + label** and a **NUEVO** badge when
     unlocked < 7 days) → the **Sellos** shelf (`SealsShelf` — one meta-trophy per axis + the Grand
     Seal) → "Secretos" responsive grid (`SecretsPanel`). **Calm, not glowing:** a conquered trophy is
     the same quiet card as a locked one, distinguished by a subtle **warn left-accent** + the warm
     trophy icon — the old full-grid `glowwarn` halo was removed (read as a wall of glow). The locked
     trophy shows the **lock icon + `aria-label`** (no redundant "Bloqueado" text). Secrets render as
     **autonomous cards in a responsive 2–3-per-row grid of uniform height** (`gridAutoRows:1fr` +
     `height:100%`), each a silhouette + cryptic hint (locked) or hint + revealed criterion + date +
     project (unlocked).
   - **Estadísticas** (`logrosStats`): the **radar** ("Atributos del gremio", `statRadar`) + three
     `heroStat` record tiles → three ledger columns (`statLedgerRow`) grouped Producción / Calidad /
     Ritmo & alcance, each stat carrying an **unbounded `Nv N` metric level** (`metricLevel`, phase 3 —
     a `Nv N` chip + a band-colored pip across 5 hues; `0` → "sin nivel") instead of the old
     rarity-named tier medal. The level keeps climbing with the value, never capped at 5.
   - **Rangos** (`RankLadder`, reconciled 2026-06-25): the **40-rung guild rank ladder** (FRD-09) as an
     **enriched, era-sectioned vertical climb** — chosen over a card grid on UI/UX research (an ordered
     40-tier ladder reads as a *climb*, which a grid breaks; the dead space is killed by enriching the
     row, not by fleeing to cards). 6 named **eras** (El despertar · Los portadores · Los guardianes ·
     Los campeones · Los ascendidos · La trascendencia), each a section header + level range. Each rank
     row: a **large `RankEmblem`** (88px; 104px current; 124px summit) with its I·II·III grade badge,
     the rank name, a one-line **flavor caption**, the **level band** `Nv min–max`, the **XP threshold**
     ("Inicio" / "1.040 XP"), and a **state marker** with icon + text (`✓ Conseguido` / `ESTÁS AQUÍ` /
     `🔒 Nv N`). The current rank glows (`accent` border + progress bar to the next rank); locked ranks
     dim toward the summit (opacity floor 0.5 so icon+text stay legible); the summit (rank 40) gets a
     distinct centered "LA CIMA" treatment (`warn` frame). Container max-width 860px.

## Components mapped to frozen primitives

| Element | Render fn | Token / primitive |
|---|---|---|
| Hall page wrapper | `logrosView` | `.rpghall` |
| Standardized chain card | `ChainCard` (`SpotCard` / `StandardCard` → shared `ChainProgress` + `CardFooter`) | `rpgpanel` + `.itemslot` medal + `NodeLadder` + `.xpbar` (ALWAYS) + uniform footer + `tiers.tier1..5` |
| Saga section (Misiones) | `SagaSection` (`HallTabs`) | `secthead` (saga icon + name) + uniform `StandardCard` grid |
| One-time trophy (conquered) | `UniquesSection` item | `rpgpanel` + warn **left-accent** + warm `.itemslot` (no full glow) + `RarityTag` gem+label + `NuevoBadge` |
| One-time trophy (locked) | `UniquesSection` item | `rpgpanel` + lock icon + `aria-label` (no "Bloqueado" text) + `RarityTag` |
| Seals shelf (Trofeos) | `SealsShelf` (`HallTabs`) | 8 axis seals + Grand Seal; per-seal `earned/total` progress; unlocked = filled, locked = dim |
| Secret card (grid) | `SecretsPanel` `SecretItem` | `rpgpanel`, `gridAutoRows:1fr` + `height:100%` (uniform height), accent border (unlocked) / base (locked) |
| Record stat tile | `heroStat` | `rpgpanel.herostat` (40px pixel `.big` numeral) + tier badge |
| Ledger row | `statLedgerRow` | `.ledrow` + tier `.node` pip + pixel numeral |
| Attributes radar | `statRadar` | SVG, `accent` polygon + glow, `bd` rings, pixel-font labels |
| Section header | `secthead` | `rpgSkin.secthead` (trailing 1px `.ln` rule) |
| Sub-tabs (5, with icons + counts) | `HallTabs` (`logrosTabs`) | `.stab` / `.stab.on` |
| Rank ladder row / era header / summit | `RankLadder` + `ladderMeta` | `rpgpanel` + `RankEmblem` (88/104/124px) + `accent` glow (current) + `warn` frame (summit) |
| Metric level chip + band pip (Estadísticas) | `statLedgerRow` / `heroStat` | `metricLevel` → `Nv N` chip + 5-hue pip |

Tier rarity (`tiers.tier1..tier5` = **Común → Poco común → Raro → Épico → Leyenda**, never metal
names) is **always** paired with the tier **name text** (`TIERN`) on every badge/pip — color is never
the only signal (a11y rule). **v2 per-trophy rarity** reuses the same 5 `tiers.ts` colors as a gem +
**text label** on each `UniquesSection` trophy (`RarityTag`, `title` = estimated-rarity blurb) — again
color+text, never color alone.

## FRD acceptance criteria → visual mapping

- Stats that only grow → `logrosStats` ledgers + `heroStat` records (pixel numerals, `tabular-nums`).
- Cumulative chains tier up Común→Poco común→Raro→Épico→Leyenda with a **progress bar to next tier** +
  next-tier name → `ChainCard` (`SpotCard` for the spotlight, `StandardCard` for the rest) sharing the
  **`ChainProgress`** block: `NodeLadder` → goal-row (or "Cadena legendaria completada" on a maxed
  chain) → **`.xpbar` ALWAYS present** (completed = full 100% bar) → uniform `CardFooter`. The spotlight
  is the same vertical layout (bar BELOW, never floated to the right) at a larger scale.
- 40-rung **rank ladder** (Rangos tab) → `RankLadder` + `ladderMeta` (eras + flavor), big `RankEmblem`,
  era headers, current-rank glow + progress, summit treatment (FRD-09 single source `RANKS`).
- Each unlocked tier stores **date + project** → the uniform **`CardFooter`** on every chain card: it
  shows the latest dated unlock (`📅 date · project`) when one exists, else an honest fallback
  (`N acumulado` / `récord N d` / "sin récord aún") — so every card has the same footer slot, never a
  date on one card and nothing on its neighbour.
- **"Almost there"** (Zeigarnik) → `questsNear` (top-3 nearest) on Resumen + `rpgChainSpot` spotlight
  on Misiones.
- Unique achievements grouped **by state** (Conquistados → Por conquistar), with the **8 axes**
  (Discovery/Speed/Quality/Consistency/Mastery/Production/Guild/Resilience) as **filter chips** and a
  per-trophy **rarity gem + label** + **NUEVO** badge → `UniquesSection`. Date+project when unlocked,
  condition + rarity when locked.
- **Seals** (meta-trophies, v2) — one per axis (unlocked when all its trophies are earned) + the Grand
  Seal (all 8) → `SealsShelf`, each showing `earned/total` so partial axes read as a progress goal.
- **Secret achievements** as silhouette + cryptic hint; on unlock reveal the criterion → `SecretsPanel`
  (responsive uniform-height grid): locked = `?` silhouette + italic hint; unlocked = `!` + the
  criterion + date + project — honest, not a loot box.
- Honest endowed progress → bars start at the **real** achieved value (`chainState` computes from real
  STATS), never zeroed.
- Names scale in grandeur by tier → carried in the `CHAINS`/`TIERN` data (`achievements.md`).

## States (empty / loading / error)

- **Empty / day zero:** chains render at tier 0 ("bloqueado" badge, `text.t3`), bars at their real
  (possibly 0%) value — honest, not faked. Trophies show the **locked** treatment. Secret trophies
  show the silhouette + hint. "Próximas hazañas" / "Vitrina" sections **hide** when there is nothing to
  show (`questsNear`/`recentTrophies` return empty string) rather than render an empty box.
- **Loading:** server-delivered stats render directly (no skeleton per the Next.js rule); chain XP
  fills animate to width on mount via `.xpbar transition`.
- **Error:** if a factory read fails, fall back to the last computed STATS; numerals show `0` with
  `tabular-nums` so the grid never reflows; no blank panel.

## Accessibility notes

- The **locked-trophy reveal** uses `:focus-within` as well as `:hover` (`rpgSkin.lockchip.reveal`) —
  keyboard-reachable, not hover-only. `prefers-reduced-motion` disables the fade.
- Tier is text+color (badge name), date is text (calendar icon + label), locked vs unlocked conveyed by
  a lock glyph in addition to dimming — never color/opacity alone.
- One `<h1>` (the Hall title); sub-tabs are real tab semantics; pixel numerals keep `tabular-nums`.
- Touch targets: sub-tabs and category chips sized ≥ the `.stab` padding; ensure ≥44px hit area on
  implementation.

## Demo-only controls (DR-061)
None. The Hall is **read-only derived data** (stats computed from reading the factory). No state
togglers, no mode pickers — nothing to wrap in a DEMO block.

## v2 implemented components (2026-06-29) — prototype fn → React component
The prototype (`index.html`) remains the **visual source** for tokens/skin; the v2 build diverged the
*structure* per the owner's standardization feedback. Map of what actually ships:
- `rpgChainCard`/`rpgChainMini`/`rpgChainSpot` → **one** `ChainCard` (`SpotCard`/`StandardCard` over the
  shared `ChainProgress` + `CardFooter`) — uniform layout, bar always present, uniform footer.
- `logrosMisiones` bucket grouping → **`SagaSection`** grouping by saga (`HallTabs`).
- `rpgOneCard.glowwarn` → `UniquesSection` trophy with a calm **warn left-accent** (no full glow) +
  `RarityTag` (gem+label) + `NuevoBadge`; locked = lock icon + `aria-label` (no "Bloqueado" text).
- NEW **`SealsShelf`** (8 axis Seals + Grand Seal) on Trofeos and the **Vitrina** on Resumen share the
  same calm accent.
- `logrosTrofeos` secrets list → **`SecretsPanel`** responsive **uniform-height** grid
  (`gridAutoRows:1fr` + `height:100%`).
The data tables (8 axes, rarity, sagas, secrets, real-signal map) live in `docs/achievements.md` v2.

## index.html render-fn pointer
`logrosView` (~L528) and its family: `logrosResumen`/`logrosMisiones`/`logrosTrofeos`/`logrosStats`
(~L489-526), `logrosHero` (~L407), `questsNear` (~L427), `recentTrophies` (~L433),
`rpgChainCard`/`rpgChainSpot`/`rpgChainMini` (~L458-476), `rpgOneCard`/`rpgTrophyLock` (~L478-485),
`heroStat`/`statLedgerRow` (~L487-488), `statRadar` (~L446), `chainState` (~L390), `logrosTabs` (~L439),
`secthead` (~L444). Data: `CHAINS`/`ONETIME`/`STATS`/`TIERN`/`TIERC` (see `docs/achievements.md`).
CSS: `.rpghall`, `.rpgpanel`/`.rpggrid`/`.spot`, `.itemslot`/`.node`/`.lockchip`/`.reveal`,
`.xpbar`, `.ledrow`, `.stab`/`.stab.on`, `.secthead` (rpgSkin group).
