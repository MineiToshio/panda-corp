# Context pack · FRD-20 · Project overlay freshness

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-20 copy, S2.1 builds, S2.2 amendments, S2.3-20 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-20-overlay-freshness/frd.md` (id FRD-20, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 1 under `states["frd-20-overlay-freshness"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 6 AC lines: 1 drawn · 1 partially drawn · 1 not drawn · 3 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-20#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### AC-20-001.1 · partial · `overlay-behind`, `project-summary`

> - **AC-20-001.1** — IF the project's `overlay_version` is **strictly behind** the factory's
>   `OVERLAY_VERSION` (semver), Mission Control SHALL show the warn badge in Resumen — heading
>   "Versión desfasada de Pandacorp", a detail naming both versions, and the copyable
>   `/pandacorp:upgrade` command.

**Prototype:** Resumen opens with an amber notice (icon, "Este proyecto usa una versión vieja del motor de Pandacorp", "Va con la v8.98.0 y la fábrica ya está en la v8.110.0. Actualízalo para que el próximo build use las reglas y herramientas nuevas.", command `/pandacorp:upgrade`, "Córrelo en la carpeta de PandaSaga"). The AC's heading is "Versión desfasada de Pandacorp". A running project adds "(espera a que termine el build en curso)" (code path; the captured behind projects are not running).

### AC-20-001.2 · not drawn · `project-summary-funko`

> - **AC-20-001.2** — IF the project's `overlay_version` **equals or is newer than** the factory's,
>   Mission Control SHALL show the ok badge ("al día") with **no** command row.

**Prototype:** A project that is up to date (Funko Tracker, 8.110.0 = 8.110.0) shows NOTHING; the quiet ok badge "Última versión de Pandacorp" is not drawn.

### AC-20-001.3 · behaviour only · `overlay-behind`

> - **AC-20-001.3** — IF either version is missing or unparseable, Mission Control SHALL treat the
>   state as `unknown` and show **nothing** (no false alarm).

**Prototype:** Unknown renders nothing: data rule.

### AC-20-002.1 · drawn · `overlay-behind`

> - **AC-20-002.1** — The warn badge SHALL show the **command to copy** `/pandacorp:upgrade`.

**Prototype:** Copyable command box with the copy icon.

### AC-20-002.2 · behaviour only · `overlay-behind`

> - **AC-20-002.2** — The badge SHALL NOT execute the command — it only shows it so the owner runs it
>   in the project's folder.

**Prototype:** The notice only shows the command; the owner runs it in the project folder (the note says where).

### FRD-20#U1 · behaviour only · `overlay-behind`

> - The check SHALL **not execute anything**: it only reads `overlay_version` (already parsed) and the
>   `OVERLAY_VERSION` file. Any unreadable/unparseable input yields `unknown` (never a false alarm),
>   and the readers never throw (DR-078: an explicit `unknown` reason, never a silent fallthrough).

**Prototype:** Read-only defensive readers.

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `overlay-behind` | `#portfolio?project=pandasaga` | wait for `.notice.upgrade` | full page | `AC-20-001.1` `AC-20-001.3` `AC-20-002.1` `AC-20-002.2` `FRD-20#U1` |

States cited above that belong to another FRD folder (captured there, reused here): `project-summary`, `project-summary-funko`.

**Not drawn (1)**: `AC-20-001.2`.

**Partially drawn (1)**: `AC-20-001.1`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### `overlay-behind`

- [b] Este proyecto usa una versión vieja del motor de Pandacorp
- [p] Va con la v8.98.0 y la fábrica ya está en la v8.110.0. Actualízalo para que el próximo build use las reglas y herramientas nuevas.
- [code] /pandacorp: upgrade
- [@aria-label] Copiar /pandacorp:upgrade
- [span] Córrelo en la carpeta de PandaSaga
- [b] Siguiente paso:
- [code] /pandacorp: implement
- [@aria-label] Copiar /pandacorp:implement
- [span] La Fragua · PandaSaga

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- "Versión desfasada de Pandacorp" | "Este proyecto usa una versión vieja del motor de Pandacorp".
- "Última versión de Pandacorp" (ok badge) | absent.
- Detail "naming both versions" | "Va con la v8.98.0 y la fábrica ya está en la v8.110.0.".

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- The ok badge (AC-20-001.2) is an FRD want without a drawn counterpart (Group B), or the owner drops it.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 19: the upgrade notice appears only when the project's overlay is behind the factory, with `/pandacorp:upgrade`, using the app's `getOverlayFreshness`; it sits at the top of the Resumen above "Siguiente paso" and La Fragua.
- Iteration 28: command boxes inside a toned notice take its tint and a coloured prompt.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
