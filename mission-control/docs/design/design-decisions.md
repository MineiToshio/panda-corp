# Design decisions — Mission Control

History and rationale for the design contract. The canonical token values live in `docs/design/design-tokens.json`; the human-readable contract in root `DESIGN.md`. This file records *how we got here and why*.

**Current contract: Órbita, frozen 2026-10-22** (first entry below). Entries dated 2026-06-18 and 2026-06-19 describe the Atelier / pixel-RPG freeze and are **superseded**; they are kept for history. The 2026-06-22 fidelity pass is superseded in its Atelier-specific parts (see its banner). The 2026-06-26 reveal-more rule still holds and is carried into `DESIGN.md`.

---

## 2026-10-22 — Freeze the Órbita design contract (DR-054 ADOPT-VISUAL) — **FROZEN**

**What.** The design system is frozen **FROM the owner-approved Órbita prototype at `docs/design/prototype/index.html`** (round 5, iteration 28, approved by the owner on 2026-10-21; decision-log entry of that date). Root `DESIGN.md` is rewritten as the Órbita contract (marked `FROZEN 2026-10-22`, pending the design gate), `docs/design/design-tokens.json` is regenerated from the prototype's final CSS (history in `design-tokens-history.json`, web fonts under `fonts`), and `docs/design/components.md` is rewritten for Órbita. The portable CSS split lives in `docs/design/prototype/reference/css/`, the catalogue in `docs/design/prototype/components.html`, the per-FRD slices in `docs/frds/frd-NN-*/mocks/`.

**Why.** Under DR-054 an approved visual makes the designer's job fidelity, not novelty: no alternative directions were generated and nothing was relaxed or modernised. The owner liked the round-4 direction, gave full creative freedom on colour, shape and layout on condition that every Mission Control function stays, and approved the result after 28 owner-reviewed iterations with real data at desktop, tablet and phone widths in both themes.

**What the prototype contains (DR-056 complete extraction).**
- Base layer: neutral graphite/porcelain tokens, nine semantic hues with two tints, the type scale, radii, spacing, seven shadow tokens, and the shared components of iteration 28.
- App-wide shell: the persistent sidebar (252px, 64px collapsible rail, 76px tablet rail), the phone top bar, bottom nav and drawer, the skip link.
- Embedded scene layers, each with its own spec: La Fragua (four stations, tokens, courier, always-dark scene tokens), La Campaña (dark journey map with six pixel-art rooms), the two-level dependency graph, the data-model diagram, the typed document paper and the captured Manual (`.manual-live`).
- Assets staged for the app: Space Grotesk, Inter and JetBrains Mono (self-hosted, SIL OFL), the Pandacorp mark, the twelve agent sprites, courier and mascot, 18 rank emblems, six zone images, 64 exported SVG icons (`prototype/icons/`). The unused Manrope files are not staged.

**Rationale of the rules frozen.** Chrome is neutral and hue carries meaning, always with text or an icon, so a manager can scan a screen by colour without it being decoration. Green, amber and red were reserved for status and severity after the owner found categories borrowing them (iteration 28); a project's phase counts as status, which is the deliberate exception. Every card, band and section got one header form, one command-box look, one search width and one «Mostrar más» bar because three independent catalogues of the screens found three visual dialects. Typography was decided in iteration 21 (Space Grotesk display + Inter body); JetBrains Mono is kept for ids, code, commands and paths only. The sidebar replaced the earlier top navigation because projects are the main object of the app and each should be one click away from any screen. The brand mark is the existing Pandacorp logo; the product keeps its name.

**Privacy-safe fixture.** The repository is public, so the prototype renders **fictional data only**. A fixture factory under `docs/design/prototype/fixtures/` (factory root with portfolio, ideas, backlog, memory and services; five fictional projects; `git-state.json` standing in for git history) is written in the formats the app's own readers parse, and the exporters run those readers with a frozen clock (2026-10-21T00:20Z), so the output is byte-identical between runs. Project and idea ids match the approved review (`mission-control`, `funko-tracker`, `pandasaga`, `pandacast`, `personal-page-v2`); their content is invented. The same fixture can seed the app build for the fidelity gate. `OPEN-MOCKUP.md` has the regeneration commands. Earlier rounds are archived under `docs/design/explorations/visual-refresh-2026/mockups/`; the previous Atelier prototype is at `docs/design/archive/prototype-v1/`.

**Supersedes.** The Atelier / pixel-RPG freeze (2026-06-18) and its complete-extraction addendum (2026-06-19: `rpgSkin`, `party`, `partyStructural`), and the embedded `party-proposal.html` / `party-pipeline.html` as binding visuals. Those entries below are marked superseded and kept for history. The old Atelier token names are gone from `design-tokens.json`.

**Owner decisions applied (M1, 2026-10-22 and earlier).** Mission Control targets desktop, tablet and phone (2026-10-21). The interface is Spanish; shown content keeps its language; artifact names stay in English (FRD, PRD, ADR, work order, spec, backlog); «Documentación» is the surface name everywhere and «Docs» is its short rail and bottom-nav label (as the prototype draws it; «Manual» is not used). Features the prototype does not draw stay out of v2 (the Inicio digest with mark-seen, the board «recommended» badge, Campaña per-phase checklists, deploy target and objectives in the Resumen, the skill workflow diagram, the creation affordances). The Party tab is gone (La Fragua heads the Resumen). Data-model layout: the app's current engine stays (owner-approved 2026-10-16) and its canvas is compared by computed styles (L1/L2), not pixels (L3); the dependency map adopts the prototype's layouts.

**Deliberate decisions about the prototype itself.**
- **Inicio H1.** The reconciliation proposed recording «Centro de mando» (H1) against the nav label «Inicio» as a deliberate deviation. The prototype source now reads `pageHead('Inicio', 'Tu centro de mando: …')`, so the H1 equals the nav label and there is no deviation to justify. «Centro de mando» survives in the subtitle.
- **Accordion exception.** Decision rules open as an inline accordion although reveal-more normally opens a dialog (2026-06-26): 48 short rows, default text only.
- **Prototype-only text.** The footer sentence, the capture stamp («Captura de proyectos · …», «Captura de la fábrica · …») and the demo bar are not product copy (DR-061); the build implements none of them, and the capture stamp is not a component.
- **Theme control (M2 owner decision 5, 2026-10-22; resolves D-8).** The prototype draws a small theme button (sun/moon) in the sidebar footer next to «Colapsar» and inside the drawer on phones. It starts from the system preference and remembers the owner's choice. The existing `ThemeToggle` stays in the inventory, restyled to Órbita (`components.md`). The demo bar's own `#theme` button remains a separate demo-only affordance.
- **Brand-mark exception (M2 owner decision 4, 2026-10-22).** The brand mark stays the raster emblem `docs/design/prototype/assets/pandacorp.png`, a recorded exception to the vector-logo rule: Mission Control is an internal tool and the emblem is the guild crest. The build serves the original bytes (no re-encoding, no `next/image` optimisation). `docs/design/prototype/logo/` holds the export: `pandacorp-mark.svg` (a wrapper that embeds the PNG losslessly), `pandacorp-mark.png` and a README that states the exception. The SVG is a convenience wrapper, not a redrawn vector.

**Where the drawn prototype departs from its own rules (recorded, not hidden).** Verified against `base.css`, `prototype.css` and `prototype.js` on 2026-10-22, after the S2.1 prototype pass. **The DRAWN values bind.** The prototype wins for visuals, and the L1/L2 oracle measures exactly what is drawn: D-2, D-3, D-4 and D-6 are frozen as drawn, so a build that "corrects" one of them fails its own oracle. Changing any of them is a later prototype round (recorded in the visual punch list), never a build-side decision. D-1, D-5, D-7 and D-8 are resolved; nothing is left to diverge.

| # | Finding | Rule | Resolution |
|---|---|---|---|
| D-1 | Motion. The earlier prototype carried non-transform transitions (colour, background, border, shadow, the sidebar's `width`) and opacity keyframes that faded text. | FRD-13 #U5 and DR-129: only transforms animate, text never fades | **Resolved (FRD wins; prototype aligned in S2.1).** `prototype.css` keeps only `transform` transitions and `@keyframes pop`, `achin` and `tok-in` animate transforms only; hover feedback changes fill or border without animating them. Nothing is left to diverge. |
| D-2 | `dialog .dbody .eyebrow` is set in JetBrains Mono («Lo que se necesita de ti», «Recomendación del agente»); `.ears` keyword tags and the `.cm em` cast name tag are mono | Uppercase labels are Inter; mono only for ids, code, commands, paths | **Binds as drawn** (mono stays for these elements; the measured value is the oracle). A change to Inter is a later prototype round. |
| D-3 | `table.t th` tracks at .05em; every other uppercase label at .08em | Proposal says table heads share the eyebrow style | **Binds as drawn** (.05em; the measured value is the oracle). |
| D-4 | Hue outside its meaning: green on the Observabilidad tab and its view switch, the work-order reading tabs, paper and acceptance criteria, «Los más alcanzables» and the cost chip; amber on the Inicio nav icon and the «Tu turno» card; coral on the Antipatrón lesson type and the Propuesta problem band; gold on the Data FRD kind | Green/amber/red only for status and severity | **Binds as drawn** (the audit left it; the oracle measures these hues). Listed in `DESIGN.md`; a recolour is a later prototype round. |
| D-5 | Em dash in copy. The Propuesta renderers no longer join title and description with « — » (no such join remains in `prototype.js`). The one remaining «—» is the **empty-cell marker** in tables and stats. | No em dash as a separator in UI copy (code-conventions) | **Resolved.** The rule bans the dash used as a *separator*; the empty-cell marker is not one and stays as drawn. |
| D-6 | Targets under 44px: `.btn` 40, `.btn.sm` 32, `.chipbtn` 34, `.iconbtn` 40, `.cmd .iconbtn` 36, `.ask-cmd .iconbtn` 30, `.diagram-tools .iconbtn` 34 | 44px design target, 24px gated floor | **Binds as drawn.** All clear the 24px gate; the L1/L2 oracle measures the exact box sizes, so the build reproduces them. Reaching 44px is a later prototype round the owner asks for. |
| D-7 | English interface strings (dialog kickers «Skill», «Estándar · Programming», scope chip «project», model chips, «esfuerzo high») | Interface in Spanish | **Resolved.** The prototype now draws these in Spanish (the copy reconciliation `freeze/copy/frd-NN.md` judged them); shown content keeps its original language. |
| D-8 | Theme control: the only switch was `#theme` in the demo bar (`data-demo-only`) | FRD-13: both themes first-class | **Resolved by the owner at M2 (decision 5, 2026-10-22):** a theme button (sun/moon) is drawn in the sidebar footer next to «Colapsar» and in the phone drawer; system preference by default, choice remembered. `ThemeToggle` stays in `components.md`, restyled. It is not retired. |

## Functional reconciliation (DR-064)

Both directions were reconciled before the prototype was blessed as canonical. Full itemised tables with EARS drafts: `docs/design/freeze/reconciliation.md` (S1.3). The owner confirmed every recommendation at M1 on 2026-10-22 (`docs/design/freeze/m1-decisions.md`). Counts: **Group A 79 · Group B 53 · contradictions 20 · prototype corrections 13**.

### Group A · the prototype has it, the FRDs lacked it (79) — RESOLVED: written into the FRDs

S2.2 writes every item into its owning FRD as an acceptance criterion with the pre-assigned id (`AC-NN-MMM.K`, next free REQ number of the FRD, `.K` from 1), and the FRD's `fdd.md` cites the captured states. Item numbers A-01…A-79 are in `reconciliation.md`.

| FRD | Items | New ids start at | What the prototype adds |
|---|---|---|---|
| FRD-02 Ideas board | A-01…A-08 (8) | AC-02-016 | board search, phase selector chips, hide-empty switch, category result count, idea header, Campaña progress strip, clickable FRD cards with kind tags, env-var rows |
| FRD-03 Portfolio | A-09…A-11 (3) | AC-03-008 | overview cards, Tarjetas / Lista switch, project picker dialog |
| FRD-04 Project workspace | A-12…A-19 (8) | AC-04-014 | compact header, tab counts, Resumen tiles, Avance por FRD, decisions list and dialog, Tu turno, Últimos avances, Documentos reader |
| FRD-05 Work orders | A-20…A-23 (4) | AC-05-008 | three views, Por FRD groups, Tablero caps, reading summary |
| FRD-06 La Fragua | A-24…A-31 (8) | AC-06-020 | scene at the head of the Resumen, verdict, four stations, tokens, empty stations, live mode, foot chips, stacking |
| FRD-07 Configuration | A-32…A-36 (5) | AC-07-013 | Resumen hub, search and filters, agents by tier, rule filters, standards list |
| FRD-08 Documentation | A-37…A-39 (3) | AC-08-020 | routing home, full-text search, reader with right-hand index |
| FRD-09 Gamification | A-40, A-41 (2) | AC-09-008 | sidebar guild card, gold achievement notice |
| FRD-10 Achievements Hall | A-42…A-46 (5) | AC-10-028 | next rank, mission order, trophies, rank eras, «sin datos aún» |
| FRD-11 Build modes | A-47…A-49 (3) | AC-11-005 | mode cards, scoped build target, Campaña picker |
| FRD-12 Observability | A-50…A-53 (4) | AC-12-006 | two-level dependency map, focus card, list below 900px, legacy link |
| FRD-13 Visual system | A-54…A-57 (4) | AC-13-010 | colour rules, fonts and 12px floor, hover and focus rules, always-dark scenes |
| FRD-15 Plugin warning | A-58 (1) | AC-15-006 | sidebar pill |
| FRD-17 Proposals | A-59…A-62 (4) | AC-17-011 | ordered to-do, nav badge counts actions, grouped signals, Memoria flow |
| FRD-18 Inicio | A-63…A-66 (4) | AC-18-022 | layout, one-line Tu turno with dialog, En marcha, Pulso and funnel |
| FRD-19 App shell | A-67…A-70 (4) | AC-19-005 | Proyectos group, nav counts, collapsible rail, tablet and phone shell |
| FRD-20 Overlay freshness | A-71 (1) | AC-20-004 | project folder named in the notice |
| FRD-21 Pending merge | A-72…A-74 (3) | AC-21-007 | Árboles de trabajo table, branch dialog, cleanup command |
| FRD-22 Factory backlog | A-75…A-78 (4) | AC-22-010 | priority tiles, topic bars, Cómo avanzar, grouped open items |
| FRD-26 Services | A-79 (1) | AC-26-011 | Cuentas table |

### Group B · an FRD wants it, the prototype lacks it (53)

**Out for v2 (35)** — owner decision 2026-10-21 (prototype-less app features stay out); S2.2 removes or defers the AC.

| # | FRD · AC | What leaves v2 |
|---|---|---|
| B-01 | FRD-02#U1 | «recommended» badge on board cards |
| B-02 | REQ-02-008 | discard quick-tags and the «Descartando…» state (the free-text reason still feeds `/discover`) |
| B-03 | AC-02-012.4 | gold card background for favourites (the star marks it) |
| B-04 | AC-02-013.6 | scoped dependency graph inside the FRD dialog |
| B-05 | AC-02-015.1 (part) | distinct treatment of composite key groups, isolated entities, self-relations |
| B-06 | AC-02-015.2 (part) | attribute mappings on links; per-connector selection |
| B-07 | AC-02-015.6 (part) | viewport-filling dialog fallback (native fullscreen stays) |
| B-08 | AC-02-015.11 | layout-worker loading and error states (see the consequence note below) |
| B-09 | REQ-03-003 (part) | «stopped» indicator on rows |
| B-10 | REQ-03-004, AC-14-003.1, AC-14-004.1 | bug and decision count badges on rail rows (the rail is gone; decisions are a Lista column) |
| B-11 | REQ-03-007 (part) | invalid-date chip for last sync |
| B-12 | FRD-04#U2 | «Obsoleta» decision tag (an obsolete decision is still never counted as pending) |
| B-13 | REQ-04-010 (part) | `implemented_sha` / `closing_at` evidence in the change dialog |
| B-14 | AC-06-012.3 | effort level as read-only data |
| B-15 | FRD-07#U7, FRD-08#U8-U10 | skill workflow diagram, mini-flow, curated explainer |
| B-16 | FRD-07#U9, #U10 (part) | «New decision rule» / «New standard» buttons, rule explainer |
| B-17 | FRD-07#U11, #U12 | agent level, title, XP, per-agent pixel art, per-agent model explanation |
| B-18 | FRD-09#U5-U7 | phase animation, release celebration, level-up moment |
| B-19 | FRD-10#U1 (part) | estimated-rarity blurb |
| B-20 | FRD-10#U4 | per-trophy NUEVO badge |
| B-21 | FRD-10#U8 (part) | «LA CIMA» summit treatment |
| B-22 | FRD-10#U9 (part) | TU PARTY roster and record badges in the hero |
| B-23 | FRD-10#U12 (part), #U16 | chain-complete crown; date and project per unlocked tier |
| B-24 | FRD-10#U19 (part) | distinct revealed-secret treatment (an unlocked secret becomes a normal trophy tile) |
| B-25 | AC-10-022.1, .2 (populated) | populated top-N usage and effort lists (skills do not emit the event yet; the honest empty band stays) |
| B-26 | AC-12-004.3, .4 | «saltar al primer error», «seguir al paso activo» |
| B-27 | AC-12-004.5 | zoom/pan/fit/fullscreen toolbar on the dependency map (the data-model toolbar stays) |
| B-28 | FRD-17#U3, #U12 | dismiss ✕ per card and remembered dismissal |
| B-29 | FRD-17#U2, #U6, #U9, #U10 (part), REQ-17-009 (part) | prune list, «obsoleta» explainer, stale-memory nudge, harvest-orphan banner, reject affordance, «Úsala cuando» rows |
| B-30 | REQ-18-005…009 | «Desde tu última visita» digest with mark-seen |
| B-31 | REQ-18-016 (part), -018, -019, -020, FRD-18#U1 (part) | version and age on cards, «estancado», «N bugs» chip, inline blocker reason, «estable · en operación» label |
| B-32 | AC-20-001.2 | quiet «Última versión de Pandacorp» ok badge (up to date renders nothing) |
| B-33 | REQ-21-004 | «Pendientes de merge» block in the Resumen (the Inicio dialog covers it) |
| B-34 | AC-22-001.3 (part) | evidence line on backlog rows (shown in the item dialog) |
| B-35 | AC-14-003.2, AC-14-005.1 (indicator) | `rethink_pending` indicator on the rail |

**Reclassified as behaviour, no picture needed (3).** B-36 AC-02-015.5 (the active-search announcement is an `aria-live` message on the drawn search). B-37 FRD-15#U3/#U4 (per-runtime Claude/Codex verdicts are API fields; the one drawn banner fires when either runtime is behind). B-38 AC-14-003.3 (the three feedback channels are explained in the captured Manual pages).

**Drawn in the prototype as configured states — RESOLVED: S2.1 builds each one (15)**, then the FRD keeps its AC and the FDD cites the state.

| # | FRD · AC | State id | What is drawn |
|---|---|---|---|
| B-39 | REQ-05-002 | `wo-failed` | failing work order: «Bloqueado» column and coral card in Tablero, row in Por FRD |
| B-40 | REQ-18-015, -017, AC-12-001.2, AC-14-002.2, AC-06-019.7 | `build-no-signal` | `running` with a stale heartbeat reads «Sin señal · último evento hace N» on Inicio, Portafolio and the Resumen (DR-066) |
| B-41 | AC-22-004.2, .3 | `backlog-errors` | coral notice naming unreadable files, parsed items still listed (DR-078) |
| B-42 | AC-02-015.7, AC-04-012.4 | `model-invalid` | explicit error for a malformed, oversized or unreadable model artifact, rest of Arquitectura intact |
| B-43 | REQ-21-006 | `worktrees-unreadable` | repository row with the coral «No se pudo leer» chip, distinct from «Al día» |
| B-44 | AC-10-022.3 | `stats-stream-error` | usage band in its unreadable-stream error state |
| B-45 | AC-26-007 | `accounts-source-error` | Cuentas with an explicit bounded issue |
| B-46 | FRD-03#U2 | `portfolio-path-missing` | «Ruta no encontrada» chip and recovery command |
| B-47 | FRD-03#U1, FRD-18#U2 | `factory-empty` | no projects: Inicio first-action card and Portafolio empty state |
| B-48 | REQ-18-003, -012 (zero) | `home-calm` | Tu turno empty: «Nada espera tu acción ahora mismo.» and the *al día* badge |
| B-49 | AC-12-003.3 | `wo-frd-drift` | «Verificado · N derivas» and «Deriva ilegible» on the Por FRD row (DR-122) |
| B-50 | FRD-04#U3 (part), FRD-02#U4, #U5 (part) | `project-change-rebuilds`, `idea-discarded-reason` | change dialog with the `rebuilds_verified` warning; discarded idea with its reason |
| B-51 | REQ-21-001, -002 (alert), -003 (entry point) | `shell-pending-chip` | sidebar pill «⎇ N pendientes» (alert when any repository is «Depurar ya»), linking to Inicio's «Árboles de trabajo» (DR-096) — **owner confirmed at M1** |
| B-52 | REQ-04-005, AC-14-001.1…-002.2 | `project-snapshot` | «último commit en verde» panel with its `git worktree add` command, in the Resumen below La Fragua, only while a build runs — **owner confirmed at M1**; FRD-14 gets `states["frd-14-snapshot-and-feedback"]` |
| B-53 | AC-26-001…-005, -009 | `portfolio-accounts` | third Portafolio view «Cuentas» beside Tarjetas / Lista, reusing the Cuentas table — **owner confirmed at M1** |

**M1 decision 2, settled.** The app's current layout engine stays, so the data-model clauses of C-16 are kept in FRD-02 as behaviour only (AC-02-015.10 and .11; `fdd.md` of FRD-02 records them as «behaviour (no picture)» and compares the canvas by computed styles, not pixels).

### Contradictions · the FRD said something else than the prototype (20)

Resolution is **amend the FRD to the prototype** (S2.2), except C-03 where the FRD wins and the prototype is corrected.

| # | FRD | FRD said → prototype (approved) | Resolution |
|---|---|---|---|
| C-01 | FRD-19, FRD-18 REQ-18-001 | top navigation, six destinations, exempt drill-ins → persistent sidebar, seven destinations, rail, phone bar, no exempt route | amend; nav contract recorded in `components.md` |
| C-02 | FRD-13 #U1, #U2, #U4, #U8 | warm pixel-RPG palette, one accent, 3 elevations → Órbita tokens | amend: FRD-13 points to `DESIGN.md` / `design-tokens.json` plus A-54…A-57 |
| C-03 | FRD-13 #U5 | transform/opacity only → colour, border, shadow, width transitions and a text-fading dialog | **keep FRD**; prototype corrected (P-10); see D-1 |
| C-04 | FRD-04 REQ-04-001…-004 | ten tabs with Party, compact header everywhere → eight tabs, full hero on Resumen only | amend (also fixes the stale 9/10-tab e2e specs) |
| C-05 | FRD-04 #U3, #U4, REQ-04-011 | separate toggles, inline confirm, relative dates → one «Historial N», confirm dialog with optional reason, absolute dates | amend |
| C-06 | FRD-03 REQ-03-001/-002/-005/-006 | rail of building/shipped projects → overview of all projects, picker | amend; accounts extension follows B-53 |
| C-07 | FRD-05 REQ-05-001 | five-column board as the view → inside Observabilidad, default Por FRD | amend |
| C-08 | FRD-06 sprite-scene ACs | sprite per work order, rooms, tribunal, relay, flow strip → four-station La Fragua in the Resumen | amend: remove and write A-24…A-31; reworded keeps listed in `reconciliation.md` |
| C-09 | FRD-07 #U3, #U10 | every item opens a modal; nine fixed domains → rules as accordion, data-driven domain select | amend |
| C-10 | FRD-08 #U1, #U2, #U3, #U7, #U11 | never «Manual»; side menu; Reference re-renders cards → «Documentación» (Manual only as short label), index on the right, Referencia points to Configuración | amend |
| C-11 | FRD-08 #U14-#U16 | non-Claude runtimes read-only (DR-120) → DR-133 full read/write | amend |
| C-12 | FRD-09 #U1, #U2, #U8 | guild level in a top bar → sidebar guild card, gold notice | amend |
| C-13 | FRD-10 #U2, #U7…#U11, #U18, AC-10-026.2 | axes, emblem sizes, hero scope, wording → Constancia/Resiliencia, 56px emblem, hero above all tabs, «sin datos aún» | amend |
| C-14 | FRD-11 REQ-11-001, FRD-02 AC-02-010.9 | inline select → four-card mode picker | amend both |
| C-15 | FRD-12 (timeline, force layout, 1-hop highlight) | → Observabilidad with three views, no timeline, deterministic layout, full-chain highlight | amend; AC-12-003.3 moves to B-49 |
| C-16 | FRD-02 (empty column, rail, campaign, plan, model) | → visible «Sin ideas en esta fase», folded rail, corridors, state mosaic, phones open on Esquema | amend, **except** the data-model clauses (see the consequence note) |
| C-17 | FRD-17 #U1, #U11, AC-17-010.1/.2, AC-17-001.1/.3 | top-bar badge, «Crónica del gremio», collapse at 6 → sidebar badge counting actions, «Mostrar más» | amend |
| C-18 | FRD-18 layout, REQ-18-010/-012/-013 | digest, progress strip, mixed Tu turno → layout A-63, Tu turno = decisions + changes ready | amend |
| C-19 | FRD-21 REQ-21-002/-003/-005 | 3 h threshold, per-row `merge-queue.sh` → legend rule, table by repository, `/pandacorp:worktrees` | amend |
| C-20 | FRD-22 AC-22-001.2…-009.1 | two sub-tabs, hechos toggles → three tabs, «Cómo avanzar», one collapsed «Hechos y descartados» | amend |

### Prototype corrections (13) and the second FRD-wins item

Cases where the prototype breaks an FRD that stays, the prototype contract or a newer fact; S2.1 makes each one and re-captures. Verified in the sources on 2026-10-22: **P-01 applied** (`html[data-demo="off"] [data-demo-only] { display: none !important }`), **P-02 applied** (the skip link only moves focus), **P-10 applied** (all motion is transform-only; see D-1). The rest are S2.1's.

| # | Where | Fix |
|---|---|---|
| P-01 | La Fragua scene control leaks under `?demo=off` | hide by document flag |
| P-02 | skip link routed as an unknown screen | focus-only handler (the app uses a real in-page anchor) |
| P-03 | idea hero verdict chip | remove (keep FRD, AC-02-009.5) |
| P-04 | «Entrar a La Fragua» targets the removed Party tab and shows on a locked phase | link to the project Resumen; hide until the build phase |
| P-05 | restore dialog asks for a reason | remove the field |
| P-06 | Resumen decision dialog shows bare `/pandacorp:decide` | scoped `/pandacorp:decide <id>` |
| P-07 | `/pandacorp:worktrees` labelled «Habilidad propuesta» | show as a normal command |
| P-08 | next command derived from the phase | building with open orders → `/pandacorp:implement`, shipped → `/pandacorp:review-launch` (DR-043) |
| P-09 | dirty-plugin banner variant («N archivos modificados») | **keep FRD (second FRD-wins item):** the owner decided on 2026-06-22 that uncommitted `plugin/` edits never trigger the banner; remove the code path |
| P-10 | non-transform motion | transform-only (C-03, D-1) |
| P-11 | «Manual» in inner strings | say «Documentación» (the short rail label is «Docs») |
| P-12 | prototype-only footer text | build omits it (see `DESIGN.md`) |
| P-13 | captured Manual still says «Portfolio → Party» | app content (DR-046); refreshed in the v2 build, noted in FRD-08's content-currency line |

**Copy.** The copy reconciliation (`freeze/copy/frd-NN.md`) was confirmed at M1, including «work order» instead of «orden» (English artifact name, feminine agreement) and «Documentación» instead of «Manual» as the surface name.

**Impact / docs touched.**
- Canonical tokens → `docs/design/design-tokens.json` (regenerated from the final CSS; Atelier groups removed).
- Contract → root `DESIGN.md` (rewritten, FROZEN 2026-10-22), `docs/design/components.md` (rewritten for Órbita, with the AppShell nav contract).
- FRD amendments (Group A, contradictions, Group B outs) → S2.2; FDDs → S2.3-NN; fidelity docs → S2.5; the decision-log entry → S5.2.

**Carried into the next phase (not done here).** The v2 build replaces `src/app/globals.css` with the `@theme` mirror of the new tokens, wires the three fonts with `next/font` from the staged files, stages `prototype/assets/` into `public/`, and implements the shell first (foundation wave). No design question is left open: D-1, D-5, D-7 and D-8 are resolved and D-2, D-3, D-4 and D-6 bind as drawn.

---

## 2026-06-26 — Reveal-more is a modal, never inline expand-that-pushes-content

**What.** Owner rule, now a design principle: a surface that reveals more detail (a rank's detail, the
discarded-ideas list, etc.) opens in a **modal overlay** — we do **not** use the inline
expand-that-pushes-the-page-down pattern ("se ve horrible… no hacemos nunca ese patrón salvo que
realmente tenga sentido"). To support this consistently there is **one shared `Modal` core**
(`components/core/Modal/Modal.tsx`, DR-057) — overlay + dimmed/blurred backdrop + centered panel +
focus-trap + Escape + backdrop-click-closes — extracted from the intake modal and reused by it, the
**"Ver descartadas"** modal, and any future reveal-more surface. Bespoke per-surface overlays are a defect.

**Why.** The accordion-style expand reflowed the whole page and read as broken; modals keep the context
stable and the reveal focused. One shared component keeps every modal coherent (the parallel-agent
coherence problem) and cheap to add.

---

## 2026-06-22 — Whole-app fidelity pass: design decisions (page chrome, campaign honesty, board↔campaign vocabulary)

> **Partly superseded 2026-10-22 by the Órbita freeze.** The decisions about the Atelier prototype, the CSS road connectors, the Fragua stone PNG and the danger-glow discard button no longer apply. Still valid in spirit and carried into the Órbita rules: one page-title block with the H1 equal to the nav label, honest liveliness (motion only when the data says a build runs), board and campaign sharing one vocabulary, locked-phase fichas showing their full information.

**What.** A round of owner-QA fidelity decisions against the approved prototype
(`docs/design/prototype/index.html` + the embedded `party-pipeline.html` for La Campaña). These are
**fidelity decisions on the frozen tokens** — they change *how surfaces are composed*, not the token
contract (palette/typography/surfaces are untouched; the 2026-06-18 freeze stands). Recorded here per
the design decision-log discipline; the behavioural contract lives in the FRDs and the
[decision log](../decision-log.md) (the 2026-06-22 entries), the implementation in the blueprints.

- **Page chrome is one component (`PageLayout`).** Every top-level surface wraps its body in a single
  `PageLayout` (the page's one `<main>` + the shared `PageTitle` + the body slot), so the title block
  (icon + name + description) lands in the **same place with the same spacing** everywhere. The
  bespoke per-page `<main>`/padding (the Board was the worst offender) is gone. A *wrapper each page
  invokes* was chosen over the root shell rendering the title, to keep dynamic count tails
  (Propuestas/Logros) and the Board's conditional title (Tablero vs an open card) local while still
  enforcing one chrome. (The page-chrome principle was also added to `factory/standards/`, DR-062
  extension.)
- **Campaign liveliness is honest — roam only when an agent runs.** The active phase reads "● en
  curso" and its cast **roams** (rAF wander, lead halo, speech-on-meet) **only** when the project is
  genuinely `running` (`status.yaml running: true`, threaded card → CardDetail → CampaignPipeline);
  otherwise it reads **"fase actual"** and the cast **idle-bobs in place** ("quietecito en el
  centro"). The app only tracks a persistent running state for the build, so momentary skill runs
  (research/product/…) read the truthful "fase actual" rather than a fake "en curso." Honours
  `prefers-reduced-motion` (and jsdom/SSR → static). Consistent with FRD-09's honest-gamification
  principle: no fake motion implying work that isn't happening.
- **CSS road connectors, under the rooms.** La Campaña's inter-phase connectors are the prototype's
  striped **CSS road** (`StoneBridge variant="road"`, tinted ok-green while flowing) — *not* the
  Fragua stone PNG the campaign had been reusing (it was built faithful to an older mock,
  `la-campana.html`; the current canonical prototype is `party-pipeline.html`). The road sits **under**
  the room images (rooms z-index 2, road z-index 1) so connectors never paint over the pixel-art; the
  centred doc chip stays visible. Lesson: anchor to the *current* canonical prototype.
- **Deliverable = icon + short artifact name.** Each non-locked room shows the phase emoji + the short
  artifact only (`🔍 research.md`, `📋 PRD + FRDs`, …); the "entrega ▸" label + arrow were dropped and
  the leaked `phase.writes` split ("— hallazgos") removed. A `PHASE_META` map (emoji · deliver ·
  accent colour) feeds both the room chips and the connectors.
- **Board ↔ campaign share one vocabulary.** The Kanban columns use La Campaña's numbered phase names
  (`1 Investigación · 2 Producto · 3 Diseño · 4 Arquitectura · 5 Construcción · 6 Release` +
  `Descartada`), so the board and the card-detail campaign read the same words. Pure label change; the
  two-axis column derivation is untouched.
- **Locked-phase ficha shows its info.** A future (not-yet-reached) phase's ficha still renders its
  full information (description, LEE/ESCRIBE, the whole team) — information *about* the phase is
  readable regardless of progress; only the build phase's "Entrar a La Fragua" **action** is gated on
  reaching build. The header label ("en espera") signals the future phase.
- **Discard button: danger hover, not accent glow.** The discard affordance matches the shared
  `Button` `size="sm"` (same size as "← Volver al tablero") and gets a **danger-coloured** hover
  (`.pc-discard`: red border + danger-bg tint + danger glow) — a destructive button shouldn't glow
  accent-cyan. The transition is inline (the shared-Button pattern), since `globals.css` may only
  transition compositable props (AC-13-005.1). It uses `--color-danger` + the `ti-trash` icon.
- **Home alerts + tab bodies on the shared primitives.** Earlier in the same pass: the home health
  alerts became rounded `Banner` cards + an icon `CopyButton` + the shared `CmdRow` (terminal glyph);
  the card-detail Documentos tab became a rail + reader and Comandos a `CmdRow` + project-command box
  (both formerly bespoke). All fixed at the *primitive* level (DR-057 single-source), not per consumer.
  *(Superseded later: the card-detail **Comandos** tab was folded into La Campaña's ficha, and Propuesta/Spec/Arquitectura tabs were added — see `frd-02/frd.md` REQ-02-009, reconciled 2026-07-05.)*

**Why.** Repeated "it's done" had been false because surfaces were never browser-verified against the
prototype, and the visual gate proves *consistency with its own baseline*, not *fidelity to the
prototype*. This pass verified each surface in the browser against the prototype itself (dark + light,
interacting) and only re-blessed baselines after that confirmation. The decisions above are the
fidelity reconciliation; the tokens were already correct (the defects were in composition).

**Impact / docs touched.** Behaviour contracts → the FRDs (esp. [FRD-02](../frds/frd-02-ideas-board/frd.md)
card-detail amendment + AC-02-010.7 rewrite); implementation → the feature blueprints +
[`components.md`](components.md) (the `PageLayout`, `RoamingCast`, `StoneBridge variant`, `Room
labelNode` inventory rows); history + why → the [decision log](../decision-log.md) (2026-06-22). No
token value changed — `docs/design/design-tokens.json` and root `DESIGN.md` are unchanged (the
2026-06-18 freeze stands).

---

## 2026-06-19 — Complete the extraction: app-wide RPG skin + Party pixel-art spec (DR-056) — **FROZEN**

> **SUPERSEDED 2026-10-22 by the Órbita freeze.** The RPG embossed skin (`rpgSkin`) and the Party pixel-art spec (`party`) are retired from the contract. The pixel-art sprites, rank emblems and zone art survive as assets inside La Fragua and La Campaña, on the Órbita scene tokens. The lesson stands: DR-056 requires every layer to be extracted.

**What.** A completeness audit of the 2026-06-18 freeze found **two layers of the approved prototype were missed** (the core extraction captured palette/typography/categories/tiers/radii/shadows/base components, but not these). Added them to the contract under the DR-056 complete-extraction rule — **ADDING the missing layers, not rewriting the core**:

- **Layer 1 — the app-wide RPG embossed skin** (`design-tokens.json › rpgSkin`, new `## The app-wide RPG skin` section in `DESIGN.md`). The prototype applies a **global second-pass skin** (`index.html` 128–158, *"Skin RPG — GLOBAL"*) that **re-skins the base components** (`.panel`/`.cfgcard`/`.navitem`/`.cmd`) with the emboss signature (`inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--canvas)`, `1px bd2`, `10px` radius) and adds the RPG primitives: `.rpgpanel`, `.rpggrid` (22px texture), `.shield` (96×96 accent crest + glow), `.xpbar` (18px striped), `.herostat .big` (40px Pixelify numeral), `.lockchip`/`.reveal` (locked→hover/focus-reveal), `.secthead`, `.itemslot`, `.node`, `.sprite`, `.glowwarn`, `.anim`/`rpgIn`, `.spot`. **This skin is what actually renders app-wide** — the base `.panel` alone would silently drop the look.
- **Layer 2 — the Party pixel-art spec** (`design-tokens.json › party`, new `## The Party pixel-art spec` section). The two embedded sub-views are part of the contract, each with its OWN scale: **per-view sprite sizes recorded individually (Dashboard 54px / Fragua 52px / Campaña 58px — NOT averaged)**, scene grids (Dashboard 32px / Fragua·Campaña 30px), room sizes (Campaña 250×208 on a 920×560 stage), the sprite state machines (`s-work/s-review/s-blocked/s-idle/carry`; Fragua `work/review/carry/vault/split/say-on`; Campaña `idle/walking/small/locked`), the full keyframe inventory (`pcbob`, `mchalo`, `mceb`, `mcsay`, `mcdt`, `rpgIn`, `roompulse`, `idlebob`, `walkbob`, `cbob`, `slidein`, `halo`, `sayin`, `pulse`), and a new **`partyStructural`** token group capturing the ~10 hardcoded structural background colors (`#16201f #141b22 #16201d #0c1113 #1d2629 #26312f #202927 #1c2523 #2c3836 #2f4a3a #21342a #1c3a2a`) + the `rgba(12,17,19, α)` scrim family — so a tokens-only build reproduces the Party map backgrounds pixel-faithfully.

**Why.** DR-056 complete-extraction: base components + any app-wide skin/theme overrides + each embedded sub-view's own spec are ALL part of the contract; partial extraction silently drops the look (exactly the failure mode that re-occurred here — an app-wide RPG skin and a pixel-art sub-view spec were missed). The structural colors and the skin emboss are not "decoration" — they are the surface treatment the owner approved.

**Verified by grepping the prototype directly** (never read whole — `index.html` is 2.4MB): `index.html` lines 87–158 (party block + global skin block), `party-proposal.html` (Fragua) and `party-pipeline.html` (Campaña) for sprite/grid/room sizes, state classes and keyframe bodies. The `rgba(...)` emboss/scrim literals are theme-independent structural values — kept verbatim, NOT tokenized to a surface color.

**Ambiguity recorded (resolved as found).** The audit brief cited a **Fragua room of 432×372 and a 32px Fragua grid**. The CURRENT approved prototype (`party-proposal.html`, the redesign) actually uses a **920×560 stage with absolutely-positioned forge/vault rooms and a 30px scene grid** (no single fixed 432×372 room box). Recorded **as found in the prototype** (the source of truth), with a note in `party.roomSizes_px`. If the owner intends the older 432×372 framing, that is a prototype change to confirm — not a value to invent here.

**Impact / docs touched.**
- Canonical tokens → `docs/design/design-tokens.json` (added `rpgSkin` + `party` groups; core tokens untouched; JSON validated).
- Contract → root `DESIGN.md` (added `## The app-wide RPG skin` and `## The Party pixel-art spec` sections).

**Carried into the next phase (implementation, NOT done here).** `src/app/globals.css` and components must apply the `rpgSkin` overrides app-wide (not just the base `.panel`) and the Party sub-views must use their per-view sprite/grid/room sizes and the `partyStructural` colors. `src/`/`globals.css` were intentionally NOT touched — that is the implementer's job.

---

## 2026-06-18 — Re-anchor on the approved prototype (DR-054 ADOPT-VISUAL) — **FROZEN**

> **SUPERSEDED 2026-10-22 by the Órbita freeze** (the Atelier warm-dark palette, teal accent and Pixelify Sans are replaced). The DR-054 reasoning (fidelity, not novelty; the gate decides, not self-assessment) is unchanged and is what this freeze applied.

**What.** Froze the design system **FROM the owner-approved prototype `prototype/index.html`** (+ embedded sub-views `party-proposal.html` / La Fragua and `party-pipeline.html` / La Campaña). Extracted both themes (dark default + light) faithfully into `docs/design/design-tokens.json` and wrote the contract in root `DESIGN.md`.

**Why.** Mission Control's UI had **diverged from the approved prototype** (see factory memory: "Fallo de fidelidad de diseño en MC"). The build shipped a cold, generic look instead of the pixel-RPG identity the owner approved. DR-054 mandates that when an owner-approved visual exists, the designer's job is **fidelity, not novelty**: extract the real visual language, generate no alternative directions, relax nothing.

**Root cause — superseded brief.** `docs/design/brief.md` wrongly **demoted the prototype to a functional-only reference** and instructed the designer to **invent a fresh cold-blue palette (hue ~230)**. That invented palette is what landed in `src/app/globals.css` and caused the divergence. This decision **SUPERSEDES `docs/design/brief.md`** (kept for history with a banner; not deleted).

**Decisions taken (all = "reproduce the prototype exactly"):**

- **Two themes, both first-class.** Dark (default) + light, extracted verbatim from the prototype's `:root` and `[data-theme="light"]` blocks, including the `prefers-color-scheme: light` fallback.
- **Surfaces = 3 + 1 elevations.** `canvas / panel / card` everyday, plus `card2` (`#2A3336` dark / `#F1EFEA` light) — the 4th step the Party sub-views add for the pixel-art canvas.
- **One rationed accent** = the prototype's **teal/steel-blue** (`#33B6D1` dark / `#007890` light). Explicitly **NOT** the invented hue-230 cold-blue.
- **Three font families with distinct jobs:** Pixelify Sans (pixel/level numerals — the RPG signature), Space Grotesk (display/headings/buttons/tabs/nav), mono (code/ids/commands/paths). Both web fonts at weights 400/500/600/700.
- **Categories (9) + tiers (5)** preserved as the agent-hue and RPG-rarity ramps.
- **Pixel-art is part of the contract.** Zones + 54×54 agent sprites render with `image-rendering: pixelated` on a 32px grid; expressive motion (bob/halo/emote) is reserved for the Party canvas.
- **`tabular-nums` global**, 3 elevation shadows, focus ring `2px solid accent`.

**Provenance.** Frozen FROM `prototype/index.html` (+ `party-*.html`) on 2026-06-18. Token values verified by grepping the prototype directly (not only the supplied summary): the `:root`/`[data-theme]` blocks, the typography scale (sizes 9–42px, weights 400–700, line-heights), the padding/gap scale, and the component classes (`.panel`, `.card`, `.chip`, `button`, `.tab`, `.navitem`, `.mcstation`, `.mcag`). The exact light-theme tier values (`#757B81 #1C8742 #006EB8 #7C3EB3 #C26300`) and the `card2` 4th-surface step were extracted from the prototype, not assumed.

**Impact / docs touched.**
- Canonical tokens → `docs/design/design-tokens.json` (created/frozen).
- Contract → root `DESIGN.md` (created).
- `docs/design/brief.md` → **superseded** (banner prepended; kept for history).
- `docs/design/technical-assumptions.md` → costs of faithful reproduction (custom fonts, 19MB pixel-art assets, `image-rendering: pixelated`).

**Carried into the next phase (NOT implemented here — implementation is the build's job):**
- `src/app/globals.css` currently holds the **wrong** cold-blue (hue-230) tokens → must be replaced by the `@theme` mirror of `design-tokens.json`.
- Fonts (Pixelify Sans, Space Grotesk) must be wired via `next/font`.
- `prototype/assets/` must be staged into `public/` so the app serves the zones/sprites/logo.

**Fidelity note.** No values were invented, relaxed, or modernized. The contract is the prototype, transcribed.
