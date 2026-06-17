---
id: WO-10-006
type: work-order
slug: chains-almost-there
title: WO-10-006 — Chains cards + "Almost there"
status: DRAFT
parent: FRD-10
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-10-006 — Chains cards + "Almost there"

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-10-chain-card`, `CMP-10-almost-there`](../blueprint.md#4-components--interfaces).

## Goal
Render the cumulative chains (tier pips, current tier badge, **honest endowed-progress** bar to next
tier via `CMP-09-xp-bar`, next-tier name, unlock date+project) and the **"Almost there"** section
(top chains by % to next tier — Zeigarnik).

## Acceptance criteria (EARS, from FRD-10)
- **AC-10-006.1** — Each chain card SHALL show the current tier (Bronze→Legend), a bar to the next tier with the next tier's name, and tier pips, from `computeChains()`.
- **AC-10-006.2** — Each unlocked tier SHALL show its **date** and **project**.
- **AC-10-006.3** — The progress bar SHALL show **honest endowed progress** (real achieved, never inflated/stuck) and SHALL reuse `CMP-09-xp-bar` (negative AC).
- **AC-10-006.4** — The **"Almost there"** section SHALL show the chains closest to their next tier; it SHALL NOT use false urgency, countdowns or nagging (negative AC, FRD-09).
- **AC-10-006.5** — Tier colors SHALL come from FRD-13 tier tokens; state never by color alone (badge label present).

## Dependencies
- WO-10-001 (`computeChains`), WO-10-005 (page shell). Intra-feature.
- FRD-09 `CMP-09-xp-bar`. FRD-13 tier tokens. Cross-feature.

## TDD plan
1. RED: tests for chain card (tier/badge/bar/next name/pips/date+project), "Almost there" ordering, "no false urgency", endowed-honest bar, tokens/not-color-alone.
2. GREEN: implement.
3. Refactor.

## Definition of done
- Component tests green incl. negative ACs; tsc + biome clean; tokens only. `.pandacorp/verify.sh` passes.

## Status Note

Built and delivered:

**Files delivered:**
- `app/achievements/ChainCard.tsx` — `ChainCard` (CMP-10-chain-card): tier pips, current tier badge, honest endowed-progress bar (reuses `XpBar`), next tier name, unlock date+project per tier.
- `app/achievements/AlmostThere.tsx` — `AlmostThere` (CMP-10-almost-there): top ≤3 chains by pctToNext descending, excluding maxed chains; no false urgency language anywhere.
- `app/achievements/ChainCard.test.tsx` — 45 tests RED→GREEN covering AC-10-006.1..5 including all negative ACs.

**Interfaces/contracts exposed:**

```tsx
// ChainCard — app/achievements/ChainCard.tsx
export function ChainCard({ chain }: ChainCardProps): React.JSX.Element
// data-testid="chain-card"                — article root
// data-testid="chain-label"               — chain name
// data-testid="chain-tier-badge"          — text badge; data-tier={0..5} (0=no tier)
// data-testid="chain-pip-{i}"             — one pip per tier; data-filled="true"|"false"
// data-testid="chain-xp-bar-wrapper"      — wraps CMP-09-xp-bar
// data-testid="chain-next-tier-name"      — "Siguiente: <name>" (absent when maxed)
// data-testid="chain-unlock-item"         — one per unlocked tier; shows date + project

// AlmostThere — app/achievements/AlmostThere.tsx
export function AlmostThere({ chains }: AlmostThereProps): React.JSX.Element
// data-testid="almost-there"              — section root
// data-testid="almost-there-item"         — one per shown chain (max 3)
// data-testid="almost-there-empty"        — shown when no chains qualify
```

**Integration seams:**
- Consumes `ChainState` from `computeChains()` (`lib/achievements.ts` IF-10-chains, WO-10-001).
- Reuses `XpBar` from `components/rpg/XpBar.tsx` (CMP-09-xp-bar, WO-09-004) — no custom bar.
- Tier color tokens: `var(--color-tier-1..5, <fallback>)` — fallback to existing agent tokens until FRD-13 defines them explicitly.
- Ready to be embedded in `app/achievements/page.tsx` (WO-10-005 hall page) under its "Misiones" or "Resumen" tab.

**Test coverage:** `app/achievements/ChainCard.test.tsx` (45 tests, 177/177 files green).

**Gate:** verify.sh PASS — biome clean, tsc clean (0 new errors), vitest 4904/4904 green.
</content>
