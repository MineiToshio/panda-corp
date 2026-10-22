# Context pack · FRD-21 · Pending-merge visibility (never strand a forgotten worktree)

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-21 copy, S2.1 builds, S2.2 amendments, S2.3-21 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-21-pending-merge/frd.md` (id FRD-21, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 2 under `states["frd-21-pending-merge"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 6 AC lines: 0 drawn · 3 partially drawn · 3 not drawn · 0 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-21#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### REQ-21-001 · not drawn · `worktrees-card`, `shell-expanded`

> - REQ-21-001 — The shell SHALL show a global pending-merge indicator reachable from every screen. WHEN
>   there is ≥1 un-merged worktree/branch across all projects, it SHALL show the count (`⎇ N pendientes`);
>   WHEN there are none, it SHALL read calm (no manufactured urgency) — hidden or an *al día* affordance.

**Prototype:** There is no `⎇ N pendientes` chip in the shell. Pending work appears only as the "Árboles de trabajo" card on Inicio (right column), so it is not reachable from every screen.

### REQ-21-002 · partial · `worktrees-card`

> - REQ-21-002 — WHEN any pending item is **stale** (idle past the threshold, default 3h, from the factory
>   `PANDACORP_STALE_HOURS`), the indicator SHALL adopt its **alert** variant, and the status SHALL be
>   conveyed by **text + icon**, never color alone (a11y; `accessibility.md`).

**Prototype:** Staleness is a per-project coloured state with text + dot: "Depurar ya" (coral; 3+ leftovers or pending branches, or any branch untouched for 7+ days), "Revisar pronto" (amber; any branch older than a day or any leftover), "Al día" / "Limpio" (green). The stale threshold (3 h from `PANDACORP_STALE_HOURS`) is not the rule used.

### REQ-21-003 · partial · `worktrees-card`, `worktrees-branch-dialog`

> - REQ-21-003 — Activating the indicator SHALL open a **cross-project list** of un-merged work; each row
>   SHALL show project, branch, task (if known), age, and status — one of `in-progress` (a live worktree /
>   recent), `ready` (committed, clean, idle, not merged), `stale` (idle past the threshold). Rows SHALL be
>   ordered stale → ready → in-progress (most-at-risk first).

**Prototype:** The cross-project list is a table (Proyecto · Sin integrar · Sobrantes · Estado); a project row opens a dialog "Árboles de trabajo · Funko Tracker" listing each branch: subject of the last commit, origin ("Rama manual / Carril de un build / Sesión de Claude Code / Sesión de Codex"), age, commits outside main, uncommitted count, branch name. Per-row status in-progress / ready / stale and the stale → ready → in-progress ordering are not used; rows order by repo state.

### REQ-21-004 · not drawn · `project-summary`

> - REQ-21-004 — The project **Resumen tab** SHALL show a "Pendientes de merge" block with that project's
>   un-merged items, or an *al día* state when none.

**Prototype:** No "Pendientes de merge" block in the project Resumen.

### REQ-21-005 · partial · `worktrees-card`, `worktrees-branch-dialog`

> - REQ-21-005 — The surface SHALL be **read-only** and SHALL NOT call Claude. It SHALL NOT offer a
>   merge/delete action in v1 (it only *surfaces*); each row MAY show the copy-able command to land it
>   (`cd <worktree> && bash .pandacorp/merge-queue.sh`).

**Prototype:** Read-only, no merge/delete. The command shown is the PROPOSED skill `/pandacorp:worktrees` (labelled "Habilidad propuesta", dashed), not `cd <worktree> && bash .pandacorp/merge-queue.sh`.

### REQ-21-006 · not drawn · `worktrees-card`

> - REQ-21-006 — The data reader SHALL be **fail-loud** (DR-078): on an unreadable/malformed source it
>   SHALL render an explicit error state, NEVER a silent empty list that reads as "al día". "Zero pending"
>   and "could not read" are distinct, distinctly-rendered states.

**Prototype:** A repo that cannot be read draws a coral "No se pudo leer" chip in code; the fixture has no unreadable repo, so no state draws "could not read" vs "al día".

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `worktrees-card` | `#inicio` | wait for `.wt-table` | full page | `REQ-21-001` `REQ-21-002` `REQ-21-003` `REQ-21-005` `REQ-21-006` |
| `worktrees-branch-dialog` | `#inicio` | click `[data-wt-repo]:not([disabled])` → wait for `dialog[open]` | capture viewport; widths 375/1280 | `REQ-21-003` `REQ-21-005` |

States cited above that belong to another FRD folder (captured there, reused here): `shell-expanded`, `project-summary`.

**Not drawn (3)**: `REQ-21-001`, `REQ-21-004`, `REQ-21-006`.

**Partially drawn (3)**: `REQ-21-002`, `REQ-21-003`, `REQ-21-005`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### `worktrees-card`

- [h2] Árboles de trabajo
- [p] Trabajo en paralelo que no está en main, y worktrees que sobraron.
- [span] Para depurar un proyecto, corre en su carpeta
- [@aria-label] Copiar /pandacorp:worktrees
- [span] Habilidad propuesta
- [@title] Composición de ejemplo: esta captura no incluye esta fuente
- [@aria-label] Tabla desplazable
- [th] Sin integrar
- [@title] Ramas con trabajo que no está en main
- [th] Sobrantes
- [@title] Worktrees abiertos sin nada pendiente
- [span] Depurar ya
- [span] Limpio
- [p] Desliza la tabla para ver todas las columnas
- [summary] ¿Cómo se decide el estado?
- [p] 3 o más sobrantes o ramas sin integrar, o alguna sin tocar hace más de 7 días. alguna rama de más de un día o algún sobrante. solo trabajo reciente. Captura del 20 oct. 2026, 7:20 p. m..
- [b] Depurar ya:
- [b] Revisar pronto:
- [b] Al día:

### `worktrees-branch-dialog`

- [dlg h2] Árboles de trabajo · Funko Tracker
- [dlg p] 12 ramas sin integrar y 1 worktree sobrante.
- [dlg span] Rama manual · hace 8 h · 12 commits fuera de main (×9 of the same pattern)
- [dlg span] Rama manual · hace 3 días · 2 commits fuera de main
- [dlg span] Rama manual · hace 22 h · 1 commit fuera de main
- [dlg span] Rama manual · hace 1 h · 7 commits fuera de main · 2 sin guardar
- [dlg span] Corre en la carpeta de Funko Tracker para depurarlo:
- [dlg code] /pandacorp: worktrees

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- `⎇ N pendientes` chip | none; card title "Árboles de trabajo" with the lead "Trabajo en paralelo que no está en main, y worktrees que sobraron.".
- Statuses in-progress / ready / stale | "Depurar ya" / "Revisar pronto" / "Al día" / "Limpio".
- "worktree" in English inside Spanish copy: "worktrees", "sobrantes", "Sin integrar" columns.
- Legend "¿Cómo se decide el estado?" and the helper "Desliza la tabla para ver todas las columnas".

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- Placement: the owner decision of 2026-06-26 (global ambient indicator primary, per-project Resumen secondary — "the fear is not looking") is reversed by the approved design (Inicio card only; iteration 2-4). The FRD, not the prototype, needs the owner's call at S1.3.
- The rule for the state (3+ leftovers/pending or 7+ days → Depurar ya) is the prototype's own proposal (iteration 4) and differs from FRD-21's stale default.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 2: "Árboles de trabajo" returned in the right column of Inicio with real data from the FRD-21 reader across the factory and the four project repos.
- Iteration 3: each branch is explained (subject, origin, files changed, commits outside main, uncommitted changes) with a plain-language hint; a "Copiar pedido" idea was replaced in iteration 4 by a table plus the proposed cleanup skill.
- Iteration 4: table by project; state rule and legend in the card; `/pandacorp:worktrees` proposed, with a safety boundary (remove only worktrees and branches whose work is already in main and that have nothing uncommitted; never touch locked worktrees, a live build's lanes or gate worktrees, or the deployed snapshot).
- Iteration 28: headers use the shared card header (neutral icon on this card).

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
