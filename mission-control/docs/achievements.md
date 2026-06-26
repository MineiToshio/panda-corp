# Pandacorp achievements and stats

Design of the Achievements Hall. Each achievement stores the **date** and **project** where it happened. Implemented (seed) in the prototype; when the real Mission Control is built, the stats are computed by reading the factory and the projects.

## Stats (counters that grow — "character sheet")
Products shipped · Ideas captured · Work orders completed · Phases completed · Iterations deployed · Flawless launches (zero rejections) · Ideas discarded · PRDs written · ADRs recorded · Agents coordinated · Record streak (weeks) · Record idea→launch (days).

## Cumulative chains (tier up: Común → Poco común → Raro → Épico → Leyenda)
> Tier rarity uses the Spanish rarity names (never metal names), reconciled 2026-06-25. These 5 tiers are the **Misiones** lens; the **Estadísticas** tab instead shows an **unbounded `Nv N`** per metric (`metricLevel`, FRD-09 phase 3 — counts the chain thresholds below crossed, then extends ≈1.6× beyond the last; higher-is-better never caps at 5, lower-is-better stays bounded). The guild's overall **rank** climbs the separate 40-rung ladder (FRD-09, the **Rangos** tab).

Each one tracks a stat; crossing the threshold unlocks the tier (with date + project). Thresholds:

| Chain | Stat | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|---|
| Products shipped | shipped | 1 | 5 | 10 | 25 | 50 |
| Ideas captured | ideas | 5 | 20 | 50 | 100 | — |
| Work orders | workorders | 10 | 50 | 200 | 500 | 1000 |
| Phases completed | phases | 5 | 25 | 75 | 200 | — |
| Iterations | iterations | 1 | 10 | 25 | 50 | — |
| Flawless launches | flawless | 1 | 3 | 7 | 15 | — |
| Ideas discarded | discarded | 5 | 20 | 50 | 100 | — |
| PRDs written | prds | 3 | 10 | 25 | 50 | — |
| ADRs recorded | adrs | 3 | 15 | 40 | 100 | — |
| Agents coordinated | agents | 3 | 6 | 10 | 15 | — |
| Record streak (wks) | streak | 2 | 8 | 26 | 52 | — |
| Record idea→launch (days, lower=better) | speed | ≤30 | ≤14 | ≤7 | ≤3 | — |

Tier names (scaling in grandeur), e.g. Products shipped: The first brick → Master builder → The architect → The digital magnate → The factory oracle. (Full list of names in the prototype code.)

## Unique achievements (one-time only, with date + project)
- **Discovery**: Launch day · The first spec · The designer's debut · The blueprinter · Iteration zero · The grand tour (all 6 phases).
- **Speed**: 48 hours of madness · Ship it Friday · The marathon (20+ WO in a row).
- **Quality**: First attempt (zero rejections across all phases) · The practical perfectionist (3 in a row with no rejection in design).
- **Consistency**: The early-bird founder (WO before 8am) · The last to turn off the lights (WO after midnight).
- **Mastery**: The trilogy (3 live products at once) · State collector (one product through all states).
- **Secrets** (hidden with a cryptic hint until unlocked): "you see the void on the other side" (idea base with nothing active) · "the code reviewed the code" (one agent auto-corrects another) · "it goes faster than expected" (full pipeline in one day).

## UX
Stats character sheet + an "Almost there" section (top 3 chains by % to the next tier, Zeigarnik effect) + chains with a bar to the next tier and tier pips + uniques by category. Future: meta-achievements (titled Seals), "New" for 7 days after unlocking, estimated rarity.

Research: [docs/research/08-gamification.md](../../docs/research/08-gamification.md) and sources therein.
