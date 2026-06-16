# FRD-03 — Work orders

The **portfolio rail + project navigation + read-only path-not-found recovery**. Composes the FRD-01
data layer; hosts the FRD-04 workspace in its right panel. See the feature blueprint
([`../blueprint.md`](../blueprint.md)) and the platform architecture
([`../../../product/architecture.md`](../../../product/architecture.md)).

## Work orders

| WO | Title | Artifact | Depends on |
|---|---|---|---|
| WO-03-001 | `activeProjects` compose helper | `lib/portfolio.ts` (`activeProjects`) | FRD-01 (`readPortfolio`, `readStatus`, `pathExists`) |
| WO-03-002 | Project rail + rows + indicators | `app/portfolio/page.tsx`, `components/ProjectRail.tsx`, `components/ProjectRow.tsx` | WO-03-001 |
| WO-03-003 | Business snapshot (shipped) | `components/BusinessSnapshot.tsx` | WO-03-002 |
| WO-03-004 | Selection + default + workspace slot | `app/portfolio/page.tsx` | WO-03-002, FRD-04 (workspace) |
| WO-03-005 | Empty state + path-not-found recovery | `components/PortfolioEmpty.tsx`, `components/RecoveryHint.tsx` | WO-03-001, FRD-02 (`CopyButton`) |

## Ordering & parallelism

- **WO-03-001 first** — the compose helper that everything renders from (pure-ish, fully testable
  with fixtures).
- After WO-03-001: **WO-03-002** (rail) then **WO-03-003** (snapshot) and **WO-03-005** (empty +
  recovery) parallelize. **WO-03-004** (workspace slot) needs FRD-04's workspace component to host;
  until FRD-04 lands, stub the slot (render a placeholder) so selection/default-select are testable
  independently.

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
