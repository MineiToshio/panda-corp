# Independent Mission Control usability review

Scope: relationship toggle, collapsed native schema disclosures with retained content, integrated responsive shell dismissal, Architecture order and service rationale preservation. Reviewer owns tests only; production/docs/git/build state remain lead-owned.

## RED evidence

- Model and shell: 8 failed / 1 passed across 2 files, `/tmp/mc-usability-red.log`. Relationship click/Enter/Space deselection fails, schema initially visible, shell remains open after destination/Escape/outside/route change. Direct relationship switching and entity neighborhood behavior passes.
- Architecture: 1 failed / 1 passed, `/tmp/mc-usability-architecture-red.log`. Existing order places model before services. Vendor-specific operational rationale is already preserved even when vendor appears in stack; regression oracle requires it remain preserved.

Browser-native text selection, responsive geometry/caps and final fullscreen behavior are lead-owned. ## Clarification and test-oracle adjustments

Lead confirmed the owner's explicit wording is one table at a time: native exclusive accordion via shared `details[name]`, each initially closed, re-click closes. The independent disclosure test retains all field/type/composite-key/relation-mapping assertions and checks each open/close path; browser enforcement of name-group exclusivity must be proved in a real browser because installed jsdom does not enforce it.

Two intermediate shell failures were test overreach, not production defects: outside means outside the menu, not outside the entire header; a route-keyed disclosure may remount its toggle, so route dismissal must query the live post-navigation button rather than assert against a detached DOM node. The corrected suite checks pointer interaction inside the menu leaves it open, outside interaction closes it, Escape restores focus, same-route link and slotted Propuestas destination both close it, and route changes reset live disclosure state.

## GREEN evidence

Independent command: `pnpm exec vitest run src/components/modules/DataModelViewer/_tests src/components/modules/AppShell/_tests src/components/modules/Nav/_tests src/app/board/_components/CardDetail/ArchitectureDigest/_tests 'src/app/projects/[slug]/_observability/WoDag/_tests' --reporter=dot`

Result: 24 files / 146 tests passed, `/tmp/mc-usability-green.log`. This preserves model geometry/routing/cardinality/source/async engine and fullscreen tests, architecture live-data/DAG integration, shell landmark/slots/exempt routes, and navigation active-route/href behavior.

New reviewer tests: 3 files only, with 12 acceptance cases. Existing tests adapted only in DataModelViewer.test.tsx and viewer.reviewer.test.tsx: click schema entity disclosures before existing field/key/mapping/search-visibility assertions. No existing assertions removed. New test files are ESLint/Biome clean; all five touched files pass Biome. Existing DataModelViewer test retains its two pre-existing no-node-access warnings, no ESLint errors.

## Live source inspection

- DataModelViewer selection callback toggles only when both previous and requested selection are the same relationship ID. Entity neighborhood highlighting does not accidentally deselect an edge on its first direct selection. Click, Enter and Space use the same public relationship callback.
- ModelSchema uses native details/summary, initially without open, unique viewer-level name grouping, and unchanged schemaText formatter preserving attributes/types/optional flags/keys/relationship mapping and cardinalities. CSS schema layout is a single flex column, natural pre height (old 560px cap removed), with user-select:text. Diagram entity cards have user-select:none plus WebKit prefix, also in the same fullscreen diagram rendering. Canvas pointerdown clears prior text selection.
- AppShell header owns brand, actions/toggle and destination area as direct grid children. Phone/tablet breakpoint is 1100px; open region spans both columns, phone destinations use two columns and tablet three. ShellNavigation resets through pathname key, closes through capture of descendant anchor clicks (including slotted badge), document pointerdown outside menu/toggle, and Escape with focus return. Listeners clean up when closed/unmounted.
- Architecture renders Stack then ServicesBand then DataModel then separate EnvBand. ServicesBand renders every authored title/description; there is no vendor-name deduplication/filter. New copy distinguishes technology choices from operational flows.
- Shell's former 1240px cap and shared digest/pitch 920px inner caps are removed. Existing hero prose 720px limits and architecture plan text 640px limit remain; full-width table/model surfaces no longer inherit those caps.

## Browser artifact inspection

Independently read the completed `/tmp/mc-usability-browser.log`: 16 passing cases, 12 shell cases at 320/390/768/1024/1280/1600 in light/dark plus 4 real Panda architecture cases at 390/1600 in light/dark. Architecture logs report actual native fullscreen, no table text selection, native details-name exclusivity with 39 entities, Stack→services→model→environment order, and model width matching article width (366px phone / 1560px wide). No page errors in those cases.

Visually inspected these produced artifacts directly: 320-light navigation, 390-dark navigation, 1024-light navigation, 1600-dark desktop shell, 390-dark collapsed schema, 390-light expanded schema, 1600-dark expanded schema, 1600-light collapsed schema. The header is integrated with a right-side toggle and full-width destination grid; desktop navigation stays one row. Schema is one full-width column, closed entities remain compact, expanded 21-field ContentItem uses natural height and preserves full code with intentional horizontal scrolling for long relation lines. No blocking visual finding in those inspected artifacts.

Browser Range canary correction: user-select:none causes toString() to omit selected diagram text even when a noncollapsed programmatic Range exists. A complete native click may recreate a collapsed browser caret after the application clears selection. Correct oracle is noncollapsed Range before pointer interaction, then empty text plus collapsed selection afterward, rather than requiring rangeCount zero after a complete click. Production did not change for this harness correction.

## Persistent browser regression tests

At lead's explicit delegation, added only `e2e/model-usability.spec.ts` and `e2e/shell-usability.spec.ts`: 9 declared tests / 18 project-expanded cases, listed successfully by Playwright. Both pass Biome and ESLint. They use gotoHydrated and the frozen Mission Control fixture with 6 entities, not the owner's 39-entity Panda data.

Model cases exercise actual SVG path midpoint mouse clicks/double-click, Enter/Space toggles/direct switching; native fullscreen field non-selection, noncollapsed→collapsed Range clearing; all 6 disclosures initially closed, browser-enforced exclusive opening, single-column bounds, preserved composite keys/types/relationship declarations, natural pre height and copyable schema text. Shell cases exercise 320px phone dismissal via Escape/outside/current link/navigation, 1024px tablet integrated menu, 1600px full available width/one desktop row, in both themes. Shell bounds intentionally inspect header/menu/body; root HTML's pre-existing clipped board columns are outside this shell change.

Persistent E2E execution and the canonical full gate remain lead-owned. No server, production build, push, deployment, canonical docs, git state or build state were mutated by this reviewer.

## Verdict

PASS for scoped correctness and visual artifact review. Independent 146-test regression is green, new persistent E2E suites are ready for lead execution, and no blocking implementation finding remains in the reviewed surface. Final full-gate/build/deploy assertions must use the lead's execution evidence.



## Integration addendum — 2026-10-17

Re-read live HEAD (`5e5198cb`, concurrent BL-0239 change) and all six unstaged files after the lead preserved/repositioned the candidate onto that base. The unstaged delta is 8 insertions / 10 deletions: removal of an obsolete two-up comment, updates to stale width/disclosure comments, and formatting of PipelineDetail's newly integrated explanation. The explanation's wording is preserved.

Independent deterministic check compared each working file with its index version. Installed TypeScript transpilation with JSX output and removeComments:true emits byte-identical JavaScript for all five TSX files, including PipelineDetail (therefore its rendered JSX text is unchanged). globals.css emits equivalent rules after stripping comments and normalizing whitespace. All six comparisons PASS. This addendum records no functional change and the scoped review remains PASS. The integrated canonical gate and final production build/E2E remain lead-owned; their reruns are not asserted from prior results. Reviewer wrote only this /tmp report addition for this integration check.
