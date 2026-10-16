# Independent review: shared Architecture and logical data model

Date: 2026-10-16. Reviewer: separate Codex JUDGE subagent. Scope: the owner-authorized manual feature, without launching the build engine or modifying project machine state. No commits were created by this reviewer.

## Verdict

PASS for scoped correctness and runtime behavior after one blocking defect was repaired by the implementation owner. This report does not replace the lead agent's canonical `verify.sh` gate. No remaining blocking finding was identified in the inspected feature.

The review used the latest owner requirements: Architecture immediately after Work orders (eight tabs), the complete shared Architecture component on board and Portfolio, exact “Modelo de datos” wording, diagram default at every width, compact field cards, pointer pan without native diagram scrollbars, and a compact code-style Esquema alternative.

## Independent evidence

- Broad affected regression run: **148 test files / 1,897 tests passed**. Command: `pnpm exec vitest run src/lib/architecture src/components/modules/DataModelViewer src/app/board src/app/projects src/app/portfolio --reporter=dot`. Output: [test-results.log](test-results.log).
- Final focused rerun after the camera and copy refinements: **16 files / 125 tests passed**. Output: [final-focused-tests.log](final-focused-tests.log).
- Independently ran `pnpm exec tsc --noEmit`: exit 0. Scoped Biome check of the seven reviewer-owned test/helper files: exit 0, no fixes.
- Browser exercised the actual Next app at isolated `127.0.0.1:3019`, using its E2E factory fixture and the fixture's six-entity/five-relationship artifact. The real Mission Control artifact separately validates as explicit `persistence: none`; the browser fixture is illustrative, not a claim that the real application uses a relational database.
- Both actual surfaces passed: board card → Architecture and `/portfolio?project=Mission%20Control&tab=architecture`. Desktop and 375px phone default to Diagram. All six field tables are present. Diagram overflow computes to `hidden`. Drag changes the stage transform by exactly the pointer displacement, with no native scrollbar.
- Both surfaces switch to six `<pre>` schema blocks with zero tables. Relation details explain cardinality in both directions and preserve field mappings. Expansion opens the native dialog; Escape closes it and returns focus to its trigger. Phone document width equals viewport width (375px), and both surfaces emitted zero page errors. Raw results: [browser-results.json](browser-results.json); reproducible probe: [browser-review.mjs](browser-review.mjs).
- Scoped axe WCAG 2/2.1/2.2 AA scan produced zero violations on both actual viewers. Dark mode was verified from browser media state (`prefersDark: true`) and computed root base color `#0f1517`, rather than inferred from a stored preference. Results: [a11y-results.json](a11y-results.json). An earlier scoped light-mode scan likewise returned zero violations.

The browser was closed before releasing the isolated server to the lead agent's canonical verification.

## Blocking defect found and resolved

Valid opaque entity IDs `__proto__`, `constructor`, and `toString` passed boundary validation but crashed Dagre 3.0.0 layout internals. The independent hostile-ID suite initially produced **three failures and two passes**. `layout.ts:82` then attempted to access missing `route.points`; other cases failed inside Dagre's acyclic traversal.

The implementation owner repaired the boundary by mapping authored entity and relationship identities to safe graph-only tokens. Current source: `src/components/modules/DataModelViewer/layout.ts:48`. Authored IDs remain intact in returned nodes, edges, references and selection. The preserved independent suite now passes all five opaque IDs, including punctuation and Spanish text. This is a bounded implementation repair, not a relaxation of source validation.

## Source review anchors

| Concern | Observed implementation |
| --- | --- |
| Bounded, explicit filesystem states | `src/lib/architecture/data-model/read-data-model.ts:7` bounds stat/read bytes, rejects non-files and invalid UTF-8 JSON, distinguishes missing from malformed source. |
| Single artifact bridge | `src/lib/architecture/read-artifacts.ts:9` supplies both board and workspace; a malformed JSON source cannot silently become “none”. |
| Full Architecture reuse | `src/app/projects/[slug]/ProjectWorkspace.tsx:269` renders the same `ArchitectureDigest` used by the board, including work orders, ADRs and environment sections. |
| Eight tabs and order | `src/app/projects/[slug]/_components/tabbar.tsx:47` places Architecture immediately after Work orders. |
| Data model section label | `src/app/board/_components/CardDetail/ArchitectureDigest/ArchitectureDigest.tsx:514` renders “Modelo de datos” with the viewer. |
| Compact schema, composite mappings | `src/components/modules/DataModelViewer/ModelSchema.tsx:5` serializes field types, optionality, keys, ordered composite groups and relations from the same model. |
| Field metadata | `src/components/modules/DataModelViewer/EntityCard.tsx:51` preserves field names, types, keys and optionality; composite keys are included at their fields. |
| No diagram scrollbar; pointer alternatives | `src/components/modules/DataModelViewer/viewer.module.css:62` uses hidden overflow; `useViewport.ts:63` implements pointer pan and `useViewport.ts:100` provides keyboard movement. |

## Reviewer-authored coverage and baseline change

Added independent tests for the real artifact, malformed and oversized collections, repeated composite references, foreign-language labels, composite identity and mapped ports, parallel/self/isolated entities, opaque IDs, schema mode, search, honest states and common board/workspace artifact resolution. Shared review fixture: `src/test/dataModelFixture.ts`.

Only the superseded seven-tab expectations in `workspace-shell.test.tsx` were reblessed: count eight, Architecture in the exact owner-requested position, inactive tabs and shared shell coverage include it. No unrelated assertion was weakened.

The first broad run overlapped an implementation-agent copy edit and observed one transient old-copy/new-test failure. It was rerun after directly verifying the source and assertions were consistent; the final broad result above is green. The independent none-state test now checks the corrected database wording.

## Limitations and visual notes

Long field names/types intentionally ellipsize inside compact diagram cards; full values remain in title attributes and in Esquema. This is an advisory density trade-off, not missing source data. The initial camera's excess top whitespace was observed on the phone, reported, and then repaired by anchoring the first entity at readable scale; the final light screenshots and browser probe reflect that repair.

This review establishes rendering and validation of a designed artifact. It does not inspect a live product database or certify that the declared model has been implemented. The UI communicates that limitation explicitly.
