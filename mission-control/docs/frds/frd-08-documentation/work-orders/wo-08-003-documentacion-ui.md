---
id: WO-08-003
type: work-order
slug: documentacion-ui
title: 'WO-08-003 — Documentación UI: home, search, reader, index, not-found'
status: ACTIVE
parent: FRD-08
foundation: false
implementation_status: IN_REVIEW
difficulty: medium
reopen_count: 0
artifacts:
  - 'src/app/manual/page.tsx'
  - 'src/app/manual/ManualShell.tsx'
  - 'src/app/manual/DocReader.tsx'
  - 'src/app/manual/DocNav.tsx'
  - 'src/app/manual/ManualNavContext.tsx'
  - 'src/app/manual/types.ts'
  - 'src/app/manual/[...segments]/**'
  - 'src/app/manual/_components/DocsHome/**'
  - 'src/app/manual/_components/DocsSearch/**'
  - 'src/components/modules/DocumentReader/**'
  - 'src/app/manual/_tests/page*.test.tsx'
  - 'src/app/manual/_tests/docs-home*.test.tsx'
  - 'src/app/manual/_tests/docs-search*.test.tsx'
  - 'src/app/manual/_tests/doc-reader*.test.tsx'
  - 'src/app/manual/_tests/persistentNavigation.test.tsx'
  - 'src/app/manual/_tests/visual-reanchor*.test.tsx'
  - 'e2e/documentation.spec.ts'
  - 'e2e/persistent-navigation/manual.spec.ts'
source_requirements: [REQ-08-001, REQ-08-002, REQ-08-003, REQ-08-006, REQ-08-007, REQ-08-020]
dependsOn: [WO-13-012, WO-25-001]
last_updated: '2026-10-22'
---

# WO-08-003 Documentación UI: home, search, reader, index, not-found

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Blueprint: [`blueprint.md`](../blueprint.md) · FRD: [`frd.md`](../frd.md) · FDD: [`fdd.md`](../fdd.md).

## Summary

Rebuilds the Documentación shell (`/manual`, `/manual/:group/:page`) as the Órbita design: a home that routes the reader in (the numbered «Empieza aquí» tutorial path, «Guías para el día a día», «Explorar por tipo» with Referencia pointing to Configuración), one full-text search across every page with snippets, and a reader with breadcrumbs, a position counter or the tutorial's «Paso X de Y» bar, previous and next within the group, and the page index at the right with its own search, folded behind a control below 900 px. It also creates the shared `DocIndex` and `Paper` module that the project Documentos tab reuses, shows the bounded not-found page, and stops embedding the catalogs (Referencia now links to Configuración).

## In Scope

- **Shell and routing.** `ManualShell` renders `PageHead` (eyebrow, h1 «Documentación», subtitle) and either the home, the search results, the reader or the not-found state from the URL (`/manual`, `/manual/:group/:page`, `q`, `index`). `page.tsx` keeps reading the authored pages (`readManualPages()` plus `readServiceManualPages()`, unchanged) and no longer reads skills, agents, rules or standards. `[...segments]/page.tsx` keeps its codec seeding, drops the `reference` family as a rendered surface and redirects the legacy `reference/<commands|agents|rules|standards>[/<item>]` paths to `/configuration/<skills|agents|rules|standards>[/<item>]` (an old link keeps its resource) by applying WO-25-001's `normalizeLegacyNavigation` at this route boundary (the codec's catalog mapping is `commands → skills`, `agents`, `rules`, `standards`, the same ids as Configuración's sections; no second mapping table here, DR-115). The shell renders no `<main>` (the app shell's `main#content` is the only main landmark, AC-19-001.5); `page.test.tsx` and `visual-reanchor.test.tsx` cases that query `getByRole("main")` are updated here.
- **Home (AC-08-020.1).** `DocsHome` (`DocsGroupCard` / `DocsSteps`): search field «Buscar en toda la Documentación» (placeholder with the live page count); card «Empieza aquí» with the numbered tutorial path then «Después, entiende lo esencial» (four curated concept links); card «Guías para el día a día» (six curated guide links, the guide count, «Ver todas»); the two cards end at the same height and stack below 1024 px; block «Explorar por tipo» (Tutorial, Guías, Conceptos, Workflows with their page counts, then Referencia with «En Configuración» linking to `/configuration`). Group counts and the page count are derived from the page index, never typed in.
- **Search (AC-08-020.2).** `DocsSearch`: a pure, injected-renderer index (`buildSearchIndex`) and `searchPages`, listing matches from every group in a «Resultados» card, each with its title, an ellipsis-delimited snippet around the match and its group chip; choosing a hit opens the page. See the blueprint (`IF-08-search-index`) for the text-extraction contract (reconciliation 2026-10-22, confirmed: lazy client-side extraction of each registered renderer's text with `react-dom/server` `renderToStaticMarkup`, already installed, built on the first non-empty term and memoised; no build-time generated index, which would be a second replica of the pages, DR-115; a test proves every registered renderer is extractable); the term lives in `q`, typing replaces history.
- **Reader (AC-08-020.3).** `DocReader` + `DocNav` + `DocIndex`: `Crumbs` (Documentación › group › page), counter «2 de 22» (or «Paso 2 de 2» with the two-segment progress bar and the text «Paso 2 de 2 del tutorial» on tutorial pages), the page body (a bespoke renderer when one exists, else the `.md` body through `Markdown`; the content is WO-08-004's), the previous and next cards «Anterior en <grupo>» / «Siguiente en <grupo>», and the index at the right (own search «Buscar en la Documentación…», groups Tutorial · Guías · Conceptos · Workflows · Referencia with counts, the current page highlighted and `aria-current="page"`). Below 900 px the index is a `button` «Índice · <título>» that opens it above the page and returns focus to the button when closed; the opened state lives in `index`.
- **Referencia.** The index and the home list Comandos, Agentes, Reglas de decisión and Estándares as links to the matching Configuración section (FRD-07); no catalog is rendered here.
- **Not found.** An unknown group or page renders the `EmptyState` «Esta página no existe» / «La Documentación no tiene una página «<slug>».» with the link «Ir al inicio de la Documentación»; no index and no reader.
- **Shared module.** `src/components/modules/DocumentReader/`: `DocIndex` / `DocItem` (props per components.md: groups, query, optional type filter chips; the folded control label is a prop: «Índice · <página>» here, «Elegir documento · N» in the project Documentos tab) and `Paper` (typed document reader: header with type chip, path and copy button, then `Markdown`). Both are built and unit-tested here; WO-04-012 mounts them.
- **Navigation context.** `ManualNavContext` keeps its interface (`goToSkill`, `goToAgent`, `goToManual`) so the FlowGraph file that WO-13-013 deletes still compiles; `ManualShell` now implements `goToSkill` / `goToAgent` as links to the Configuración item URLs and `goToManual` as a reader navigation.
- **Behaviour e2e.** `e2e/documentation.spec.ts`: home → search → open a result → reader with counter, previous/next and the index → tutorial page «Paso X de Y» → at a phone width the folded index → unknown page. Starts with `gotoHydrated`; role and name selectors.

## Out of Scope

- Page content, the Claude Design wording, the «El equipo» bios, the multi-runtime page, the `content/manual` stubs and the structure test (WO-08-004).
- The catalogs themselves (FRD-07, WO-07-006) and the project Documentos tab (WO-04-012).
- `src/lib/manual/**` (the page index reader is WO-08-001 history; WO-08-004 owns the folder this wave).

### Removed in this WO (v1 pieces; delete code, exports and tests together)

1. The embedded Referencia: the imports of `AgentList`, `AgentDetail`, `SkillsSection`, `StandardsSection`, `DecisionRulesSection` from `DocReader.tsx`, `DocReader.tsx`'s type import of `AgentLevelResult` from `@/lib/gamification/agents` (WO-13-013 deletes `agents.ts`; agent levels are out of v2), the reference-selection state and props (`skills`, `agents`, `rules`, `standards`, `levels`) from `ManualShell`, `DocNav` and `page.tsx`, and the `reference/*` navigation branch of `DocNav`.
2. The two-pane `236px 1fr` side menu with the Diátaxis headers «Empezar aquí · Guías · Referencia · Conceptos» as the navigation (replaced by the index at the right and the home).
3. The `reference` segment family as a rendered route (kept only as the redirect above).
4. Any unused export or prop left by the above, and the tests of the removed pieces.

## Requirements & Acceptance Criteria

Requirements traced: REQ-08-001 (surface named «Documentación»), REQ-08-002 (reading area and the index at the right), REQ-08-003 (four groups plus Referencia pointing to Configuración), REQ-08-006 and REQ-08-007 (catalogs live in Configuración, derived there), REQ-08-020.

- **AC-08-020.1** — THE Documentación home SHALL offer "Empieza aquí" (the numbered tutorial path, then "Después, entiende lo esencial"), "Guías para el día a día", and an explore-by-type block (Tutorial · Guías · Conceptos · Workflows) whose Referencia entry points to Configuración.
- **AC-08-020.2** — WHEN the owner searches the Documentación, THE system SHALL list the matching pages from every group, each with a text snippet.
- **AC-08-020.3** — THE reader SHALL show breadcrumbs, a "Paso X de Y" progress bar on tutorial pages, previous/next links within the page's group, and a page index to the RIGHT of the page with its own search, folded behind a control below 900 px.

Worked example (AC-08-020.3): the third page of a six-page tutorial reads «Documentación › Tutorial › <página>», the bar «Paso 3 de 6», «Anterior en Tutorial» / «Siguiente en Tutorial», and the index at the right lists the group's pages with a search box; at 375 px the index is behind the button «Índice · <página>».

Completeness (definition of done beyond the ACs):

- **Error and empty paths:** unknown page (above); a search with no match shows the catalogue's empty sentence (`documentacion.results.empty`, captured in state `docs-search-empty`; no literal is typed in code) in the results card; a page whose renderer throws while indexing is indexed by title only and its failure is reported by a test, never swallowed silently at runtime.
- **Security:** read-only; commands are shown to copy, never run; the legacy redirects only map to fixed Configuración paths (no open redirect: the section is matched against a closed list, the item is URL-encoded as one segment).
- **Performance:** the search index is built lazily on the first non-empty term and memoised for the session; the home and reader do no work for it before then; wide tables and code scroll inside their own box.
- **Accessibility:** the index control is a `button` whose label contains the page name; the opened index is keyboard reachable and closes back to its control; breadcrumbs end in `aria-current="page"`; the progress bar carries «Paso X de Y del tutorial» as text; one `h1` «Documentación»; 44 px targets on touch layouts; `prefers-reduced-motion` honoured; only transforms animate.
- **Copy:** every Spanish string comes from `t()` (`documentacion.*`; the short «Docs» label on the rail and bottom navigation belongs to the shell, WO-19-002); the surface is never called «Manual» or «Códice» in interface text (REQ-08-001).
- **Fidelity:** the built screens match `mocks/documentation.html` (layout, structure, components, density) on the frozen tokens in light and dark at 375 / 768 / 1280, keeping the prototype's recorded ids, class names and `data-*` / `aria-*` hooks; verified by the Preview Smoke gate (DR-055) and by the close-out computed-style and pixel diff.

## Components and interfaces built

From the [blueprint](../blueprint.md): `CMP-08-docs-shell`, `CMP-08-docs-home`, `CMP-08-docs-search` (`IF-08-search-index`), `CMP-08-doc-reader`, `CMP-08-doc-nav`, `CMP-08-doc-index` (the shared `DocIndex` / `DocItem`), `CMP-08-paper` (the shared `Paper`), `CMP-08-docs-not-found`. Route-private pieces live in `src/app/manual/_components/<Name>/`; the shared module lives in `src/components/modules/DocumentReader/` because two routes use it.

## Reuse (components.md: reuse, then adapt, then create)

`PageHead`, `Crumbs`, `SearchField`, `Card` + `CardHeader`, `ListRow`, `Chip`, `Button` (link variant as the previous/next cards), `Markdown`, `CommandBox`, `Avatar` (roster, WO-08-004), `EmptyState`, `Icon`. `DocsGroupCard` / `DocsSteps`, `DocIndex` / `DocItem` and `Paper` are the inventory rows this WO creates or restyles. `PageTitle` / `DocHeading` are retired names: do not import them.

## Installs

None.

## Derogated tests (BL-0051: same WO, never a later one)

- Implementer-authored, updated or deleted here: `src/app/manual/_tests/page.test.tsx`, `persistentNavigation.test.tsx` (after WO-25-001's split it holds only the three Manual cases; this work order is its one W3 owner, reconciliation 2026-10-22), `visual-reanchor.test.tsx` (v1 side menu, Referencia embed, `PageTitle`).
- `e2e/persistent-navigation/manual.spec.ts` (split out by WO-25-001): authored Manual selection, anchor, paste and history updated to the v2 reader; the former `/manual/reference/...` steps assert the redirect to `/configuration/...` (AC-25-001.1, AC-25-002.1, AC-25-004.1 re-verified).
- Reviewer-authored, NOT edited (DR-080), re-blessed or rewritten by the FRD-08 gate reviewer: `src/app/manual/_tests/frd-08-gate-opus.reviewer.test.tsx`, `frd-08-reuse.gate.reviewer.test.tsx`, `manual.reviewer.integration.test.tsx` (they pin the v1 Referencia reuse of the Configuración cards and the old shell).
- Blessed visual baselines of `/manual` (`e2e/visual.spec.ts-snapshots/**`): never touched; re-blessed by the reviewer at the close-out Visual QA.

## Tests this WO owns

Component and unit tests beside the code (`getByRole` first): home blocks and derived counts (including the curated links resolving to existing pages, failing loud when one does not), search (matching across groups, snippet ellipsis, no match, `q` round trip), reader (counter, tutorial bar, previous/next at group edges, index highlight, folded control below 900 px, focus return), not-found, the legacy redirect table, `DocIndex` and `Paper` in isolation; `e2e/documentation.spec.ts` as listed. Tests use fixture page lists, never the real `content/manual` through a default root.

## Visual reference

- **Mock screen(s) to reproduce:** `docs/frds/frd-08-documentation/mocks/documentation.html`, sections `docs-home`, `docs-search`, `docs-page`, `docs-page-index-open`, `docs-page-not-found`, `docs-page-tutorial` (and `docs-page-guide` for the counter variant); screenshots in `mocks/screenshots/<id>-<width>-<theme>.jpg` at 375 / 768 / 1280, light and dark (the index-open state at 375 and 768).
- **Oracle states** (`oracle-states.json`, `frd_slug` frd-08-documentation): `docs-home`, `docs-search`, `docs-search-empty` (scenario state; its build-side double is the `oracle-recipes.json` entry of the same name), `docs-page`, `docs-page-index-open`, `docs-page-not-found`, `docs-page-tutorial`, `docs-page-guide`; routes `/manual`, `/manual/concepts/el-pipeline`, `/manual/concepts/no-existe`, `/manual/tutorial/como-empezar`, `/manual/guides/g-modo`. (`docs-page-team` and `docs-page-multi-runtime` are WO-08-004's content states.)
- **Token slice:** the reader's hue follows the page's group (`data-tone`); `--surface`, `--surface-2`, `--line`, `--text`, `--text-2`, `--text-3`, `--focus`; progress bar fill in the group hue; radius and spacing tokens as in `docs/design/design-tokens.json`; Space Grotesk titles, Inter body, JetBrains Mono only for commands and paths; `tabular-nums` on counters; nothing under 12 px.
- **FDD pointer:** `docs/frds/frd-08-documentation/fdd.md`.
- **Assets:** exported SVG icons via `Icon`; the agent sprites used by the roster are staged in `public/` by WO-13-010.

## Dependencies

WO-13-012 (composite primitives: `Crumbs`, `Card`, `ListRow`, `EmptyState`, `Markdown`, `Dialog` family) and WO-25-001 (URL codec: `/manual/:group/:page`, `q`, `index`). The page index reader WO-08-001 and the feedback page WO-14-004 are already history. Consumers: WO-04-012 (`DocIndex`, `Paper`), WO-07-006 (waits for this WO's removal of the Referencia embed).

## Status Note

- 2026-10-30 (S2C): Built the home, lazy full-text results, authored reader, shared DocIndex/Paper, bounded missing-page state and route-boundary legacy redirects. UI Vitest: 5 files, 20 tests passed. AC-08-020.1/2/3 are cited by the UI tests and the authored behavior spec. Biome formatted the owned paths. Full TypeScript currently reports seven obsolete DocReader prop usages in the untouched frd-08-gate-opus and frd-08-reuse reviewer suites; these need reviewer reconciliation. Browser behavior and visual fidelity are unverified (Chromium unavailable by task constraint). Changes remain uncommitted by instruction.
- 2026-10-30 (S2C final verification): After WO-08-004, the scoped non-reviewer suite passed 247 tests across 21 files and the scoped TypeScript check passed. Search results and home links reuse the shared ListRow/DividedList. A subsequent page.test.tsx run passed all 7 UI tests. Independent reviewer reconciliation is still required: frd-08-gate-opus, frd-08-reuse.gate and manual.reviewer.integration pin the removed v1 contract (20 observed failures). The full typecheck remains red on seven old DocReader prop calls in the first two reviewer suites. Browser behavior, pixel fidelity and the full gate are unverified.

- 2026-10-30 (S2C round 2): Reused core SearchField on the home and shared index, removed the hardcoded search id and duplicate field CSS, restricted the URL index state to `1`, removed unused exports, stripped only the leading Markdown H1, separated block text during search extraction, folded accents in the index filter and corrected concept/workflow hues. Updated the two implementer URL expectations; reviewer suites and visual baselines are unchanged. Scoped Vitest passed 312 tests across 25 files (including reviewer suites), full `pnpm exec tsc --noEmit` passed, and scoped Biome passed 79 files. `pnpm knip` reports only three out-of-scope exported types in core Button/Tabs, with none in this work order. Playwright was attempted on port 3953 using a temporary config to override the fixture port; all 13 desktop cases stopped at Chromium launch with macOS MachPortRendezvousServer permission denial before assertions. Browser behavior, computed width and visual fidelity remain unverified. No commits were created.
