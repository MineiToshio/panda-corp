---
id: BP-03
---
# Blueprint (bench-medium frd-03-search-filters, Build Plan section verbatim)

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-03-001 | WO-02-001 | `src/lib/taskFilters.ts`, `src/lib/_tests/taskFilters.test.ts`, `src/lib/schemas/taskQuery.ts`, `src/lib/schemas/_tests/taskQuery.test.ts`, `src/server/queries/task.ts`, `src/server/queries/_tests/taskList.test.ts`, `src/app/api/v1/projects/[id]/tasks/route.ts`, `src/app/api/v1/projects/[id]/tasks/_tests/list.test.ts`, `e2e/task-search-api.spec.ts`, `docs/api/wo-03-001.md` | false | WO-02-002 |
| WO-03-002 | WO-02-002, WO-03-001 | `src/app/projects/[id]/_components/TaskFilters/**`, `src/app/projects/[id]/page.tsx`, `e2e/task-filters.spec.ts` | false | none |

- **Order & parallelism:** wave W5 runs WO-03-001 next to WO-02-002 (disjoint artifacts: WO-03-001 touches the data layer, schemas and the API route; WO-02-002 touches the page and its `_components/`, never `TaskFilters/`). WO-03-002 runs alone in wave W6 after both.
- **Intentional overlaps, serialized:** `src/server/queries/task.ts` and `src/app/api/v1/projects/[id]/tasks/route.ts` (WO-02-001 creates, WO-03-001 modifies; `dependsOn WO-02-001`); `src/app/projects/[id]/page.tsx` (WO-02-002 creates, WO-03-002 modifies; `dependsOn WO-02-002`). WO-03-001's `src/server/queries/_tests/taskList.test.ts` and `.../tasks/_tests/list.test.ts` are new files next to WO-02-001's own tests (unique names).
- **Integration order:** query schema and pure pipeline, then the list function and the route, then the contract file `docs/api/wo-03-001.md`; then the URL builder, the form, count, no-match and pagination components, then the page composition that wires them.
- **Cross-FRD dependencies:** WO-03-001 on WO-02-001 (FRD-02); WO-03-002 on WO-02-002 (FRD-02) and WO-03-001. Transitively FRD-03 sits after the FRD-01 foundation (WO-01-001..003) and WO-01-004. FRD-03 is the last feature in the cross-FRD order (wave W6).
- **API contract owners:** WO-03-001 owns `docs/api/wo-03-001.md` (the full list-endpoint query contract, IF-03-list-endpoint-query); WO-03-002 consumes it only after WO-03-001 is done. WO-02-001 keeps `docs/api/wo-02-001.md` for the Task resource and the other task endpoints.
- **Visual spec (UI WO-03-002):** reproduce `docs/frds/frd-03-search-filters/mocks/project-filters.html` (filtered, page 2 of 2), `mocks/project-filters-no-match.html` and `mocks/project-filters-defaults.html` with `fdd.md`, at 390 px and 1280 px, light and dark, on `docs/design/design-tokens.json` and `DESIGN.md`. Only the filter form, the count, the no-match sentence and the pagination block are this feature's; the rest of each mock is FRD-02's. Screenshots in `mocks/screenshots/`.
- **Assets:** none (no images, icons or external fonts; the system font stack is in the layout).
- **Gate notes:** every `GET` path still returns 4xx only through `problem` (API contract gate); the data-layer gate is unaffected (queries import only the client type); knip runs over the whole project at every FRD gate and flags an exported symbol nobody imports (including a type or constant used only in its own file), so every export is imported by a test of its owning WO (see Risks; production consumers come on top) and the remaining types stay module-local. Surfaces in `e2e/routes.ts` are seeded and blessed by the FRD gate, not by these WOs.
- **Dependency versions:** no package is added.

## Next
