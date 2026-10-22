# Mission Control visual refresh — Órbita

**Status: APPROVED by the owner on 2026-10-21 (round 5, iteration 28; prototype `index.html`, preview round 5.28).** The approved design is the input to the design freeze. The freeze turns it into the design contract (tokens, `DESIGN.md`, component inventory, per-FRD mocks and fidelity oracle). The PRD/FRDs, runtime and project/build state stay authoritative until the v2 milestone updates them, and nothing here changes the running app.

## Recommendation

Recompose Mission Control as a contemporary, calm operations workspace with a distinctive guild identity. Put the operator's next decision first, expose progress without a wall of equally important cards, and give each content type a suitable presentation. Use graphite/porcelain surfaces with a semantic multicolor palette, Manrope headings with Inter body text, lightweight surfaces and deliberate spacing. Lilac remains an identity accent; document purpose and attention have their own color cues. Preserve sprites, campaign, achievements, ranks, rarity, XP, all read surfaces and every existing action.

The owner's current instruction explicitly authorizes exploration beyond the historical global RPG finish: color, fonts, placement and composition may change; functionality may not. This does not establish that the owner has approved Órbita or withdrawn the gamification itself. The product keeps its name and existing brand mark. Órbita is the working name of the proposed visual direction.

## Deliverables and boundaries

- [Open the navigable review](preview.html): desktop/tablet/phone preview controls, direct screen selection and light/dark comparison. The preview embeds the same study below; it is review-only chrome, not a new product feature.
- [Navigable design study](index.html): all main destinations, all real idea cards, the nine project sections, light/dark preview and three heading treatments. Round 5 is a full redesign populated from three private, timestamped read-only captures, all re-taken on 2026-10-20: projects, factory memory/backlog/configuration/guild/health, and the Manual pages rendered by the locally served app. Only the Party scene, worktree/merge and maintenance notices remain illustrative, and each is labelled. None of the captured information is presented as a continuously live feed.
- [Source and preservation inventory](inventory.md): implementation touchpoints and the complete functional preservation matrix.
- [Live evidence](evidence/): page captures and JSON observations of the running app at port 1987. Personal content is kept local through the exploration's evidence ignore file.
- [Prototype verification](verification.md): measured viewport, accessibility and interaction checks, with their limits.

Round 3 includes the full captured project documents, work orders, Spec blocks, architecture artifacts, changes and Manual pages. Scene artwork, ancillary guild/catalog examples and graph geometry remain design demonstrations. Its dialogs never modify factory files. It is deliberately not a production replica or a complete state oracle. The comprehensive preservation inventory, rather than the abbreviated examples, defines what a subsequent design pass must draw and retain. No feature is implicitly removed because its full state is not drawn here.

## Round 5 — full redesign with real data everywhere

The owner liked the round-4 direction and gave full creative freedom (colors, shapes, layout, a complete change if useful) as long as every Mission Control function remains, the result is easy to understand and navigable, and it is well made. Round 5 therefore rewrites the study rather than restyling it. The same review URL opens the new Inicio. Round 4 is archived under `mockups/round-4/`.

### What changed and why

| Area | Round 5 | Why |
|---|---|---|
| Shell | Persistent sidebar with the seven sections, the five projects (phase and progress) and the guild card; icon rail on tablet; top bar, bottom navigation and drawer on phone | Projects are the main object of the app: each is now one click away from any screen. Counts in the navigation show what needs attention. This departs deliberately from the earlier "prefer top navigation" advice; the content keeps the 1180 px reading frame. |
| Visual system | Neutral graphite/porcelain chrome; hue only carries meaning (phase, work-order state, document purpose, rarity), always with text or an icon. Light tokens at `:root`, dark tokens under `[data-theme="dark"]`, a tokenized type scale with nothing below 12 px, tokenized radii/spacing/shadows, hover effects only on hover-capable pointers | Color becomes information rather than decoration, and the round-4 palette the owner liked is kept. |
| Inicio | "Centro de mando": *Tu turno* holds only what the owner can act on (real pending decisions and changes ready to build), with a separate *En marcha* list for orders awaiting their FRD review, changes being built and drafts; portfolio cards with phase stepper and progress ring; pulse; idea funnel by phase; real activity; guild progress | The decision-first hierarchy the diagnosis asked for, now with actual items instead of a sample. |
| Tablero | Category chips with counts and a live result count; a single horizontal pipeline at every width with snapping columns, a phase selector on tablet/phone and narrow empty phases (iteration 5) | Removes horizontal scrolling on desktop and phone without hiding a phase. |
| Idea detail | Hero with phase stepper, favorite, open project and discard/restore (confirmation and reason); Campaña with six stages, the current command and build modes | All existing bounded actions are visible; writes stay simulated. |
| Portfolio | Overview of every project with a comparison table; the full project header only in Resumen, a one-line header elsewhere so content starts near the top; tab counts | Shorter path to the content of each section. |
| Work orders | Default "Por FRD" view with stacked state bars and collapsible groups; state tiles act as filters; the board view caps each column at eight with "show more"; the order detail extracts summary, scope and acceptance, plus a fact sheet, upstream/downstream dependencies and the scoped build command | The previous four-column board made a 109-order column 18,000 px tall and opened on empty columns on phone. |
| Arquitectura | Section shortcuts; stack table; integrations; the model diagram pans by dragging, zooms, fits, resets and goes fullscreen; selecting an entity highlights its relations and dims the rest; schema with one entity open at a time; relations with both cardinalities | Same facts, easier to read; the designed-not-verified distinction stays explicit. |
| Observabilidad | New "Mosaico" (every order as a state-colored tile by FRD), the real build timeline where the capture has timings, and a dependency trace | A whole build is legible at a glance; the trace is a reading aid, not a replacement for the real DAG engine. |
| Documentos | Index ordered by purpose (product, architecture/decisions, each FRD by name, design, reviews, rules, work orders), collapsible groups, search, typed reader; relative links resolve to the captured document | The round-4 index started with dozens of design audit files. |
| Comandos | Next step from the real phase commands; build modes with their real labels and hints, remembered per project; scoped `/pandacorp:implement <id>` builder | Same canonical commands, never executed. |
| Propuestas, Logros, Configuración | Now real: 258 backlog items, 407 lessons with 32 promotions and 32 self-suggestions, 26 skills, 16 agents, 134 decision rules, 33 standards, level/rank/XP, 100 trophies, 19 mission chains, 9 seals and 40 ranks with the existing rank art | These were the main illustrative gaps of round 4. |
| Documentación | The 38 Manual pages as composed by the app (diagrams, steps, commands), captured read-only from the locally served app, with previous/next | Round 4 could only show the index stub because the bodies live in React. |

### Iteration 2 — owner feedback on Inicio and the sidebar (same day)

- The plugin warning is now the first element of Inicio and a pill in the sidebar, driven by the real FRD-15 readers: installed 9.135.0 vs repository 9.137.0 at capture time. It only renders when behind (or with uncommitted plugin changes).
- Each *Tu turno* item ends with the skill to run and a copy button (`/pandacorp:decide`, `/pandacorp:implement change:<id>`), naming the project folder.
- *En marcha* is explained and split into collapsible groups: being built, waiting for their FRD review, drafts not yet ready.
- Portfolio cards explain themselves: the ring has a tooltip ("109 de 110 work orders verificados"), each segment of the six-part bar names its phase and state, and a caption reads "Etapa N de 6 del pipeline · último cambio …".
- The activity card left Inicio (it stays in each project); *Árboles de trabajo* returned in the right column with real data from the FRD-21 reader across the factory and the four project repos, with status, commits ahead, age and the landing command.
- The sidebar orders projects by last commit, shows at most five with "Ver los N" beyond that, and its Proyectos header collapses (remembered per browser). Inicio cards, the Portfolio overview and the picker use the same order.

### Iteration 3 — Inicio for an owner returning after months

- Order goes from general to specific: left column *Tu turno*, *Tu cartera*, *En marcha*; right column Pulso, Gremio, Embudo de ideas, Árboles de trabajo.
- *Tu turno* explains itself. Items are grouped by kind ("Decisiones que solo tú puedes tomar", "Cambios listos para construir"), each with one sentence on what it is and what its command does, then by project. Each decision shows its age (and that the skill first asks whether a decision 7+ days old still applies), "Lo que se necesita de ti" taken from the inbox block, the agent's recommendation, collapsible context, and the command scoped to that one decision, `/pandacorp:decide <id>`, as the real app does (the previous round showed the bare command, which made two decisions look identical).
- *Árboles de trabajo* tells the owner what each branch is: the subject of its last commit, its origin (build lane, Claude Code or Codex session), files changed, commits outside `main`, uncommitted changes, and a plain-language "lectura rápida" hint (never an automatic verdict). Per repository, a "Copiar pedido" button copies a request for Claude Code to triage the branches, land the finished ones with the merge queue and propose deletions without deleting anything unconfirmed. Integration commands moved into "Detalles".
- **Finding about the projects:** PandaSaga's spec digest lists FRD-01 to FRD-06 although FRD-07 (content ingestion) exists; Funko Tracker's `.env.example` leaves 28 of 55 variables without a comment of their own (several share one block comment). The factory rule already asks for a one-line purpose per variable; it is not enforced by a gate yet.
- **Finding about the current app:** PersonalPage v2's 2026-07-01 decision reads "**Estado:** ✅ RESUELTO 2026-07-01" in its inbox file, but the app's decision reader still counts it as pending (and keeps the "· " separator in titles). The study shows it with an explicit warning instead of hiding it.

### Iteration 4 — less text, less color

The owner found iteration 3 too dense and too colorful. Now:

- *Tu turno* is one short line per item (title, project · kind · age, the exact command with a copy button) plus a "Detalles" modal holding what it is, what is needed, the agent's recommendation, context and what the command does. A decision already closed in its file is flagged in the line and explained in the modal.
- *Árboles de trabajo* is a table: project, branches not integrated, leftover worktrees, and one colored state. Under the description sits the command for a proposed cleanup skill, `/pandacorp:worktrees`, labelled as proposed because it does not exist yet. A project row opens its branch list in a modal. State rule (legend in the card): **Depurar ya** with 3+ leftovers or pending branches, or any branch untouched for 7+ days; **Revisar pronto** with any branch older than a day or any leftover; **Al día** with only recent work; **Limpio** with nothing. Leftovers are open worktrees carrying nothing pending, now counted from `git worktree list` (locked ones excluded), which the app's pending reader does not list.
- Card header icons are neutral everywhere; color stays for state, phase, the progress rings and the plugin alert.
- **Proposed skill, safety boundary:** remove automatically only worktrees and branches whose work is already in `main` and that have nothing uncommitted; never touch locked worktrees, a live build's lanes or gate worktrees, or the deployed snapshot; list everything else with a recommendation and delete it only after the owner confirms. Building it is factory work (`/pandacorp:learn`), outside this study.

### Iteration 5 — Tablero on tablet and phone

The owner disliked the vertical labels of collapsed empty phases and the stacked phase groups below 1024 px, and asked how kanban apps handle small screens. Evidence gathered: Atlassian documents swiping right-to-left between board columns in Jira for iPhone and Android; Trello users describe list-by-list snapping; a long-standing request on Atlassian's tracker (TRELLO-1063) asks for a slider or dropdown because far-right columns are only reachable by swiping one at a time; forum reports (Telerik, Vikunja) show that horizontal panning conflicts with dragging cards unless drag needs a long press.

Decision for the study:
- One horizontal pipeline at every width: all six phases side by side on desktop; about two and a half columns on tablet and one plus a peek on phone, inside a contained scroller that snaps to each column (the page itself never scrolls sideways).
- A phase selector with counts appears when not every column fits; it jumps to a phase and follows the swipe.
- Empty phases stay narrow, with their label horizontal and "Sin ideas en esta fase".
- No card drag-and-drop: a column is the idea's real phase, which only advances when its skill runs (unchanged from the real app). Swiping is only for moving across columns, which also avoids the scroll-versus-drag conflict.

### Iteration 6 — Tablero columns

Owner feedback: columns looked squeezed and the board should simply scroll sideways on desktop too. Now every column has the same width (280 px on desktop, about two and a half per screen on tablet, one plus a peek on phone), the board scrolls horizontally at every width with snapping, the phase selector is always visible, and a remembered "Ocultar columnas vacías" switch removes empty phases (and their selector chips) instead of drawing them narrow.

### Iteration 7 — idea and project tabs as glance reports

The owner wants the project tabs to read like management reports: spot the state at a glance, read details only on demand, and see environment, database and integrations filled for at least one project. The project capture was re-taken (2026-10-20); it now also keeps each `.env.example` variable's comment and the project's services from the factory services directory (public fields only: provider, purpose, status, environments; never login emails, notes, resource ids or values). Funko Tracker is the fullest example: 14 stack layers, 10 services, 64 variables in 15 groups, 54 tables and 91 relations, 16 ADRs, 34/48 work orders.

- **Propuesta:** the one-liner with verdict/badge chips, four numbers (score, return, category, phase), "De un vistazo" cards (bet, problem, why now, vision) and the deeper sections as one-line rows; each opens its full text in a modal, plus "Propuesta completa".
- **Spec:** intro, six numbers (FRDs, work orders, user types, success metrics, v1 scope in/out, open decisions), product and research blocks as short cards, and a compact FRD table with progress whose modal shows the contract (overview, user stories, business rules) and jumps to its work orders.
- **Arquitectura:** stack line with host and cost, six numbers (stack layers, services configured, environment variables, tables/relations, ADRs, plan), then Stack as a label/choice grid ("Ver por qué" opens the reasons), Servicios as a table with environments and status, Base de datos as the data areas with Diagrama/Esquema on demand, Entorno as groups whose modal lists each variable and its purpose, ADRs one line each, and the plan per FRD.
- **Documentos:** type filters with counts above the index (work order, design, decision, architecture…).
- **Campaña:** six stage tiles (done / now / pending, each with its command in a modal) and one "Ahora" card with the next command and build modes.
- Color stays restrained: neutral cards, small colored icons, color only on status and progress.

### Iteration 8 — measured color in the reports

Owner feedback: iteration 7 went too far toward a single neutral color. Each glance card now carries its purpose color in its title and a thin top accent (problem coral, value green, users violet, metrics teal, scope blue, decisions amber…), section headings get a colored icon (product blue, research teal, features violet, stack blue, services teal, database green, environment pink, decisions amber), the headline numbers have a colored label and top accent, and FRD and ADR codes are tinted. Body text stays neutral so color guides without competing.

### Iteration 9 — Propuesta, Spec and Arquitectura follow the current app's structure

The owner preferred the current app's layout for these three tabs and asked for the same structure and data, adapted only to the new design system. The study now mirrors IdeaPitch, SpecDigest and ArchitectureDigest: a hero, full-width tinted bands, and label | content rows with the same typed renderers.

- **Propuesta:** hero (memo-pitch eyebrow, the bet, type/platform and verdict badges) → "De un vistazo · el sueño" (bet, problem with the quote, why now, why you, vision as feature cards plus the preview checklist) → "Profundizar · el criterio" (market, distribution, catalog, export, gaps as risk↔mitigation pairs, legal, red team box, the ask box) → "El tablero de decisión" (scorecard bars, effort-vs-value chart, collapsed evidence). The capture runs the app's own `parsePitch` and applies the component's row rules.
- **Spec:** hero → "PRD · qué y por qué" (problem bullets, value highlight, user role cards, metric cards, v1 scope checklist, out-of-scope pills, open-decision box) → "Research · la evidencia" (reference cards and prose rows) → "FRDs · las piezas del v1" cards with "Ver detalle" modals.
- **Arquitectura:** hero (stack line, intro, host/cost/phase chips) → stack table → integrations and operation → data model (diagram by default, schema on demand) → environment variables with their purpose → decisions with ADR modals → implementation plan (a state mosaic standing in for the app's interactive dependency graph) and per-FRD cards.
- The services directory moved out of Arquitectura into a new **Cuentas** project tab, matching the app's tenth workspace tab.

### Iteration 10 — the idea tabs replicate the app's layout exactly

The owner asked for the very same organization, layout and data distribution as the current app in every idea tab, changing only colors, theme and sizes to the new system. Done against fresh captures of the app at :1987:

- **Layout primitives:** the tab hero sits on the page background; each section is a full-bleed band (edge to edge of the content column, its own background tint) with a monospace colored eyebrow; rows are a narrow label column (small monospace uppercase, a softer tinted color) and a wider content column (body size, the visual focus), separated by thin dashed lines.
- **Page header:** like the app, the title line with its chips, "Etapa: …", then "Volver al tablero" and the favorite / open / discard actions.
- **Propuesta, Spec, Arquitectura:** same bands, rows and renderers as before, now in that layout (vision feature cards with the preview checklist, risk↔mitigation pairs, red team and ask boxes, scorecard and effort-vs-value chart).
- **Documentos (idea):** the app's curated rail (Resumen; Producto: PRD, Research; per FRD: Contrato, Diseño, Implementación) beside a reader, instead of the full workspace tree.
- **Campaña:** the app's journey map of six illustrated rooms in snake order with their hand-off labels and states (entregado / en curso / en espera), and below it the selected phase sheet (description, reads, writes, the team with sprites, the commands with build modes, "Entrar a La Fragua"). Phase data comes from the app's own `phases.ts`; the room art is the app's existing zone art.

### Iteration 11 — stale captures and the campaign's life

- The owner saw old renderings of Propuesta, Arquitectura and Campaña: the browser had kept the 2026-10-17 capture (no Funko architecture, no pitch structure, no campaign data). The build now stamps the data scripts with a per-build version, the review frame's "open unframed" link carries the round, and Campaña explains a missing capture instead of failing.
- Campaña keeps the app's animations: each room shows its team's sprites with role tags; in the active room they roam (a fresh spot every 0.9–2.5 s, sometimes toward a teammate, bobbing while walking), finished rooms idle-bob out of sync, locked rooms are static and dimmed, and the active room pulses. As in the app, speech bubbles are not shown unless a build is actually running, and everything stops under reduced motion.

### Iteration 12 — modal colour, clickable cards, right-hand indexes, Campaña polish

- **Modals keep the tab's colour:** every dialog has a tone (the head is tinted with a top rule, and a small monospace kicker in that colour sits above the title, e.g. "FRD-02 · Spec", "ADR-0015", "Decisión · Funko Tracker"). The FRD detail uses the same label | content rows as the tabs, each label in its own hue (visión, historias, reglas, fuera de alcance, preguntas abiertas, work orders).
- **FRD cards are fully clickable** in Spec and Arquitectura (the title is the button and its hit area covers the card); the "Ver detalle" button is gone.
- **Secondary sidebars go on the right:** the document index of the project Documentos tab, the Manual (Documentación) and the idea Documentos rail now sit right of the reader, so the app sidebar is the only left column. On phones the index stays above the reader behind its toggle. Rule for the rest of the design: any secondary sidebar that would sit next to the app sidebar goes on the right.
- **Readable documents:** markdown takes the document type's colour (h1 with a tinted underline, h2 with a side rule, h3 tinted, h4–h6 as small monospace labels, tinted table headers and zebra rows, tinted code and list markers). The idea Documentos reader now has the same paper head (type chip and path) as the project reader.
- **Campaña, same line, better finish:** the map fills the width as a 5-column snake on a dotted floor; corridors between rooms carry the hand-off artifact with its direction and turn solid green once delivered; each room has its phase colour (label dot, border, selection and pulse). A six-segment progress strip shows phases delivered. The phase sheet has a tinted head with its number, state and previous/next buttons; reads → writes is a two-box flow; team members stand on a small stage; the first command is highlighted as "Siguiente paso · avanza a …" and the rest are listed as other options. Commands with modes now show their own modes (the spec's ask/auto/infer), not the build-mode picker, and `<idea>` is filled with the idea's slug. All animations are kept.

### Iteration 13 — no accent stripes, coloured kind tags, honest environment rows

- **No coloured stripes anywhere:** every thick top or left accent bar is gone (document paper, FRD cards, work-order cards, report blocks, dialog heads, phase sheet head and next-step box, alert banner, campaign step, quotes, notices, the markdown h2 side rule, blockquotes and the sidebar's current-item marker). Where a surface needed definition it keeps its tint and a hairline border; the current navigation item keeps its background. Rule for the rest of the design: hue goes in text, chips and tints, never in an edge stripe.
- **FRD kind tags in colour:** UI pink, Infra amber, Tool/CLI teal (API blue, Data green when they appear). A FRD the spec digest does not list yet (PandaSaga FRD-07) takes its kind from its own `frd.md` (`ui:`), with a tooltip saying so, instead of showing an arrow.
- **Work-order progress only once the build starts:** FRD cards and the FRD modal show the progress bar and "n/m" only when the project is in Construcción/Release or any work order has moved; before that the card says how many work orders are planned. The implementation-plan mosaic is unchanged.
- **Environment variables as label | content rows:** the name in a coloured monospace pill on the left, what it is for on the right, grouped by the `.env.example` section headers. A variable without its own comment says "Sin descripción en .env.example" and a badge counts them (Funko Tracker: 28 of 55); nothing is invented to fill them.

### Iteration 14 — coloured document rail, plan progress only once built

- **Idea Documentos rail:** section titles carry a colour and a small square (Documentos teal, Producto blue, each FRD violet), items take their section's icon colour and the current item its tint. FRD sections read "FRD-01 · title" instead of the folder slug.
- **Implementation plan before Construcción:** the state mosaic and its "Por FRD" subtitle are hidden; one line says how many work orders are planned across how many FRDs and that their progress appears when the build starts; the FRD cards (with their blueprint detail) stay.
- **Manual:** the captured pages' inline accent stripes (the bar before each title, left-ruled notes) are hidden, per the no-stripe rule.

### Iteration 15 — Propuestas as a to-do list

- **Resumen tab (new, default):** "Qué te toca, en orden" lists only what needs the owner. Each item has a count, a plain-language reason, the one command, where to run it, and a link to the detail. In this capture:
  - the P0 backlog item;
  - the lessons waiting for a yes/no (32 proposed plus 4 seen in 2 projects);
  - the P1 queue;
  - the ideas still in Descubiertas.

  Memory upkeep shows as "se revisa sola" while the daily routine is current. The menu badge counts these actions (4) instead of adding up every item (120). Two small panels summarize memory and backlog, and the factory's automatic signals are grouped by kind:
  - board columns;
  - lessons seen in 2 projects;
  - skills with no usage event.

  The usage signal is flagged unreliable when it marks most skills (26 of 28, including daily ones).
- **Memoria:** the life of a lesson as a four-step flow (notes → candidates → waiting for your decision → active rules), with who moves each step (daily routine, 2+ projects, you). Then the lessons to decide, each opening its `/pandacorp:learn LESSON-…` command. Candidates are collapsed ("no piden nada").
- **Backlog:**
  - P0/P1/P2 tiles that filter;
  - a by-topic bar list in plain names, which filters too (areas sharing a name are merged);
  - a "Cómo avanzar" card: one at a time, recommended, or the whole queue with its cost warning;
  - open items grouped by priority, history collapsed.

### Iteration 16 — Logros back to the app's organization, in Órbita

The owner preferred the current app's Logros. This iteration rebuilds it with the app's organization and the new design system:
- **Misiones:** one card per chain, grouped by saga. Each card has its own icon, the tier rarity chip, the tier node ladder, the next tier with value/threshold, a progress bar and the accumulated count. The mission closest to its next tier is in the spotlight.
- **Trofeos:** a conquered-progress bar, the seals, the category filter, then three sections: Conquistados (gold cards with date and project), Por conquistar (compact locked cards) and Secretos (hints).
- **Estadísticas:** the app's operator report and character sheet, drawn as charts:
  - the pulse (verdict + four KPIs);
  - the six-axis guild radar plus six record tiles with their levels;
  - three ledgers: Producción, Calidad, Ritmo y alcance;
  - work orders per week (columns) and ideas per week (line);
  - usage (empty until skills emit usage events);
  - the ideas funnel and per-project phase transitions with reopen flags;
  - projects by phase, process signals and the next action with its command.

  `export-extras.mjs` now assembles this exactly as the app's `/achievements` page does: FRD-23 aggregate first, live git readers as fallback, `buildInformeData`, and the StatsPanel radar formulas.
- **Rangos:** the 40 ranks in the app's six eras. Each row shows the emblem with its grade, the family flavour line, the level range and XP. Reached ranks are marked "Conseguido", the current one has the XP left to the next rank, and the rest are locked.
- **Propuestas tweaks:**
  - the lessons seen in 2 projects now use the same row style as the other lessons;
  - the backlog's "Cómo avanzar" lists the whole-queue command first.

### Iteration 17 — balanced Logros summary, focused rank ladder

- **Resumen:** two right-hand cards were added so both columns end at a similar height (1018 / 1064 px at 1440): "Tu siguiente rango" (current → next emblem, XP left, how XP is earned) and a compact "Atributos del gremio" radar naming the strongest and weakest axes. Recent trophies show the last 4.
- **Rangos:** eras more than one step beyond the current one are collapsed, with their level range and rank count (goal gradient: the near climb stays in focus; the summit is one click away). The seal with axis `grand` now reads "Todos los sellos".

### Iteration 18 — four Logros improvements

- **Misiones:** inside each saga, the missions closest to their next tier come first. The ones with no progress at all go last, muted.
- **Trofeos:** a "Los más alcanzables" section above "Por conquistar" shows the lowest-rarity locked trophies, one per category (three when a category is filtered), so there is an obvious next target among 61 locked ones.
- **Estadísticas:** counters fed by build/agent events that have never been recorded show "sin datos aún" instead of a 0, with a one-line explanation:
  - gates, reviews, findings;
  - streak, active days, idea→launch record;
  - agents, subagents, modes, iterations, flawless launches.

  The summary radar's sentence says those axes are "aún sin datos" rather than weak.
- **Achievement notices:** the Inicio Gremio card shows the latest achievement and links to Trofeos. A trophy flagged new by the app, or unlocked within 7 days of the capture, raises a gold notice once per browser, with Ver and Cerrar; it closes on its own after 9 s. Nothing is fresh in this capture, so `?achievement=preview` shows the notice with the latest unlock for review.

### Iteration 19 — project workspace for a manager

- **Resumen** is rebuilt around one question, "what state is this project in?":
  - **Upgrade notice:** shown only when the project's Pandacorp overlay is behind the factory, with `/pandacorp:upgrade`. It uses the app's `getOverlayFreshness`, now in the capture.
  - **Estado general card:**
    - a health chip: espera tu decisión / construyendo / en pausa / listo para lanzar / avanzando;
    - one plain verdict sentence;
    - four tiles: avance, falta, cambios abiertos, último movimiento;
    - the next step with its command.
  - **Two columns:**
    - left: Avance por FRD (unfinished first) and Decisiones;
    - right: a compact Tu turno and Últimos avances.
  - **Últimos avances** is built only from structured sources: verified work orders per day from the build timeline, and filed or started changes.
  - **Removed:** the per-item "En marcha" list (now counted in the tiles), the raw activity log and "Contexto completo del producto".
  - Timestamped engine log lines in the decisions inbox are hidden as non-questions, with a count.
- **Observabilidad = the work-order section:**
  - the former "Work orders" tab is renamed, and old `tab=Work orders` links still land there;
  - it gains the build timeline and the dependency trace as views (Por FRD / Tablero / Línea de tiempo / Dependencias);
  - the separate Observabilidad tab and its mosaic are gone (the Architecture plan keeps a mosaic).
- **Cuentas** sits after Arquitectura:
  - it shows the login user, copyable, where it used to show the plan;
  - the service name opens its dashboard in a new tab;
  - environment chips are spaced and coloured (dev blue, staging amber, prod green).

  Like the app's Accounts view, the capture now carries the login email and dashboard URL, never credentials.
- **Party → La Fragua, kept and rebuilt** (see the red team below):
  - a scene on the build-hall art with four stations (Cola, Taller, Revisión, Bóveda), each with its sprites, its real work-order count and clickable tokens;
  - a forging bar, open changes as "Misiones secundarias" and the structured "Diario de la party";
  - the raw engine log, collapsed, as "Bitácora técnica del motor".

  The party works and the courier carries orders only while a build runs (`?party=live` previews it); otherwise it idles.

**Party red team.** The objections:
- it duplicates the Resumen;
- its updates are not real;
- it is never visited;
- it costs memory.

Answers:
- The rebuilt scene shows nothing that is not counted from the capture. It movement-codes only real build activity and adds what no other tab gives: a spatial "where is the work right now" view and the RPG feel the owner values.
- Its cost is static CSS and a few sprites.
- Kill criterion: if a build-day visit does not answer "how much is left and where" faster than the Resumen, fold the scene into the Resumen as a strip and remove the tab.

### Iteration 20 — one Portfolio view at a time

The Portfolio overview no longer shows the project cards and the comparison table together. Cards are the default; a Tarjetas / Lista switch shows the comparison table instead. The choice lives in the URL (`view=lista`), so it survives reloads and the back button.

### Iteration 21 — type decision, collapsible sidebar, La Fragua inside the Resumen, the dependency graph back

- **Typography decided:** Space Grotesk (display) + Inter (body). The font switcher and Manrope are gone; `assets/space-grotesk.css` loads the variable Space Grotesk file.
- **Collapsible sidebar (desktop), as in PandaTrack:**
  - pinned open by default (252 px), or collapsed to a 64 px icon rail;
  - while collapsed, pointing at it floats it open over the page without pushing the content, and keyboard focus opens it the same way;
  - the "Colapsar / Fijar abierta" button sits at the bottom and the choice is remembered per browser;
  - tablet keeps its rail and phone its drawer.
- **La Fragua merged into the Resumen (proposal):** the Party tab is removed. The Resumen opens with the scene: the project verdict as its headline, the health chip, the forging bar, the four stations with real counts and tokens, and chips for what is left, open changes and the last movement.
  - A **scene control** shows it as it really is, off, on (a running build: party at work, courier carrying orders) or as a **labelled simulation** in which tokens fly between stations and the counts follow.
  - A **Con La Fragua / Panel** switch brings back the plain Estado general card for comparison.
  - The engine log stays available, collapsed, at the bottom.
- **Dependency graph (DAG) restored and improved, in Observabilidad → Dependencias:**
  - every work order sits in a column by depth (its longest chain of prerequisites), coloured by state, with curved edges from prerequisite to dependant;
  - it filters by FRD; orders from other FRDs that connect show dashed;
  - clicking an order lights only its upstream and downstream chain, dims the rest, and a card below lists what it depends on and what it unlocks.

### Iteration 22 — two-level dependency graph, Cuentas polish, Documentación and Configuración

- **Observabilidad:**
  - "Línea de tiempo" is removed;
  - Dependencias now has two levels:
    - **Por FRD**, like the app's compound DAG: each FRD is a box with its work orders in chain order, and cross-FRD links are aggregated into one line per pair, labelled with the count and "⇄" for links going the other way. Pairs that depend on each other keep their dominant direction, so the map reads in order.
    - **Por work order**: the sequential graph with focus.
  - Clicking an FRD title opens it in the detailed graph.
- **Cuentas:**
  - no external-link or copy icons; the service name still opens its dashboard in a new tab;
  - the login is click-to-copy text, with a light sweep and a "Copiar" hint on hover;
  - rows are ordered by status (configured → proposed → inactive), then by name A–Z.
- **Documentación** (research + red team in the round notes):
  - **A home page that routes in:** Empieza aquí (the numbered tutorial), Guías para el día a día, Explorar por tipo (Tutorial, Guías, Conceptos, Workflows and a Referencia card pointing to Configuración), and one search across the text of all 38 pages with snippets.
  - **Reader:** breadcrumbs (Documentación › group › page), "Paso X de Y" with a progress bar on tutorial pages, previous and next within the group, and full-text search in the right-hand index.
- **Configuración:**
  - a **Resumen** hub with one search across skills, agents, rules and standards, four count tiles, and "Tus comandos" (the 20 owner commands, click to copy);
  - search in every tab;
  - Skills filtered by "Comandos tuyos / Motores internos", with copy on each row;
  - Agents grouped by model tier;
  - Standards as one list ordered MUST first, with visible severity facets and a domain select (instead of 10 small cards).
- **Colour rule applied:** one hue per catalog everywhere (skills violet, agents blue, rules amber, standards teal). Red, amber and green are kept for status and severity only, so domain chips and model tiers became neutral labels.
- **Research → red team:** rejected because they conflict with the owner's earlier decisions or the app's consistency:
  - a left-hand page index (the owner's rule puts secondary rails on the right);
  - a second "On this page" rail next to the page index (the research itself lists mixing them as an anti-pattern);
  - drawers instead of modals for definitions (every detail in the app is a modal).

### Iteration 23 — balanced docs home, collapsed FRD list, aligned state chips

- **Documentación home:** "Empieza aquí" and "Guías para el día a día" now share one height (545 px each at 1440). The left card adds "Después, entiende lo esencial", with four key concepts: the pipeline, the team, the human gates, state and files.
- **Observabilidad → Por FRD:** every FRD starts collapsed. One "Expandir todo / Colapsar todo" toggle opens or closes them all; a filter still opens the matching groups.
- **Work-order rows:** the dependency column has a fixed width, so the state chips (En revisión, Verificado…) line up on the same edge whether or not a row shows the link count.

### Iteration 24 — Resumen is La Fragua only; readable tokens; courier on the busy stretch

- **Resumen:** the "Panel" alternative is removed, since it repeated the project card above the tabs. That card now also shows "último movimiento".
- **Tokens:**
  - each La Fragua token shows its work-order code on two lines (FRD number over order number, e.g. 01 / 001), 44×40 px at the 12 px type floor;
  - hover or keyboard focus opens a card with the code, state, title, a one-line description and its FRD;
  - eight tokens show per station, then "+N".
- **Stations:** all four plates share one height. An empty station shows three dashed slots and a short message (Nada por empezar, Nadie construyendo ahora, Nada esperando revisión, Aún nada verificado). In the simulation, those placeholders give way as work arrives.
- **Courier:** it walks only between the first and last stations that hold work, along a gold route over that stretch, at 3 s per station. With work in only one station it stays put; the simulation uses all four.
- **Scene palette:** La Fragua keeps the dark palette in the light theme too (scene tokens in `base.css`), so its tokens and chips keep contrast on the dark art.

### Iteration 25 — calmer "Últimos avances"

Each progress line now has a coloured icon and a small status label (En construcción, Listo para construir, Pedido, Work orders verificadas), with the subject in neutral text and the date at the right. Before, every line was a green link. Rows that open a change carry a chevron.

### Iteration 26 — phone and tablet pass

The owner asked for a full pass on tablet and phone, with permission to use different interfaces where that reads better. Three independent reviews of every route at 375 and 768 px found about 60 problems; the shared causes were fixed once, then a second review checked the result.

- **Phone-specific patterns:**
  - the dependency map becomes a list in build order, where each FRD unfolds to what it depends on, what it unblocks and its work orders; the work-order level lists them by step, and the focus card moves above the list;
  - La Fragua shows one station per row below 900 px (crew, name and count, then its work orders), with no tall half-empty boards;
  - tables with fixed columns become one card per row (Cuentas, the portfolio comparison, the architecture stack);
  - the data model opens on its schema list;
  - an idea's documents are picked from a folded list instead of a short inner-scrolling box.
- **Long content:**
  - environment variables fold by group when there are more than 12;
  - rules show 30 at a time, with real dividers;
  - phase transitions show 10 at a time, as two-line cards;
  - trophies still to conquer show 12 at a time;
  - untouched missions are compact on phones;
  - the work-order board on phones shows 4 cards per column and collapses empty columns to one line;
  - on tablet the board flows as a two-column masonry.
- **Text that used to break mid-word:**
  - commands break only at their seams (after ":" and spaces), never inside an id;
  - markdown tables keep whole words and scroll sideways, with a visible hint;
  - list rows move their chips and commands under the title on phones.
- **Layout:**
  - two-column card pairs become one column below 1024 px, with *Tu turno* first in the Resumen;
  - the idea header keeps its actions on one row;
  - the campaign hides name tags in crowded rooms and keeps the phase arrows in the sheet header;
  - ranks put the emblem on the left;
  - the radar's labels no longer clip;
  - headings avoid a lone last word;
  - "hace 4 h" never strands its unit.

### Iteration 27 — readable work-order summary, colour in Comandos, Spanish interface

- **Work-order summary:**
  - the header shows the order's place in the flow (Planificado → En curso → En revisión → Verificado) with one plain sentence on what that means now;
  - the body then reads in order: «De qué trata», «Qué cambia» (with «Fuera de alcance» set apart), «Cómo se comprueba» and «Qué se construyó»;
  - each acceptance criterion is its own card, with its id as a tag and the EARS keywords marked;
  - a long status note shows its first items and folds the rest;
  - the side card says the difficulty in Spanish and lists the files the order touches (from its `artifacts`) instead of a bare count;
  - a line states that the content comes from the order's document, in English.
- **Comandos:** each card's icon and commands carry its category colour (a faint tint and a coloured prompt, no edge stripe). The four build modes get an icon and a 1–4 power meter. In «Cambios y decisiones», each command takes the colour of what it does: change pink, decision amber, new version violet.
- **Language rule (owner):** everything Mission Control writes is in Spanish. Content it shows from documents or from AI-generated project and factory files stays in their original language (English). This includes FRD and work-order titles, skill and agent descriptions, rules, lessons, backlog items and model notes. The interface strings that were still in English were translated: Portafolio, Lanzamiento, Investigación, Trampa (lesson type) and «Habilidad propuesta». The proper names of factory artifacts (FRD, PRD, ADR, work order, spec, backlog) are kept pending the owner's choice.

### Iteration 28 — one application: shared component rules

The owner asked for the screens to feel like one application. In his example, the Cambios card icons were grey while the Comandos ones were coloured. Three independent catalogues of every screen found three visual dialects (cards, report bands, scenes) and drift in colour, type and controls. Each fix is a shared rule, not a per-screen patch:

1. **Card header:**
   - a tinted icon tile in the card's colour, and a display-font title of one size whatever the heading level;
   - the count pill beside the title takes the same colour.
2. **Report bands** (Spec, Arquitectura, Propuesta): use that same card header, not small uppercase labels.
3. **Section heading outside cards** (one form everywhere): display title in text colour, icon in the section hue, hairline, muted note at the right. The old statistics band heading is gone.
4. **Small uppercase labels** use Inter. Monospace is kept for ids, code, commands and paths.
5. **Status colours stay status:** green, amber and red mean status or severity only. Categories that used them moved:
   - return type: Mixta pink, Monetaria teal;
   - lesson types: Trampa pink;
   - the Memoria section: teal;
   - rarity «Poco común»: teal;
   - Manual workflows: violet;
   - decision rules: pink;
   - Infra tags: slate;
   - work-order documents: violet;
   - environments: one teal hue;
   - the conversion KPI: blue.

   In-progress changes share the work orders' blue.
6. **Command boxes** inside a coloured card take a faint tint and a coloured prompt, on every screen.
7. **Shared controls:**
   - selected filter chips are neutral;
   - «Mostrar más» is always a full-width dashed bar;
   - search fields share one width;
   - every card intro paragraph has the same spacing;
   - mini-card titles inside bands are text-coloured.
8. **Two cards side by side end at the same height:** columns stretch and the last card of the shorter column fills the gap.

After two verification passes, more items followed the same rules:
- **Section headings:** the campaign journey and «Tu cartera» headings use the shared heading.
- **Counts:** band counts became pills.
- **Monospace only for code:** hero tags, FRD type tags, build-mode tags, campaign hand-off labels, level chips, document counts and «copiar» use Inter.
- **Category colours:**
  - mission progress, near trophies and the guild radar use gold;
  - Pulso and data-model sections use non-status hues;
  - reviews and history use slate.
- **Selected states:** the board's selected phase and La Fragua's selected mode are neutral.
- **Commands:** list-row commands share the command-box look, with a prompt and a tint; commands in toned notices and banners take their tone.
- **Board:** columns line up, and an empty column shows its 0.
- **Small fixes:**
  - the idea memo no longer repeats the idea title;
  - the campaign shows «Lanzamiento» instead of «Release».

**Deliberate exception:** a project's phase is its status in the pipeline, so phase colours (including green Lanzamiento and amber Arquitectura) stay as they are.

### Remaining gaps and limits

- **Simulated or illustrative and labelled:** La Fragua's "Encendida" and "Simulación" modes when no build runs (the counts are always real), and every write (favorite, discard/restore, change/backlog discard, dismiss).
- **Not captured:** live refresh/SSE. The study's dependency maps use a simple deterministic layout; the real app's compound DAG uses a force layout, which a build must keep or replace deliberately.
- **Capture times:** projects 2026-10-21 00:20; factory extras (backlog, memory, configuration, guild with the Informe series, health) 2026-10-20 23:19; Manual 2026-10-20 09:46, from the deployed local app, which may lag the source.
- **Before any freeze:** choose a self-hosted monospace font (preflight warning) and move the remaining literal component lengths into tokens (warning above 150).
- **Not yet reviewed with the owner this round:** the light theme as a whole (Cambios and Comandos were approved in iteration 27; the work-order summary was redesigned there and awaits the owner's look). All pass the automated matrix and the iteration-26 phone/tablet review, but none had a dedicated owner pass.
- **App features not drawn yet** (re-checked against the current prototype source):
  - Inicio: the digest with count and mark-seen;
  - the board's "recommended" badge;
  - Campaña's per-phase checklists (the capture carries descriptions, reads, writes, team and commands only);
  - the deploy target (internal/external) and objectives count in the project Resumen;
  - the skill workflow diagram in Configuración;
  - the creation affordances (new standard / rule / skill via `/pandacorp:learn`).
- **Finding about the current app:** the composed Manual pages use a different phase vocabulary and color code (Descubierta/Documentada; Diseño violet, Arquitectura green, Construcción pink) from the rest of Mission Control, and 10–11 px inline labels. The study shows them as captured (raised to 12 px); unifying them is a content change for the real app.

See [round-5 verification](round-5-verification.md). This is a further owner-review round, not final approval or a replacement of the production visual contract.

## Round 4 — semantic color and visual hierarchy

The owner likes the modern composition but finds the single-purple treatment too flat. Color now identifies purpose and draws attention at scanning distance, using the current app's Spec hierarchy as a reference. The same review URL opens PandaSaga Spec. All real snapshot content and round-3 navigation remain in place; no new features, statuses, priorities or source documents are invented.

| Purpose | Color | Reinforcing cue |
|---|---|---|
| Product / Spec | Blue | Flag/book icon, labelled hero and section |
| Research, findings, metrics and data | Teal | Search/bolt/model icon and explicit heading |
| Functional contracts | Violet | FRD identifier and contract/book icon |
| Design documents | Pink | Spark icon and Design label |
| Architecture and technical decisions | Amber | Cube/shield icon, document type and heading |
| Value and verified progress | Green | Value heading or actual verified count/check icon |
| Problem context | Coral | Problem heading and flag icon; not a fabricated error status |
| Reference, excluded scope and planned work | Slate | Explicit labels; no lower-opacity body text |

Shared palette tokens live only in the exploration's `prototype.css`, with light/dark pairs. The same document classification supplies link buttons, index icons, current selection, reader type badge and section headings. Spec panels use colored heading icons, a purpose-tinted surface and top rule; open decisions remain labelled separately from other material. FRD cards retain their own identifiers and show verified/total work-order counts derived from the existing captured orders. Board phases and work-order columns use their real phase/state rather than arbitrary per-card colors. Architecture, Manual groups, project phase avatars and summary metrics adopt the same palette. Body text retains a readable neutral color; color is always reinforced by text or an icon.

See [round-4 verification](round-4-verification.md). This is a further owner-review round, not final approval or a replacement of the production visual contract.

## Round 3 — real project journeys

The owner likes the visual direction and requests a more complete iteration before judging the final result. Both Board detail and Portfolio now consume one shared project presentation for Spec, Architecture and Documents. A searchable project dialog shows all five projects with phase, FRD/document counts and actual work-order progress. The static local capture contains 22 ideas, 718 full documents, 170 work orders, 52 FRDs, 23 ADRs, 43 changes and 38 Manual pages. PandaSaga supplies a real 39-entity/95-relationship model; absent source artifacts remain explicit. Review uses the same stable `preview.html` URL, initially opening PandaSaga Architecture in that archived round.

This accepts the direction for further iteration, not the final freeze or a production change. The snapshot and private review evidence are ignored by Git and stay local. Regeneration uses existing canonical readers; no project status or source document is written. See [round-3 verification](round-3-verification.md).

## What was actually reviewed

Source was read for the global shell, shared styling, dashboard, board/detail, embedded/direct workspaces, all nine workspace tabs, diagrams/model controls, proposals, all five achievement sections, all four configuration sections, the Manual, routes and product/design contracts. The running app was inspected in Chromium at `http://127.0.0.1:1987` on 2026-10-17.

The baseline capture set covers seven base destinations at **1440, 768 and 390 CSS px**, plus the direct project family and nested selections at desktop and phone widths. Dark-mode spot captures cover Inicio, Tablero, Documentación and Logros. Both Mission Control and PandaSaga were used to avoid judging document/model views only on a small example. A full production a11y audit, real-device Safari/touch run, profiler trace, network benchmark and every possible data/error state are **not** claimed.

Two distinctions matter: a document's claim that a feature is responsive is not evidence of actual usability; a page can have no outer overflow while a fixed internal column makes its main content unreadable. Also, the served runtime is the baseline under observation; source explanations are cited separately, not assumed to prove the exact deployed revision.

## Diagnosis, in priority order

| Priority | Observed issue | Evidence | Proposed response |
|---|---|---|---|
| P0 | Manual reader becomes a narrow clipped strip on phone | `evidence/manual-390.png`; source `src/app/manual/ManualShell.tsx:85` uses `236px 1fr` with hidden overflow | Full-width reader; index disclosure on phone, rail only when reader width permits |
| P0 | Board causes outer horizontal overflow at 390 px | `evidence/live-audit.json`: document width **499** at viewport **390**; `evidence/board-390.png` | Stack controls; allow horizontal scroll only inside the Kanban, with stable page width |
| P0 | Achievements → Estadísticas has phone overflow | `evidence/nested-audit.json`: observed document width **598** at viewport **390**; `evidence/achievements-Estadsticas-390.png` | Reflow report bands/cards; local scrolling for truly two-dimensional charts only |
| P0 | Project Documentos also overflows on phone | `evidence/nested-audit.json`: document width **668** at viewport **390** after waiting for the selected tab | Shared responsive index/reader pattern for both document surfaces |
| P1 | Routine activity dominates Inicio before decisions | `evidence/home-1440.png`, `home-dark.png`; `src/app/page.tsx:381` mounts Digest before TuTurno | Tu turno first; cartera second; activity as compact rows with accessible expansion |
| P1 | Maintenance warning occupies a large high-emphasis block | Same home captures; current warning includes status, instructions and full command | Persistent compact warning with disclosure; errors that prevent trustworthy reading remain prominent |
| P1 | The globally embossed grid/tile language gives almost everything similar emphasis | Shell source `src/components/modules/AppShell/AppShell.tsx:36`; panel/row styles, `globals.css`, `DESIGN.md` global skin | Remove global grid/ledge/inset treatment; reserve expressive framing for guild experiences |
| P1 | Project context is followed by nine wrapping tabs on phone | `evidence/pandasaga-architecture-base-390.png`; `src/app/projects/[slug]/_components/tabbar.tsx:54` | Single local tab row with clear overflow, active section visible, full nine-item access |
| P1 | Workspace summary foregrounds a long document above operational state | `evidence/portfolio-1440.png`; `tab-summary.tsx` renders summary before snapshot/decisions | State, decisions and verified snapshot above context; full document remains accessible |
| P2 | Navigation framing changes between global views, direct projects and configuration | Shell exemption in `AppShell.tsx`; live direct project/config captures | Consistent brand/context/back pattern while retaining embedded/direct URL contexts |
| P2 | Dense small labels and pixel typography compete with operational reading | `Informe.tsx:51` uses 11 px Pixelify labels; visible report/board captures | Clear hierarchy with normal type for work; pixel imagery and rarity remain expressive accents |
| P2 | Very long catalogs and streams require more reading than their visual hierarchy supports | Configuration and Proposals captures; dismissable stream and catalog sources | Structured rows with title, concise metadata, full readable detail; preserve original source wording |

The P0 items are measured usability defects; the rest are design judgments grounded in the observed screens. Replacing the font/color alone will leave the main hierarchy and responsive failures in place.

## Visual direction

### Character

Precise, warm in tone, expressive in the moments that deserve it. The metaphor is an operator's observatory with a living workshop inside. The operational chrome is quiet; the Party and the guild's milestones carry the fantasy. Avoid wallpaper grids, glowing borders on every tile, gradient cards, decorative status numbers and a permanently animated dashboard.

### Palette

| Role | Dark | Light | Use |
|---|---|---|---|
| Canvas | `#101116` | `#F5F5F9` | Neutral graphite / porcelain |
| Surface | `#191A22` | `#FFFFFF` | Primary panels |
| Raised/control | `#20212C` | `#EFEFF6` | Selected surfaces, secondary controls |
| Primary text | `#EFF0F6` | `#202131` | Reading and headings |
| Secondary text | `#A4A7BB` | `#62657B` | Supporting copy, still readable |
| Structure | `#30323F` | `#DDDFE9` | Quiet boundaries |
| Accent | `#B7A9FF` | `#6550B9` | Main action, active section, selection |
| Success | `#7ED9B4` | `#247257` | Verified / launched, always labelled |
| Attention | `#F1C383` | `#895915` | Real decisions or warnings |
| Failure | `#FF9DA7` | `#A3384D` | Failure / blocking issue |

These are proposed tokens, not replacements for the current canonical tokens. In implementation, derive semantic aliases and validate every actual foreground/background pair. Accent is rationed. Category/rarity/trace colors keep their distinct meanings; do not recolor every item merely for variety. Amber is a small semantic signal, not an olive/mustard surface theme.

### Typography

**Recommend Manrope + Inter.** Manrope gives headings recognizable character; Inter keeps dense work and documentation easy to read. The preview allows Inter-only and Space Grotesk + Inter on the same actual layouts so the owner can compare. Reuse the existing monospace treatment for commands/paths/identifiers; choose a pinned self-hosted monospace before the final freeze.

Proposed scale: page title 34/28 px desktop/phone; section heading 18–22 px; body 14–16 px; metadata 12–13 px. Long prose uses 16 px and roughly 65–75 characters per line; structured tabs can use the full host width. Keep tabular numerals for changing/aligned values. Pixel typography is removed from routine reading; sprites, badges, rarity and rank imagery preserve the guild's identity. The owner still chooses the final fonts at the design gate.

Manrope and Inter are locally staged from Google Fonts with their OFL texts. Space Grotesk is reused from existing project assets. The logo and sprites are existing assets, not a new brand proposal.

### Space and surfaces

Keep the **centered 1240 px outer maximum including gutters**, per the owner's earlier correction. A desktop app should feel spacious without stretching across an ultrawide monitor. Use 16–24 px edge padding, a 4 px spacing base, 20–24 px panel padding, roughly 20–32 px section gaps. Panels have subtle boundaries, 12–20 px radii and no permanent emboss. Nested content uses separators or spacing rather than boxes inside boxes inside boxes. Heights follow content. Do not force matching-height cards with blank padding.

Use one family each for page headers, section headers, tabs, status chips, command rows, detail dialogs, empty/error states and graph toolbars. One accented main action per local decision group; secondary actions stay quiet. Do not turn a destructive action into an attractive primary button.

## Recomposition by surface

### Inicio

Desktop: main column **Tu turno → Construcción y cartera → factory worktrees → progress**. Secondary column **Pulso → Desde tu última visita → maintenance**. Phone: decisions, projects and meaningful progress before secondary activity. Do not let repeated StopGate items push decisions below the fold.

Keep all existing fields: exact commands and copy affordances, decision links, digest count and mark-seen semantics, conversion metric and source states, project phase/running distinction, verified/total counts, next command, blocked/debt/feedback badges, worktree progress/ready/stale details, XP, recent achievement and next milestone. The study abbreviates these to illustrate hierarchy; the complete design pass must render each.

A collapsed warning still names the problem before expansion. An invalid/missing data source must never collapse into an innocent green health chip. No new "approve", "run" or "launch" behavior is proposed.

### Tablero and idea detail

Keep the six phase columns and their exact derivation. Desktop column width should support natural title wrapping. Phone keeps one readable column plus a visible edge of the next inside a contained scroll region; avoid page-wide lateral movement. Existing search/category/reset controls stack naturally. Keep score, return type, project type, recommended/building state, favorite action, discarded list, capture-command dialog, discard/restore reason flow and keyboard access. No drag-to-advance.

The full idea detail remains a page with five conditional sections: **Propuesta, Spec, Arquitectura, Documentos, Campaña**. Keep phase-aware defaults, canonical documents and all pitch/research detail. Present long material with clear headings and disclosures without rewriting facts or dropping evidence. Preserve all six campaign stages, their checklists, next commands and build mode behavior.

### Portfolio and project workspace

Desktop: modest collapsible project rail plus full host-width workspace. Tablet/phone: compact project selector replaces the long rail above the content. Maintain the choice to collapse the rail and the current URL selection. Direct links and the embedded workspace share the same visual vocabulary.

| Existing section | Proposed composition | Preservation requirement |
|---|---|---|
| Resumen | Compact state summary, snapshot/decisions/merge, readable context, activity below | Summary/key points, deployed link, overlay state, snapshot/worktree command, decisions, merge and log |
| Spec | Readable overview with structured FRD list and document links | Complete PRD/research/FRD digest, true folder count, pending state |
| Work orders | Current FRD/state filters above a clean four-state Kanban | Every order, grouped contract, live refresh, detail, status note and document tabs |
| Arquitectura | Stack → Integrations/operations → Model → environment/ADRs/plan | Every authored fact and exact shared data model/artifact semantics |
| Cambios | Compact status groups, readable detail, historical disclosure | Ready/draft/building/closing, done/discarded, errors, copy and existing discard |
| Party | Large scene with sober context and a full-width event feed below | All zones, sprites, gate/judge/reviewer, queue/vault/archive/tents, mode-as-data, live freshness/off-state |
| Observabilidad | Calm toolbar + dedicated canvas; aligned timeline rows | Actual time scale, durable track, dependencies, selection/trace, all current graph controls |
| Documentos | Reader with a secondary index; full-width reading on phone | Full tree, markdown, tables/code, safe links and selected document URL |
| Comandos | Mode selector, exact copyable command, phase/target variants | Canonical mode list/flags, remembered mode per project, FRD/change targeting; never execute |

### Architecture and graph surfaces

Keep the deliberate architecture order and all recent model improvements. Diagram is still default. Esquema stays initially collapsed with one entity open at a time. No equal-height schema cards. Do not turn a designed model into a live database claim. Distinguish missing, malformed and explicitly no-persistence states.

Both ER diagram and work-order DAG keep the current shared icon toolbar at top-right, native fullscreen with fallback, actual-opener focus restoration, pan/zoom/fit/reset/search/selection, exact cardinality/key/type information and non-destructive behavior. The study's simplified graph only illustrates the surface treatment; it must **not** replace the actual viewer or its interaction engine.

Two-dimensional content may pan/scroll within its own canvas; labels should not be shrunk into unreadability to satisfy a "no scroll" screenshot. Touch and keyboard alternatives remain available. Keep selected edges visually distinct and avoid the removed rectangular relationship focus box.

### Propuestas

Preserve **Memoria / Backlog**, their meaning and their counts. Memory becomes a short health strip plus structured streams; full source/evidence remains in detail. Keep promotions, candidate lessons, prune, self-suggestions, per-group versus per-item commands, local-only dismissal and ver-más behavior. Absolute dates stay accessible so a relative "hoy" cannot mislead.

Backlog keeps priority/id ordering, open/doing groups, done/discarded disclosure, full markdown, parsing error messages, existing discard flow and both generic/targeted commands. This is a presentation change, not a second backlog system or new write path.

### Logros

Preserve all five sections: **Resumen, Misiones, Trofeos, Estadísticas, Rangos**. A refined guild card anchors the view; rank art, sprites and trophy illustrations carry the delight. Give the current rank, XP denominator and next threshold clear hierarchy. Earned trophies feel tangible; locked states are calm and reveal their content by touch and keyboard as well as hover.

Keep saga/category filters, active mission chains, rarity, secrets, unique trophies, almost-there items, full rank ladder and requirements. Estadísticas preserves the report's six operational bands, charts/radar/records/ledger, freshness/source states and next actions. Repair phone reflow before adding polish. Missing or unwired metrics keep their explicit unknown labels. No fabricated live data, streak rewards or extra incentives.

### Configuración

Keep **Habilidades, Agentes, Reglas de decisión, Estándares**. Prefer structured rows with one clear title, concise context and complete detail over a dense wall of embossed catalog cards. Preserve skill scope/flows, agent role/model/XP/levels/reverse skill links, policy defaults/approval status, standards and their original definitions. Do not silently translate or rewrite authoritative source prose to make a card shorter. A brief display summary must link to the complete source.

### Documentación

The most important responsive redesign. Desktop has a readable two-pane structure; tablet reduces the index width only while the reading column stays comfortable; phone uses an **Abrir índice** disclosure above a full-width document. Preserve tutorial/guides/concepts/workflows/reference groups, diagrams, commands and cross-navigation. Tables/code scroll locally if needed; prose reflows. Keep selected document and anchor URLs/history; return focus from the mobile index without losing the reader's context.

### Shared states

Design loading, valid-empty, no-result, unknown/stale, malformed-source, not-found and clipboard-error states with the same components. Keep failure messages informative. Dialogs use a predictable title/close/action order and become nearly full-width on phone without touching screen edges. Native Escape/focus return remain. Confirmation and reason steps for existing destructive actions stay explicit.

## Responsive contract

| Range | Shell | Workspace / documentation | Dense content |
|---|---|---|---|
| 320–599 px | One integrated header; labelled disclosure; guild detail reachable through Logros | Single column; project selector; index under demand; local section row | Contained Kanban/canvas, readable card widths; tables reflow or scroll locally |
| 600–820 px | Compact contextual navigation without desktop-width pressure | Main content full-width; rail replaced when it steals reading space | Two columns only when content fits; filter rows wrap |
| 821–1100 px | Navigation may occupy a second integrated row | Collapsible project rail; compact document rail if legible | Fewer columns, deliberate local overflow |
| Above 1100 px | Slim top navigation and compact guild identity | Centered 1240 px application frame | Full-width host panels; prose alone has a readable line limit |

These are design starting points, not device detection. Validate the component's available width, landscape, 200% text zoom and long Spanish titles. Target 44 px controls; retain a visible active section and keyboard access when the local tab row overflows. A 320 px phone must retain every destination and action. Do not hide missing controls behind hover.

## Fluidity and performance

The proposal treats fluidity as predictable movement and stable reading, not extra animation. Use 120–180 ms feedback for menus/selection and up to 220 ms transforms for an opening surface; no text fading or bouncing layout. Respect reduced-motion. Retain focus/scroll/URL context; live updates must not reset the user's tab, camera or document position.

Investigate re-render/scene/layout cost with a profiler before optimizing. Reuse the existing worker/camera batching for graphs. Keep the app's current data/refresh contracts; avoid eager rendering of a giant hidden scene or full catalog just to animate it. Reserve space for loading blocks to prevent jumps. Self-host pinned fonts; reuse current assets and existing primitives. A static mockup cannot prove a faster Next.js app: no quantified speedup is claimed.

Future acceptance targets: no interaction-caused page jump, one main vertical reading flow, no ordinary page overflow, stable live refresh, and no >50 ms main-thread work caused by simple shell/menu interactions under representative data. Real-device/profile evidence is required before promising these targets.

## References and deliberate departures

- [Linear: A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh) — predictable action placement, quieter borders, hierarchy and visual consistency. Adopt the discipline, not a clone of its product.
- [Raycast: A fresh look and feel](https://www.raycast.com/blog/a-fresh-look-and-feel) — concise, focused reading and comfortable density. This does not propose a global command palette or new shortcuts.
- [Vercel: dashboard navigation redesign](https://vercel.com/changelog/dashboard-navigation-redesign-rollout) — consistent contextual navigation. Do not inherit team switching, deployments or account features.
- [Resend: the role of design](https://resend.com/handbook/design/whats-the-role-of-design-at-resend) — careful product craft as a useful direction reference, not evidence of this app's measured quality.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — contrast, reflow, keyboard/focus, target size and interaction alternatives. The 44 px touch target is our design target; do not misstate it as the WCAG 2.2 AA minimum, which is 24 px with exceptions.

All were consulted in this session. The proposed palette, typography and composition are design judgments for Mission Control.

## Alternatives considered and risks

1. **Only replace cyan with purple.** Cheap, but the activity wall, reader width and repeated visual weight survive. Reject as the main approach.
2. **Turn the whole app into an immersive RPG scene.** Strong personality but competes with documents, data and phone use. Retain the immersive experience inside Party and the Hall instead.
3. **Use a large permanent global sidebar.** Familiar for dashboards but competes with the 1240 px frame, Portfolio rail and document/model content. Prefer top navigation; contextual secondary rails appear only where useful.
4. **Remove detail to create a clean screenshot.** This would violate the request. Use progressive disclosure with complete accessible content; show all counters, exceptions and real actions in the final state set.
5. **Rewrite navigation or graph engines during the skin change.** High regression risk with recent URL/model work. Keep route/state/data engines intact, adapt their presentation, and test the same links and controls.

The main trade-off: quieter chrome may initially feel less playful. Use existing sprites, rank imagery and intentional milestone moments to preserve delight. Another risk is excess whitespace on small screens; validate real long names and populated/empty states rather than filling every panel with placeholder cards.

## Delivery plan after a visual choice

The current request ends with this proposal. Suggested implementation order after approval:

1. Finalize the visual system on **Inicio, a dense architecture/model view and Documentación at phone width**. These expose hierarchy, dense data and reading risk early. Approve the palette/type/layout together.
2. Draw every listed surface/state at required widths and both themes. Reconcile the preservation matrix against the app/FRDs. Produce the proper PDD/FDD/token/copy/asset/fidelity contracts; only then replace the old approved design anchor.
3. Implement the shared shell/primitives/responsive patterns, then migrate Inicio/Tablero/Portfolio, then readers/graphs, then Party/Propuestas/Logros/Configuración. Reuse existing data/URLs/actions. Each group must remain navigable while it changes.
4. Qualify with real project data, semantic action/URL regression checks, both themes, desktop/tablet/phone, keyboard/touch, one independent review and the canonical gate. Compare behavior to the old app and appearance to the approved new reference. The owner chooses when to authorize implementation.

**Carried into implementation (owner decision, 2026-10-20):** fix the decision reader (`src/lib/docs/activity.ts` `readDecisions`) so a block whose status line reads `**Estado:** ✅ RESUELTO …` counts as resolved, and titles drop the leading "· " separator (seen on PersonalPage v2's `2026-07-01-1`). Do it as part of implementing this design, with a regression test anchored in that case, keeping every existing decision id unchanged. It is a reader fix, so it outlives the visual change.

No automatic phase advancement, queue drain, scope expansion, public publication, external communication or production change is part of this study.
