# Órbita round 5 — full redesign, verification

Date: 2026-10-20 (four iterations the same day). Status: **reviewable design iteration**, not a final design freeze or production implementation. Same stable review: http://127.0.0.1:1988/preview.html (opens Inicio).

## Owner request and scope

The owner gave full creative freedom over colors, shapes and layout, including a complete change, as long as every Mission Control function remains and the result is good, navigable, easy to understand and well made. The study was rewritten (template, tokens, shell, every screen). The [proposal](proposal.md#round-5--full-redesign-with-real-data-everywhere) lists each change, its reason and the remaining gaps. Round 4 is archived under `mockups/round-4/`.

Data comes from three private, read-only captures in the ignored `data/` folder: projects (2026-10-17, unchanged), factory extras (2026-10-20: backlog, memory, configuration, guild) and the Manual pages rendered by the locally served app (2026-10-20). The two new exporters (`scripts/export-extras.mjs`, `scripts/capture-manual.mjs`) only read; an independent subagent wrote the extras exporter and its output was re-checked (counts per section, parse) before use.

## Verification evidence

The QA scripts are kept with the study (`scripts/qa-matrix.mjs`, `scripts/qa-flows.mjs`, `scripts/qa-smalltext.mjs`); their outputs are under `evidence/` (ignored, private).

- **Canonical design preflight** (`plugin/skills/design/scripts/preflight-round.mjs`, browser ran): **0 fail, 2 warn**. Report: `evidence/round5-preflight.json`. Fixed in this round: literal colors (shadows now tokens), the explicit dark token block, 24 hover rules now behind `@media (hover: hover)`, and one 11.4 px `code`. Open warnings, both declared in the proposal: no self-hosted monospace yet, and 347 literal component lengths (from 767; threshold 150).
- **Responsive/a11y matrix (final, after the review fixes):** 33 screens/sub-sections × 1440/1280/768/375 × dark/light = **264 states**, axe WCAG 2.2 A/AA: 0 runtime errors, 0 outer horizontal overflow, exactly one H1 everywhere, no contrast, name or scroll-region violations. The only remaining axe items are 6 `target-size` notes at 375 px (Spec shortcuts, the first mosaic row, one skill row): axe reports each as "partially obscured" by the sticky bottom navigation at the captured scroll position (the targets themselves measure 26–32 px); scroll padding was added so focused elements scroll clear of both phone bars (not separately measured). Report: `evidence/round5-matrix.txt`.
- **Text floor:** no visible text under 12 px on any of the 33 screens at 1440 and 375 (`qa-smalltext.mjs`). The captured Manual carries the real app's own 10–11 px inline labels; the study raises them to 12 px when displaying them, which is itself a finding about the current app.
- **Interaction flows:** **44/44 pass**, 0 page errors, three consecutive runs (`evidence/round5-flows.txt`); one earlier run timed out on a click and cascaded from the Propuestas lesson dialog onward, and did not reproduce. Iteration 2 adds three checks: the plugin banner is first and owner items carry a copyable command, the portfolio ring explains itself on focus, and the sidebar project list is ordered by last change and its collapse is remembered. Besides the original 35, six more cover the review fixes: not-found states for an unknown idea and work order, no discard on a shipped idea, cancelling a discard returns to its detail, the tab overflow arrow at 1280 px, and the phone drawer keeping Tab focus inside. The original set covers: sidebar and bottom navigation, board search/category/clear, favorite, capture dialog with focus return, idea tabs and arrow-key tab movement, discard confirmation (simulated), picker search keeping the section, model selection/dimming/clearing, zoom/fit, single-open schema, state filters, board "show more", order dependencies, document search and relative-link resolution, change detail command, mosaic and trace navigation, build mode remembered across reload, scoped command, clipboard, backlog filter and item command, lesson dialog, trophy categories, Manual next page, rule search, agent→skill links, scroll-to-top on screen change, phone drawer (inert when closed, Escape returns focus), phone document index and visible active tab.
- **Visual inspection:** fresh screenshots of Inicio, Tablero, idea detail, Portfolio overview, Resumen, Spec, Work orders (both views and detail), Arquitectura, Party, Observabilidad, Documentos, Comandos, Propuestas, Logros, Manual and Configuración, at desktop, tablet and phone and in both themes, were inspected in this session; issues found there (rail labels on tablet, idea-title wrap, table header squeeze, card width, tab overflow at 1440) were fixed and re-captured.

## Independent review

An independent reviewer (separate agent, no access to this session's reasoning) drove the study at 375–1440 px in both themes across 43 routes and compared it with `inventory.md`. Closure:

- **Fixed:**
  - Logros statistics now state their scope (the guild's event record, not the project capture), which explains why completed work orders (176) or FRDs differ from Inicio. Counters without events read "Sin señal" instead of a false zero. The hero shows mission tiers reached (12 of 78) instead of an ambiguous "8 active".
  - *Tu turno* keeps only owner actions; orders awaiting FRD review, changes being built and drafts moved to *En marcha*. The sidebar count, tab badges and backlog chip counts now share one definition, and Propuestas explains its total.
  - The board switches to phase groups below 1024 px and fits six columns from there up.
  - Overflowing project tabs get arrow controls on pointer devices.
  - The Observabilidad switch wraps on phone.
  - The phone drawer traps focus.
  - Discard is hidden on shipped ideas and offered for open and in-progress backlog items, as in the real app.
  - Unknown idea, project, section, work order, document and Manual page show explicit not-found states instead of substitutes.
  - The decision dialog states what the capture holds.
  - The tablet rail says "Propuestas", shows distinct project initials (PS, PC) and an attention dot.
  - Breadcrumbs, links and funnel rows meet the 24 px target floor.
  - Smaller items: the diagram's first row clears its toolbar and "fit" no longer shrinks text below about 55%; the score is labelled; funnel rows are no longer fake links; the rarity legend is plain text; cancelling a discard returns to its detail; the aria label for projects without orders is honest; "mech" shows its inherited model; the activity card says entries are undated.
  - Change targets were added to the command builder; rule domains are shown; the Manual index gains a Referencia group linked to the captured catalogs.
- **Declared instead of drawn:** the remaining inventory items the reviewer listed (digest/mark-seen, recommended badge, stage checklists, freshness and direct route, deployed URL/objectives/overlay, Informe pulse/radar/records/ledger, rank acts, skill workflow diagram, agent XP) are now listed in the proposal's remaining gaps.
- **Reported, not changed:** the real Manual's own phase vocabulary/colors and 10–11 px labels differ from the rest of the app; that belongs to the app's content, not this study.
- The reviewer's "missing round-5 verification" blocker was a timing artifact: this file was written while the review ran.

## Not claimed

No production gate, no physical-device Safari run, no performance benchmark, no live-refresh behavior, and no final owner approval. Writes are simulated. The Party scene, parallel-work card, maintenance notice and verified-snapshot line are labelled illustrative.

## Iteration 2 (owner feedback on Inicio and the sidebar)

Re-run on the final HTML after the iteration: the same 264-state axe matrix (only the 6 documented bottom-bar `target-size` notes at 375 px, plus 2 on Inicio's first *Tu turno* button for the same reason), 0 overflow, 0 small text, preflight 0 fail / 2 warn. The plugin, worktree and recency data come from a re-run of `export-extras.mjs` (new `health` section using the app's `plugin-sync` and `pendingMerge` readers plus `git log -1` per project). Tooltips are hidden with `display: none` until hover or focus, after an invisible tooltip was found widening the page.

## Iteration 3 (Tu turno and Árboles de trabajo explained)

`export-extras.mjs` now also captures, read-only, each decision block's ask/context/file status (`health.decisionDetails`) and, per pending branch, the last commit subject, files changed against `main` and uncommitted changes. The decision-reader discrepancy was confirmed against the live reader (not only the 2026-10-17 capture). Final numbers are recorded below from the full re-run on the final HTML.

Final re-run on the iteration-3 HTML: interaction flows **44/44**, 0 page errors; matrix **264 states**, 0 overflow, 0 runtime errors, one H1 everywhere, axe only the 6 documented bottom-bar `target-size` notes at 375 px; no text under 12 px on any screen; design preflight 0 fail / 2 warn.

## Iteration 4 (quieter Inicio)

`export-extras.mjs` also records per repository the number of extra, locked and detached worktrees. Flows now 46 (adds the "Detalles" modal with a decision-scoped command and the worktree table opening a project's branch list).

Final re-run on the iteration-4 HTML: flows **46/46**, 0 page errors; matrix **264 states**, 0 overflow, 0 runtime errors, axe only the 6 documented bottom-bar `target-size` notes at 375 px; no text under 12 px; design preflight 0 fail / 2 warn.

## Iteration 5 (Tablero on tablet and phone)

Final re-run: flows **47/47** (adds the phone phase selector jumping to a column with no page-level sideways scroll), matrix **264 states** with 0 overflow and only the 6 documented bottom-bar `target-size` notes, no text under 12 px, preflight 0 fail / 2 warn.

## Iteration 6 (Tablero columns)

Flows **48/48** (adds the hide-empty switch: 6 → 4 columns, remembered across reload, one shared column width of 280 px at 1440). Matrix 264 states, 0 overflow, only the 6 documented bottom-bar `target-size` notes; no text under 12 px; preflight 0 fail / 2 warn.

## Iteration 7 (glance reports in the idea/project tabs)

The project capture was re-taken on 2026-10-20 with `.env.example` comments and per-project services (public fields only). Flows **50/50** (adds the Funko architecture glance: 10 services, 15 environment groups, a group modal listing its variables; and the Spec FRD modal jumping to its work orders; the diagram test now opens `model=Diagrama`, since the database section defaults to its summary). Matrix **304 states** (38 routes incl. Funko Propuesta/Spec/Arquitectura/Documentos/Campaña × 4 widths × 2 themes): 0 overflow, 0 runtime errors, one H1 everywhere, axe only 6 `target-size` notes at 375 px, each confirmed as "partially obscured" by the sticky bottom navigation. No text under 12 px; design preflight 0 fail / 2 warn.

## Iteration 8 (measured color)

Flows **50/50**, matrix **304 states** (0 overflow, the same 6 bottom-bar `target-size` notes at 375 px), no text under 12 px, preflight 0 fail / 2 warn.

## Iteration 9 (current-app structure for Propuesta, Spec and Arquitectura)

Flows **52/52** (adds: the Propuesta shows the three app bands with 13 rows for Funko Tracker; the architecture digest shows 14 stack layers, 9 integrations, the environment variables with their purpose and an ADR modal; the project Cuentas tab lists 10 services; the Spec FRD card modal jumps to its work orders). Matrix **312 states** (39 routes incl. Cuentas): 0 overflow, 0 runtime errors, one H1 everywhere; axe only 8 `target-size` notes at 375 px, each "partially obscured" by the sticky bottom navigation (checked for the new Spec button). No text under 12 px; preflight 0 fail / 2 warn.

## Iteration 10 (the app's exact layout in the idea tabs)

Flows **54/54** (adds the idea Documentos rail opening the PRD and the Campaña room picker showing the selected phase sheet). Matrix **312 states**: 0 overflow, 0 runtime errors, one H1 everywhere, axe only the 6 documented bottom-bar `target-size` notes at 375 px. The first run caught literal colors in the journey map and 11.5 px hand-off labels; both fixed (map colors are now tokens, labels 12 px) and re-checked: no text under 12 px on any screen, preflight 0 fail / 2 warn.

## Iteration 11 (cache stamp and campaign animations)

Data scripts now carry a per-build version stamp. The roam engine was checked in a real browser: with motion allowed the active room's 4 sprites change position within 4 s and the room pulses; with reduced motion they stay put and the pulse is off. Flows **54/54**, matrix **312 states** (0 overflow, the same 6 bottom-bar `target-size` notes), no text under 12 px, preflight 0 fail / 2 warn.

## Iteration 12 (modal colour, clickable FRD cards, right-hand indexes, Campaña)

Flows **57/57**, 0 page errors (adds: clicking the body of an Arquitectura FRD card opens a violet modal headed "FRD-01 · Plan de implementación" with 7 rows and no extra button on the card; the project, Manual and idea document indexes sit right of the reader at 1440; Campaña's next-phase button moves the sheet and the selected room). Matrix **312 states**: 0 overflow, 0 runtime errors, one H1 everywhere. The first axe run caught the phase-head state chip below contrast on its tinted head in dark (8 states); fixed with a surface background and re-checked. Remaining axe items are the documented `target-size` notes at 375 px, each reported as "partially obscured" by the sticky bottom navigation (checked again for the Documentos metadata summary). No text under 12 px; preflight 0 fail / 2 warn.

## Iteration 13 (no accent stripes, kind tags, conditional progress, environment rows)

Flows **59/59**, 0 page errors (adds: PandaSaga's 7 FRD cards each carry a coloured kind tag and no progress bar before the build, while Funko Tracker's plan shows 8; Funko's 55 environment variables render as name | purpose rows with the missing ones flagged and counted). A CSS search confirms no inset top/left accent shadow or thick left/top border remains outside the journey map's corridors. Matrix **312 states**: 0 overflow, 0 runtime errors, one H1 everywhere. The first axe run caught the "Sin descripción" note below contrast in light (56 nodes on Funko); raised to the secondary text colour and re-checked. Remaining axe items are the documented `target-size` notes at 375 px ("partially obscured" by the bottom navigation). No text under 12 px; preflight 0 fail / 2 warn.

## Iteration 14 (document rail colour, plan mosaic gated on the build)

Flows **60/60**, 0 page errors (adds: PandaSaga's Arquitectura plan shows no mosaic and no "Por FRD" subtitle, Funko Tracker's shows both). Matrix **312 states**: 0 overflow, 0 runtime errors, one H1 everywhere; axe only the documented `target-size` notes at 375 px ("partially obscured" by the bottom navigation). No text under 12 px; preflight 0 fail / 2 warn.

## Iteration 15 (Propuestas: Resumen, lesson flow, backlog by topic)

Flows **62/62**, 0 page errors. New checks:
- the Resumen shows 4 actions, each with one `/pandacorp:` command, and the menu badge matches (4);
- the backlog topic filter narrows the list, and areas with the same plain name are merged.

The existing backlog and lesson checks were updated for the new tabs. Matrix **320 states** (40 routes incl. the Propuestas Resumen): 0 overflow, 0 runtime errors, one H1 everywhere. The first axe run caught the green flow step's caption below contrast in dark; it was raised to the secondary text colour and re-checked. Remaining axe items are the documented `target-size` notes at 375 px. No text under 12 px; preflight 0 fail / 2 warn.

## Iteration 16 (Logros in the app's organization)

Flows **63/63**, 0 page errors.
- The trophy category check now filters by Velocidad (100 → 10), since Secretos is a section, not a category.
- A new check confirms:
  - 19 missions in 5 sagas with one spotlight;
  - the radar, 6 weekly columns and the ideas line;
  - 40 ranks in 6 eras with exactly one current.

Matrix **320 states**: 0 runtime errors, one H1 everywhere. The first run caught an 18 px overflow at 768 px in the phase-transition list; its rows now stack on tablet, re-checked at all widths. Axe shows only the documented `target-size` notes at 375 px. No text under 12 px; preflight 0 fail / 2 warn. The guild capture was re-taken (`export-extras.mjs`) with the Informe series.

## Iteration 17 (Logros summary balance, rank ladder focus)

Flows **63/63**, 0 page errors. The Logros check now also confirms the summary's three right-hand cards and the 3 far eras collapsed. Matrix **320 states**: 0 overflow after stacking the summary radar below 1180 px (the first run found 36 px at 768). Axe shows only the documented `target-size` notes at 375 px. No text under 12 px; preflight 0 fail / 2 warn.

## Iteration 18 (four Logros improvements)

Flows **64/64**, 0 page errors. A new check confirms:
- 6 reachable trophies in 6 different categories;
- idle missions only at the end of each saga;
- 11 "sin datos aún" ledger rows;
- the Inicio last-achievement link, and the preview notice showing the same trophy and closing.

The notice and the last-achievement link pass axe in dark and light. Matrix **320 states**: 0 overflow, 0 runtime errors; axe only the documented `target-size` notes at 375 px. No text under 12 px; preflight 0 fail / 2 warn.

## Iteration 19 (project workspace: Resumen, Observabilidad, Cuentas, La Fragua)

Projects were re-captured with overlay freshness and the services' login and dashboard URL. Flows **67/67**, 0 page errors.
- **New checks:**
  - PandaSaga shows the upgrade notice with `/pandacorp:upgrade`; Funko Tracker, which is current, does not;
  - the Resumen has 4 tiles and a verdict, with no engine-log decision and no product-context block;
  - the tab order is Resumen · Spec · Observabilidad · Arquitectura · Cuentas · Cambios · Party · Documentos · Comandos, and old `tab=Work orders` links land on Observabilidad;
  - Cuentas has login users, `target=_blank` dashboard links and spaced environment chips;
  - La Fragua's station counts add up to the project's work orders, and a token opens its order.
- **Updated checks:** the dependency trace now opens via `view=deps`; the spec FRD jump lands on Observabilidad; the environment check follows the data (Funko's 55 variables are now all described).

Matrix **336 states** (42 routes): 0 overflow, 0 runtime errors, one H1 everywhere.
- **First axe run:** it caught the upgrade note's caption below contrast in dark, and 16 px Fragua tokens under the 24 px target size. Both are fixed (secondary text colour, 24 px tokens) and re-checked.
- **Remaining:** only `target-size` notes at 375 px reported as "partially obscured" by the bottom navigation (now also one Observabilidad FRD summary).

No text under 12 px; preflight 0 fail / 2 warn.

## Iteration 20 (Portfolio cards / list switch)

Flows **68/68**, 0 page errors. The new check confirms the overview shows cards and no table by default, and that the Lista switch shows only the table with `view=lista`. Matrix for both views at 4 widths × 2 themes: 0 issues.

## Iteration 21 (type, sidebar, Fragua in the Resumen, dependency graph)

Flows **70/70**, 0 page errors.
- **New checks:**
  - the sidebar collapses to 64 px, floats to 252 px on pointer without moving the content, survives a reload and can be pinned open again;
  - headings render in Space Grotesk;
  - the Resumen scene's counts add up to Funko Tracker's 48 orders, there is no Party tab, Apagada switches to idle, the simulation changes the counts, Panel restores the Estado general card, and a token opens its order;
  - the dependency graph lays out all 48 orders, and focusing WO-05-001 lights 36 edges and dims the rest.
- **Updated checks:** the trace and the panel-mode Resumen checks follow the new structure.

Matrix **344 states** (43 routes incl. the scene on and the Panel view): 0 overflow, 0 runtime errors; axe only the documented `target-size` notes at 375 px. No text under 12 px. The preflight's unguarded-hover warning from the first sidebar pass was removed by driving the float from pointer events; preflight 0 fail / 2 warn.

## Iteration 22 (dependency graph levels, Cuentas, Documentación, Configuración)

Flows **72/72**, 0 page errors.
- **New checks:**
  - Documentación: the home shows the 2 tutorial steps and 5 groups, «worktree» finds 7 pages by content, and a tutorial page shows breadcrumbs, "Paso 1 de 2" and a progress bar;
  - Configuración: the hub has 4 tiles and its search returns skills, agents and rules for «review»; the MUST facet narrows standards from 33 to 11; skill rows carry copyable commands;
  - Dependencias: 8 FRD boxes with 19 aggregated links, no "Línea de tiempo" view, and the work-order level still lays out all 48 orders with focus;
  - Cuentas: no icons beside names or logins, rows sorted by status, logins are click-to-copy.

Matrix **352 states** (44 routes): 0 overflow, 0 runtime errors, one H1 everywhere. The first axe run flagged short "Tus comandos" descriptions and skill names under the 24 px target; both now have a 24 px minimum height. Remaining: only `target-size` notes at 375 px reported as "partially obscured" by the bottom navigation. No text under 12 px; preflight 0 fail / 2 warn.

## Iteration 23 (docs home balance, collapsed FRD list, chip alignment)

Flows **73/73**, 0 page errors. The new check confirms that Por FRD starts with 0 of 8 groups open, the toggle opens all 8 and closes them again, and every state chip ends at the same x (1327 px at 1440). The scroll-to-top check now expands the groups first. The docs home cards measure 545 / 545 px. Matrix **352 states**: 0 overflow, 0 runtime errors; axe only the documented `target-size` notes at 375 px ("partially obscured" by the bottom navigation). No text under 12 px; preflight 0 fail / 2 warn.

## Iteration 24 (Fragua-only Resumen, coded tokens, scoped courier)

Flows **74/74**, 0 page errors.
- **New check:**
  - a token reads «01 001» and its hover card names WO-01-001;
  - all plates are 237 px;
  - every empty station shows its placeholder;
  - the courier's route matches the first and last busy station: 3 → 4 for Funko Tracker.
- **Updated checks:** the Resumen checks now look for the hero's "último movimiento" and for the absence of a Panel switch.

One full run first showed 22 click timeouts ("element not stable") across unrelated screens. A clean rerun, plus an isolated reproduction of the first failing step, showed every element stable, so it was a transient slowdown on this machine. The run also found a real defect: the simulation tried to update the "+N" counter of an empty station, which now has none. It is fixed: placeholders are cleared when work arrives.

Matrix **344 states**: 0 overflow, 0 runtime errors.
- **First axe pass:** coded tokens failed contrast in the light theme (32 nodes), because the dark scene used light-theme tones. The scene is now pinned to the dark palette, and both themes re-check clean.
- **Remaining:** only `target-size` notes at 375 px, each "partially obscured" by the sticky bars.

No text under 12 px; preflight 0 fail / 2 warn.

## Iteration 25 (Últimos avances)

Flows **74/74**, 0 page errors. The three Resumen matrix routes (Funko, PandaSaga, simulation) at 4 widths × 2 themes: 0 overflow, 0 contrast issues; only the documented 375 px `target-size` note on the simulation route. No text under 12 px. The proposal's "Remaining gaps" list was re-checked against the prototype source and the capture timestamps, and corrected: La Fragua counts are real, and the Informe series, overlay notice and dependency maps are now drawn.


## Iteration 26 (phone and tablet pass)

- **Review:** three independent reviews of all 44 routes at 375 and 768 px (dark) found about 60 problems. After the fixes, a second review of fresh captures found no layout-breaking issue. Its remaining items were fixed and re-checked:
  - two hidden-data clips (the comparison table at 768 px and the schema code at 375 px);
  - the account logins at 768 px;
  - several alignment details.
- **Flows:** **76/76**, 0 page errors (`evidence/round5-flows.txt`). The two new checks are:
  - on a phone, the dependency map is a list whose FRDs unfold to «Depende de / Desbloquea» and open a work order;
  - on a phone, La Fragua shows its four stations in four rows and Cuentas renders as cards without page overflow.
- **Matrix:** **344 states** (44 routes × 1440/1280/768/375 × dark/light), with 0 overflow, 0 runtime errors and one H1 everywhere. Axe reports only 10 `target-size` notes at 375 px. Each is a control of 28 px or more, partially covered in the capture by the sticky bottom navigation (Observabilidad, Cuentas, the La Fragua simulation, Backlog, Manual).
- **Other checks:**
  - no text under 12 px on any route;
  - design preflight 0 fail / 2 warn (the system mono font and literal lengths).

Light theme was spot-checked visually on the phone for Cuentas and the dependency list. The proportional figures now used for big numbers replace Space Grotesk's tabular «1», whose flag looked clipped.

## Iteration 27 (work-order summary, Comandos colour, Spanish interface)

- **Flows:** **77/77**, 0 page errors. The new check opens WO-02-014. It confirms the current step is «En revisión», the four sections come in reading order, there are three criterion cards, and the order touches one file.
- **Matrix:** 56 states on the routes these changes touch (work-order detail, Comandos, Resumen, Portafolio, Inicio, Memoria, Documentos) at 1440/1280/768/375 × dark/light, with 0 issues: no overflow, no errors and no axe findings.
- **Visual check:** the work-order detail at 1440 and 375 px, plus a second work order with Summary and In Scope sections; Comandos in both themes.
- **Language scan:** a scan of the visible text on all 44 routes left English only inside document or project/factory content, apart from the factory artifact names kept on purpose.

## Iteration 28 (one application: shared component rules)

- **Review:** three independent catalogues of all routes (1440 px) listed every variant of each component. The fixes were shared rules. Two verification passes on fresh captures followed, and their remaining items were fixed.
- **Flows:** **77/77**, 0 page errors. Two checks were updated to the new markup: band headings are card headers, and the FRD type tag is a chip.
- **Matrix:** 344 states, with 0 overflow, 0 runtime errors and no contrast findings. Axe reports only `target-size` notes at 375 px, on controls of 28 px or more that the sticky bottom navigation partially covers in the capture.
- **Other checks:**
  - no text under 12 px;
  - preflight 0 fail / 2 warn (the system mono font and literal lengths).
