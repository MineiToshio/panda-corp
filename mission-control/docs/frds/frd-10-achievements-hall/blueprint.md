---
id: FRD-10-blueprint
type: blueprint
parent: FRD-10
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-29'
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

### v2 (2026-06-29) — "la página épica": catalogue + real-signal re-wiring
The catalogue grew to **~80 trophies across 8 axes** (Discovery · Speed · Quality · Consistency ·
Mastery · **Production · Guild · Resilience**), **~19 chains grouped in 5 sagas**, and **~18 secrets**,
with **per-trophy rarity** (a pyramid over the `tiers.ts` colors), category **Seals** (a meta-trophy per
axis + a Grand Seal), and a **NUEVO** badge. The decisive change is **not** the count: the v1 predicates
read an `achievement`/`task=…` event **nothing ever emitted**, so most trophies were dormant forever.
v2 re-anchors every unlock to the **real event vocabulary** (`AgentDone`/`ReviewVerdict`/`GateResult`/
`GateVerdict`/`BuildLaunch`/`BuildComplete`/`BuildRelaunch`/`SubagentStop`/`AgentFinding`, fields nested
under `data`) via a new **signals layer**. The single `lib/achievements.ts` module became a **`lib/
achievements/` package** (§3). Full catalogue, the real-signal map and the rarity model:
`docs/achievements.md` v2.

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

**v2 — the module became a `lib/achievements/` package** (each file ≤ the size limit, one concern):
- `signals.ts` — `deriveSignals(data): Signals` + memoized `signalsFor(data)` (WeakMap, DR-092): the
  **single derivation** of every real-event aggregate (woClosed, builds, relaunches, subagents,
  gatePasses, flawlessGates, reviewsApproved, findings, distinct roles/modes, weeklyStreak, activeDays,
  peaks, fastest build, time-of-day flags, first-occurrence stamps). Folded via `foldEvent`/`foldByKind`
  to stay under the cognitive-complexity cap.
- `readerData.ts` — the `ReaderData` type (extracted here to break the `stats ↔ signals` import cycle
  caught by madge; `stats.ts` re-exports it).
- `catalogue/` — `types.ts` (the 8-axis `UniqueCategory`, `UniqueDefinition` w/ rarity, `SecretDefinition`),
  `helpers.ts` (shared check helpers), one file **per axis** (`discovery`/`speed`/`quality`/
  `consistency`/`mastery`/`production`/`guild`/`resilience`.ts) and `secrets.ts`.
- `predicates.ts` — the **assembler**: concatenates the axis arrays into `UNIQUE_DEFINITIONS` (no barrel
  re-export; consumers import types/secrets from the concrete modules).
- `definitions.ts` — the chain tables + `Saga`/`SAGA_ORDER`/`SAGA_ICONS` and the `saga` field.
- `tiers.ts` — the 5 tier colors **plus** the v2 `Rarity` type + `rarityColor`/`rarityLabel`/`rarityBlurb`.
- `stats.ts` / `achievements.ts` — `computeStats`/`computeUniques`/`computeChains`/`computeSecrets` +
  the new `computeSeals`, all re-anchored to `signals`.

Plus a **reader extension** outside the package: `lib/events/events.ts` surfaces the real **enriched
fields** (`verdict`, `result`, `reopenCount`, `blocking`, `important`, `agentType`, `effortLevel`,
`maxAgents`, `wos`, `frds`, `reason`) from the nested `data`, with **fail-loud** parsing (DR-078).

## 4. Components & interfaces

### Interfaces (`lib/achievements/`, NEW pure package — §3)
- **`IF-10-signals`** (v2, `signals.ts`) — `signalsFor(data): Signals` (memoized) → the single derivation
  of every real-event aggregate the catalogue/stats consume (DR-092 single-source). Pure; reads the
  uncapped event stream + statuses/ideas, never fabricates.
- **`IF-10-stats`** — `computeStats(readerData): Stat[]` → the character-sheet counters (only-grow),
  v2 re-anchored to `signals` (added builds, subagents, gates, reviews, findings, modes, activedays).
- **`IF-10-metric-level`** (`lib/achievements.ts`, reconciled 2026-06-25) — `metricLevel(statKey, value): number` → the **unbounded `Nv N`** per-metric level shown in the Estadísticas tab (phase 3). It counts how many of the metric's defined chain thresholds the value has crossed, then **extends ≈1.6× beyond the last** so higher-is-better metrics keep climbing past Nv 5 (lower-is-better stays bounded by its finite tiers; unknown/0 → 0 = "sin nivel"). Replaces the old rarity-named tier on Estadísticas; the rarity-named 5-tier chains remain the **Misiones** lens.
- **`IF-10-chains`** — `computeChains(stats): ChainState[]` → per chain `{ stat, currentTier, nextTier, pctToNext (endowed), saga, unlocks: {tier, date, project}[] }` using the `docs/achievements.md` thresholds. Lower-is-better chains (idea→launch) handled per the prototype `chainState` logic. v2 carries `saga` (copied from the chain definition) for the Misiones saga grouping.
- **`IF-10-uniques`** — `computeUniques(data, now?): Unique[]` → `{ name, category (1 of 8 axes), rarity,
  isNew, unlocked, date?, project?, condition }`. `rarity` from the catalogue; `isNew` = unlocked within
  7 days of `now` (honest, from the real `date`).
- **`IF-10-seals`** (v2) — `computeSeals(uniques): Seal[]` → one Seal per axis `{ axis, name, unlocked,
  total, earned }` (unlocked when `earned === total`) + the **Grand Seal** (`axis:"grand"`, unlocked when
  all axis Seals are held). Pure-derived from the unlocked-set — **no new signal**.
- **`IF-10-secrets`** — `computeSecrets(readerData): Secret[]` → `{ unlocked, hint, criterion?, date?, project? }`; criterion is revealed ONLY when unlocked.

### Components (`app/achievements/`)
- **`CMP-10-hall-page`** — `app/achievements/page.tsx` (Server Component): reads the single source `getGuildState()` (FRD-09 `IF-09-guild-state`) and renders the **5-tab** Hall (Resumen · Misiones · Trofeos · Estadísticas · **Rangos**) via `HallTabs`; the GuildHero lives inside the Resumen tab (not a persistent header — the always-visible level is the header GuildBar). Party avatars via `CMP-09-avatar`. App surface architecture §11 `app/achievements`. → page AC.
- **`CMP-10-rank-ladder`** (`app/achievements/RankLadder/RankLadder.tsx` + `ladderMeta.ts`, reconciled 2026-06-25) — the **Rangos** tab: the 40-rung guild rank ladder (FRD-09 `RANKS`/`rankForLevel`) as an **enriched, era-sectioned vertical climb**. Each rank row = a **large `RankEmblem`** (88px; 104px current; 124px summit — the art is the hero) + name + a one-line RPG **flavor caption** (`ladderMeta.FAMILY_FLAVOR`) + the **level band** `Nv min–max` + the **XP threshold** + a state marker with **icon + text label** (`✓ Conseguido` / `ESTÁS AQUÍ` / `🔒 Nv N` — never color alone, WCAG 1.4.1). The 40 ranks group into **6 narrative eras** (`ladderMeta.ERAS`); the current rank glows with a progress bar to the next rank; locked ranks dim toward the summit (opacity floor 0.5); the summit (rank 40) gets a distinct centered treatment. → AC "Rangos tab". (Design rationale — list over grid — in the FDD §Rangos.)
- **`CMP-10-stats-panel`** — the stats character sheet (only-grow counters), each with its **unbounded `Nv N` metric level** (`IF-10-metric-level`) shown as a chip + a band-colored pip (phase 3 — replaces the rarity-named tier on Estadísticas). Numbers use `tabular-nums` (FRD-13). → AC "statistics panel".
- **`CMP-10-chain-card`** (`ChainCard/`) — a cumulative chain in **one standardized layout** (v2): `SpotCard` (spotlight) and `StandardCard` (rest) both render the shared **`ChainProgress`** block — `NodeLadder` (the first connector segment now draws: node 0 is `flex:0 0 auto`) → goal-row OR "Cadena legendaria completada" → **`.xpbar` ALWAYS** (completed = full 100%) → the uniform **`CardFooter`** (latest dated unlock `📅 date · project`, else the honest cumulative fallback). The spotlight is vertical at a larger scale (bar BELOW, not floated right). → AC "cumulative chains", "date+project per tier", "endowed progress honest".
- **`CMP-10-almost-there`** — top chains by % to next tier (Zeigarnik). → AC "Almost there".
- **`CMP-10-uniques`** (`UniquesSection/`) — unique trophies grouped **by state** (Conquistados / Por conquistar), with the **8 axes** as filter chips, a per-trophy **`RarityTag`** (gem + label, `title` = rarity blurb) and a **`NuevoBadge`** (unlocked < 7 days). Conquered = calm warn **left-accent** (no full glow); locked = lock icon + `aria-label` (no "Bloqueado" text). → AC "unique achievements by state + 8 axes + rarity + NUEVO".
- **`CMP-10-seals`** (v2, `SealsShelf` in `HallTabs`) — the meta-trophy shelf: 8 axis Seals + the Grand Seal, each with `earned/total` so partial axes read as a goal (`IF-10-seals`). → AC "Seals".
- **`CMP-10-secrets`** (`SecretsPanel/`) — secret achievements in a **responsive uniform-height grid** (`gridAutoRows:1fr` + card `height:100%`): silhouette + cryptic hint when locked; reveal the criterion + date+project when unlocked — never an obscure loot box. → AC "secret achievements".

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
| Unique achievements by state, 8 axes as filter chips, date+project / condition | `CMP-10-uniques`, `IF-10-uniques` |
| Per-trophy **rarity** gem+label (pyramid) + estimated blurb (v2) | `IF-10-uniques` (`rarity`), `tiers.ts` (`rarityColor/Label/Blurb`), `CMP-10-uniques` (`RarityTag`) |
| **Seals** — one per axis + Grand Seal (v2) | `IF-10-seals` (`computeSeals`), `CMP-10-seals` (`SealsShelf`) |
| **NUEVO** badge on trophies unlocked < 7 days (v2) | `IF-10-uniques` (`isNew`), `CMP-10-uniques` (`NuevoBadge`) |
| Chains **grouped into sagas** on Misiones (v2) | `IF-10-chains` (`saga`), `definitions.ts` (`SAGA_*`), `SagaSection` |
| Every unlock from a **real signal**, events reader **fail-loud** (v2, honesty) | `IF-10-signals`, `lib/events/events.ts` (enriched fields, DR-078) |
| Secret achievements: silhouette + cryptic hint → reveal criterion on unlock | `CMP-10-secrets`, `IF-10-secrets` |
| Honest endowed progress (start from real achieved, no nagging) | `IF-10-chains` (endowed), `CMP-10-chain-card` (negative ACs) |
| Names fun & scaling in grandeur by tier | `IF-10-chains` (data from `docs/achievements.md`) |
| Hero with guild level/XP + party | `CMP-10-hall-page` + `IF-09-guild-xp` + `CMP-09-avatar` |

## Build Plan (Phase 2)

Phase 2 re-anchors the **presentational** Hall surfaces to the owner-approved prototype
(`docs/design/prototype/index.html`, the **Logros** view); the stats/chains/uniques/secrets engine is
already correct.

**State (all VERIFIED — the Hall is built; v2 shipped 2026-06-29):**
- **WO-10-001** — the `lib/achievements` engine (stats/chains/uniques/secrets).
- **WO-10-005** — the coarse Hall-surfaces UI (`ChainCard` + `UniquesSection` + `AlmostThere` +
  `SecretsPanel` + `HeroStat`/`StatLedgerRow`).
- **WO-10-006** — the Rangos tab (`RankLadder`, reconciled 2026-06-25).
- **v2 catalogue + real-signal re-wiring (WO-10-009 … WO-10-013):**
  - **WO-10-009** — surface the real enriched event fields (`lib/events/events.ts`, fail-loud).
  - **WO-10-010** — the real-signal derivation layer (`signals.ts` + `readerData.ts`).
  - **WO-10-011** — catalogue v2 (~80 trophies / 8 axes / 18 secrets, real-signal wired) +
    per-trophy rarity + Seals + NUEVO infra + character-sheet stats re-anchored.
  - **WO-10-012** — render v2 (rarity gem/label, NUEVO, `SealsShelf`) + dead-code/a11y prune.
  - **WO-10-013** — missions expanded to 19 chains grouped in 5 sagas (`SagaSection`) + the visual
    standardization of the mission cards, the Trofeos tab and the secrets grid (decision-log
    2026-06-29: node-ladder fix, uniform `ChainProgress`/`CardFooter`, calm Trofeos accent,
    uniform-height secrets).

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
