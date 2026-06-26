---
id: FRD-10-blueprint
type: blueprint
parent: FRD-10
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-25'
---
# FRD-10 — Achievements Hall (Guild Hall) · feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **per-FRD blueprint** (DR-049). It references the
> **[platform architecture](../../product/architecture.md)** (the `lib/events.ts`/`lib/status.ts`
> readers §6, the read-only invariant §1/§7, the app surface §11 `app/achievements`, FRD-13 tokens),
> the **[FRD-09 blueprint](../frd-09-gamification/blueprint.md)** (the XP engine + honesty rules) and
> the design detail in **[`docs/achievements.md`](../../achievements.md)**. Read those first.

## 1. Feature summary

The **Guild Hall**: a page of achievements that are also **stats that grow**, each with a date and
project. All stats are **computed by reading the factory and the projects** (no stored counters) —
honest by construction. It has a **5-tab layout** (Resumen · Misiones · Trofeos · Estadísticas · **Rangos**) with: a stats
panel (counters that only grow, each showing an **unbounded `Nv N` metric level** — `metricLevel`,
phase 3, no longer capped at 5), **cumulative chains** that tier up (**Común → Poco común → Raro →
Épico → Leyenda**) with an honest **endowed-progress** bar to the next tier, an **"Almost there"**
section (Zeigarnik), **unique achievements** by category (Discovery, Speed, Quality, Consistency,
Mastery), **secret achievements** (silhouette + cryptic hint until unlocked, then reveal the
criterion — never an obscure loot box), and the new **Rangos** tab: the 40-rung guild rank ladder
(FRD-09) as an enriched era-sectioned climb (`RankLadder`).

It reuses the FRD-09 engine and primitives (`IF-09-guild-xp`, `CMP-09-xp-bar`, `CMP-09-avatar`) and
adds the **stats/chains/achievements computation** over the existing readers. The chain thresholds,
tier names and unique/secret list are specified in `docs/achievements.md`.

## 2. Where the stats come from (honesty contract, shared with FRD-09)

Every stat is **derived from verifiable real outcomes** read via the platform readers — never an
app-incremented counter:

| Stat / achievement input | Source | Reader |
|---|---|---|
| products shipped | projects at `phase: release` (DR-085: launched/terminal) | `lib/status.ts`, `lib/portfolio.ts` (FRD-01/03) |
| ideas captured / discarded | `factory/ideas/*.md` (`status`) | `lib/ideas.ts` (FRD-01) |
| work orders completed | `status.yaml` `work_orders_done` + `achievement` events | `lib/status.ts`, `lib/events.ts` |
| phases completed | `status.yaml` `phase` history | `lib/status.ts` |
| iterations, flawless launches, PRDs, ADRs, agents coordinated | docs presence + events | `lib/docs.ts`, `lib/events.ts`, `lib/status.ts` |
| record streak (weekly), record idea→launch | timestamps from events/status | `lib/events.ts`, `lib/status.ts` |
| unique / secret unlock date + project | the event/status that triggered it | `lib/events.ts`, `lib/status.ts` |

Counters **only grow** because they reflect cumulative real history. Endowed progress is **honest**:
bars start at the progress **already achieved** (real), never inflated (FRD-10 AC + FRD-09 forbidden
"stuck bar"). No notifications/nagging (FRD-10 AC).

## 3. New `lib/` module (flagged)
`lib/achievements.ts` — pure computation of `{ stats, chains, uniques, secrets }` from the typed
reader outputs. Architecture §6 maps FRD-10 to `events`+`status`; this derivation module is the one
new file (flagged here, like FRD-09's `lib/gamification.ts`). No new fs access — consumes reader
output. The chain/tier/unique definitions are data tables sourced from `docs/achievements.md`.

## 4. Components & interfaces

### Interfaces (`lib/achievements.ts`, NEW pure module — §3)
- **`IF-10-stats`** — `computeStats(readerData): Stat[]` → the character-sheet counters (only-grow).
- **`IF-10-metric-level`** (`lib/achievements.ts`, reconciled 2026-06-25) — `metricLevel(statKey, value): number` → the **unbounded `Nv N`** per-metric level shown in the Estadísticas tab (phase 3). It counts how many of the metric's defined chain thresholds the value has crossed, then **extends ≈1.6× beyond the last** so higher-is-better metrics keep climbing past Nv 5 (lower-is-better stays bounded by its finite tiers; unknown/0 → 0 = "sin nivel"). Replaces the old rarity-named tier on Estadísticas; the rarity-named 5-tier chains remain the **Misiones** lens.
- **`IF-10-chains`** — `computeChains(stats): ChainState[]` → per chain `{ stat, currentTier, nextTier, pctToNext (endowed), unlocks: {tier, date, project}[] }` using the `docs/achievements.md` thresholds. Lower-is-better chains (idea→launch) handled per the prototype `chainState` logic.
- **`IF-10-uniques`** — `computeUniques(readerData): Unique[]` → `{ name, category, unlocked, date?, project?, condition }`.
- **`IF-10-secrets`** — `computeSecrets(readerData): Secret[]` → `{ unlocked, hint, criterion?, date?, project? }`; criterion is revealed ONLY when unlocked.

### Components (`app/achievements/`)
- **`CMP-10-hall-page`** — `app/achievements/page.tsx` (Server Component): reads the single source `getGuildState()` (FRD-09 `IF-09-guild-state`) and renders the **5-tab** Hall (Resumen · Misiones · Trofeos · Estadísticas · **Rangos**) via `HallTabs`; the GuildHero lives inside the Resumen tab (not a persistent header — the always-visible level is the header GuildBar). Party avatars via `CMP-09-avatar`. App surface architecture §11 `app/achievements`. → page AC.
- **`CMP-10-rank-ladder`** (`app/achievements/RankLadder/RankLadder.tsx` + `ladderMeta.ts`, reconciled 2026-06-25) — the **Rangos** tab: the 40-rung guild rank ladder (FRD-09 `RANKS`/`rankForLevel`) as an **enriched, era-sectioned vertical climb**. Each rank row = a **large `RankEmblem`** (88px; 104px current; 124px summit — the art is the hero) + name + a one-line RPG **flavor caption** (`ladderMeta.FAMILY_FLAVOR`) + the **level band** `Nv min–max` + the **XP threshold** + a state marker with **icon + text label** (`✓ Conseguido` / `ESTÁS AQUÍ` / `🔒 Nv N` — never color alone, WCAG 1.4.1). The 40 ranks group into **6 narrative eras** (`ladderMeta.ERAS`); the current rank glows with a progress bar to the next rank; locked ranks dim toward the summit (opacity floor 0.5); the summit (rank 40) gets a distinct centered treatment. → AC "Rangos tab". (Design rationale — list over grid — in the FDD §Rangos.)
- **`CMP-10-stats-panel`** — the stats character sheet (only-grow counters), each with its **unbounded `Nv N` metric level** (`IF-10-metric-level`) shown as a chip + a band-colored pip (phase 3 — replaces the rarity-named tier on Estadísticas). Numbers use `tabular-nums` (FRD-13). → AC "statistics panel".
- **`CMP-10-chain-card`** — a cumulative chain: tier pips, current tier badge, **endowed-progress bar** to the next tier (reuses `CMP-09-xp-bar`), next-tier name, unlock date + project. → AC "cumulative chains tier up + bar + next tier name", "date+project per tier", "endowed progress honest".
- **`CMP-10-almost-there`** — top chains by % to next tier (Zeigarnik). → AC "Almost there".
- **`CMP-10-uniques`** — unique achievements grouped by category, with date+project when unlocked / condition when locked. → AC "unique achievements by category".
- **`CMP-10-secrets`** — secret achievements: silhouette + cryptic hint when locked; reveal the criterion (what triggered it) + date+project when unlocked — never an obscure loot box. → AC "secret achievements".

### Reused (no duplication)
- FRD-09: `IF-09-guild-xp`, `CMP-09-xp-bar`, `CMP-09-avatar`.
- FRD-01/03/06: `lib/ideas.ts`, `lib/status.ts`, `lib/portfolio.ts`, `lib/docs.ts`, `lib/events.ts`.
- FRD-13 tokens (the 5 tier colors are tokens, per prototype `--tier-1..5`), `tabular-nums`.

## 5. Honesty / ethics (from FRD-09 + FRD-10)
Negative ACs across the WOs: counters reflect real cumulative history (no app-increment); endowed
progress shows REAL achieved progress (never inflated/stuck); secrets always reveal their criterion
on unlock (no permanent obscurity); NO notifications/nagging, NO leaderboards, NO false urgency. Each
unlock maps to a verifiable result. Empty factory → honest empty/low state, never fabricated trophies.

## 6. Read-only & security posture
All stats derived from read-only sources (architecture §7); nothing written. No personal data beyond
the local factory repo.

## 7. Traceability (REQ → AC → CMP/IF)

FRD-10 states EARS bullets (no explicit `REQ-10-MMM` ids). Work orders assign `AC-10-MMM.K`.

| FRD-10 EARS bullet | Component(s) / Interface(s) |
|---|---|
| Statistics panel (counters that only grow) | `CMP-10-stats-panel`, `IF-10-stats` |
| Each metric shows an unbounded `Nv N` level (never capped at 5) | `IF-10-metric-level`, `CMP-10-stats-panel` |
| 5-tab layout incl. **Rangos** = the 40-rung rank ladder (enriched, era-sectioned) | `CMP-10-hall-page` (`HallTabs`), `CMP-10-rank-ladder` (+ FRD-09 `RANKS`) |
| Cumulative chains tier up (Bronze→Legend) + bar to next + next tier name | `CMP-10-chain-card`, `IF-10-chains` |
| Each unlocked tier stores/shows date + project | `IF-10-chains`, `CMP-10-chain-card` |
| "Almost there" section (Zeigarnik) | `CMP-10-almost-there`, `IF-10-chains` |
| Unique achievements by category, date+project / condition | `CMP-10-uniques`, `IF-10-uniques` |
| Secret achievements: silhouette + cryptic hint → reveal criterion on unlock | `CMP-10-secrets`, `IF-10-secrets` |
| Honest endowed progress (start from real achieved, no nagging) | `IF-10-chains` (endowed), `CMP-10-chain-card` (negative ACs) |
| Names fun & scaling in grandeur by tier | `IF-10-chains` (data from `docs/achievements.md`) |
| Hero with guild level/XP + party | `CMP-10-hall-page` + `IF-09-guild-xp` + `CMP-09-avatar` |

## Build Plan (Phase 2)

Phase 2 re-anchors the **presentational** Hall surfaces to the owner-approved prototype
(`docs/design/prototype/index.html`, the **Logros** view); the stats/chains/uniques/secrets engine is
already correct.

**State:**
- **VERIFIED (do not rebuild):** WO-10-001 — the `lib/achievements.ts` engine (stats/chains/uniques/
  secrets), verified.
- **PLANNED (Phase 2 UI):** WO-10-005 — the single coarse Hall-surfaces work order (`ChainCard` +
  `TrophyCard`/`UniquesSection` + `AlmostThere` + `SecretsPanel` + `HeroStat`/`StatLedgerRow`).

**Coarse DAG & parallelism:**

```
[VERIFIED engine: WO-10-001]   [FRD-13 foundation: WO-13-006/007/008]   [FRD-09 WO-09-003: page hero + XpBar]
              └───────────────────────────┬───────────────────────────────────────┘
                                          ▼
                          WO-10-005 (Hall surfaces — UI)
```

WO-10-005 is a single sequential UI WO (no intra-FRD UI peer to parallelize). It starts once the
foundation primitives, the verified engine, and the FRD-09 page hero/shell exist.

**Disjoint artifacts (shared-route coordination with FRD-09):** the achievements route
(`src/app/achievements/`) is **shared**. **FRD-09 WO-09-003 owns** the page hero block in `page.tsx`,
`components/modules/GuildBar/**` and `StatsPanel.tsx` (the radar). **This WO owns** the
chains/trophies/almost-there files only: `ChainCard/`, `UniquesSection/`, `AlmostThere.tsx`,
`SecretsPanel.tsx`. Neither FRD re-implements the other's region; `page.tsx`'s hero is FRD-09's, its
per-tab bodies are populated by this WO's components.

**Cross-FRD deps:** `frd-13` (foundation `SectionHead`/`Tabs`/`ItemSlot`/`TierBadge`/`XpBar`, tier
tokens, `tabular-nums`); `frd-09` (shared achievements page + the `XpBar` primitive + `IF-09-guild-xp`).
</content>
