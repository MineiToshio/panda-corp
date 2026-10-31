---
id: WO-02-017
type: work-order
slug: spec-architecture-digests
title: WO-02-017 Spec and Arquitectura digests (shared by the idea page and the workspace)
status: ACTIVE
parent: FRD-02
foundation: false
implementation_status: VERIFIED
difficulty: high
reopen_count: 0
artifacts:
  - 'src/app/board/_components/CardDetail/{SpecDigest,ArchitectureDigest}/**'
  - 'src/components/modules/{ReportBand,Spec}/**'
  - 'src/lib/{architecture,spec}/**'
  - 'src/app/projects/[slug]/_components/_tests/{spec-tab,architecture-tab}.test.tsx'
source_requirements: [REQ-02-011, REQ-02-013, REQ-02-016]
dependsOn: [WO-13-012, WO-25-001]
last_updated: '2026-10-30'
---

# WO-02-017 Spec and Arquitectura digests

## Summary

Rebuild the two shared digests on Órbita: `SpecDigest` (hero, the bands «PRD · qué y por qué», «Research · la
evidencia» and the FRDs band with fully clickable `FrdCard`s and the FRD `DialogSheet`) and `ArchitectureDigest`
(hero, «Stack y tecnologías», «Integraciones y operación», «Modelo de datos» hosting the unchanged `DataModelViewer`,
«Variables de entorno» grouped by `.env.example` section, ADR rows with their dialog, the «Plan de implementación»
state mosaic, per-FRD cards with their dialog, and «La arquitectura todavía no está publicada.»). It creates the
shared `ReportBand` family and `FrdCard`, and removes the work-order DAG from the digest.

## In Scope

- **`ReportBand` family** in `src/components/modules/ReportBand/` (blueprint § Relocations): `DigestHero` (eyebrow,
  title, lead, chips), `ReportBand` (card header of one size + label \| content rows with 128 px labels; hosts the
  Propuesta blocks folded into the row: features, risks, quote, checks, score bar, decision box, gauge card, legal),
  `EnvRow` / `EnvFold`, `AdrRow`, `PlanMosaic`. WO-02-016 consumes them for Propuesta.
- **`FrdCard`** in `src/components/modules/Spec/FrdCard.tsx`: whole-area button, code, coloured kind tag (UI, Infra,
  Tool/CLI, API, Data: from the digest, else the FRD's `ui:` frontmatter field), state stack bar once construction
  has started, the planned count before.
- **`SpecDigest`** (restyle in place): `DigestHero` with the phase chip and `projectMetaChips` (IdeaCard, shared with
  Propuesta); bands «PRD · qué y por qué», «Research · la evidencia», «FRDs · las piezas del v1 (N)» (N = live FRD
  folder count, DR-115); label-classified, scannable subsections as the AC lists; FRD dialog on `DialogSheet` (kicker
  «FRD-01 · Spec», Visión, Historias de usuario, Reglas de negocio, Fuera de alcance, Preguntas abiertas, Work orders
  with progress, then «Contrato», «Blueprint», «Ver work orders»). The open FRD stays URL-owned (`specFrd`).
- **`ArchitectureDigest`** (restyle in place): hero; «Stack y tecnologías» (choices and rationale); «Integraciones y
  operación» (every authored flow, responsibility and task, no de-duplication against Stack); «Modelo de datos»
  (heading always present, hosts `DataModelViewer` with its unchanged props, narrative/content-entity context
  readable, the explicit-none and error states of the viewer shown here); «Variables de entorno» (`EnvRow` grouped by
  `.env.example` section, «Sin descripción en .env.example» with a count badge, `EnvFold` past 12); «Decisiones»
  (`AdrRow` per live ADR → ADR dialog: kicker «ADR-0001», title, folded «Metadatos del documento», the ADR text;
  URL-owned `adr`); «Plan de implementación» (`PlanMosaic`: one tile per live work order grouped by FRD, coloured and
  labelled by `implementation_status`; before Construcción the line «N work orders planificadas»); per-FRD cards
  (`FrdCard` with live WO count and blueprint one-liner) → dialog (kicker «FRD-01 · Plan de implementación», the same
  sections plus «Implementación», ending with «Contrato», «Blueprint», «Ver work orders»; URL-owned
  `architectureFrd`); availability and the not-published message per AC-02-013.1.
- **Readers** (`src/lib/{architecture,spec}`): `readArchitectureArtifacts` stays the one bundle for board and
  workspace (`IF-02-architecture-artifacts`); `env.ts` returns each entry with its `.env.example` section and whether it
  has its own comment line; the FRD kind falls back to the FRD's `ui:` field; work-order counts and the mosaic come from
  live frontmatter only (DR-115). Fail-loud (DR-078): an unreadable ADR/env/work-order source is an explicit error in
  its band, never an empty list. The data-model reader (`data-model/`) is unchanged.
- **Seam for FRD-04** (`IF-02-digest-props`, blueprint Contracts C3): new props optional; the props `ProjectWorkspace`
  and `TabSpec` pass today (`project`, `navigationBaseHref`-driven link resolver, `frdCount`, chips inputs) stay
  accepted until WO-04-010 rewires the workspace (W5). Keep the digest roots' accessible names (`article`
  «Resumen del spec» and the architecture equivalent) so the workspace mounts stay testable. The FRD lists of
  both readers keep their shape in this wave (`parseSpec(...).frds[].id` / `.title` and the architecture digest's
  per-FRD list): `listProjectFrds()` (WO-12-007, same wave W3) reads them for the FRD titles the oracle draws
  («FRD-01 · Data reading», AC-12-004.1, AC-05-008.2); additions are optional fields only.
- Only the digest-internal assertions of `src/app/projects/[slug]/_components/_tests/{spec-tab,architecture-tab}.test.tsx`
  are updated here (the digest markup changes in W3); their tab-frame assertions stay WO-04-010's (W5).
- Copy: every label from `t()` (catalogue keys under `workspace.spec.*`, `workspace.arquitectura.*`); delete the
  local `ArchitectureDigest/copy.es.ts`.

**Removals (map §6.C item 10, §0.6):** the `WoDag` import, the work-order DAG in «Plan de implementación» and the scoped
DAG at the end of the FRD dialog (AC-02-013.3, AC-02-013.6); the v1 styles files these bands replace
(`SpecDigest.styles.ts`, `ArchitectureDigest.styles.ts`) once unused; `ArchitectureDigest/_tests/ArchitectureDigest.dag.integration.test.tsx`.

## Out of Scope

- The data-model viewer itself (WO-02-018) and its layout engine (WO-02-019).
- Mounting the digests in the idea page (WO-02-016) and in the workspace Spec/Arquitectura panels (WO-04-010).
- The interactive dependency graph (FRD-12, WO-12-007).

## Requirements & Acceptance Criteria

Delivers REQ-02-011, REQ-02-013 and the FRD-card and environment parts of REQ-02-016. AC-02-015.9 (same reader and
viewer everywhere) is WO-02-018's; this WO provides the single reader seam it relies on.

- **AC-02-011.1** — WHEN the open card's linked project has a spec digest (`.pandacorp/comms/spec-resumen.md`
  present and non-empty), THE system SHALL render a **Spec** tab **between Propuesta and Documentos**;
  WHEN no digest exists, THE system SHALL NOT render the Spec tab (the project hasn't reached that
  stage). The reader is fail-loud (DR-078): a missing digest is the deliberate absent state, never a crash.
  The digest (and the project's docs and status) SHALL be read for **any card linked to a project**
  (`project` set): in-pipeline, shipped (launched) or discarded, not only in-pipeline, so a launched
  or discarded project keeps its Spec, Arquitectura and Documentos tabs.
- **AC-02-011.2** — WHEN the **Spec** tab is active, THE system SHALL render the digest natively in three
  sections — **"PRD · qué y por qué"**, **"Research · la evidencia"**, **"FRDs · las piezas del v1"** (plain headings, no emoji) — reusing the Propuesta tab's visual language
  (full-bleed tinted blocks, label rows, role/stat/reference cards, an amber callout for the open
  decisions) for cross-surface coherence (DR-062). PRD/Research subsections are classified by label and
  rendered to be **scannable at a glance** (owner rule): **El problema** → a bullet list (not a prose
  wall); **Hipótesis de valor** → a single short highlighted callout; **Usuarios** → title+description
  role cards; **Métricas** → title+description stat cards; **Alcance v1** → a roomy checklist (not
  cramped pills); **Fuera del v1** → muted chips **without a strike-through** (legibility); **Decisiones
  abiertas** → an amber callout; **Referentes** → reference cards; else prose. Title+description cards
  parse a `- **Title** — desc` bullet (the parser tolerates a parenthetical between the bold and the
  dash, so a mis-authored bullet still yields a title + a description rather than a title-only card).
- **AC-02-011.3** — THE FRDs section SHALL render **one compact card per v1 FRD** (id · title · type tag ·
  one-line summary). WHEN the owner clicks an FRD card, THE system SHALL open a **modal** (not an inline
  expand — owner rule, reusing the core `Modal` with its focus-trap/Escape/return-focus a11y contract)
  showing that FRD's detail — Visión, Historias de usuario, Reglas de negocio, Fuera de alcance,
  Preguntas abiertas and Work orders — colour-coded per section, consistent with the Spec page, and
  ending with the buttons "Contrato", "Blueprint" and "Ver work orders".
- **AC-02-011.4** — WHEN Spec is opened from the Portfolio workspace or a direct project page, THE system SHALL reuse this complete Spec component and digest/count readers under FRD-04 REQ-04-013. The board's conditional-tab behavior remains unchanged; the workspace retains an honest empty state when its digest is absent.
- **AC-02-013.1** — WHEN the open card's linked project has a non-empty architecture digest OR a present structured model artifact (including explicit none or invalid input), THE system SHALL render an **Arquitectura** tab after Spec when available, otherwise after Propuesta. WHEN the card is linked to a project but both artifacts are absent, THE system SHALL still render the tab, with the message "La arquitectura todavía no está publicada." (amended 2026-10-22 to the approved prototype); WHEN the card has no linked project, THE system SHALL omit the tab. Availability SHALL NOT depend on the digest when the model artifact is present. This applies to every project-linked card, including shipped and discarded cards.
- **AC-02-013.2** — WHEN **Arquitectura** is active, THE system SHALL reuse the complete `ArchitectureDigest`: hero, **Stack & tecnologías**, **Integraciones y operación**, **Modelo de datos**, **Variables de entorno**, **Decisiones (ADRs)**, **Plan de implementación**, and per-FRD cards. The **Modelo de datos** heading SHALL remain present and host the shared logical-model viewer (REQ-02-015); existing narrative/content-entity context SHALL remain readable. Stack SHALL describe technology/provider choices and their rationale; Integraciones y operación SHALL preserve all authored service flows, responsibilities and operational tasks without deduplicating away facts merely because a vendor also appears in Stack. Missing narrative SHALL NOT suppress an available model or its error/none state.
- **AC-02-013.3** — THE **Plan de implementación** SHALL render a **state mosaic**: one tile per work
  order, grouped by FRD, each tile coloured and labelled by `implementation_status`. WHILE the
  project has not reached Construcción, the block SHALL be replaced by a line "N work orders
  planificadas". The mosaic is computed from the LIVE work-order frontmatter
  (`docs/frds/*/work-orders/*.md`, DR-049), not from the digest. The interactive dependency graph
  (critical path, parallelism) lives in Observabilidad → Dependencias (FRD-12, amended 2026-10-22 to
  the approved prototype; supersedes the earlier `WoDag` reuse here).
- **AC-02-013.4** — THE **Decisiones (ADRs)** and **Variables de entorno** blocks SHALL be read **live** from
  the real artifacts (`docs/adr/*` and `.env.example`), not duplicated in the digest, so they never drift.
  An ADR row SHALL be clickable and open a **modal** (the core `Modal` a11y contract) with the ADR body.
- **AC-02-013.5** — THE **per-FRD** cards SHALL render one card per FRD (id · title · WO count · blueprint
  one-liner); clicking a card SHALL open a **modal** with that FRD's blueprint summary + its work-orders
  list — consistent with the Spec tab's FRD-card→modal pattern (owner rule: heavy detail in a modal).
- **AC-02-013.6** — (amended 2026-10-22, v2 reconciliation) **Out of v2 (owner decision 2026-10-21):** WHEN an FRD's modal is open AND that FRD has **more than one** live work order, THE
  system SHALL render, at the end of the modal, a **scoped dependency DAG** (the same `WoDag` reused by
  the main Plan de implementación) showing ONLY that FRD's work orders and their intra-FRD dependencies
  /parallelism. WHEN the FRD has a single work order, THE system SHALL NOT render the DAG (there is no
  dependency/parallelism to show). In v2 the FRD modal ends with its links only (Contrato,
  Blueprint, Ver work orders).
- **AC-02-016.7** — EACH FRD card in the Spec and Arquitectura tabs SHALL open its detail from its whole area, SHALL carry a coloured kind tag (UI, Infra, Tool/CLI, API or Data, taken from the FRD's `ui:` field when the digest lacks it), and SHALL show work-order progress only once construction has started (before that, the planned count).
- **AC-02-016.8** — THE "Variables de entorno" block SHALL group variables by their `.env.example` section, SHALL label a variable without its own comment "Sin descripción en .env.example" with a count badge, and SHALL fold any group longer than 12 variables.

AC-02-013.6 is satisfied by its "In v2" sentence: no DAG in the modal; the dialog ends with the links the captured
states draw («Contrato», «Blueprint», «Ver work orders»; the note's «Diseño» link is not drawn and is recorded for the
PM in the architecture ledger). The band headings use the captured wording («Stack y tecnologías», «Decisiones»).

**Completeness (DR-100):** digest absent (Spec omitted on the board; honest empty state in the workspace), digest
present but a band empty (band omitted, never a placeholder row), ADR/env/work-order source unreadable (explicit error
in that band, the rest intact), no work orders yet («N work orders planificadas» with 0), an FRD without blueprint
(card without one-liner). **NFRs:** accessibility (cards are buttons with an accessible name, dialogs trap focus, close
on Escape and return focus, kind and state conveyed by text, `tabular-nums`), performance (all bands from the one
request-scoped bundle, no client fetch), language (FRD/ADR/digest text keeps its language, LESSON-0490), DR-115
(counts derive from disk, never from digest prose).

## Components

Builds `CMP-02-spec-digest`, `CMP-02-architecture-digest`, `CMP-02-report-band`, `CMP-02-frd-card`,
`IF-02-architecture-artifacts`, `IF-02-digest-props`. Reuse first: `Card` / `CardHeader`, `Chip`, `StackBar`,
`Dialog` / `DialogSheet`, `Button` toned, `Markdown`, `EmptyState`, `Notice` (WO-13-011/012), `DataModelViewer`
(mounted, WO-02-018), `projectMetaChips` (IdeaCard). Create the components.md rows `DigestHero`, `ReportBand`,
`EnvRow` / `EnvFold`, `AdrRow`, `PlanMosaic`, `FrdCard`. Installs: none.

## Visual reference

- **Mock screens:** `docs/frds/frd-02-ideas-board/mocks/ideas-board.html#idea-spec`, `#idea-architecture`,
  `#idea-frd-dialog`, `#idea-adr-dialog`, `#idea-architecture-frd-dialog`, `#idea-architecture-missing` (oracle states
  of the same ids; the workspace twins `project-spec` / `project-architecture` are FRD-04's).
- **Token slice:** band tones via `data-tone` (`--tone`, `--tint`, `--tint-strong`), kind tag hues (UI pink, Infra
  slate, Tool/CLI teal, API blue, Data gold), state hues for the mosaic, `--surface`, `--surface-2`, `--line`,
  `--text`..`--text-3`, `--r-lg`, `--r-xl` (dialog), `--shadow-dialog`, `--fs-h3` (card titles), `--fs-xs`/`--fs-sm`,
  `--font-mono` (variable names, ids, paths), `--amber` (open-decisions callout).
  Reference CSS: 25-spec, 27-architecture, 11-progress, 33-dialog.
- **FDD pointer:** `docs/frds/frd-02-ideas-board/fdd.md` (Screens: Idea, Spec tab; Idea, Arquitectura tab; States: Spec
  FRD card dialog, ADR dialog, Architecture FRD plan dialog, Architecture not published).
- **Fidelity criterion:** the built digests match `mocks/ideas-board.html` for the states above (layout, structure,
  components, density, both themes, 1280/768/375; the two dialogs at 375 and 1280) on the frozen tokens, keeping the
  recorded ids, classes and `data-*` hooks (`.dhero`, `.band`, `.brow`, `.frdc`, `.envrow`, `details.env-fold`,
  `.adr-row`, `.mosaic`); verified by the preview smoke gate (DR-055) and the close-out Visual QA.

## Tests

- Unit: `env.ts` grouping and described flag (real `.env.example` fixture + a malformed one that fails loud), FRD kind
  fallback, mosaic grouping by `implementation_status`, label classification of subsections.
- Component (`getByRole`): `FrdCard` (whole-area activation, kind tag, progress vs planned), `SpecDigest` bands and
  FRD dialog (focus trap, Escape, focus return, URL `specFrd`), `ArchitectureDigest` bands, not-published state, ADR
  dialog, per-FRD dialog, env folding past 12, model band hosting the viewer for ready/none/error results.

### Derogated tests (BL-0051)

- Implementer tests updated here: `src/app/board/_components/CardDetail/SpecDigest/_tests/SpecDigest.test.tsx`,
  `src/app/board/_components/CardDetail/ArchitectureDigest/_tests/ArchitectureDigest.test.tsx`,
  `src/lib/architecture/_tests/{architecture,env,adr,read-architecture}.test.ts`, `src/lib/spec/_tests/*`, and the
  digest-internal assertions of the FRD-04 mount tests `src/app/projects/[slug]/_components/_tests/{spec-tab,architecture-tab}.test.tsx`
  (only those assertions; the tab frame stays WO-04-010's). Deleted: `ArchitectureDigest/_tests/ArchitectureDigest.dag.integration.test.tsx`.
- Reviewer-authored, derogated for the FRD-02 gate reviewer (never edited here):
  `src/app/board/_components/CardDetail/ArchitectureDigest/_tests/usability.reviewer.test.tsx`,
  `src/lib/architecture/_tests/read-artifacts.reviewer.test.ts` (only if the bundle shape changes),
  `src/app/projects/[slug]/_components/_tests/spec-workspace.reviewer.test.tsx` (FRD-04 gate, if digest internals it
  asserts change).

## Dependencies

WO-13-012 (card, dialog family, notice; leaf primitives through WO-13-011), WO-25-001 (URL keys `specFrd`,
`architectureFrd`, `adr`). W3 in parallel with WO-02-015, WO-02-018, WO-02-020 (disjoint artifacts). Consumers:
WO-02-016 (W4), WO-04-010 (W5).

## Definition of done

The ACs above pass with tests that fail without the change; `WoDag` is no longer imported anywhere under
`src/app/board/`; the workspace still compiles and mounts both digests; `.pandacorp/verify.sh --since <ref>` green;
tokens only; every string from `t()`.

## Status Note

- 2026-10-30 (S2B): Built the shared ReportBand family (DigestHero, label/content rows, EnvRow/EnvFold, AdrRow, PlanMosaic) and Spec/FrdCard/FrdDetail. Both digests use the completed FRD-13 primitives and URL-owned dialogs. Removed both digest style files, IntegrationBands, architecture local copy, the WoDag import and the implementer DAG integration suite. No reviewer tests edited.
- 2026-10-30: The additive mount seam accepts `frds: DigestFrd[]`, `sourceErrors: DigestSourceErrors`, `constructionStarted`, `navigationBaseHref`, plus all prior props. `readSpecArtifacts` returns body/live FRDs/count/orders/errors; `readArchitectureArtifacts` additionally returns live FRDs and band errors. WO-02-016 / WO-04-010 must pass these additive fields when replacing their mounts; existing mounts still compile but do not yet forward them. Live FRD rows provide ui-kind fallback, blueprint summary and work-order state. Source errors remain independent of narrative/model validity.
- 2026-10-30: Combined S2B implementer verification passed 131 tests in 22 files. Scoped TypeScript passed; Biome passed for 47 touched source/test/style files. Each of this WO's twelve acceptance criteria is cited in a test. Chromium, browser dialog focus/accordion exclusivity and visual fidelity are unverified by task constraint.
- 2026-10-30: Reviewer-only run: 22 failing / 28 passing tests across 13 suites. Six failing suites: viewer fullscreen.consistency, fullscreen.ux, modelIdentity, usability, viewer; ArchitectureDigest usability (old listitem shape). All layout/routing/hostile-id/async/frame reviewer suites and read-artifacts reviewer passed. Navigation v2-boundaries/v2-survivors and spec-workspace remain for the reviewer to reconcile outside this stream's test scope. No visual baselines, decision log or .pandacorp state changed.
- 2026-10-30: Shared catalogue/inventory files are outside S2B ownership. Existing catalogue keys drive the new visible headings and states. Legacy viewer/navigation-control labels and unavailable-selection labels, plus ADR metadata wording, still need missing catalogue entries; inventory rows already exist but their ReportBand paths need the central relocation update. These are explicit review/integration follow-ups, not claimed complete.

- 2026-10-30 (agent-inferred): A new RED test demonstrated that the legacy architecture parser ignored the v2 Integraciones y operación heading and dropped prose/nested service tasks. Patched only its services parser and renderer to retain the authored continuations; all other bands keep their source contracts.

- 2026-10-30 (S2B round 2): Patched FRD observability IDs and extension-free document navigation, empty env/ADR bands, the unpublished architecture state, zero-order plan copy, three-line env section banners, and frontmatter-free blueprint summaries. Added fixtures matching the read-only pandatrack and funko-tracker .env.example header shapes. Removed the requested unused exports while retaining parseEnvExample for the immutable reviewer probe. Knip no longer flags parseEnvExample; its remaining findings are ButtonVariant, ButtonTone and TabDef outside this patch scope. The unpublished dialog fixture now supplies a published digest when exercising plan cards. No reviewer tests or visual baselines changed.
- 2026-10-30 (S2B round 2 verification): With PORT=3952 and PANDACORP_E2E_PORT=3952, scoped Vitest passed 193 tests in 36 files, including both unchanged s2b.adversarial.reviewer suites (13 tests, also passed separately). TypeScript (`pnpm exec tsc --noEmit --incremental false`) passed; scoped Biome passed 84 files. Knip exited 1 for the three out-of-scope exports recorded in WO-02-017. Browser/E2E and visual fidelity remain unverified. Changes remain uncommitted by owner instruction.
