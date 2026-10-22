# Work orders — FRD-01 Data reading layer

> The authoritative order and parallelism is the **Build Plan** in `../blueprint.md` (the build engine reads
> that, not this). This file is the readable summary. Each work order is a coarse slice (one reader module or
> capability), carries its own `implementation_status` frontmatter and its own artifacts.
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

The **data layer**: one reader per work order with its TDD fixtures, testable in isolation through
`PANDACORP_FACTORY_ROOT`, plus (v2) the fixture seams of the fidelity gate. v1 work orders (000 to 009)
stay live and `VERIFIED`; WO-01-010 and WO-01-011 are new. FRD-01 is REQ-only by design (it defines no
`AC-01-*` bullet), so no work order owns an acceptance criterion; they trace to `REQ-01-MMM` in the
blueprint (§ Requirement → component traceability).

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-01-000 | test-fixtures | VERIFIED | — | Fixture factory trees and the `withFactoryRoot` harness every reader test uses. |
| WO-01-001 | path-exists | VERIFIED | WO-01-000 | `pathExists`, the read-only existence probe. |
| WO-01-002 | read-profile | VERIFIED | WO-01-000 | `readProfile`: presence and parse; absence drives the onboarding gate. |
| WO-01-003 | read-ideas | VERIFIED | WO-01-000 | `readIdeas`: idea cards with their frontmatter. |
| WO-01-004 | read-portfolio | VERIFIED | WO-01-000 | `readPortfolio`: the portfolio table into project rows. |
| WO-01-007 | read-events | VERIFIED | WO-01-000 | `readEvents`: capped tail, project filter before the cap, live and no-signal inputs. |
| WO-01-005 | read-status | VERIFIED | WO-01-000, WO-01-001 | `readStatus`: partial-tolerant `status.yaml` plus live inbox counts. |
| WO-01-006 | read-project-docs | VERIFIED | WO-01-000, WO-01-001 | `readProjectDocs`: the feature-centric `docs/` tree and `.pandacorp/` comms. |
| WO-01-008 | onboarding-gate | VERIFIED | WO-01-002 | The onboarding gate instead of the app when there is no profile. |
| WO-01-010 | fixture-seams | PLANNED | WO-01-000, WO-01-001 | v2: `now()`, `runGit()`, the env contract and `pnpm dev:oracle` for the fidelity gate. |
| WO-01-009 | live-transport-sse | VERIFIED | WO-01-005, WO-01-007, WO-05-001 | The shared SSE transport (`/api/live`) and `useLiveSnapshot`. |
| WO-01-011 | adopt-seams | PLANNED | WO-01-010, WO-10-014, WO-23-006, WO-14-001, WO-14-005, WO-17-003, WO-17-005, WO-17-008, WO-09-006, WO-01-009, WO-15-003, WO-21-003 | v2: route the kept readers' clock and git calls through the seams. |

> **Depends on** mirrors each work order's `dependsOn` frontmatter (DR-087). **Status** is the
> `implementation_status` of the work order.

## AC coverage

FRD-01 defines no acceptance criterion; every work order is AC-less by design and traces to `REQ-01-MMM`.
WO-01-010 and WO-01-011 enable the oracle-mode states of FRD-04, FRD-10 and FRD-18.

## Build order

Waves come from the Build Plan: W0 WO-01-000; W1 WO-01-001, WO-01-002, WO-01-003, WO-01-004, WO-01-007
(parallel); W2 WO-01-005, WO-01-006, WO-01-008, WO-01-010 (parallel); W3 WO-01-009; W5 WO-01-011. Cross-FRD:
WO-01-009 needs WO-05-001; WO-01-011 needs the owners of the readers it migrates (FRD-09, 10, 14, 15, 17,
23); WO-21-003, WO-03-007 and WO-10-016 depend on WO-01-010.

## Definition of done (every work order)

- Tests written first (RED), then GREEN, then refactor; run against the fixture tree, never the live factory.
- `.pandacorp/verify.sh` green: biome, `tsc --strict`, vitest, knip, madge.
- Readers are fail-soft and honest per the blueprint's tolerance rules (no throw on missing or malformed
  input, no silent empty success).
- No write to disk, no Claude / AI dependency in `package.json`.

## Superseded (v1 history)

None. All v1 work orders of this FRD are kept live; their `- **AC-…**` style bullets were rewritten as plain
`v1 AC-01-…` history lines (FRD-01 defines no AC).
