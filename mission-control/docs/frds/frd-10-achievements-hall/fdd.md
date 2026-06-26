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
   - **Misiones** (`logrosMisiones`): the **chains** (cumulative tier ladders). One **spotlight**
     chain (`rpgChainSpot`, "A UN PASO DE SUBIR", the highest-% active chain) → a `secthead`
     "En ascenso" grid of big chain cards (`rpgChainCard`) → "Comunes" mini grid (`rpgChainMini`) →
     "Legendarias" (completed) grid.
   - **Trofeos** (`logrosTrofeos`): a conquered-count strip (`.xpbar`) → category chips
     (Descubrimiento · Velocidad · Calidad · Consistencia · Maestría · Secreto) → "Conquistados"
     big grid (`rpgOneCard`) → "Por conquistar" small grid (`rpgTrophyLock`, the hover/focus reveal)
     → "Secretos" grid (silhouette + cryptic hint).
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
| Tier chain card (big) | `rpgChainCard` | `rpgSkin.rpgpanel` + `.itemslot` medal + `.node` ladder + `.xpbar` + `tiers.tier1..5` |
| Tier chain spotlight | `rpgChainSpot` | `rpgpanel.spot.rpggrid` (thicker `spot` border) + big `.itemslot` |
| Tier chain mini | `rpgChainMini` | `rpgpanel` + small `.itemslot` + slim `.xpbar` |
| One-time trophy (unlocked) | `rpgOneCard` | `rpgpanel.glowwarn.anim` (warn glow) + `.itemslot` |
| Trophy locked (hover-reveal) | `rpgTrophyLock` | `rpgSkin.lockchip` (`.lockslot` + `.reveal` fade-in on hover/focus-within) |
| Record stat tile | `heroStat` | `rpgpanel.herostat` (40px pixel `.big` numeral) + tier badge |
| Ledger row | `statLedgerRow` | `.ledrow` + tier `.node` pip + pixel numeral |
| Attributes radar | `statRadar` | SVG, `accent` polygon + glow, `bd` rings, pixel-font labels |
| Section header | `secthead` | `rpgSkin.secthead` (trailing 1px `.ln` rule) |
| Sub-tabs (5, with icons + counts) | `HallTabs` (`logrosTabs`) | `.stab` / `.stab.on` |
| Rank ladder row / era header / summit | `RankLadder` + `ladderMeta` | `rpgpanel` + `RankEmblem` (88/104/124px) + `accent` glow (current) + `warn` frame (summit) |
| Metric level chip + band pip (Estadísticas) | `statLedgerRow` / `heroStat` | `metricLevel` → `Nv N` chip + 5-hue pip |

Tier rarity (`tiers.tier1..tier5` = **Común → Poco común → Raro → Épico → Leyenda**, never metal
names) is **always** paired with the tier **name text** (`TIERN`) on every badge/pip — color is never
the only signal (a11y rule).

## FRD acceptance criteria → visual mapping

- Stats that only grow → `logrosStats` ledgers + `heroStat` records (pixel numerals, `tabular-nums`).
- Cumulative chains tier up Común→Poco común→Raro→Épico→Leyenda with a **progress bar to next tier** +
  next-tier name → `rpgChainCard` / `rpgChainMini` / `rpgChainSpot` (the `.xpbar` + "Siguiente: {tier}").
- 40-rung **rank ladder** (Rangos tab) → `RankLadder` + `ladderMeta` (eras + flavor), big `RankEmblem`,
  era headers, current-rank glow + progress, summit treatment (FRD-09 single source `RANKS`).
- Each unlocked tier stores **date + project** → the `stamp` line (calendar icon) on every chain card.
- **"Almost there"** (Zeigarnik) → `questsNear` (top-3 nearest) on Resumen + `rpgChainSpot` spotlight
  on Misiones.
- Unique achievements grouped by category (Discovery/Speed/Quality/Consistency/Mastery), date+project
  when unlocked, condition when locked → `logrosTrofeos` (category chips + `rpgOneCard` / `rpgTrophyLock`).
- **Secret achievements** as silhouette + cryptic hint; on unlock reveal the criterion → the
  `a.hidden` branch of `rpgOneCard` / `rpgTrophyLock` (question-mark slot + italic hint), and the
  `.lockchip .reveal` overlay shows **"CÓMO DESBLOQUEAR"** (the criterion) on hover/focus — honest, not
  a loot box.
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

## index.html render-fn pointer
`logrosView` (~L528) and its family: `logrosResumen`/`logrosMisiones`/`logrosTrofeos`/`logrosStats`
(~L489-526), `logrosHero` (~L407), `questsNear` (~L427), `recentTrophies` (~L433),
`rpgChainCard`/`rpgChainSpot`/`rpgChainMini` (~L458-476), `rpgOneCard`/`rpgTrophyLock` (~L478-485),
`heroStat`/`statLedgerRow` (~L487-488), `statRadar` (~L446), `chainState` (~L390), `logrosTabs` (~L439),
`secthead` (~L444). Data: `CHAINS`/`ONETIME`/`STATS`/`TIERN`/`TIERC` (see `docs/achievements.md`).
CSS: `.rpghall`, `.rpgpanel`/`.rpggrid`/`.spot`, `.itemslot`/`.node`/`.lockchip`/`.reveal`,
`.xpbar`, `.ledrow`, `.stab`/`.stab.on`, `.secthead` (rpgSkin group).
