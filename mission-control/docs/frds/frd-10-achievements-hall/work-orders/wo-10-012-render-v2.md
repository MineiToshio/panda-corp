---
id: WO-10-012
type: work-order
slug: render-v2
title: 'WO-10-012 — Render v2: rarity gem + NUEVO badge + new axis icons + Seals shelf + sagas'
status: ACTIVE
parent: FRD-10
implementation_status: PLANNED
source_requirements: []
artifacts: [src/app/achievements/UniquesSection/**, src/app/achievements/SecretsPanel/**, src/app/achievements/ChainCard/**, src/app/achievements/_components/HallTabs.tsx, src/app/achievements/_tests/**]
difficulty: high
dependsOn: [WO-10-011]
last_updated: '2026-06-29'
---
# WO-10-012 — Render v2 (surface the epic catalogue), no visual redesign

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. UX in
[`docs/achievements.md`](../../../achievements.md) §7. **Owner constraint: do NOT redesign the look** —
this is content + small additive UI on the EXISTING components/tokens (DR-062 visual coherence).

## In Scope
- `UniquesSection`: render the **per-trophy rarity** as a colored gem/border (reuse `rarityColor`)
  **plus a text label** (never color alone, WCAG 1.4.1) + an estimated-rarity blurb; add the **3 new
  axis** filter chips with icons (`Production` → `ti-package`, `Guild` → `ti-users-group`,
  `Resilience` → `ti-shield-bolt` — confirm against the icon set); show a **NUEVO** pip on trophies
  unlocked ≤7 days (from `isNew`).
- A **Seals shelf** (the 8 axis Seals + Grand Seal) in the Trofeos tab — locked Seals show their axis +
  "completa todos sus trofeos"; unlocked show the Seal.
- `SecretsPanel`: scale to the ~18 secrets (grid), hint-only when locked, criterion on unlock (existing
  contract).
- `ChainCard`/Misiones tab (`HallTabs`): group chains under **saga** headers (narrative section heads,
  reusing the existing section-head style).
- The page (`page.tsx`) passes the injected `now` to the engine for `isNew` and reads events **uncapped**
  for the achievements engine.

## Out of Scope
- Any change to the visual language/tokens (DR-062 — reuse sibling styles). The catalogue/predicates
  (WO-10-011), signals (WO-10-010), reader (WO-10-009).

## Acceptance criteria (EARS)
- **AC-10-012.1** — Each trophy SHALL show its rarity via gem/border color AND a text label AND an estimated-rarity blurb (not color alone).
- **AC-10-012.2** — The 8 axes SHALL appear as filter chips with icons; the new axes render with a distinct icon each.
- **AC-10-012.3** — A trophy with `isNew` SHALL show a NUEVO badge; secrets/locked never show it.
- **AC-10-012.4** — The Seals shelf SHALL show 8 axis Seals + Grand Seal with locked/unlocked states (not color alone).
- **AC-10-012.5** — Misiones chains SHALL be grouped under saga headers; the Hall SHALL remain **visually consistent** with the existing design (DR-062) — no new scale/palette.
- **AC-10-012.6** — The Preview Smoke Gate (DR-055) SHALL be green: `/achievements` renders all tabs without console error/blank with the real factory data.

## TDD plan
RED: component tests — rarity label present (by role/text), NUEVO badge boundary, axis chips render, Seals locked/unlocked, saga grouping. GREEN: implement on existing components. Browser smoke on `/achievements`.

## Definition of done
`pnpm vitest run app/achievements` green; tsc + biome clean; no `any`; Preview Smoke Gate green on `/achievements`; `.pandacorp/verify.sh` passes.
