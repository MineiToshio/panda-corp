---
id: WO-07-003
type: work-order
slug: registry
title: 'WO-07-003 — `lib/registry.ts`: read decision rules'
status: DRAFT
parent: FRD-07
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-07-003 — `lib/registry.ts`: read decision rules

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-07-registry`](../blueprint.md#3-components--interfaces).

## Goal
Implement `readDecisionRules()` in `lib/registry.ts`: parse `factory/decisions/registry.yaml`
(`decisiones[]`) into typed rules. **No hand-copied list** (DR-046).

## Acceptance criteria (EARS, from FRD-07 + DR-046)
- **AC-07-003.1** — WHEN `readDecisionRules()` runs, it SHALL return one entry per item in `decisiones[]` with `id`, `patron`, `default`, `requiereHumano: boolean` and optional `nota`.
- **AC-07-003.2** — The `requiereHumano` field SHALL map directly from `requiere_humano`; a missing value SHALL default to `false` and SHALL NOT throw.
- **AC-07-003.3** — The reader SHALL tolerate extra/unknown YAML keys without failing (forward-compatible).
- **AC-07-003.4** — WHEN the file is missing or unparseable, the reader SHALL return an empty list with a typed warning, never throw (architecture §7 graceful degradation).
- **AC-07-003.5** — The reader SHALL read from `resolveFactoryRoot()` (FRD-01) for fixture testing.

## Dependencies
- FRD-01 `lib/config.ts`. Cross-feature.
- Libraries: `yaml` (architecture §2), Node `fs`.

## TDD plan
1. Fixture `registry.yaml` (a `requiere_humano: true` rule, a `false` rule, one with a `nota`, one with extra keys) + a missing-file case.
2. RED: tests for field mapping, boolean default, extra-keys tolerance, missing-file → `[]`.
3. GREEN: implement `readDecisionRules()`.
4. Refactor.

## Definition of done
- `pnpm vitest run lib/registry.test.ts` green; tsc + biome clean; no `any`/`@ts-ignore`.
- `.pandacorp/verify.sh` passes.

## Status Note

**Built:** `lib/registry.ts` — `readDecisionRules()` pure reader for
`factory/decisions/registry.yaml`. Parses `decisiones[]` into typed `DecisionRule[]`.
No hand-copied list (DR-046). Read-only — zero writes.

**Interface/contract exposed (`IF-07-registry`):**
```ts
// lib/registry.ts
export type DecisionRule = {
  id: string;
  patron: string;
  default: string;
  requiereHumano: boolean;
  nota?: string;
};

export function readDecisionRules(): DecisionRule[];
// Never throws. Missing/unparseable YAML → [].
// Reads from resolveFactoryRoot() (PANDACORP_FACTORY_ROOT override for tests).
```

**Integration seams:**
- Reads `factory/decisions/registry.yaml` via `resolveFactoryRoot()` from `lib/config.ts` (FRD-01).
- Uses `yaml` package (`parse`) already in the dependency graph (architecture §2).
- Consumed next by: `CMP-07-rules-list` / `CMP-07-rule-detail` (WO-07-008) and `lib/reference.ts` (FRD-08 Manual).
- The `requiereHumano` boolean directly drives the auto-approves (●) / asks-you (●) indicator in the UI.

**Test file:** `lib/registry.test.ts` — 33 tests covering all five ACs:
- AC-07-003.1: field mapping (id/patron/default/nota) for all four fixture entries.
- AC-07-003.2: `requiereHumano` true/false/absent→false, never throws.
- AC-07-003.3: extra unknown YAML keys tolerated; not exposed on returned shape.
- AC-07-003.4: missing file → `[]`, unparseable YAML → `[]`, empty file → `[]`,
  missing `decisiones` key → `[]`, non-existent factory root → `[]`.
- AC-07-003.5: fixture-testing via `PANDACORP_FACTORY_ROOT` env override confirmed.
- Shape invariants: every returned rule has correct TypeScript types.
- Malformed entries (missing id/patron/default) skipped; valid entries still returned.
</content>
