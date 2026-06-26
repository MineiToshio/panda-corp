---
id: WO-09-007
type: work-order
slug: rank-ladder
title: 'WO-09-007 — Guild rank ladder: 40 ranks, granular level + band model, custom emblems'
status: DRAFT
parent: FRD-09
implementation_status: VERIFIED
reopen_count: 0
provenance: reconciled-from-code
artifacts:
  - 'src/lib/gamification/gamification.ts'
  - 'src/components/core/RankEmblem/**'
  - 'src/components/modules/GuildBar/**'
  - 'src/components/modules/GuildHero/**'
  - 'public/ranks/*.png'
source_requirements: [AC-09-001.x]
dependsOn: [WO-09-001, WO-09-003]
last_updated: '2026-06-25'
---
# WO-09-007 — Guild rank ladder: 40 ranks, granular level + band model, custom emblems

> *Reconciled from code by `/pandacorp:sync` on 2026-06-25 — describes existing, shipped behaviour (owner-authored rank system, phases 1–6), not a forward plan. The work was built by hand in a fast iteration session; this WO records it as-built so the build's own record is honest.*

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [§3a Rank ladder + `CMP-09-rank-emblem`](../blueprint.md#3a-rank-ladder--granular-level--rank-by-band-reconciled-from-code-2026-06-25).
FDD: [§4b Rank emblems & the 40-rung ladder](../fdd.md).

## What shipped

- **40-rank ladder** (`RANK_DEFS`, Spanish + English names + Tabler fallback icon): Humano → Buscador del Alba I·II·III → Portador de Luz I·II·III → Guardián del Juramento/Glifos/Éter I·II·III → Portador de Esquirla I·II·III → Caballero Radiante I·II·III → Invocador de Reinos I·II·III → Heraldo del Alba I·II·III → Señor de Tormentas I·II·III → Ascendente I·II·III → Ascendente del Fénix → Señor del Leviatán → Señor Dragón Carmesí → Guardián Celestial → Soberano del Alba → **Portador del Juramento Eterno**. Single source: `RANKS`.
- **Level vs rank are distinct axes** (NOT 1:1): `xpForLevel`/`levelForXp` (super-linear curve — each level costs more); `rankBandSize(i)=3+⌊i/4⌋` (bands widen toward the summit); `RANK_MIN_LEVEL` (cumulative entry level); `rankForLevel(level)` (the band containing the level). The summit starts at ~Nv 289.
- **Types:** `Rank = { title, titleEn, icon, sprite, minLevel, grade }`; `GuildLevel` gains `rankIndex` + `grade`; `computeGuildLevel` returns the granular level with `next`/`pctToNext` targeting the next **level** and the rank fields describing the band.
- **Custom pixel-art emblems:** 18 sprites at `public/ranks/<slug>.png`; `RANK_SPRITES[40]` maps each rank to its family slug. New core component `RankEmblem` (`<img>` of the sprite + Tabler-icon fallback + a roman-numeral **grade badge** I·II·III for `grade∈{1,2,3}`).
- **Surfaces updated to show the emblem + grade:** `GuildBar` (header, 18px) and `GuildHero` (hero, 32px), both reading the single source `getGuildState()` so the displayed rank matches everywhere.

## Acceptance (verified as-built)
- `verify.sh` GREEN. Unit tests: gamification/guild suites cover the curve, band membership, `rankForLevel`, the top-rank threshold, and `computeGuildLevel`'s returned rank/grade.
- The emblem degrades to the Tabler icon when a sprite is missing; the grade badge renders only for I·II·III.

## Notes
Owner-authored ladder + calibration (decision-log 2026-06-25, phases 2–5). XP honesty contract unchanged (XP by verifiable result only). The **Rangos** tab that visualises this ladder is FRD-10 (`RankLadder`, WO-10-006).
