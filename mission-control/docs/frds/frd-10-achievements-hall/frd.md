---
id: FRD-10
type: frd
title: FRD-10 — Achievements Hall
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-21'
ui: true
visual_source: docs/design/prototype/index.html
---
# FRD-10 — Achievements Hall

A page of achievements that are also **stats that grow**, with a date and project on each one. (Today with example data in the prototype; when the real Mission Control is built, the stats are computed by reading the factory and the projects.)

## Tier vs rarity (distinct concepts)
**Tier** and **rarity** are two different things and must not be conflated:
- **Tier** = the level a cumulative chain has reached. A chain tiers up through **5 tiers** — **Común → Poco común → Raro → Épico → Leyenda** (Common → Uncommon → Rare → Epic → Legend) — each time its stat crosses a threshold. Tier is a property of *where a chain currently sits*.
- **Rarity** = how rare an individual achievement is to obtain (Común→Leyenda), a per-achievement attribute independent of chain tiers. **Shipped in v2** as a per-trophy gem/border (reusing `tiers.ts` colors) in a pyramid distribution (many Común, few Leyenda), with an estimated-rarity label.

## v2 — "La página épica" (2026-06-29)
The catalogue is expanded from 15 trophies / 12 chains / 3 secrets to **~80 trophies across 8 axes**,
**~21 chains grouped in sagas**, and **~18 secrets**, with **per-trophy rarity**, category **Seals**
(platinum-equivalent), a **NUEVO** badge and an **estimated-rarity** label. Crucially, **every unlock
is re-anchored to the REAL event vocabulary the factory emits** — the v1 predicates read an
`achievement`/`task=…` event that nothing ever emitted, so most trophies were dormant forever (see
decision-log 2026-06-29). The full catalogue, the real-signal map and the rarity model live in
[mission-control/docs/achievements.md](../../achievements.md).

## Acceptance criteria (EARS)
### v2 additions (2026-06-29)
- Every unique trophy SHALL carry a **rarity grade** (Común · Poco común · Raro · Épico · Leyenda), shown as a colored gem/border (reusing `tiers.ts`) plus a **text label** (never color alone, WCAG 1.4.1) and an estimated-rarity blurb. The catalogue SHALL follow a **pyramid** distribution (≈40/25/17/11/6%).
- Trophies SHALL span **8 axes** (Descubrimiento · Velocidad · Calidad · Consistencia · Maestría · **Producción** · **Gremio** · **Temple**), offered as filter chips with each axis's icon.
- The Hall SHALL show **Seals** (meta-trophies): one per axis, unlocked when **all** that axis's trophies are earned, plus a **Grand Seal** when all 8 Seals are held. A Seal is derived purely from the unlocked-set of its axis (no new signal).
- A trophy unlocked within the last **7 days** SHALL show a **NUEVO** badge, derived from its real unlock `date` vs the server clock (no fabrication).
- Cumulative chains SHALL be **grouped into sagas** (narrative section headers) on the Misiones tab.
- **Honesty (non-negotiable):** every trophy/chain/secret SHALL be **derived from a verifiable real signal** (idea cards · project statuses · the real event vocabulary in `docs/achievements.md` §1). A condition with **no real signal** SHALL NOT ship as a trophy (recorded under "pending emitter" instead) — no dormant/smoke trophies. The events reader SHALL **fail loud** (DR-078) on an unrecognised enriched shape, never silently drop it.

### Base criteria
- It SHALL present a **5-tab layout** (Resumen · Misiones · Trofeos · Estadísticas · **Rangos**), each tab a chip with **its icon** and, where applicable, **a count** (Misiones = chains in progress; Trofeos = unlocked trophies) — prototype `logrosTabs` (the Rangos tab is the new guild-rank-ladder surface, FRD-09).
- The **Rangos** tab SHALL show the **40-rung guild rank ladder** (FRD-09) as an **enriched, era-sectioned vertical climb** (UI/UX research 2026-06-25: for an ordered 40-tier ladder a list beats a grid — it preserves the climb metaphor — and the row's horizontal space is filled with metadata rather than abandoned for cards). The 40 ranks are grouped into **6 narrative "eras"** (El despertar · Los portadores · Los guardianes · Los campeones · Los ascendidos · La trascendencia), each with a section header + level range. **Each rank row** shows a **LARGE pixel-art emblem** (≈88px; 104px for the current rank — the art is the hero, the owner's request) with its **grade badge** (I·II·III), the Spanish name, a **one-line RPG flavor caption**, the **level band** `Nv min–max` (open-ended `Nv N+` at the top), the **XP threshold** ("Inicio" / "1.040 XP"), and a **state marker with an icon + text label** (`✓ Conseguido` / `ESTÁS AQUÍ` / `🔒 Nv N`) — never color alone (WCAG 1.4.1). The **current rank** is highlighted (accent glow + a bar of progress to the NEXT rank); ranks already earned read as done; ranks ahead are dimmed/locked (fading toward the summit, opacity floored at 0.5 so the icon+text cues stay legible). The **summit** (rank 40) gets a distinct, centered full-width treatment ("LA CIMA", larger emblem, warn-colored frame) so the top reads as a destination. The rank is the BAND that contains the guild's granular level (FRD-09 `rankForLevel`), not a 1:1 level.
- The **GuildHero character-sheet** (level shield · guild title · XP bar · TU PARTY roster · record badges) SHALL live **inside the Resumen tab** (below the tabs), NOT as a persistent header across tabs — the always-visible guild level is the header GuildBar (FRD-09). Prototype `logrosResumen = hero + questsNear + recentTrophies`. (Decision 2026-06-25, red-team: a persistent hero duplicates the header GuildBar.)
- The hero summary SHALL count **hazañas = tiers reached (Σ currentTierIndex+1 across chains) + unlocked trophies**, and **misiones en curso = chains with a next tier** (prototype `logrosCounts`).
- The XP bar SHALL show the **XP total on the left** and **"faltan N para Nv X · &lt;nextRank&gt;" on the right**, both above the bar (prototype `logrosHero`).
- Each **cumulative chain card** SHALL show the **current tier's fun name** as its title (chain name as subtitle), a **rarity badge** (Común → Leyenda — never metal names), a **tier-colored** bar (reusing CMP-09-xp-bar's fillColor), a **node ladder** of the tiers, a **goal row** "→ &lt;next&gt; · valor / umbral" (lower-is-better: "récord Nd → ≤Md"), and on completion the **"Cadena legendaria completada"** crown plus the unlock date when known.
- It SHALL show a **statistics panel** (counters that only grow), comprising exactly these stats: products shipped, ideas captured, work orders, phases completed, iterations, flawless launches, ideas discarded, PRDs written, ADRs registered, agents coordinated, record streak (weeks), and record idea→launch (days). These SHALL be presented as the character sheet — a radar of guild attributes, the record/hero stats (products shipped · record streak · record idea→launch) and the per-category ledger (Production · Quality · Pace & reach).
- Each metric in the Estadísticas tab SHALL show an **unbounded "Nv N" level** (FRD-09, `metricLevel`) that **keeps climbing with the value — never capped at 5** and no rarity names (Común→Leyenda): the level counts the metric's defined milestones crossed, then extends ≈1.6× beyond the last. The level is shown as a `Nv N` chip + a band-colored pip (5 hues) on hero tiles and ledger rows; 0 → "sin nivel". (The rarity-named, 5-tier chains remain the **Misiones** lens; Estadísticas is the numeric character-sheet lens.)
- It SHALL show **cumulative chains** that **tier up** through the 5 tiers (**Común → Poco común → Raro → Épico → Leyenda**) when the associated stat crosses each threshold, with a **progress bar to the next tier** and the name of the next tier.
- EACH unlocked tier SHALL store and show the **date** and **project** where it happened.
- It SHALL show an **"Almost there"** section with the chains closest to their next tier (Zeigarnik effect).
- It SHALL show **unique achievements** (one-time only) grouped **by state** — **Conquistados** (unlocked) then **Por conquistar** (locked, compact lockchips with a hover-reveal of the unlock condition) — with the **eight axes** (Discovery, Speed, Quality, Consistency, Mastery, Production, Guild, Resilience — v2) offered as **filter chips** (not as a second grouping axis), with date + project when unlocked, and the condition + rarity when locked. (Matches the prototype `logrosTrofeos`; the earlier by-category grouping made every locked card look identical and diverged from the design.)
- It SHALL include **secret achievements** shown as a silhouette + a **cryptic hint** until unlocked; ON unlocking, it SHALL **reveal its criterion** (what triggered it), never remain an obscure loot-box-style mechanic.
- The chains and progress bars SHALL apply **honest endowed progress**: start by showing the progress **already achieved** (not at zero) — it speeds up completion (Zeigarnik effect) and is honest because it corresponds to real work. No notifications or nagging reminders.
- The names SHALL be fun and scale in grandeur by tier (e.g. Products shipped: The first brick → Master builder → The architect → The digital magnate → The factory oracle).

## Detail
Full list of stats, thresholds, tier names and unique achievements in [mission-control/docs/achievements.md](../../achievements.md).

## Future
Meta-achievements (Seals), the "New" badge, and per-trophy rarity are **shipped in v2** (above).
Remaining future ideas: trophy "progress %" toward partially-met conditions, and the *pending-emitter*
trophies (`docs/achievements.md` §8) that need a new factory event (code-churn, runtime-error feed)
before they can ship — never shipped as dormant.
