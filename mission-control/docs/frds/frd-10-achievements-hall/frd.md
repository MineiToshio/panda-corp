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
- **Rarity** = how rare an individual achievement is to obtain (estimated Common→Legendary), a per-achievement attribute independent of chain tiers. Rarity is **Future** (see below) and is NOT shown today.

## Acceptance criteria (EARS)
- It SHALL present a **4-tab layout** (Resumen · Misiones · Trofeos · Estadísticas), each tab a chip with **its icon** and, where applicable, **a count** (Misiones = chains in progress; Trofeos = unlocked trophies) — prototype `logrosTabs`.
- The **GuildHero character-sheet** (level shield · guild title · XP bar · TU PARTY roster · record badges) SHALL live **inside the Resumen tab** (below the tabs), NOT as a persistent header across tabs — the always-visible guild level is the header GuildBar (FRD-09). Prototype `logrosResumen = hero + questsNear + recentTrophies`. (Decision 2026-06-25, red-team: a persistent hero duplicates the header GuildBar.)
- The hero summary SHALL count **hazañas = tiers reached (Σ currentTierIndex+1 across chains) + unlocked trophies**, and **misiones en curso = chains with a next tier** (prototype `logrosCounts`).
- The XP bar SHALL show the **XP total on the left** and **"faltan N para Nv X · &lt;nextRank&gt;" on the right**, both above the bar (prototype `logrosHero`).
- Each **cumulative chain card** SHALL show the **current tier's fun name** as its title (chain name as subtitle), a **rarity badge** (Común → Leyenda — never metal names), a **tier-colored** bar (reusing CMP-09-xp-bar's fillColor), a **node ladder** of the tiers, a **goal row** "→ &lt;next&gt; · valor / umbral" (lower-is-better: "récord Nd → ≤Md"), and on completion the **"Cadena legendaria completada"** crown plus the unlock date when known.
- It SHALL show a **statistics panel** (counters that only grow), comprising exactly these stats: products shipped, ideas captured, work orders, phases completed, iterations, flawless launches, ideas discarded, PRDs written, ADRs registered, agents coordinated, record streak (weeks), and record idea→launch (days). These SHALL be presented as the character sheet — a radar of guild attributes, the record/hero stats (products shipped · record streak · record idea→launch) and the per-category ledger (Production · Quality · Pace & reach).
- It SHALL show **cumulative chains** that **tier up** through the 5 tiers (**Común → Poco común → Raro → Épico → Leyenda**) when the associated stat crosses each threshold, with a **progress bar to the next tier** and the name of the next tier.
- EACH unlocked tier SHALL store and show the **date** and **project** where it happened.
- It SHALL show an **"Almost there"** section with the chains closest to their next tier (Zeigarnik effect).
- It SHALL show **unique achievements** (one-time only) grouped **by state** — **Conquistados** (unlocked) then **Por conquistar** (locked, compact lockchips with a hover-reveal of the unlock condition) — with the five categories (**Discovery, Speed, Quality, Consistency, Mastery**) offered as **filter chips** (not as a second grouping axis), with date + project when unlocked, and the condition when locked. (Matches the prototype `logrosTrofeos`; the earlier by-category grouping made every locked card look identical and diverged from the design.)
- It SHALL include **secret achievements** shown as a silhouette + a **cryptic hint** until unlocked; ON unlocking, it SHALL **reveal its criterion** (what triggered it), never remain an obscure loot-box-style mechanic.
- The chains and progress bars SHALL apply **honest endowed progress**: start by showing the progress **already achieved** (not at zero) — it speeds up completion (Zeigarnik effect) and is honest because it corresponds to real work. No notifications or nagging reminders.
- The names SHALL be fun and scale in grandeur by tier (e.g. Products shipped: The first brick → Master builder → The architect → The digital magnate → The factory oracle).

## Detail
Full list of stats, thresholds, tier names and unique achievements in [mission-control/docs/achievements.md](../../achievements.md).

## Future
Meta-achievements (titled, displayable Seals), a "New" badge for 7 days after unlocking, and a per-achievement **rarity** estimate (Common→Legendary) — a concept distinct from chain tiers (see "Tier vs rarity" above), not shown today.
