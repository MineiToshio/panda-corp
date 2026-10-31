---
id: WO-02-020
type: work-order
slug: campaign-orbita
title: WO-02-020 La Campaña Órbita (map, strip, phase sheet, commands, mode picker)
status: ACTIVE
parent: FRD-02
foundation: false
implementation_status: IN_REVIEW
difficulty: medium
reopen_count: 0
artifacts:
  - 'src/components/modules/CampaignPipeline/**'
  - 'src/lib/command-modes.ts'
  - 'src/lib/_tests/command-modes*.test.ts'
  - 'src/app/board/_components/CardDetail/CardDetail.tsx'
  - 'src/app/board/_components/CardDetail/_tests/CardDetail.tabs.test.tsx'
  - 'e2e/persistent-navigation/board.spec.ts'
source_requirements: [REQ-02-010, REQ-02-016, REQ-11-005]
dependsOn: [WO-13-012, WO-11-003, WO-25-001]
last_updated: '2026-10-30'
change_ref: design-phase-copy-claude-design-sunset.md
---

# WO-02-020 La Campaña Órbita

## Summary

Rebuild the idea's Campaña tab as the Órbita journey map: six pixel-art rooms on the always-dark map with their
cast (roaming by transform unless reduced motion; live markers only while an agent runs), corridors carrying the
hand-off artifact, the «N/6 entregadas» strip, and the pinned phase sheet (kicker, state chip, previous/next arrows,
Descripción, Lee → Escribe, the whole team, «Qué puedes correr» with the spec-mode disclosure, «Elegir modo de
construcción» opening FRD-11's `BuildModePicker`, and «Entrar a La Fragua» only from Construcción). It carries the
Campaña half of the Claude Design sunset change card (no app text mentions Claude Design).

## In Scope

- **Map** (`CampaignPipeline`, `CampaignRoom`): six rooms in the fixed order research → product → design →
  architecture → build → release (Investigación · Producto · Diseño · Arquitectura · Construcción · Lanzamiento) in the
  prototype's snake on `--map-*` tokens (dark in both themes), wrapped in the labelled container «El viaje de esta idea
  por las 6 fases»; each room shows its name tag and cast (agent sprites from `public/` as original bytes,
  `image-rendering: pixelated`, plain `<img>`); state by position versus the active phase (`phaseFromStatus`, kept
  WO-02-011) with the words «entregado», «en curso», «en espera» (never colour alone); the current room pulses;
  corridors carry the hand-off artifact («research.md», «PRD + FRDs», «sistema + mocks», «blueprint + Build Plan», «el
  código») and turn solid green once delivered; no artifact pill inside rooms, no striped road.
- **Strip:** six segments and «N/6 entregadas» with the accessible description of the prototype's progress strip.
- **Cast motion:** the current room's cast roams by `transform` only (< 300 ms steps, FRD-13 motion rule), done rooms
  idle in place, locked rooms static; `prefers-reduced-motion` renders all static; the lead halo and speech-on-meet
  live markers render only while the project is `running`.
- **`PhaseSheet` + `TeamMember`** (pinned, never toggled closed): the active phase's sheet open by default; a room or
  the previous/next arrows switch it; the open phase lives in the URL key `phase` (FRD-25); kicker «Fase N de 6», phase
  name and state chip; «Descripción»; «Entra y sale» («Lee» → «Escribe»); «Equipo» with every specialist (sprite,
  name, role, one sentence); «Qué puedes correr»: the first `CommandBox` labelled «Siguiente paso · avanza a <fase>»,
  the rest under «Otras opciones de esta fase»; `<idea>` tokens interpolated with the slug at render (the data keeps
  the canonical token, WO-02-013 history); `explore` offered only in the research sheet, never first.
- **Modes:** the `spec` clarification modes in a disclosure «Cuántas preguntas te hago antes de generar la
  documentación», each mode with its own copyable command (`/pandacorp:spec <slug> --ask` …) and a one-line hint
  (`src/lib/command-modes.ts`); the build sheet's «Elegir modo de construcción» disclosure mounts FRD-11's
  `BuildModePicker` (WO-11-003) as is. Keep the `IMPLEMENT_MODES` export compiling until WO-11-004 deletes its last
  consumer (`mode-selector`, W6).
- **Forge link:** «Entrar a La Fragua» is a real link (`Button` toned) to the `forgeHref` prop (Portafolio → project →
  Resumen, built by the idea page, WO-02-016), shown only on the Construcción sheet once build is reached and only when
  `forgeHref` is given; a locked build sheet shows its full content without the link.
- **Phase content** (`phases.ts`): the teams of AC-02-010.4, the deliverable chain, the Architecture and Build sheet
  content of AC-02-010.8, and the Design sheet's sunset copy exactly as the frozen prototype data draws it (state
  `idea-campaign-design`); «Claude Design» appears nowhere in the module or its tests.
- **Contract change and its single call site** (`IF-02-campaign-props`, blueprint Contracts C5): `CampaignPipeline({
  slug, activePhase, running?, forgeHref? })`; drop the no-op `onEnterForge` and the `deployTarget` prop; update the one
  call site in `CardDetail.tsx` (stop forwarding both; `CardDetail` keeps accepting them from `BoardShell` until
  WO-02-016 removes them) and the `CardDetail.tabs.test.tsx` mock that pins the old props.
- Read-only: no write, no Claude call, no build trigger; commands are copy-only.

**Removals (map §6.C item 14 Campaña half, change card, §0.6):** the per-phase checklists; the inline spec-mode
`<select>`; every import from `src/components/modules/party/**` (`Room`, `StoneBridge`, `AgentSprite`), replaced by
`CampaignRoom` / corridors / `TeamMember` sprites (WO-04-010 deletes `party/**` in W5); the `PHASE_META` emoji chips and
the deliverable chip inside rooms; the release sheet's `deployTarget` line; the «Claude Design» wording.

## Out of Scope

- Deriving the active phase (`phaseFromStatus`, kept WO-02-011) and the next-step map (`nextStep`, kept WO-02-003).
- The `BuildModePicker` itself and its persistence (FRD-11, WO-11-003); the workspace Comandos tab (WO-11-004).
- Building `forgeHref` and mounting the tab in the idea page (WO-02-016); La Fragua (FRD-06).
- The Manual half of the change card (WO-08-004).

## Requirements & Acceptance Criteria

Delivers REQ-02-010, the Campaña part of REQ-02-016 and FRD-11's AC-11-005.3. AC-02-010.2 (active phase derivation)
stays owned by the kept WO-02-011.

- **AC-02-010.1** — WHEN the **Campaña** tab is active, THE system SHALL render **La Campaña**: the
  **6-phase pipeline** in fixed order `research → product → design → architecture → build → release`,
  each phase shown as a room, wrapped in a labelled container ("El viaje de esta idea por las 6
  fases"). The phase names are Investigación · Producto · Diseño · Arquitectura · Construcción ·
  Lanzamiento.
- **AC-02-010.3** — THE system SHALL render each phase by its position relative to the active phase:
  phases **before** the active one as **done** (showing their delivered deliverable), the active one
  as **current** (glowing), and phases **after** it as **locked**.
- **AC-02-010.4** — WHEN the owner clicks a phase, THE system SHALL show that phase's **ficha**: a
  description, what it **reads** (LEE — the deliverable from the previous phase) and **writes**
  (ESCRIBE — the deliverable for the next phase), and the **whole team** of that phase — every
  specialist with its role and what it does (not only the lead). The teams SHALL be: research =
  `researcher`; product = `product-manager`; design = `designer` + `copywriter`; architecture =
  `architect`; build = `implementer` + `reviewer` + `analytics` + `security-auditor`; release =
  `devops` (**reconciled-from-code, DR-085, 2026-09-25**: the security audit is the LAST STEP of
  construction, not a separate release activity — `security-auditor` sits on the build team, and
  release keeps only `devops`; see `factory/decisions/registry.yaml` DR-085 and
  `CampaignPipeline/phases.ts`). The deliverable chain (LEE→ESCRIBE) SHALL be `research.md →
  PRD/FRDs (EARS) → mockups + design tokens + components.md (microcopy) → blueprint + ADRs +
  Build Plan + work orders → código verificado y endurecido (auditado, GREEN) → app lanzada
  (interna o externa) + plan de lanzamiento`.
- **AC-02-010.8** — (amended 2026-10-22, v2 plan: Claude Design sunset, change card `design-phase-copy-claude-design-sunset`) THE fichas SHALL reflect the **current factory**: the **Design** ficha SHALL state
  that the `designer` writes the design directions as **HTML** in the repo and publishes them as **private
  Artifacts** for the owner's review (the exact prototype copy: "Creación del sistema visual y la microcopia.
  El designer escribe las direcciones de diseño en HTML y las publica como Artifacts privados para que las
  revises, y el copywriter aporta la voz, para que el producto sea bello, accesible y coherente en lenguaje."
  and, on the designer's team line, "Escribe los mockups en HTML y los publica como Artifacts privados para tu
  revisión, define los tokens de diseño y el inventario components.md, y asegura la consistencia visual."),
  that it produces **`components.md`** + **mocks** + design tokens (and microcopy via `copywriter`), and no
  ficha or other app text SHALL mention Claude Design;
  the **Architecture** ficha SHALL state that it **plans the foundation
  (shared primitives) and the file artifacts** of each work order (plus the blueprint, ADRs and Build
  Plan); and the **Build** ficha SHALL reflect the **v2 build flow** — foundation-first, disjoint
  waves serialized by file artifact, per-WO fidelity loop, the 4-lens + visual-judge gate and the
  Option-B wave commit (consistent with FRD-06 / La Fragua).
- **AC-02-010.9** — Each phase's ficha SHALL carry a **"Qué puedes correr"** section listing that phase's
  **runnable commands** (the first is the advance/recommended step; the rest are the phase's other
  options), each as a **copyable** `CmdRow` (the first labelled "Siguiente paso", the rest under
  "Otras opciones de esta fase"). The command text SHALL **substitute the project slug**
  into the `<idea>` token (e.g. `/pandacorp:spec <idea>` renders `/pandacorp:spec <slug>`) so it
  copy-pastes directly — never a literal `<idea>` placeholder. The factory-run commands (`spec`,
  `explore`) carry the project name; the in-project commands (`design`, `blueprint`, `implement`,
  `release`, `iterate`, `bug`, `change`, `review-launch`, `new-version`, `sync`) do not. A command
  that has **modes** SHALL NOT render an inline `<select>` (amended 2026-10-22 to the approved
  prototype): the **`spec`** clarification modes (`--ask` / `--auto` / `--infer`, DR-095) SHALL sit
  in a disclosure whose summary reads "Cuántas preguntas te hago antes de generar la documentación"
  and which lists each mode with its own copyable command (the mode's flag folded into the command,
  e.g. `/pandacorp:spec <slug> --ask`); the **`implement`** build modes are offered by the
  four-card picker behind "Elegir modo de construcción" (FRD-11 AC-11-005.1). A one-line hint
  SHALL describe each mode. Commands without modes render as a plain row. Read-only
  (AC-02-010.6): showing the command is not running it.
- **AC-02-010.5** — WHEN the owner activates the **Construcción** (build) phase's "Entrar a La Fragua"
  action, THE system SHALL **navigate the host app** to Portafolio → that project's **Resumen** tab,
  whose head is La Fragua (FRD-06; there is no Party tab), WITHOUT an inner iframe reload of the
  card detail. THE system SHALL NOT show the action until the build phase is reached (a locked build
  phase shows its ficha without the action, AC-02-010.7).
- **AC-02-010.6** — THE Campaña view SHALL be **read-only**: it SHALL NOT call Claude, write any file, or
  trigger any build; the only "communication" it depicts between phases is the deliverable document
  travelling to the next phase (artifact across time).
- **AC-02-010.7** — A **locked** (future, not-yet-reached) phase's ficha SHALL still render its **full
  information** (description, LEE/ESCRIBE, the whole team) — the ficha is information *about* the phase,
  readable regardless of progress (owner, 2026-06-22); the header label ("en espera") signals it is a
  future phase. Only the build phase's "Entrar a La Fragua" **action** is withheld until the build is
  reached. (Superseded the earlier locked/empty placeholder, which hid the phase info.)
- **AC-02-010.10** — WHILE the idea is still under investigation (a pre-pipeline `discovered` /
  `recommended` card → the **research** ficha), THE "Qué puedes correr" section SHALL offer
  **`/pandacorp:explore <idea>`** (slug interpolated) as the optional refine step alongside `spec` —
  the visible path to evolve the idea conversationally BEFORE documenting the MVP. Explore is an
  option, never the advance step (spec remains first). No later (in-pipeline / shipped) phase's ficha
  SHALL offer explore. (Change `mc-nextstep-offer-explore`, 2026-07-02.)
- **AC-02-010.11** — (amended 2026-10-22, v2 plan: renumbered from the fidelity-pass restatement "AC-02-010.4 amended", so each id is defined once) the **active** phase's ficha is shown **by default** (the prototype opens
  the active phase) and **stays pinned**: clicking another phase switches it; clicking the open one
  keeps it open (the detail below the map is always visible, never toggled closed). The ficha header
  shows the kicker "Fase {n} de 6", the phase name and a state chip (e.g. "Fase 1 de 6" · "Investigación" ·
  "en curso"), with previous/next phase arrows (AC-02-016.6). The active room's cast **roams**
  — sprites wander and collaborate (lead halo, speech on meet), moved by `transform` only (FRD-13
  motion rule); `prefers-reduced-motion` renders them static. The campaign body is one bordered panel
  below the (bare, icon-bearing) tab pills; the header caption is left-aligned; the stage is
  full-width with the rooms centred.
- **AC-02-010.12** — (amended 2026-10-22, v2 plan: renumbered from the fidelity-pass restatement "AC-02-010.3 deliverable", so each id is defined once) each room shows its cast and the room name; the hand-off artifact
  (`research.md`, `PRD + FRDs`, `sistema + mocks`, `blueprint + Build Plan`, `el código`) is written
  on the **corridor** between two rooms, which turns solid green once delivered; there is no artifact
  pill inside the room and no striped road.
- **AC-02-016.6** — THE Campaña SHALL show a six-segment strip with "N/6 entregadas", and the phase sheet SHALL offer previous and next phase arrows.
- **AC-11-005.3** — THE Construcción phase sheet in La Campaña (FRD-02) SHALL offer the same mode picker behind "Elegir modo de construcción". (drawn in FRD-02's ficha)

The state chip of the current phase reads «en curso» as AC-02-010.11 and the prototype draw it; the halo and
speech-on-meet live markers are the only things gated on `running` (the FRD's older «fase actual» prose is recorded
for the PM in the architecture ledger).

**Completeness (DR-100):** absent or unrecognized status → research active (the kept derivation), all later phases
locked; a shipped idea → release active, the build sheet still offers the forge link when `forgeHref` is given; no
project (discovered idea) → no forge link anywhere; sprite art missing → the room still renders its name and words
(no broken image icon; `alt=""` decorative sprites, names in text). **NFRs:** accessibility (rooms are buttons with the
phase name and state in their accessible name, arrows labelled, the sheet a region with a heading, the strip
`role="img"` with its text alternative, disclosures native and keyboard operable, 44 px targets), reduced motion
(static cast, no pulse animation), performance (room art lazy-loaded off the critical path; motion transform/opacity
only, < 300 ms; no layout thrash in the roam loop), read-only invariant.

## Components

Builds `CMP-02-campaign-pipeline`, `CMP-02-phase-sheet`, `CMP-02-command-modes`, `IF-02-campaign-props`. Reuse first:
`CommandBox`, `Chip`, `Button` toned, `Icon` (WO-13-011/012), `BuildModePicker` (WO-11-003). Restyle in place:
`CampaignPipeline` (absorbs `CampaignRoom`), `RoamingCast` (plain sprites, transform-only). Create the components.md
rows `CampaignRoom`, `PhaseSheet`, `TeamMember` in `src/components/modules/CampaignPipeline/`. Installs: none.

## Visual reference

- **Mock screens:** `docs/frds/frd-02-ideas-board/mocks/ideas-board.html#idea-campaign`, `#idea-campaign-phase`,
  `#idea-campaign-research`, `#idea-campaign-design` (re-captured with the sunset copy), `#idea-campaign-build`,
  `#idea-campaign-release` (oracle states of the same ids).
- **Token slice:** `--map-bg`, `--map-room`, `--map-edge`, `--map-label-bg`, `--map-label-fg`, `--map-handoff-bg`,
  `--map-handoff-fg` (always dark), phase tones via `data-tone` (`--tone`, `--tint-strong`), `--green` (delivered
  corridor and strip), `--violet` (toned forge button), `--surface`, `--line`, `--text`..`--text-3` (sheet),
  `--r-lg`, `--font-mono` (commands), `--dur` / `--ease` (motion).
  Reference CSS: 42-campana, 12-command, 07-chip.
- **FDD pointer:** `docs/frds/frd-02-ideas-board/fdd.md` (Screens: Idea, Campaña tab; Campaña, Arquitectura sheet;
  research sheet; Diseño sheet; Construcción sheet; locked Lanzamiento sheet; Responsive & accessibility, Motion).
- **Fidelity criterion:** the built Campaña matches `mocks/ideas-board.html` for the states above (map, rooms,
  corridors, strip, sheet, both themes with the map dark in both, 1280/768/375) on the frozen tokens, keeping the
  recorded ids, classes and `data-*` hooks (`.room`, `.corridor`, `.camp-progress`, `.phase-sheet`, `.tmember`);
  verified by the preview smoke gate (DR-055) and the close-out Visual QA.

## Tests

- Component (`getByRole`): room order and state words, corridor delivered state, strip count, sheet pinned/switch/
  arrows/URL `phase`, the whole team per phase, commands per phase with slug interpolation and no literal `<idea>`,
  explore only in research, spec-mode disclosure with three copyable commands and hints, no `<select>`, build-mode
  picker mounted behind its disclosure, forge link only on a reached build sheet with `forgeHref`, reduced motion
  static, live markers only while `running`, the sunset copy present and «Claude Design» absent.
- Unit: `command-modes` spec modes and hints; `IMPLEMENT_MODES` still derived from `BUILD_MODES`.
- `e2e/persistent-navigation/board.spec.ts` (split out by WO-25-001): the campaign `phase` step is updated to the
  pinned sheet and the room buttons (AC-25-001.1, AC-25-002.1 re-verified); WO-02-016 updates the idea-tab steps in
  W4.
- `CampaignPipeline.tsx` and `RoamingCast.tsx` import nothing from `src/components/modules/party/**` once this work
  order lands (WO-04-010 depends on it before deleting that folder in W5).

### Derogated tests (BL-0051)

- Implementer tests updated or deleted here: `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.test.tsx`
  (also the kept WO-02-013 regression), `CampaignPipeline.ac010-8.test.tsx` (sunset copy),
  `CampaignPipeline.pixel-trail.test.tsx` (party trail removed: deleted or rewritten for the corridors),
  `src/lib/_tests/command-modes.test.ts`, `src/app/board/_components/CardDetail/_tests/CardDetail.tabs.test.tsx` (props
  of the mocked pipeline).
- Reviewer-authored, derogated for the FRD-02 gate reviewer (never edited here):
  `src/components/modules/CampaignPipeline/_tests/CampaignPipeline.wo-02-013.reviewer.test.tsx`,
  `src/app/board/_components/CardDetail/_tests/CardDetail.frd02-integration.reviewer.test.tsx` and
  `src/app/board/_tests/frd-02.shell-integration.reviewer.test.tsx` (their `onEnterForge` assertions; the forge action
  is now a link).

## Dependencies

WO-13-012 (framing patterns; `CommandBox`, `Chip`, `Button` through WO-13-011), WO-11-003 (`BuildModePicker`),
WO-25-001 (URL key `phase`). W3 in parallel with WO-02-015, WO-02-017, WO-02-018 (disjoint artifacts). Consumer:
WO-02-016 (W4) mounts it with `forgeHref`.

## Definition of done

The ACs above pass with tests that fail without the change; no import from `src/components/modules/party/**` remains in
the module; «Claude Design» appears nowhere in `src/components/modules/CampaignPipeline/**`; `.pandacorp/verify.sh
--since <ref>` green; tokens only; every chrome string from `t()` (phase content stays data in `phases.ts`).

## Status Note

- 2026-10-30 (S2A round 3): Made BuildModePicker project scope optional: unlinked ideas render the picker and keep selections in component state without reading or writing project preferences. Implement disclosures always use the picker; non-implement command modes retain their existing rendering. Updated the unlinked-idea assertion and checked selection without persistence. `pnpm exec tsc --noEmit` passed; Biome passed on the four changed TSX files. With `PORT=3951 PANDACORP_E2E_PORT=3951`, the requested FavoriteButton/BuildModePicker/CampaignPipeline Vitest run (`--maxWorkers=2`) returned exit 1: 152 passed and two BuildModePicker reviewer toast tests failed because `findByRole("status")` matched two elements. The dedicated `CampaignPipeline.s2a.reviewer.test.tsx --maxWorkers=2` run passed all 20 tests. Reviewer files and visual baselines remain untouched. No browser/E2E/full verify.sh verification; changes remain unstaged and uncommitted as requested.

- 2026-10-30 (S2A round 2): Patched every implement command disclosure, including Architecture, to use the shared picker when a linked project exists. Added optional project forwarding from CardDetail through CampaignPipeline to PhaseSheet; mode memory now uses the project identity. Unlinked ideas show plain copyable modes. Removed dead mode-default metadata, rendered disclosure hints, and updated blueprint C5. Retained implement modes because the unlinked fallback consumes them. New project-scope/fallback regression passes.
- 2026-10-30 round-2 verification: with `PORT=3951 PANDACORP_E2E_PORT=3951`, `pnpm exec vitest run src/app/board src/components/modules/IdeaCard src/components/core/FavoriteButton src/components/modules/CampaignPipeline --maxWorkers=2` returned exit 1: 533 passed, one protected reviewer test failed (`CampaignPipeline.s2a.reviewer.test.tsx:152` requires a picker without a project, contradicting the explicit fallback decision). Reviewer files remain untouched. `pnpm exec tsc --noEmit` passed (exit 0). `git diff --name-only -z --relative -- src | xargs -0 pnpm exec biome check` passed on 14 changed source/test files. `pnpm exec knip` returned exit 1 with exactly the baseline findings: unused exported types ButtonVariant, ButtonTone, TabDef, plus configuration hints; no patch-owned findings (`diff -u` of before/final output passed). `git diff --check` passed. Evidence: `/private/tmp/s2a-r2-vitest-final2.log`, `/private/tmp/s2a-r2-tsc-final.log`, `/private/tmp/s2a-r2-knip-final.log`. No browser, visual, E2E or full verify.sh run; no commits or staging, per task scope.



- 2026-10-30 (S2A): Built the six-room snake map on the frozen map tokens, original pixel sprites, delivered corridors, six-segment strip, URL-owned pinned phase sheet, arrows, complete teams, clarification disclosure commands, shared BuildModePicker and conditional real forge link. Removed party imports and retired the party-only implementer pixel-trail suite. CardDetail still accepts the transitional legacy props but no longer forwards them. Building the host forgeHref remains with WO-02-016.
- 2026-10-30: Updated the Design sheet to the frozen private-HTML-Artifact wording. No removed design-service wording remains in the module or its tests. The existing command catalog retains IMPLEMENT_MODES for its workspace consumer.
- 2026-10-30: RED evidence: the new campaign suite failed all 6 cases against the old implementation. Focused implementation verification then passed 127/127 tests; joint board/campaign verification passed 295/295 before adding the literal-slug regression cases. Final scoped results follow below. Chromium, browser fidelity and Playwright execution were not available in this worker sandbox.
- 2026-10-30 (agent-inferred, independently exposed): The unchanged reviewer interpolation test reproduced a real dollar-token replacement defect. Changed substitution to a replacement callback so slugs such as `a$&b` remain literal; added three regression cases. The reviewer test now passes; its old combobox assertion still needs reviewer reconciliation. Also awaited the popstate event in the new history test so a pending Back transition cannot spill into the next test.

- 2026-10-30 final S2A evidence: scoped implementation Vitest passed 16 files / 298 tests (`/private/tmp/s2a-vitest-final.log`, exit 0); scoped TypeScript including changed tests and imported dependencies passed (`pnpm exec tsc --noEmit -p /private/tmp/s2a-tsconfig.json`, exit 0); Biome checked all 43 changed TS/TSX/CSS files without fixes/errors (`/private/tmp/s2a-biome-final.log`, exit 0); `git diff --check` passed. Every acceptance ID in both work orders' criteria sections is cited in the existing/new test tree.
- 2026-10-30 reviewer handoff: the unchanged scoped reviewer run is RED: 8 failed / 2 passed files, 18 failed / 66 passed cases, plus the retired BoardLegend module's import failure (`/private/tmp/s2a-reviewer-drift.log`, exit 1). Reconcile the suites listed in `/private/tmp/s2a-handoff.md`; no reviewer test or blessed baseline was edited. The actual literal-slug defect from that run is fixed and its independent reviewer assertion passes. No full gate, Chromium/Playwright, native-browser focus, responsive visual fidelity or full-project TypeScript was verified. No commit, stage, merge, queue or push was performed.
