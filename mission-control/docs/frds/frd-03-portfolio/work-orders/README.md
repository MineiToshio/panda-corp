# FRD-03 — Work orders

The **portfolio rail + project navigation + read-only path-not-found recovery**. Composes the FRD-01
data layer; hosts the FRD-04 workspace in its right panel. See the feature blueprint
([`../blueprint.md`](../blueprint.md)) and the platform architecture
([`../../../product/architecture.md`](../../../product/architecture.md)).

## Work orders

> **Phase 2 re-plan (2026-06-19).** The `lib/**` compose helper stays **VERIFIED** and untouched. The
> UI WOs are collapsed into **one coarse presentational WO** (`PLANNED`) re-painting the whole
> `/portfolio` surface onto the FRD-13 foundation primitives to match the prototype. The old
> fine-grained UI WOs (rail, business-snapshot, selection-slot, empty/recovery) were removed —
> `BusinessSnapshot` is **deferred** (not built); the rest folds into the coarse WO. See the **Build
> Plan (Phase 2)** in `../blueprint.md`.

| WO | Status | Title | Artifact | Depends on |
|---|---|---|---|---|
| WO-03-001 | VERIFIED (lib) | `activeProjects` compose helper | `lib/portfolio.ts` (`activeProjects`) | FRD-01 (`readPortfolio`, `readStatus`, `pathExists`) |
| WO-03-002 | VERIFIED (UI) | **Portfolio surface** — rail + table + rows + empty + recovery + status chips | `app/portfolio/**`, `components/modules/{ProjectRail,ProjectRow,PortfolioTable}/**` | FRD-13, WO-03-001 (lib), FRD-04 (workspace slot — stub) |

> **Deferred — not built:** `BusinessSnapshot` (shipped-project business snapshot) — FRD-03 "Out of
> scope / Future". The rail keeps conceptual space but renders nothing today.

## Ordering & parallelism (Phase 2)

- **Foundation first:** the coarse UI WO depends on **FRD-13** (the shared primitives) being VERIFIED;
  `RecoveryHint` refactors onto the shared `Banner`, StatusChips onto `CountBadge`.
- **Single coarse WO** — the whole `/portfolio` page is one cohesive surface; no intra-FRD
  parallelism. The compose helper (WO-03-001) is consumed as-is — never re-planned.
- The workspace slot hosts FRD-04's component; until FRD-04 lands, stub the slot so
  selection/default-select stay testable.

## Cross-feature dependencies

- **Inbound:** FRD-01 `readPortfolio` + `readStatus` + `pathExists` (WO-03-001 cannot pass without
  them). FRD-02 `components/CopyButton.tsx` (recovery command) and `lib/next-step.ts` (optional next
  command). FRD-04 workspace component (WO-03-004 host).
- **Outbound:** the portfolio rail is the navigation entry to FRD-04 workspaces.

## Definition of done (every WO)

- Acceptance-criteria tests first (RED → GREEN → refactor) with fixtures (`PANDACORP_FACTORY_ROOT`).
- `.pandacorp/verify.sh` green (biome + tsc + vitest).
- `data-testid` on interactive elements; Spanish UI copy via i18n; design tokens only;
  `tabular-nums` on metrics.
- **Read-only:** never clones, never writes the portfolio, never calls Claude; no AI dependency added.
