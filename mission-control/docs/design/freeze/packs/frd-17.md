# Context pack · FRD-17 · Proposals inbox (self-learning gate + self-suggestion)

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-17 copy, S2.1 builds, S2.2 amendments, S2.3-17 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-17-proposals-inbox/frd.md` (id FRD-17, status VERIFIED, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 3 under `states["frd-17-proposals-inbox"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 22 AC lines: 7 drawn · 10 partially drawn · 0 not drawn · 5 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-17#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### REQ-17-009 · behaviour only · `proposals-memory`

> - **Loop v2 fields & signals (REQ-17-009, 2026-07-02 — factory proposal 23 / plugin v9.49.0).** The lesson reader SHALL parse the loop-v2 schema fields — `trigger:` ("use this when …", the retrieval condition) and `applied_in:` (the projects whose artifacts cited the lesson, script-maintained) — fail-soft per lesson (a pre-v2 lesson yields `trigger: ""` / `appliedIn: []`, never a skip). The lesson/promotion detail SHALL show the trigger ("Úsala cuando") and the applied-in projects when present (AC-17-006.1/.3). `memoryHealth()` SHALL additionally report `lastSweepAt` (the ISO content of the daily sweep marker `factory/memory/_last-sweep`; null honest when absent/unparseable — shown as the REAL "barrido diario" timestamp instead of the "(aprox.)" mtime proxy) and `harvestOrphans` (portfolio projects whose `.pandacorp/status.yaml` says `phase: release` with NO `last_harvest:` stamp — a build that closed without harvesting; surfaced as a danger banner naming each project + the `/pandacorp:memory harvest` command; honest empty otherwise) (AC-17-006.2/.3). The raw-notes nudge threshold SHALL match the loop-v2 sweep threshold (20).

**Prototype:** Reader fields (`trigger`, `applied_in`, `lastSweepAt`, `harvestOrphans`) are data. Drawn: "Última revisión automática: 20 oct. 2026 · al día" (the real sweep timestamp). NOT drawn: the lesson trigger ("Úsala cuando"), applied-in projects and the danger banner for harvest orphans.

### FRD-17#U1 · partial · `shell-expanded`, `proposals-summary`

> - Mission Control SHALL show a **Proposals inbox** ("Propuestas / Crónica del gremio") at guild level (a badge in the top bar with the open count) and per project (a chip in the portfolio rail), extending the pending-decisions/bugs chips of [FRD-14](../frd-14-snapshot-and-feedback/frd.md) with a third stream: proposals.

**Prototype:** "Propuestas" is a sidebar destination with a count badge of the actions that need the owner (4), not a top-bar badge with the open count; no per-project chip in a portfolio rail. The page title is "Propuestas" (no "Crónica del gremio").

### FRD-17#U2 · partial · `proposals-summary`, `proposals-memory`

> - The inbox SHALL aggregate four proposal kinds: (1) **candidate lessons** awaiting corroboration or the owner (`factory/memory/` entries with `status: candidate`); (2) **promotions** — a lesson active across ≥2 projects proposed for a standard / decision rule / skill (DR-047 high-risk tier); (3) **prune** — lessons proposed for deprecation/reconciliation by `/pandacorp:memory review`; (4) **self-suggestions** computed by Mission Control. **Promotions are surfaced ONLY via the durable promotions queue (REQ-17-006), NOT also as a dismissable stream** — the earlier redundant dismissable promotion stream was removed (DR-103 cleanup, 2026-07-01): a promotion is an "approve me" item (the queue carries its `/pandacorp:learn` command + target + rationale + evidence + high-risk badge), not noise to dismiss. So the dismissable streams are candidate-lessons, prune and self-suggestions; promotions live in the queue.

**Prototype:** Kinds drawn: candidate lessons ("Candidatas 24", collapsed, "No piden nada"), promotions ("Esperan tu decisión 16"), self-suggestions grouped as "Señales automáticas 42" (columnas del tablero, lecciones vistas en 2 proyectos, skills sin uso, otras); prune ("Para podar") exists in code but the fixture has none. Promotions are not also a dismissable stream.

### FRD-17#U3 · partial · `proposals-summary`

> - Self-suggestion **`unused-capability`** SHALL be emitted ONLY for **invocable skills** (`/pandacorp:<skill>`), never for agents or non-invocable capabilities (a self-suggestion's whole value is a runnable command). The **dismiss affordance** is a subtle icon-only ✕ in each card's top-right corner (not a text+border pill), keyboard-reachable with an `aria-label` (DR-103 cleanup, 2026-07-01).

**Prototype:** "Skills sin uso registrado" lists invocable skills as `/pandacorp:<skill>`; the dismiss ✕ icon in each card is NOT drawn.

### FRD-17#U4 · drawn · `proposals-lesson-dialog`

> - **Lesson detail (click a lesson card → formatted detail).** Each **lesson** card (candidate + prune) SHALL be an accessible control (a `<button>`, keyboard-operable, `aria-label` naming the lesson) that opens a **detail modal** rendering the lesson's full markdown **body** (`Lesson.body`) with the shared `Markdown` primitive — the same formatted rendering used for the FRD/backlog detail (real headings for Situation / Lesson / Apply next time / Why it matters), plus a metadata strip (type·domain, status, eval-gate, promotion, source, links). The detail opens in the shared `Modal` (focus-trap + Escape). Self-suggestions (which have no markdown body) are NOT clickable. Reuses `core/Modal` + `core/Markdown` (DR-057). Detail-view parity added 2026-07-01, mirroring FRD-22 REQ-22-005.

**Prototype:** Lesson rows are buttons (title, id · domain · projects, type chip Trampa / Problema→solución …) that open a dialog; the captured dialog is the lesson detail with its command.

### AC-17-006.7 · drawn · `proposals-lesson-dialog`, `proposals-memory`

> - **Promotion detail (click a promotion card → formatted detail, AC-17-006.7).** Each **promotions-queue** entry (proposed + rejected) SHALL likewise be an accessible control that opens the **same** `LessonDetailModal` (sectioned body + metadata strip). The promotion detail additionally shows the copyable `/pandacorp:learn` command (proposed only) so the owner can approve straight from the modal (`LessonDetail`/`LessonDetailModal` gained an optional `command` prop; the candidate/prune modals omit it). Its card SHALL show a **clean one-line summary** (the lesson's `context`, or the first body line with markdown markers stripped), NOT a raw 300-char markdown excerpt. To keep the module (`components/modules/PromotionsQueue`) free of a route-local import, the queue only emits `onSelectLesson`; the modal state lives in a route-local wrapper (`PromotionsQueuePanel`) — the same split the candidate/prune streams use. This closes the follow-up deferred on 2026-07-01. Reuses `core/Modal` + `SectionedMarkdown` + `CopyButton` (DR-057).

**Prototype:** Promotion rows open the same dialog and carry the copyable `/pandacorp:learn LESSON-NNNN`; one-line titles come from the lesson's context.

### FRD-17#U5 · drawn · `proposals-memory`

> - **Lesson card title = the `context` field.** A lesson card's title SHALL be the lesson's frontmatter **`context`** (a clean, human-written one-line summary the reader now exposes), NOT a heuristic derived from the body (which produced broken titles like a lone "." — removed). The lesson **detail body** SHALL parse the bold inline labels (`**Situation:**`, `**Lesson:**`, `**Apply next time:**`, `**Why it matters:**`) into **titled, colour-coded sections** (icon + coloured header per part, content via `Markdown`) so the parts are distinguishable instead of one wall of bold-prefixed prose. This sectioning lives in the shared `SectionedMarkdown` primitive (auto-detects `**Label:**` vs `## Heading` sections), reused by the backlog detail (FRD-22 REQ-22-005) so both modals share one look (DR-062); extracted 2026-07-01.

**Prototype:** Card title is the lesson context (a clean sentence); the dialog body is sectioned (Situation / Lesson / Apply next time / Why it matters, content in its source language).

### FRD-17#U6 · partial · `proposals-memory`

> - **Group command for the candidate + prune lists is `/pandacorp:memory review`** (the mode that acts on them — corroborates/activates candidates, proposes pruning obsolete ones), not the bare `/pandacorp:memory`. Each stream SHALL show a one-line explainer of what the list is (e.g. how "obsoleta" is determined: a lesson `/pandacorp:memory review` marked `status: deprecated` — never retrieved + old, or contradicted by newer evidence; deprecated, never deleted). (2026-07-01)

**Prototype:** The group command `/pandacorp:memory review` is drawn inside the "Para podar" card only (empty in the fixture); candidates carry no command; the explainer of "obsoleta" is not drawn.

### FRD-17#U7 · drawn · `proposals-summary`, `proposals-memory`

> - FOR each proposal, Mission Control SHALL show its **evidence/source** (the `LESSON-NNNN`, the project + capture point, or the metric), the **suggested action**, and the **exact command** to act on it — `/pandacorp:memory review`, `/pandacorp:learn …`, `/pandacorp:decide`, or `/pandacorp:review-launch` — ready to copy. Mission Control SHALL NOT run it (read-only, like [FRD-15](../frd-15-plugin-out-of-sync-warning/frd.md)/[FRD-16](../frd-16-orphan-project-detection/frd.md)).

**Prototype:** Each action shows its evidence/count, the reason in plain words, the exact command with copy, where to run it ("Córrelo en la carpeta de la fábrica") and a link to the detail; Mission Control never runs it.

### FRD-17#U8 · behaviour only · `proposals-summary`

> - Mission Control SHALL compute self-suggestions **locally, with no Claude calls** (consistent with [FRD-01](../frd-01-data-reading/frd.md)), from data it already reads: **bottlenecks** (N ideas stuck in one phase, from the board derivation); **velocity** alerts (a phase running far longer than the portfolio norm, from the `~/.claude/dashboard-events.ndjson` tail and `.pandacorp/status.yaml`); **unused capability** (a skill or agent with no recorded usage); **policy friction** (a `requiere_humano: false` decision rule that keeps reappearing in `.pandacorp/inbox/decisions.md`); a **recurring lesson** (≥2 projects in `factory/memory/` sources) proposed for promotion; and a **shipped project** whose age/metrics merit `/pandacorp:review-launch` (DR-043).

**Prototype:** Local computation of self-suggestions: data rule (velocity and policy-friction kinds are not distinguished in the capture).

### FRD-17#U9 · partial · `proposals-summary`, `proposals-memory`

> - Mission Control SHALL show a **memory-health panel** for the self-learning loop: the count of **pending raw notes** awaiting refinement (the inbox size — `.pandacorp/run/lessons.md` per project + `factory/memory/_inbox.md`), the count of **candidate lessons** awaiting corroboration/promotion (`status: candidate` in `factory/memory/`), and **when `/pandacorp:memory` last ran** (harvest/review). IF the backlog is large or it has not run in a while, it SHALL nudge with the exact command (`/pandacorp:memory harvest` / `review`) — a staleness reminder, like FRD-15's drift banner. This panel doubles as the on-demand **refine trigger surface**: the owner runs the refinement when the panel says there is something to consolidate, so the cadence is **scheduled sweep + this reminder**, not tied to any single skill (e.g. not only `implement`).

**Prototype:** Memory health: "Notas sin refinar" (raw notes), "Candidatas", "Esperan tu decisión", "Reglas activas" and "Última revisión automática"; when the daily routine is stale (>2 days) a "La memoria lleva N días sin revisarse" action with `/pandacorp:memory harvest` (code path, not captured). The harvest-orphan banner is not drawn.

### FRD-17#U10 · drawn · `proposals-memory`

> - The **promotions queue** SHALL be a durable, reviewable list — every `factory/memory/` lesson with **`promotion: proposed`** (set by `/pandacorp:memory review`), showing its target (standard / decision-rule / skill), the rationale, and the evidence. The owner reviews the **full list and decides whenever** (no in-the-moment pressure): **approve** surfaces the `/pandacorp:learn` command that promotes it (→ `promotion: approved`); **reject** marks `promotion: rejected` (the lesson stays, but never becomes a rule). The promotion state lives on the lesson (single source of truth); this page and `/pandacorp:memory status` are both views of it. Mission Control never promotes — it shows the list + the command (read-only, like FRD-15/16).

**Prototype:** Promotions queue as "Esperan tu decisión" (16) with approve = copy `/pandacorp:learn <id>`; reject (`promotion: rejected`) is not drawn; target/rationale/evidence/high-risk badge are in the dialog metadata, not on the card.

### FRD-17#U11 · partial · `proposals-memory`

> - Candidate lessons SHALL be visually distinct from `active` ones, and the eval-gate state (corroborated / awaiting a 2nd occurrence) SHALL be shown, so the owner sees why something is auto-active vs pending (DR-047).

**Prototype:** Candidates are visually separate (collapsed card "Candidatas", blue) and the "Nueva" chip marks fresh two-project lessons; the eval-gate state (corroborated / awaiting a 2nd occurrence) is expressed only as "se confirman solas cuando vuelven a aparecer en otro proyecto".

### FRD-17#U12 · partial · `proposals-summary`

> - Proposals SHALL be **honest and dismissible** (White-Hat, [FRD-09](../frd-09-gamification/frd.md)): no false urgency, no nagging, no streaks; a proposal is a suggestion the owner can dismiss, and dismissing it is remembered. Framed in the guild theme (the `librarian` is the guild's cronista), never as pressure.

**Prototype:** No false urgency, no streaks. The ✕ dismiss and remembering it are NOT drawn (the code has a generic "Oculta solo en este navegador" handler but no element uses it on these pages).

### FRD-17#U13 · behaviour only · `proposals-summary`

> - High-risk proposals (promote to a MUST standard, create/edit a skill/agent, change a DR, delete) SHALL only ever be **displayed**; approval routes to the owner running the relevant skill — Mission Control never applies them itself (DR-047 human gate).

**Prototype:** High-risk items only display; approval is the owner running the skill.

### AC-17-010.1 · partial · `proposals-memory`

> - **AC-17-010.1** — WHERE a proposal stream has **more than the collapse threshold (6)** undismissed cards, the shared `DismissableProposalStream` (`CMP-17-stream`) SHALL render only the first 6 and a **"ver más"** toggle labelled with the hidden count; the remaining cards SHALL NOT be in the rendered list until expanded.

**Prototype:** Long lists show a full-width dashed "Mostrar N más · quedan N" bar (Candidatas: 10 at a time; Esperan tu decisión: 8; Señales: all), not "ver más" with threshold 6.

### AC-17-010.2 · behaviour only · `proposals-memory`

> - **AC-17-010.2** — WHEN the owner activates the toggle, the rest of the **already-loaded** cards SHALL appear **in-place** (no additional fetch, pagination or navigation) and the toggle SHALL become **"ver menos"**; activating it again collapses back to the first 6.

**Prototype:** Expanding in place without fetching is behaviour; "ver menos" is NOT drawn (the bar only adds).

### AC-17-010.3 · behaviour only · `proposals-memory`

> - **AC-17-010.3** — WHERE a stream has **≤ 6** undismissed cards, **no toggle** SHALL be shown and every card SHALL render (unchanged behavior); the cut is over the undismissed list, so dismissing below the threshold hides the toggle.

**Prototype:** Short lists show no bar: behaviour.

### AC-17-010.4 · drawn · `proposals-memory`, `backlog`

> - **AC-17-010.4** — The collapse cut SHALL live in the **single shared** stream component and apply **uniformly to every stream kind** it serves (candidate-lesson, prune, self-suggestion) — one code path, not a per-kind fork (DR-057). Existing dismiss / detail-modal / group-level-command behavior SHALL be unchanged; the toggle is a semantic `<button>` with `aria-expanded`, keyboard-operable, Spanish copy, state not by color alone (FRD-13). Added 2026-07-05 (drains change `mc-proposal-stream-show-more`, DR-069).

**Prototype:** One shared "Mostrar más" component serves memory, backlog, rules, trophies and transitions (iteration 28).

### AC-17-001.1 · partial · `proposals-memory`

> - **AC-17-001.1** — WHERE a proposal group shares a single activating command (e.g. candidate lessons and prunable/obsolete lessons both act through `/pandacorp:memory`), the command SHALL be shown **once at the group level**, under the group title — NOT as a per-item copy button.

**Prototype:** Group-level command exists for "Para podar" only; the Resumen lists a command per action.

### AC-17-001.2 · drawn · `proposals-memory`

> - **AC-17-001.2** — A proposal item SHALL show its own per-item command **only when** its command genuinely differs from the rest of its group (e.g. each self-suggestion routes to a different skill); otherwise the item is title + evidence only and defers to the group-level command.

**Prototype:** Per-item commands differ per lesson (`/pandacorp:learn LESSON-0002`, `-0003` …) and are shown per item; candidates defer to the daily routine.

### AC-17-001.3 · partial · `proposals-memory`

> - **AC-17-001.3** — The **lesson-oriented groups SHALL be grouped together and adjacent**: candidate lessons first, then prunable/obsolete lessons immediately after (both sharing the group-level `/pandacorp:memory` command), before the promotions and self-suggestion groups.

**Prototype:** Lesson groups are adjacent (Esperan tu decisión, Candidatas, Para podar) but the promotions come FIRST; the AC wants candidates first, then prune, before promotions and self-suggestions.

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `proposals-summary` | `#propuestas` | (none) | full page | `FRD-17#U1` `FRD-17#U2` `FRD-17#U3` `FRD-17#U7` `FRD-17#U8` `FRD-17#U9` `FRD-17#U12` `FRD-17#U13` |
| `proposals-memory` | `#propuestas?tab=Memoria` | (none) | full page | `REQ-17-009` `FRD-17#U2` `AC-17-006.7` `FRD-17#U5` `FRD-17#U6` `FRD-17#U7` `FRD-17#U9` `FRD-17#U10` `FRD-17#U11` `AC-17-010.1` `AC-17-010.2` `AC-17-010.3` `AC-17-010.4` `AC-17-001.1` `AC-17-001.2` `AC-17-001.3` |
| `proposals-lesson-dialog` | `#propuestas?tab=Memoria` | click `[data-lesson]` → wait for `dialog[open]` | capture viewport; widths 375/1280 | `FRD-17#U4` `AC-17-006.7` |

States cited above that belong to another FRD folder (captured there, reused here): `shell-expanded`, `backlog`.

**Not drawn (0)**: none.

**Partially drawn (10)**: `FRD-17#U1`, `FRD-17#U2`, `FRD-17#U3`, `FRD-17#U6`, `FRD-17#U9`, `FRD-17#U11`, `FRD-17#U12`, `AC-17-010.1`, `AC-17-001.1`, `AC-17-001.3`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### `proposals-summary`

- [span] Captura de la fábrica · 20 oct. 2026, 7:20 p. m.
- [p] Lo que la fábrica aprendió construyendo y lo que hay que arreglar en ella misma. Aquí ves qué te toca y qué comando correr.
- [@aria-label] Ver secciones anteriores
- [@aria-label] Ver más secciones
- [button[tab]] Memoria 16
- [button[tab]] Backlog 11
- [h2] Qué te toca, en orden
- [p] 4 cosas necesitan tu decisión. Copia el comando, pégalo en Claude Code y vuelve.
- [span] 4 para ti
- [span] Urgente
- [strong] 2 problemas urgentes en la fábrica
- [p] Son los P0 del backlog: «Gate retries hide a red test when the second run is flaky». Arréglalo antes que lo demás.
- [code] /pandacorp:implement-backlog BL-0001 (×2 of the same pattern)
- [@aria-label] Copiar /pandacorp:implement-backlog BL-0001 (×2 of the same pattern)
- [span] Córrelo en la carpeta de la fábrica
- [a] Ver el backlog
- [strong] 16 lecciones esperan tu sí o no
- [p] La fábrica las vio funcionar en varios proyectos y propone volverlas estándar, regla o skill (12 recién detectadas en 2 proyectos). Revisa una, decide, y sigue con la próxima.
- [code] /pandacorp:learn LESSON-0001
- [@aria-label] Copiar /pandacorp:learn LESSON-0001 (×12 of the same pattern)
- [span] Córrelo en la carpeta de la fábrica · cambia el número por la lección que elijas
- [a] Ver las lecciones
- [span] Importante
- [strong] 4 arreglos importantes en cola
- [p] Prioridad P1: fallos o mejoras del motor, las plantillas y las skills que conviene hacer pronto. Se hacen de a uno.
- [span] Córrelo en la carpeta de la fábrica · el primero de la lista
- [a] Ver los P1
- [span] Ideas
- [strong] 5 ideas descubiertas esperan decisión
- [p] Están en la primera columna del tablero sin proyecto. La recomendación te dice cuál conviene llevar a spec y cuáles descartar.
- [code] /pandacorp: recommend
- [@aria-label] Copiar /pandacorp:recommend
- [a] Ver el tablero
- [b] La memoria se revisa sola.
- [span] La rutina diaria cosechó y revisó por última vez el 20 oct. 2026. No necesitas hacer nada.
- [p] Lo que aprendió construyendo tus proyectos.
- [dt] Reglas activas
- [dt] Esperan tu decisión
- [dt] Candidatas
- [dd] se corroboran solas
- [a] Ver cómo avanza una lección
- [h2] Backlog de la fábrica
- [p] Fallos y mejoras de la propia fábrica (motor, plantillas, skills), no de tus proyectos.
- [dt] Urgentes · P0
- [dt] Importantes · P1
- [dt] Cuando haya tiempo · P2
- [p] 1 ítem ya está en curso.
- [a] Ver el backlog por tema
- [h2] Señales automáticas 42
- [p] Avisos que la fábrica genera sola. Ya están incluidos arriba cuando piden algo de ti.
- [b] Columnas del tablero con muchas ideas
- [p] Una columna acumula ideas por encima del umbral. Las descubiertas se resuelven con ; las descartadas no piden nada.
- [b] Lecciones vistas en 2 proyectos
- [p] Se suman a «lecciones que esperan tu sí o no». Cada una se decide con su propio comando.
- [b] Skills sin uso registrado
- [p] marca 27 de 27 skills, incluidas algunas que se usan a diario. Solo mira las últimas 200 entradas del registro de uso; no pide ninguna acción.
- [b] Señal poco fiable:
- [b] Otras

### `proposals-memory`

- [span] Captura de la fábrica · 20 oct. 2026, 7:20 p. m.
- [p] Lo que la fábrica aprendió construyendo y lo que hay que arreglar en ella misma. Aquí ves qué te toca y qué comando correr.
- [@aria-label] Ver secciones anteriores
- [@aria-label] Ver más secciones
- [button[tab]] Memoria 16
- [button[tab]] Backlog 11
- [h2] Cómo avanza una lección
- [p] Cada build deja notas; la fábrica las convierte en lecciones y, cuando una se confirma en varios proyectos, te pide decidir si se vuelve regla para todos.
- [span] Notas sin refinar
- [span] →
- [span] esperan confirmarse
- [span] 2+ proyectos
- [span] sí o no
- [span] Reglas activas
- [span] para todos los proyectos
- [p] Última revisión automática: 20 oct. 2026 · al día. Ninguna lección obsoleta.
- [h2] Esperan tu decisión 16
- [p] Abre una, lee qué propone y, si te convence, copia su comando. /pandacorp:learn la convierte en estándar, regla o skill; si no, la dejas como está.
- [small] LESSON-0001 · javascript · funko-tracker, pandasaga
- [span] Trampa
- [small] LESSON-0002 · testing · pandasaga, personal-page-v2
- [small] LESSON-0005 · nextjs · funko-tracker, pandasaga
- [span] Problema→solución
- [small] LESSON-0008 · dates · mission-control, funko-tracker
- [p] Recién detectadas en 2 proyectos
- [span] Nueva
- [code] /pandacorp:learn LESSON-0001 (×12 of the same pattern)
- [@aria-label] Copiar /pandacorp:learn LESSON-0001 (×12 of the same pattern)
- [small] LESSON-0003 · personal-page-v2, mission-control (×3 of the same pattern)
- [small] LESSON-0004 · mission-control, funko-tracker (×2 of the same pattern)
- [small] LESSON-0006 · pandasaga, personal-page-v2 (×2 of the same pattern)
- [small] LESSON-0009 · funko-tracker, pandasaga
- [h2] Candidatas 24
- [span] No piden nada
- [p] Se confirman solas cuando vuelven a aparecer en otro proyecto.
- [small] LESSON-0013 · build-engine · funko-tracker
- [small] LESSON-0014 · worker · pandasaga
- [small] LESSON-0015 · email · personal-page-v2
- [small] LESSON-0016 · design · mission-control
- [small] LESSON-0017 · images · funko-tracker
- [small] LESSON-0018 · ingestion · pandasaga
- [small] LESSON-0019 · i18n · personal-page-v2
- [small] LESSON-0020 · seo · mission-control
- [small] LESSON-0021 · testing · funko-tracker
- [small] LESSON-0022 · factory-engineering · pandasaga
- [span] Antipatrón
- [button] Mostrar 14 más · quedan 14

### `proposals-lesson-dialog`

- [dlg p] Lección · Trampa
- [dlg span] Promoción: proposed
- [dlg p] Aplicada en: funko-tracker, pandasaga
- [dlg p] Promoverla a estándar, regla o skill:

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- "Proposals inbox (Propuestas / Crónica del gremio)" | page title "Propuestas"; tabs Resumen · Memoria · Backlog.
- "ver más" / "ver menos" | "Mostrar 14 más · quedan 14".
- "Úsala cuando" (trigger), "applied in" | not drawn.
- "obsoleta" / "podar" wording | "Para podar", "lecciones obsoletas para podar".

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- FRD-17 describes a dismissable-stream design (✕ per card, remembered dismissal, stream explainers); the approved Propuestas is a to-do list ("Qué te toca, en orden") plus memory and backlog views with no dismissals.
- Badge in the top bar and chip in the portfolio rail (FRD-14/19 era) vs the sidebar badge counting actions (iteration 15: 120 items → 4 actions).
- Collapse threshold 6 vs 8/10 per list.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 15 (owner): Propuestas becomes a to-do list. Resumen "Qué te toca, en orden" lists only what needs the owner (the P0 backlog item, the lessons waiting for a yes/no, the P1 queue, the ideas still in Descubiertas), each with count, plain reason, the one command, where to run it and a link; memory upkeep shows as "se revisa sola" while the routine is current; two small panels (Memoria de la fábrica, Backlog de la fábrica) and "Señales automáticas" grouped by kind; the usage signal is flagged unreliable when it marks most skills (27 of 27).
- Iteration 15 Memoria: the life of a lesson as a four-step flow with who moves each step; lessons to decide open their `/pandacorp:learn LESSON-…` command; candidates collapsed.
- Iteration 28: lesson types: Trampa pink; Memoria section teal; "Mostrar más" is always a full-width dashed bar.
- 2026-10-21 language rule: lesson titles/bodies keep their source language (English); the interface around them is Spanish.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
