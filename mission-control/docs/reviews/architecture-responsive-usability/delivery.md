# Architecture and responsive usability delivery

Date: 2026-10-17. Owner-authorized direct continuation; no project phase, build engine or work-order machine-status changes. Detached verification base: `d913da83dff8f4b7a9f59a56e47c561345cace86`.

## Delivered behavior

Repeated click/Enter/Space on the selected connector clears it. A connector highlighted only by entity selection still selects on its first direct activation. Diagram entity cards alone prevent text selection; pointer-down clears retained ranges, while schema text remains selectable. Browser caret recreation after a click may leave a collapsed Range, which is not selected text.

Esquema opens with all entities collapsed in one column. A native unique `details[name]` group permits one open entity per viewer, natural content heights and complete copyable logical schema, including keys/mappings/cardinalities. Reclick collapses it. No model source/formatter/parser/ELK contract changes.

Architecture is shared by board, portfolio and direct project: Stack → Integraciones y operación → Modelo de datos → environment → decisions/plan/FRD cards. Stack choices and operational flows are distinct, clarified in short copy. The original complete service bullets and environment names are preserved. No vendor-name heuristic removes operational facts.

The shell's 1240px frame cap and shared digest 920px inner cap are removed. Panels fill their host with page gutters; 720px introductory prose and existing 640px plan prose retain readable line lengths. Integrated phone/tablet navigation uses one header surface, top-right hamburger beside identity, six usable links, 44px targets and Escape/outside/link/route dismissal. Above 1100px navigation is inline; disclosed destinations use three columns through 1100px and two through 600px.

## Canonical documentation and oracle

ADR-0009 records the owner correction, superseding the prior flat schema/section-order/responsive visuals. PRD, platform architecture, FRD-02/04/19 requirements/FDD/blueprints/work-order scope, component inventory, API and decision log are aligned. Historical verification notes and machine-status fields are retained.

Independent tests first exposed missing toggle/schema/order/menu behavior. The inspected regression is 24 files / 146 tests green; old field/key/cardinality checks are preserved, with schema entities opened before assertions. The reviewer separately authored persistent browser tests for real connector hit paths, native selection/fullscreen, accordion exclusivity/copying, and phone/tablet/wide header behavior.

The live-data preproduction matrix passed 16 cases: shell 320/390/768/1024/1280/1600px in light/dark, plus actual PandaSaga 39entity model at 390/1600px in light/dark. It verifies repeated relationship selection, native fullscreen, diagram selection prohibition/clear, native one-open schema, full-width model/host and section order, with no page errors. Screenshots and actual-project artifacts remain private. Board's existing clipped horizontal columns can make root scrollWidth exceed the viewport on phone: old service 507px/new 499px at 320/390px. Shell tests therefore assert body fit plus concrete header/destination bounds, rather than certify unrelated kanban behavior. Dedicated responsive shell/model checks do not certify every surface or change frozen platform declarations.

Canonical and production evidence is recorded below when those commands finish. This scoped `--since` gate is not an unscoped visual-baseline certification. Deployment evidence is private and commit-specific.

Canonical `bash .pandacorp/verify.sh --since d913da83dff8f4b7a9f59a56e47c561345cace86 --report-all` exited 0 in the detached worktree: all 11 subgates green, 36 files / 368 unit/integration tests and 42 desktop/mobile smoke/shell cases. [Report](pre-integration-canonical-gate-report.json) and [log](pre-integration-canonical-gate.log) record the actual since-scoped qualification. The existing 13 frozen machine-state/template doc-lint advisories and Biome configuration-version info remain outside this product correction; no checker or baseline is weakened.

Fresh production-build `PANDACORP_PROD_SMOKE=1 pnpm exec playwright test e2e/logical-data-model.spec.ts e2e/model-usability.spec.ts e2e/shell-usability.spec.ts` exited 0: 24/24 desktop/mobile feature cases passed ([log](production-e2e.log)). This includes the 18 new persistent reviewer cases and 6 existing model-parity cases. Native fullscreen and fallback both use real browser presentation; connector paths receive actual mouse input and schema exclusivity is browser-enforced. A separate production breakpoint probe at 600/601/1100/1101/1150px confirmed destination bounds and desktop row placement. Root and isolated changed source/test files are byte-identical ([hashes](candidate-source-sha256.json)).

Final staged-diff [rigor classification](rigor.json) retains the conservative critical owner-oracle escalation. No automatic change engine or build executor was invoked. Evidence logs normalize trailing whitespace only. Final commit-specific 1987 deployment/live checks are recorded privately after the source commit.

Final integration baseline is `5e5198cb57b11e611f2577397b267c5a4f44252a`, a concurrent factory/Manual update preserved in full. That update introduced a Biome line-wrap failure in PipelineDetail; formatting was corrected without changing authored text. Old fixed-width/navigation comments were aligned with the implementation. Independent review confirmed byte-identical emitted JS for this comment/format-only delta and unchanged CSS rules. The complete integrated canonical command, `bash .pandacorp/verify.sh --since 5e5198cb57b11e611f2577397b267c5a4f44252a --report-all`, then exited 0: all 11 subgates green, 50 files / 581 unit/integration tests and 42 smoke/shell cases. [Final report](canonical-gate-report.json), [final log](canonical-gate.log).

The same fresh production-build/E2E command was repeated against the integrated final candidate and exited 0 with 24/24 cases passed; production-e2e.log is that final run. The source hashes now bind the final baseline and byte-identical root/isolated changed source/tests. No further functional changes followed these checks.
