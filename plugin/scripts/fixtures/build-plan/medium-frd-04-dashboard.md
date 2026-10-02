---
id: BP-04
---
# Blueprint (bench-medium frd-04-dashboard, Build Plan section verbatim)

## Build Plan

FRD-04 has a single work order. The whole-product DAG (10 WOs, six waves) is in `docs/frds/frd-01-projects/blueprint.md`, Build Plan.

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-04-001 | WO-01-001, WO-01-002, WO-01-003 | `src/server/queries/stats.ts`, `src/server/queries/_tests/stats.test.ts`, `src/app/api/v1/stats/route.ts`, `src/app/api/v1/stats/_tests/**`, `src/app/page.tsx`, `src/app/_components/**`, `e2e/dashboard.spec.ts`, `docs/api/wo-04-001.md` | false | WO-01-004 |

- **Order & parallelism:** WO-04-001 runs in wave 3, once the foundation (WO-01-001, WO-01-002, WO-01-003) is VERIFIED, in parallel with WO-01-004. Its artifacts are disjoint from it: it writes only the files above; WO-01-004 writes `src/server/queries/project.ts` and its `_tests/project.test.ts`, the project schema and the project routes, `e2e/projects-api.spec.ts`, `docs/api/wo-01-004.md`. The shared folder `src/server/queries/_tests/` is split by file name, never globbed. `src/app/page.tsx` replaces the placeholder page (an `<h1>` `Tablero` only) left by WO-01-001, serialized by `dependsOn WO-01-001`; no other WO touches it or `src/app/_components/`.
- **Integration order:** foundation seams (dates, types, db, api helpers, catalog, primitives) → `getStats` and its tests → `docs/api/wo-04-001.md` → the route handler → the route-owned components → the page → the e2e spec.
- **Cross-FRD dependencies:** the three FRD-01 foundation WOs above (read/imported, never modified). No other FRD depends on WO-04-001. FRD-02's task badge shares `isOverdue` from WO-01-003 with this WO; neither owns the rule.
- **API contract owner:** WO-04-001 owns `docs/api/wo-04-001.md` (`GET /api/v1/stats`). It has no consumer WO.
- **Visual spec:** `docs/frds/frd-04-dashboard/mocks/dashboard.html` (populated) and `mocks/dashboard-empty.html` (empty), with `fdd.md` and the screenshots in `mocks/screenshots/`, on `docs/design/design-tokens.json`. No external assets (no images, icons or web fonts; the system font stack comes from the tokens).
- **Gate notes:** the FRD-04 gate runs the browser gates on `/` (surface `dashboard` already seeded in `e2e/routes.ts`, `blessed: false`; blessing is the gate's call). knip runs over the WHOLE project at every per-FRD gate and flags an exported symbol or type with no importer (a test import counts as a consumer), so every export is imported by a test of its OWNING WO: here `getStats` and each component are imported by WO-04-001's own tests (on top of the page and route), so it adds no unused export at the FRD-04 gate after wave 3. knip also flags an exported type or constant used only inside its own file, so the `StatsList` term-order tuple and any props types stay module-local (not exported).
- **Dependency versions:** no package is added by this WO.

## Next
