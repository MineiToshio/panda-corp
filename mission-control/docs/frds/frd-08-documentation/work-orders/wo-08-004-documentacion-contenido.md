---
id: WO-08-004
type: work-order
slug: documentacion-contenido
title: 'WO-08-004 — Documentación content refresh and v2 removals'
status: ACTIVE
parent: FRD-08
foundation: false
implementation_status: VERIFIED
difficulty: medium
reopen_count: 0
change_ref: design-phase-copy-claude-design-sunset.md
artifacts:
  - 'src/app/manual/manualPages.tsx'
  - 'src/app/manual/_components/*Detail.tsx'
  - 'src/app/manual/_components/ManualLink.tsx'
  - 'content/manual/**/*.md'
  - 'content/manual/wo-08-005.content.test.ts'
  - 'src/lib/manual/**'
  - 'src/components/modules/manual-diagrams/**'
  - 'src/app/manual/_tests/manual-content*.test.tsx'
  - 'src/app/manual/_tests/manualPages*.test.tsx'
  - 'src/app/manual/_tests/conceptEquipo.test.tsx'
  - 'src/app/manual/_tests/manualSingleSource.test.ts'
source_requirements: [REQ-08-004, REQ-08-005, REQ-08-006, REQ-08-011, REQ-08-013, REQ-08-014, REQ-08-015, REQ-08-016, REQ-08-017, REQ-08-018, REQ-08-019]
dependsOn: [WO-13-012, WO-08-001, WO-14-004]
last_updated: '2026-10-22'
---

# WO-08-004 Documentación content refresh and v2 removals

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Blueprint: [`blueprint.md`](../blueprint.md) · FRD: [`frd.md`](../frd.md) · FDD: [`fdd.md`](../fdd.md).
> Change card (Manual half): `.pandacorp/inbox/changes/design-phase-copy-claude-design-sunset.md` (its Campaña half is WO-02-020).

## Summary

Brings the authored Documentación pages and diagrams up to the v2 factory and the v2 app: the design stage no longer says it uses Claude Design (hand-written HTML directions reviewed as private Artifacts, per the frozen prototype copy), the guide «Elegir modo de construcción» and the first-mission tutorial stop sending the reader to «Portfolio → Party» and to wave sizes, every other reference to a retired Mission Control surface (Party tab and panel, the old Portfolio paths) names its v2 equivalent, the multi-runtime, feature-centric layout, bespoke-stub and «El equipo» requirements are re-verified against their guard tests, and the interactive skill flow graph with its curated explainers is removed from the pages.

## In Scope

1. **Claude Design sunset, Manual half (REQ-08-013, change card).** Source of the wording: the frozen prototype's Manual snapshot `docs/design/prototype/data/manual-live.js` (page `el-pipeline`, the design stage, and the runtime comparison), which is the oracle for these states. Required content: a new project's default design engine is hand-written HTML directions in the repo (the repo is the source of truth and the agent verifies them there before showing them); each prototype is published as a private Artifact with one stable link for the whole phase, opened and commented from any device; before each round the agent reads the comments, refines the local file and republishes on the same link, and every round is logged in the journal; if the session cannot publish Artifacts the local files or screenshots are used. Apply it in `_components/PipelineDetail.tsx` (replace the «Claude Design» default-engine paragraph and the «Con Claude Design el loop…» block), in the runtime comparison (`manual-diagrams/RuntimeComparison.tsx` and its test: the row «Claude Design» becomes «Revisión de diseño» with Claude «Artifacts privados con enlace estable y comentarios» and Codex «archivos locales o capturas», status as in the snapshot), and in `manualPages.tsx` page `sync` (the section «Dos capas + el espejo de Claude Design»: read `plugin/skills/sync/SKILL.md` at build time and state only what its design-mirror step documents; drop the sentence if it no longer mentions a mirror). A content test fails if any authored page or diagram says the design phase uses Claude Design.
2. **Retired Mission Control surfaces (REQ-08-013).** Replace every authored reference to a surface v2 removed or renamed: «Portfolio → Party» and «Portfolio → Resumen» (build mode and first mission: the mode is chosen in the project's Comandos tab and in the Campaña ficha; the first mission ends by opening the project from Portafolio and watching La Fragua at the top of Resumen), «panel Party», «pestaña Party», «El Party panel», «feed del Party», «eventos del Party», «tribunal del Party» (La Fragua is the four-station scene at the top of the project's Resumen, FRD-06), and the nav name «Portfolio» as an app section (the destination is «Portafolio»). Files: `manualPages.tsx`, `_components/{CockpitDetail,EstadoDetail,DesatendidaDetail,PipelineDetail,FeedbackDetail}.tsx`, the matching `content/manual/**` stubs only for the one-line summary. A content test holds the closed list of retired phrases and fails if any page renders one; the factory concepts named «portfolio» (`factory/portfolio.md`, `sync-portfolio`) are not affected.
3. **Wave sizes (REQ-08-013).** The guide «Elegir modo de construcción» (`g-modo`) no longer states waves of 2 / 4 / 8 work orders; it states what the installed build engine documents (read `plugin/skills/implement/SKILL.md` and `factory/standards/build-orchestration.md` at build time; do not copy numbers from memory).
4. **Multi-runtime page (REQ-08-014 to REQ-08-016), feature-centric structure page (REQ-08-017), bespoke stubs (REQ-08-018), «El equipo» (REQ-08-019).** Already built: re-verify each against its existing guard (`manualPages.dr133.test.tsx`, `manualPages.multi-runtime.test.tsx`, `manualSingleSource.test.ts`, `conceptEquipo.test.tsx`) and fix any drift; every authored page keeps exactly one source of content (a bespoke renderer, its `.md` an index stub). Both runtimes are labelled read/write in the comparison and the two-doors diagram; no certified-automation claim.
5. **Coverage REQs (REQ-08-004, REQ-08-005).** The pages still cover what Pandacorp is, the flow, the stages, the commands, the build modes, the standards and handing off; a content test lists the required topics against the page index so a removed page fails loudly.
6. **Surface name (REQ-08-001, content side).** Audit the authored pages and diagrams for interface strings that name the surface «Manual» or «Códice» and fix them (the page shell strings are WO-08-003's).
7. **Referencia and catalogs (REQ-08-006, REQ-08-011).** The Documentación holds no catalog of its own: a test asserts no `reference` group in the content tree and no catalog renderer registered in `manualPages.tsx`; the catalogs and the full `SKILL.md` as markdown live in Configuración (FRD-07, derived from the factory).
8. **Feedback channels.** `content/manual/wo-14-004.feedback-channels.test.ts` and the page it covers keep their three commands (AC-14-003.3 is WO-14-004's); this WO keeps them green.

## Out of Scope

- The shell, home, search, reader, index and not-found page (WO-08-003).
- Configuración (WO-07-006) and the Campaña ficha copy (WO-02-020).
- Deleting `FlowGraph` and `src/lib/manual/skill-flows.ts`: WO-13-013 (W7) deletes them once nothing imports them (FlowGraph's own test keeps them compiling and "used" until then); this WO removes every page and test import of them. `src/lib/manual/workflow-flows.ts` is NOT out of scope: its only importer is `manualPages.tsx`, so this WO deletes it (reconciliation 2026-10-22; leaving it untested and unimported from W3 to W7 would red knip).
- New pages: v2 adds none; the page count (Tutorial 2, Guías 11, Conceptos 22, Workflows 3) is unchanged.

### Removed in this WO (v1 pieces; delete code, exports and tests together)

1. The interactive flow graph on the Workflows pages: the two `<FlowGraph flow={buildFlow|backlogFlow}/>` blocks in `manualPages.tsx`, with any sentence that tells the reader to click a node, the `workflow-flows.ts` imports and the file `src/lib/manual/workflow-flows.ts` itself (it imports the `SkillFlow` type from `skill-flows.ts`, which WO-13-013 deletes).
2. The curated per-skill explainers and the skill-flow cross-navigation from the pages (REQ-08-008 to REQ-08-010, REQ-08-012): the `getSkillFlow` describes in `manualPages.builder.test.tsx`, `manualPages.lanes.test.tsx` and `manualPages.fastLane.test.tsx` are deleted; their page-text describes (DR-125, DR-126 content on the unattended-build and workflow pages) stay and stay green.
3. Any `ManualLink` target that pointed at a removed Referencia page or at a skill flow (`ManualLink` itself stays for page-to-page links).
4. Every unused export left by the above.

## Requirements & Acceptance Criteria

This work order is content and removals; it owns no live acceptance criterion (the live criteria of FRD-08, AC-08-020.1 to AC-08-020.3, are WO-08-003's). It delivers REQ-08-004, REQ-08-005, REQ-08-006, REQ-08-011, REQ-08-013, REQ-08-014, REQ-08-015, REQ-08-016, REQ-08-017, REQ-08-018 and REQ-08-019 of [`frd.md`](../frd.md), verified by the content tests below (REQ-08-008 to REQ-08-010 and REQ-08-012 are Out of v2: their pages are removed).

Completeness (definition of done):

- **Tests:** the new content tests (sunset wording, retired phrases, required topics, no `reference` group) and every existing guard listed above are green; each test reads fixtures or the real `content/manual` through the page registry, never through a default factory root.
- **Copy:** Spanish authored prose; artifact names stay English (FRD, work order, ADR); no em dash or en dash in new copy (LESSON-0123); commands appear in `CommandBox` and are copied, never run.
- **Accuracy:** statements about the factory workflow are copied from the installed plugin skills and standards at build time (DR-046), not from memory.
- **Accessibility and performance:** diagrams keep their text alternatives; nothing new is added to the initial bundle (pages load as before).
- **Fidelity:** the content states `docs-page-guide`, `docs-page-team`, `docs-page-multi-runtime` and the `el-pipeline` design block match the oracle where the oracle was redrawn for the sunset (commit 6c4dbd87). Known gap, reported in the ledger: the oracle still draws «Portfolio → Party» in `g-modo` and in the tutorial page, which REQ-08-013 removes; the FRD wins (hierarchy `FRD > FDD`), so these two text differences are expected until DESIGN re-captures them.

## Components and interfaces built

From the [blueprint](../blueprint.md): `CMP-08-concept-pages` (the authored pages: `manualPages.tsx` renderers, `_components/*Detail.tsx`, `manual-diagrams/*`, the `content/manual` stubs), `IF-08-manual-index` (WO-08-001, unchanged). No new component; `ManualLink` and the diagrams are reused.

## Reuse

`CommandBox`, `Markdown`, `Avatar` (roster), the existing `manual-diagrams` atoms (`DocH`, `ProseTable`, `TeamDiagram`, `RuntimeComparison`, `MultiRuntimeDiagram`). Nothing is created.

## Installs

None.

## Derogated tests (BL-0051: same WO, never a later one)

- Updated here: `src/components/modules/manual-diagrams/_tests/RuntimeComparison.test.tsx` (the «Claude Design» row), the three `manualPages.{builder,lanes,fastLane}.test.tsx` files (flow describes removed), any `manualPages.*` assertion on retired phrases.
- Reviewer-authored, NOT edited (DR-080): `src/app/manual/_tests/frd-08-gate-opus.reviewer.test.tsx`, `manual.reviewer.integration.test.tsx` (WO-08-003 lists them too); the FRD-08 gate reviewer re-blesses them.
- `FlowGraph.test.tsx` stays untouched until WO-13-013 deletes the component and its test together.

## Tests this WO owns

`src/app/manual/_tests/manual-content*.test.tsx` (new: sunset wording, retired phrases, required topics, no `reference` group, surface name), the existing `manualPages.*`, `conceptEquipo`, `manualSingleSource` and `content/manual/wo-08-005.content.test.ts` guards. No new e2e: the behaviour spec of the surface is WO-08-003's.

## Visual reference

- **Mock screen(s) (content):** `docs/frds/frd-08-documentation/mocks/documentation.html` sections `docs-page-guide`, `docs-page-team`, `docs-page-multi-runtime` (layout and structure are WO-08-003's; this WO supplies the page content), plus the `el-pipeline` design block of the `docs-page` state; screenshots in `mocks/screenshots/`.
- **Oracle states:** `docs-page`, `docs-page-guide`, `docs-page-team`, `docs-page-multi-runtime` (`oracle-states.json`, `frd_slug` frd-08-documentation).
- **Token slice:** page content uses the reader's group hue and the shared prose, `CommandBox`, `ProseTable` and diagram atoms; no new token.
- **FDD pointer:** `docs/frds/frd-08-documentation/fdd.md` (states «El equipo» concept and Multi-runtime concept).

## Dependencies

WO-13-012 (primitives the diagrams use), WO-08-001 (the page index reader, history) and WO-14-004 (the feedback page whose three commands must stay). Runs in W3 beside WO-08-003 on disjoint files.

## Status Note

- 2026-10-30 (S2C): Refreshed the HTML/private-Artifact design loop, conditional external-mirror explanation, mode/lane guidance and v2 destinations. Read plugin/skills/{implement,sync}/SKILL.md and factory/standards/build-orchestration.md in this checkout before writing the workflow copy. Removed page imports of FlowGraph and deleted workflow-flows.ts; deferred FlowGraph/skill-flows remain intact. Authored page titles now use h2 beneath the shell h1. The existing content stubs required no edits. Guard tests cover all registered renderer extraction, retired phrases, required topics, curated link resolution, no embedded catalogs, and the design review loop.
- 2026-10-30 (S2C verification): Scoped Vitest excluding the unchanged reviewer suites: 21 files / 247 tests passed. The final shared-ListRow search adjustment was also checked with page.test.tsx: 7 passed. Scoped TypeScript includes the changed folders and behavior specs, excludes the three obsolete reviewer suites, and passes. The three unchanged FRD-08 reviewer suites still have 20 v1 failures (embedded catalogs, automatic first-page selection and old shell); two also carry seven obsolete DocReader prop errors in the full project typecheck. No reviewer files, visual baselines, decision log or .pandacorp state were edited. Playwright and browser fidelity remain unverified by instruction. No commits were created.

- 2026-10-30 (S2C round 2): Rewrote La Fragua as the four-station scene above Resumen, corrected Portafolio and Empieza aquí destinations, removed the retired architecture route label, and separated the four build-mode commands from their prose with an explicit `implement balanced` command. Scoped Vitest passed 312 tests across 25 files (including reviewer suites), full `pnpm exec tsc --noEmit` passed, and scoped Biome passed 79 files. `pnpm knip` reports only three out-of-scope exported types in core Button/Tabs, with none in this work order. Playwright was attempted on port 3953 using a temporary config to override the fixture port; all 13 desktop cases stopped at Chromium launch with macOS MachPortRendezvousServer permission denial before assertions. Browser behavior, computed width and visual fidelity remain unverified. No commits were created.
