---
id: WO-10-011
type: work-order
slug: catalogue-v2
title: 'WO-10-011 — Catalogue v2: ~80 trophies (8 axes + rarity), ~21 chains/sagas, ~18 secrets, Seals'
status: ACTIVE
parent: FRD-10
implementation_status: PLANNED
source_requirements: []
artifacts: [src/lib/achievements/definitions.ts, src/lib/achievements/predicates.ts, src/lib/achievements/tiers.ts, src/lib/achievements/achievements.ts, src/lib/achievements/_tests/**]
difficulty: high
dependsOn: [WO-10-010]
last_updated: '2026-06-29'
---
# WO-10-011 — Catalogue v2 (the epic catalogue), re-anchored to real signals

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. The **full catalogue** (names,
axes, rarity, secrets+hints, chains/sagas, thresholds) is [`docs/achievements.md`](../../../achievements.md)
v2 §3–§6 — implement it verbatim.

## Goal
Grow the data tables + predicates to the v2 catalogue, with every unlock anchored to the WO-10-010
signals layer (NO `task="…"` reads). Add per-trophy **rarity**, the 3 new axes, **Seals** and the
~18 secrets.

## In Scope
- `predicates.ts`: `UniqueCategory` extended to the **8 axes** (add `Production`, `Guild`, `Resilience`);
  `UniqueDefinition` gains a `rarity: Rarity` field (`Común|Poco común|Raro|Épico|Leyenda`); ~80
  `UNIQUE_DEFINITIONS` per §3, each `check` reading the signals layer; ~18 `SECRET_DEFINITIONS` per §5.
  Split the tables by axis into sibling files if `predicates.ts` would exceed ~500 lines.
- `definitions.ts`: chains per §6 (new keys + re-anchored), each `ChainDefinition` gains a `saga` field;
  `CHAIN_DEFINITIONS` grows to ~21.
- `tiers.ts`: a `rarityColor(rarity)`/`rarityLabel(rarity)` helper (reuse the tier color tokens) — the
  single source for rarity color/label (DR-092).
- `achievements.ts`: `Unique` gains `rarity`; add `computeSeals(uniques)` deriving the 8 Seals + Grand
  Seal from the unlocked-set (pure); `Unique`/`Secret` may carry an `isNew` flag derived from `date`
  vs a passed-in `now` (no `Date.now()` inside the pure fn — the clock is injected by the caller).
- **Honesty:** every entry maps to a real signal (✦/⧖ in §3/§5). Anything without a signal goes to §8
  "pending emitter", NOT into the live tables.

## Out of Scope
- Rendering of rarity/Seals/NUEVO/new icons/sagas (WO-10-012).
- The signals layer itself (WO-10-010) and the reader (WO-10-009).

## Acceptance criteria (EARS)
- **AC-10-011.1** — `UNIQUE_DEFINITIONS` SHALL contain the §3 catalogue (~80) across the 8 axes, each with a `rarity`, each `check` deriving from the signals layer (verifiable, never `task=`).
- **AC-10-011.2** — `SECRET_DEFINITIONS` SHALL contain the §5 secrets (~18), hint always visible, criterion revealed only on unlock (AC-10-004.2 preserved).
- **AC-10-011.3** — `CHAIN_DEFINITIONS` SHALL contain the §6 chains (~21) with a `saga`, re-anchored to real signals.
- **AC-10-011.4** — `computeSeals` SHALL unlock an axis Seal only when ALL that axis's trophies are unlocked, and the Grand Seal only when all 8 Seals are held (pure, fixture-tested).
- **AC-10-011.5** — `isNew` SHALL be derived from the real unlock `date` vs an injected `now` (≤7 days); never fabricated; locked → not new.
- **AC-10-011.6** — Empty factory → every trophy locked, honest zeros, no fabricated dates (negative AC).

## TDD plan
RED: per-axis predicate tests against signal fixtures (unlock + stay-locked); secret hidden-criterion; Seal all-or-nothing; isNew boundary; empty-factory. GREEN: tables + predicates. Refactor; split files by axis to stay ≤500 lines.

## Definition of done
`pnpm vitest run lib/achievements` green; tsc + biome clean; pure; no `any`; `.pandacorp/verify.sh` passes.
