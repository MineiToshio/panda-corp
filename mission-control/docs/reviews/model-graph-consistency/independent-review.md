# Independent model/DAG consistency review

Scope: native Fullscreen API and Architecture graph toolbar parity, retaining diagram-only expansion, full-width entity fields, existing ELK graph/source contracts. Reviewer writes tests only; no production, docs, git or build-state mutations.

## RED evidence

Command: `pnpm exec vitest run src/components/modules/DataModelViewer/_tests/fullscreen.consistency.reviewer.test.tsx --reporter=dot`

Result against existing viewer before implementation: 3 failed / 3 passed. Native request not invoked, fullscreenchange cannot close native presentation because none is requested, native minimize control absent. Missing/denied/throw fallback behavior passes its pre-existing modal implementation. Full log: `/tmp/model-consistency-red.log`.

Harness correction: jsdom lacks dialog showModal/close methods, so tests explicitly install those browser-boundary shims and restore original descriptors after each test. Initial harness failure is superseded by the behavior-specific RED run above.

## Independent findings and repair

The first implementation preserved native entry/minimize and one canvas, but reopening via the new icon restored focus to the separate text trigger. Four reviewer tests caught that accessibility regression (`/tmp/model-consistency-native.log`). Lead corrected restoration according to the initiating control; the tests now pass for both native Escape/fullscreenchange and all three fallback paths. Existing text-trigger restoration tests remain unchanged in their assertions.

## GREEN evidence

Independent command: `pnpm exec vitest run src/components/modules/DataModelViewer/_tests 'src/app/projects/[slug]/_observability/WoDag/_tests' --reporter=dot`

Result: 17 test files / 109 tests passed (`/tmp/model-consistency-green.log`). Includes all model layout/routing/hostile-ID/asynchronous engine tests, viewer acceptance and dependency map regression tests. Added 6 native/fallback tests and 3 frame scheduling tests. Frame tests prove a burst publishes once while accumulating deltas, direct reset/fit cancels a stale scheduled frame, and unmount cancels a queued commit.

Existing tests adapted only for superseded UI scheduling/contracts: Zoom status output became the percentage button; reset now clicks that button; modal's last focus target is the searchbox in the new DOM order; wheel/drag position oracles wait for their animation frame. The wheel assertion was strengthened to prove additional movement beyond the preceding button zoom. Existing geometry, field, relationship, async layout, source, selection, schema, and focus restoration oracles remain.

Biome passes on all four reviewer-touched test files. ESLint reports 0 errors; the existing DataModelViewer test's two no-node-access warnings on its pre-existing activeElement assertion remain. Both newly authored reviewer files pass ESLint without warnings.

## Source inspection

`WoDag/ZoomControls.tsx` delegates to `modules/GraphControls/GraphControls.tsx`; `DataModelViewer/DiagramControls.tsx` delegates to the same component. Both routes share the top-right icon toolbar CSS and the browser hook via `src/hooks/useFullscreen.ts`, avoiding two visual implementations. With live `globals.css` base spacing = 1rem, the promoted toolbar preserves the reference 8px top/right and 26px icon targets at the default 16px root scale.

`useModelExpansion.open` flushes the expanded DIV into the DOM before calling native toggle within the synchronous gesture. The requested fullscreen element is a model-only DIV, not the fallback dialog. Model schema/source/tabs are outside it. Expanded search and toolbar remain inside the fullscreen target. Native fullscreenchange closes the modal presentation and returns focus; unsupported, rejected and throwing API paths retain a keyboard-dismissable dialog.

`useFrameView` batches wheel/drag updates via requestAnimationFrame while direct actions cancel pending frames. EntityCard/ModelEdges memoization retains their existing field/geometry implementation; ModelDiagram supplies a stable selection callback. No new diagram-source/layout/routing/parser behavior appears in the reviewed change.

## Verdict and limits

PASS for scoped correctness/requirements review, with no remaining blocking finding in the inspected code or 109-test regression surface. Actual browser-native fullscreen/visual checks, canonical full verify.sh gate, build/push and deployment are owned by the lead and were not run or claimed by this reviewer. No production/docs/git/build-state files were mutated by the reviewer.
