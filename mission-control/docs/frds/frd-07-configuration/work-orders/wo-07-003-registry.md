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
</content>
