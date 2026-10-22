# Context pack · FRD-15 · Plugin out-of-sync warning

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-15 copy, S2.1 builds, S2.2 amendments, S2.3-15 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-15-plugin-out-of-sync-warning/frd.md` (id FRD-15, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 1 under `states["frd-15-plugin-out-of-sync-warning"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 8 AC lines: 2 drawn · 0 partially drawn · 2 not drawn · 4 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-15#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### AC-15-002.1 · drawn · `plugin-banner`, `shell-expanded`

> - **AC-15-002.1** — IF the installed `version` is **strictly behind** the source `version` (semver), Mission Control SHALL show the banner — heading "El plugin instalado está atrás", the detail naming both versions, and the recall steps (run command → restart session).

**Prototype:** First element of Inicio (under the page header): coral alert banner with icon, heading "El plugin instalado está atrás", detail "Tienes instalada la 9.140.0 y el repositorio ya va por la 9.141.0. Las skills que corras usan la versión vieja hasta que actualices.", the steps "1) Corre el comando · 2) Reinicia la sesión de Claude Code.". The sidebar also carries a coral "Plugin desactualizado" pill (aria title "Instalado 9.140.0 · repositorio 9.141.0") that links to Inicio.

### AC-15-002.2 · behaviour only · `plugin-banner`

> - **AC-15-002.2** — IF the installed `version` **equals or is newer than** the source `version`, Mission Control SHALL show **nothing** (reason `in-sync`, no banner) — this is the up-to-date state `claude plugin update` reports.

**Prototype:** In-sync renders nothing; the capture is the behind case (a state without the banner is not captured).

### AC-15-002.3 · behaviour only · `plugin-banner`

> - **AC-15-002.3** — IF either version is missing or unparseable, Mission Control SHALL treat the state as `unknown` and show **nothing** (no false alarm).

**Prototype:** Unknown renders nothing: data rule.

### AC-15-004.1 · drawn · `plugin-banner`

> - **AC-15-004.1** — The banner SHALL show the **command to copy** `claude plugin update pandacorp@panda-corp`.

**Prototype:** Command box `claude plugin update pandacorp@panda-corp` with a copy icon button (aria-label "Copiar claude plugin update pandacorp@panda-corp").

### FRD-15#U1 · behaviour only · `plugin-banner`

> - The banner SHALL **disappear on its own** (self-clear on the next poll) once the installed version catches up to the source version.

**Prototype:** Self-clearing on the next poll: behaviour (live refresh is not captured).

### FRD-15#U2 · behaviour only · `plugin-banner`

> - The check SHALL **not execute anything**: it only reads the two JSON files and shows the command; the owner runs it. Any unreadable/unparseable input yields `unknown` (never a false alarm), and the readers never throw.

**Prototype:** Read-only: the banner only shows and copies the command.

### FRD-15#U3 · not drawn · `plugin-banner`

> - WHEN plugin freshness is read THEN Mission Control SHALL return separate Claude and Codex installed/source verdicts.

**Prototype:** One banner/pill for the plugin version; separate Claude and Codex verdicts are NOT drawn.

### FRD-15#U4 · not drawn · `plugin-banner`

> - IF one runtime cache is missing THEN only that runtime's verdict SHALL be `unknown`; the other verdict SHALL remain independently computable.

**Prototype:** A per-runtime unknown verdict is NOT drawn.

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `plugin-banner` | `#inicio` | wait for `.alert-banner` | full page | `AC-15-002.1` `AC-15-002.2` `AC-15-002.3` `AC-15-004.1` `FRD-15#U1` `FRD-15#U2` `FRD-15#U3` `FRD-15#U4` |

States cited above that belong to another FRD folder (captured there, reused here): `shell-expanded`.

**Not drawn (2)**: `FRD-15#U3`, `FRD-15#U4`.

**Partially drawn (0)**: none.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### `plugin-banner`

- [h2] El plugin instalado está atrás
- [p] Tienes instalada la 9.140.0 y el repositorio ya va por la 9.141.0. Las skills que corras usan la versión vieja hasta que actualices.
- [p] 1) Corre el comando · 2) Reinicia la sesión de Claude Code.
- [@aria-label] Copiar claude plugin update pandacorp@panda-corp

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- Steps "run command → restart session" | "1) Corre el comando · 2) Reinicia la sesión de Claude Code.".
- Sidebar pill "Plugin desactualizado" (not in the FRD).
- Dirty variant heading "Hay cambios sin commitear en el plugin" / "N archivos modificados en plugin/ sin commitear" exists in the prototype code but FRD-15 states that uncommitted plugin changes are deliberately NOT a trigger.

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- Dirty-plugin variant of the banner (prototype code path `HEALTH.plugin.uncommitted`) contradicts the owner decision of 2026-06-22 recorded in the FRD; the proposal text still says it renders "when behind (or with uncommitted plugin changes)". Decide at S1.3 whether to drop the variant from the prototype or reinstate it in the FRD.
- Per-runtime (Claude/Codex) verdicts (Proposal 32 R9) have no UI counterpart.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 2 (owner): the plugin warning is the first element of Inicio and a pill in the sidebar, driven by the real FRD-15 readers (installed 9.135.0 vs repository 9.137.0 at that capture; 9.140.0 vs 9.141.0 in the fixture); it only renders when behind.
- 2026-10-21 language: command and file names stay literal; the sentence is Spanish.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
