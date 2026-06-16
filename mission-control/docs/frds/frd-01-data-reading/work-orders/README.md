# FRD-01 — Work orders

The **data layer**. Each work order is one reader module + its TDD fixtures (RED → GREEN →
refactor), testable in isolation via `PANDACORP_FACTORY_ROOT` pointing at a fixture tree. No
production UI here except the onboarding gate (the only `app/` surface FRD-01 owns).

See the feature blueprint ([`../blueprint.md`](../blueprint.md)) for components/interfaces and the
platform architecture ([`../../../product/architecture.md`](../../../product/architecture.md), §4
data model, §6 `lib/**`).

## Work orders

| WO | Title | Module | Depends on |
|---|---|---|---|
| WO-01-000 | Test fixtures + `PANDACORP_FACTORY_ROOT` harness | `tests/fixtures/factory/**` | — |
| WO-01-001 | `pathExists` read-only probe | `lib/fs-utils.ts` | WO-01-000 |
| WO-01-002 | `readProfile` (presence + parse) | `lib/profile.ts` | WO-01-000 |
| WO-01-003 | `readIdeas` (cards + frontmatter) | `lib/ideas.ts` | WO-01-000 |
| WO-01-004 | `readPortfolio` (table parse) | `lib/portfolio.ts` | WO-01-000 |
| WO-01-005 | `readStatus` (yaml, partial-tolerant) | `lib/status.ts` | WO-01-000, WO-01-001 |
| WO-01-006 | `readProjectDocs` (feature-centric tree) | `lib/docs.ts` | WO-01-000, WO-01-001 |
| WO-01-007 | `readEvents` (capped tail + diffs) | `lib/events.ts` | WO-01-000 |
| WO-01-008 | Onboarding gate (UI) | `components/OnboardingGate.tsx` + `app/layout.tsx` guard | WO-01-002 |

## Ordering & parallelism

- **WO-01-000 first** — every other WO consumes the fixture tree. Blocking.
- After WO-01-000, the pure readers **parallelize fully**: WO-01-002, -003, -004, -007 are
  independent of each other. WO-01-001 (`pathExists`) is tiny and should land early because
  WO-01-005 and WO-01-006 depend on it.
- **WO-01-008 (onboarding gate)** is the only UI; depends on `readProfile` (WO-01-002). It also
  wants a copy affordance — if `components/CopyButton.tsx` (FRD-02 WO-02-002 / FRD-03) is not yet
  available, ship a minimal inline copy button and let FRD-02 consolidate later.

## Cross-feature dependencies (outbound)

Almost everything downstream depends on this layer:
- FRD-02 (`lib/board.ts`, `lib/next-step.ts`, `lib/discard.ts`) consumes `readIdeas` + `readStatus`.
- FRD-03 (portfolio) consumes `readPortfolio` + `readStatus` + `pathExists`.
- FRD-04/05 consume `readStatus` + `readProjectDocs`.
- FRD-06/12/18 consume `readEvents`.

## Definition of done (every WO)

- Acceptance-criteria tests written **first** (RED), then GREEN, then refactor.
- Tests run against the fixture tree (WO-01-000), never the live factory.
- `.pandacorp/verify.sh` green: `pnpm biome check .` → `pnpm tsc --noEmit` → `pnpm vitest run`.
- Reader is fail-soft per blueprint §3 (no throw on missing/malformed input).
- No write to disk, no Claude/AI dependency added to `package.json`.
