// Mission Control — the factory's own dashboard, nearly complete (109 of 110 orders verified);
// WO-02-014 waits for its FRD gate. It has no spec/architecture digests (internal tool) and an
// overlay older than the factory's, so the upgrade notice shows.
import { NO_DATABASE } from "./models.mjs";
import { planFrd } from "./plan.mjs";

const T = (s) => Date.parse(s);
const PASS = { verdict: "pass" };

const F = (n, slug, en, titles, from, every, extra = {}) =>
  planFrd({ n, slug: `frd-${String(n).padStart(2, "0")}-${slug}`, en, es: en, tag: extra.tag ?? "UI", area: slug, titles, states: extra.states ?? "d".repeat(titles.length), from: from == null ? null : T(from), every, review: extra.review === undefined ? PASS : extra.review, ...extra });

const frds = [
  F(1, "data-reading", "Data reading", ["Factory root resolution", "Idea card reader", "Portfolio table parser", "Status file reader", "Project path existence check", "Docs tree listing", "Decision inbox parser", "Activity log reader", "Events tail reader", "Reader fixtures and malformed cases"], "2026-06-16T02:10:00Z", 18),
  F(2, "ideas-board", "Ideas board", ["Column derivation from status", "Next-step hint per column", "Discard with confirmation", "Board view with search", "Card detail with tabs", "Phase taken from the project status", "Favourite flag on cards", "Idea name inside next-step hints", "Accessible empty-column marker"], "2026-06-16T06:00:00Z", 35, { ids: [1, 3, 4, 5, 7, 11, 12, 13, 14], states: "ddddddddr", review: null, overrides: { 8: { start: T("2026-09-25T01:08:00Z"), end: T("2026-09-25T01:21:00Z"), deps: ["WO-02-005"], criteria: 3, artifacts: ["src/app/board/IdeaBoardView/**"], difficulty: "low" } } }),
  F(3, "portfolio", "Portfolio", ["Portfolio rail with phases", "Release snapshot columns", "Last sync formatting"], "2026-06-17T03:00:00Z", 25, { drift: ["REQ-03-002", "AC-03-001.2"] }),
  F(4, "project-workspace", "Project workspace", ["Workspace route by slug", "Summary tab", "Documents tab with index", "Commands tab", "Not-found project state"], "2026-06-17T06:00:00Z", 22),
  F(5, "work-orders", "Work orders", ["Work-order discovery", "Kanban by state", "Work-order detail tabs", "Full document view"], "2026-06-18T02:00:00Z", 24),
  F(6, "party", "Party", ["Party scene layout", "Agent tokens by station", "Live event mapping", "Relay animation", "Idle and empty states", "Reduced-motion variant", "Party legend"], "2026-06-18T05:00:00Z", 20),
  F(7, "configuration", "Configuration", ["Skills catalog", "Agents catalog", "Decision rules list", "Standards with facets"], "2026-06-19T02:00:00Z", 26),
  F(8, "documentation", "Documentation", ["Manual reader", "Manual search"], "2026-06-19T05:00:00Z", 30),
  F(9, "gamification", "Gamification", ["Guild level from outcomes", "Rank catalogue", "Ledger snapshot", "Level-up celebration", "XP bar", "Durable outcome merge"], "2026-06-19T07:00:00Z", 20),
  F(10, "achievements-hall", "Achievements hall", ["Trophy catalogue", "Secret achievements", "Mission chains", "Seals by axis", "Stats panel", "Radar of guild attributes", "Weekly flow chart", "Funnel and flow", "Phase transitions list", "Informe verdict"], "2026-06-20T01:00:00Z", 16),
  F(11, "build-modes", "Build modes", ["Build mode catalogue", "Mode switch with memory"], "2026-06-20T06:00:00Z", 25),
  F(12, "observability-dataviz", "Observability and dataviz", ["Build timeline reader", "Timeline bars", "Dependency graph layout", "Graph focus and trace", "Per-FRD progress rows", "Freshness badge"], "2026-06-21T01:00:00Z", 22),
  F(13, "visual-system-accessibility", "Visual system and accessibility", ["Design token registry", "Light and dark themes", "Focus ring and skip link", "Dialog focus trap", "Tab strip with arrows", "Touch target floor", "Reduced motion", "Contrast audit fixes", "Responsive shell"], "2026-06-21T05:00:00Z", 18),
  F(14, "snapshot-and-feedback", "Snapshot and feedback", ["Snapshot export", "Feedback channel links", "Copy command buttons", "Toast notices"], "2026-06-24T02:00:00Z", 30),
  F(15, "plugin-out-of-sync-warning", "Plugin out-of-sync warning", ["Installed version reader", "Source version reader", "Drift banner", "Update command copy"], "2026-06-26T02:00:00Z", 28, { drift: "REQ-15-001" }),
  F(16, "orphan-project-detection", "Orphan project detection", ["Sibling folder scan", "Orphan classification", "Orphan list view", "Adopt command hint"], "2026-06-30T02:00:00Z", 26),
  F(17, "proposals-inbox", "Proposals inbox", ["Lesson reader", "Promotion queue", "Prune list", "Memory health", "Self-suggestions", "Backlog reader", "Proposals summary"], "2026-07-01T02:00:00Z", 24),
  F(18, "dashboard", "Dashboard", ["Home dashboard cards"], "2026-06-22T03:00:00Z", 30),
  F(19, "app-shell", "App shell", ["Global shell with sidebar"], "2026-06-22T05:00:00Z", 30),
  F(20, "overlay-freshness", "Overlay freshness", ["Factory overlay version reader", "Upgrade notice on the summary"], "2026-07-07T02:00:00Z", 30),
  F(21, "pending-merge", "Pending merge", ["Unmerged branch reader", "Pending work indicator"], "2026-09-24T02:00:00Z", 30),
  F(22, "factory-backlog", "Factory backlog", [], null, 30, { review: null }),
  F(23, "materialized-stats-read-model", "Materialized stats read model", ["Stats schema", "Per-project portada writer", "Freshness seal", "Aggregate index", "Factory-wide store", "Composed Informe reader"], "2026-07-07T05:00:00Z", 22),
  F(24, "decision-id-emitter", "Decision id emitter", ["Stable decision ids", "Decide command with ids"], "2026-09-03T17:00:00Z", 30),
  F(25, "persistent-navigation", "Persistent navigation", [], null, 30, { review: null }),
  F(26, "services-accounts", "Services and accounts", [], null, 30, { review: null }),
];

// FRD-03 carries a gate-drift list (the "Verificado · N derivas" badge); FRD-15's drift is a bare
// scalar, not a list, so the reader fails loud ("Deriva ilegible").
// Cross-FRD seams: most features read through the FRD-01 readers.
for (const f of frds) {
  if (f.n === 1 || !f.wos.length) continue;
  const first = f.wos[0];
  first.deps = [...first.deps, `WO-01-${String(((f.n * 3) % 10) + 1).padStart(3, "0")}`];
}

const changes = [
  ["board-search-diacritics", "change", "ready", "2026-10-18", "frd-02-ideas-board", "Buscar ideas sin importar las tildes", "Buscar \"diseno\" no encuentra la idea que dice \"diseño\"."],
  ["timeline-gap-label", "bug", "ready", "2026-10-17", "frd-12-observability-dataviz", "La línea de tiempo no marca los días sin actividad", "Dos semanas sin build se ven pegadas como si fueran seguidas."],
  ["rail-sort-ties", "bug", "ready", "2026-10-15", "frd-03-portfolio", "Proyectos con la misma fecha cambian de orden al recargar", "El orden de la barra lateral salta entre dos proyectos."],
  ["manual-deep-links", "feature", "done", "2026-09-20", "frd-08-documentation", "Enlaces directos a secciones del manual", "No se puede compartir un enlace a una sección concreta."],
  ["dag-cross-frd-links", "feature", "done", "2026-09-18", "frd-12-observability-dataviz", "Mostrar las dependencias entre FRDs en el grafo", "El grafo solo dibuja dependencias dentro de cada FRD."],
  ["skills-copy-command", "feature", "done", "2026-09-12", "frd-07-configuration", "Copiar el comando de cada skill", "Hay que escribir el comando a mano."],
  ["proposals-summary-tab", "feature", "done", "2026-09-05", "frd-17-proposals-inbox", "Pestaña de resumen en propuestas", "No hay un lugar que diga qué necesita al dueño."],
  ["trophy-category-filter", "feature", "done", "2026-08-28", "frd-10-achievements-hall", "Filtrar trofeos por categoría", "La lista de trofeos es larga y no se puede filtrar."],
  ["work-order-dependency-chips", "feature", "done", "2026-08-20", "frd-05-work-orders", "Dependencias navegables en la orden", "Las dependencias son texto plano."],
  ["portfolio-list-view", "feature", "done", "2026-08-11", "frd-03-portfolio", "Vista de lista en el portafolio", "Las tarjetas ocupan mucho cuando hay varios proyectos."],
  ["env-group-folds", "feature", "done", "2026-08-02", "frd-04-project-workspace", "Agrupar las variables de entorno", "Las listas de variables largas cuestan de leer."],
  ["sidebar-collapse-memory", "change", "done", "2026-09-22", "frd-19-app-shell", "Recordar la barra lateral plegada", "Al recargar la barra vuelve a abrirse."],
  ["board-hide-empty", "change", "done", "2026-09-21", "frd-02-ideas-board", "Ocultar columnas vacías del tablero", "Las columnas vacías empujan las demás fuera de la vista."],
  ["summary-verdict-line", "change", "done", "2026-09-19", "frd-04-project-workspace", "Veredicto de una línea en el resumen", "El resumen no dice en qué estado está el proyecto."],
  ["decision-detail-modal", "change", "done", "2026-09-16", "frd-18-dashboard", "Abrir la historia completa de una decisión", "La decisión se ve recortada en la tarjeta."],
  ["stats-no-data-label", "change", "done", "2026-09-14", "frd-10-achievements-hall", "Marcar \"sin datos aún\" en lugar de cero", "Un cero sin datos se confunde con un cero medido."],
  ["account-table-cards", "change", "done", "2026-09-10", "frd-26-services-accounts", "Tabla de cuentas como tarjetas en el teléfono", "La tabla se desborda en pantallas chicas."],
  ["kanban-show-more", "change", "done", "2026-09-08", "frd-05-work-orders", "Mostrar más órdenes verificadas bajo demanda", "La columna de verificadas es interminable."],
  ["manual-tutorial-steps", "change", "done", "2026-09-02", "frd-08-documentation", "Pasos numerados en el tutorial", "El tutorial no indica cuántos pasos faltan."],
  ["graph-phone-list", "change", "done", "2026-08-30", "frd-12-observability-dataviz", "El grafo se vuelve lista en el teléfono", "El grafo es inutilizable en 375 px."],
  ["rule-search-box", "change", "done", "2026-08-25", "frd-07-configuration", "Buscar en las reglas de decisión", "Hay más de cien reglas y ningún buscador."],
  ["tabs-overflow-arrows", "change", "done", "2026-08-18", "frd-13-visual-system-accessibility", "Flechas cuando las pestañas no caben", "Las últimas pestañas quedan escondidas."],
  ["upgrade-notice-copy", "change", "done", "2026-08-14", "frd-20-overlay-freshness", "Explicar mejor el aviso de actualización", "El aviso usa jerga interna."],
  ["discard-confirm-copy", "bug", "done", "2026-09-24", "frd-02-ideas-board", "El diálogo de descarte no devuelve el foco", "Al cerrar con Escape el foco se pierde."],
  ["ring-tooltip-keyboard", "bug", "done", "2026-09-17", "frd-03-portfolio", "El anillo de avance no explica nada con teclado", "El texto de ayuda solo aparece con el ratón."],
  ["timeline-timezone", "bug", "done", "2026-09-09", "frd-12-observability-dataviz", "Las fechas de la línea de tiempo salen un día antes", "Las fechas sin hora se interpretan en otra zona."],
  ["manual-search-accents", "bug", "done", "2026-08-27", "frd-08-documentation", "La búsqueda del manual ignora las tildes mal", "Buscar \"código\" no encuentra \"codigo\"."],
  ["trophy-date-format", "bug", "done", "2026-08-19", "frd-10-achievements-hall", "Fechas de trofeos en formato técnico", "Los trofeos muestran la fecha en formato ISO."],
  ["dark-chart-contrast", "change", "done", "2026-08-08", "frd-13-visual-system-accessibility", "Contraste de los gráficos en tema oscuro", "Las barras se pierden sobre el fondo oscuro."],
].map(([id, type, status, date, frd, title, what], k) => ({ id, type, status, date, frd, title, what, sha: status === "done" ? (0x1a2b3c4d + k * 7919).toString(16).slice(0, 8) : "" }));

const progress = [
  "**FRD-23 Read-model de estadísticas verificado** — el informe deja de recalcular todo en cada visita; queda un índice agregado y un respaldo honesto cuando falta.",
  "**FRD-24 Ids de decisiones verificado** — cada decisión tiene un id estable y el comando decide lo usa.",
  "**FRD-21 Trabajo pendiente verificado** — Mission Control muestra las ramas sin integrar por repositorio.",
  "**WO-02-014 construida** — el marcador de columna vacía es accesible; espera el gate de FRD-02.",
  "Gate completo en verde tras integrar el canario de paralelismo.",
  "Snapshot visual del tablero bendecido tras el cambio de columnas vacías.",
  "Se registró una lección sobre comparar fechas como texto.",
  "Cola de cambios: 3 listos para el próximo build.",
  "Build cerrado: 109 de 110 work orders verificadas.",
];

export const missionControl = {
  id: "mission-control",
  srcRoot: "src",
  plannedOn: "2026-06-15",
  frds,
  status: `# Machine-readable status for Mission Control (the factory dashboard).
project: "Pandacorp"
phase: implementation
version: v1
overlay_version: "8.100.0"
created_with: "6.0.0"
target_platforms: desktop
deploy_target: internal
running: false
run_started_at: "2026-09-25T01:00:00.000Z"
updated_at: "2026-10-13T07:00:00.000Z"
repo: ""
last_green_sha: "5c594bde"
safe_to_test: true
rethink_pending: false
advance_pending: false
last_harvest: "2026-10-20T00:00:00Z"
`,
  progress,
  changes,
  // An internal tool with no external services: the file exists and declares none, so the
  // directory reads it as an explicit empty project rather than a missing registry.
  services: { schema_version: 1, project_id: "mission-control", resource_slug: "mission-control", services: {} },
  adrs: [
    { n: 1, slug: "stack", date: "2026-06-15", title: "Stack: Next.js reading local files", context: "The dashboard only reads files that the factory and its projects already write.", decision: "A local Next.js app with Server Components reading the factory root; no database, no network calls." },
    { n: 2, slug: "restore-second-write", date: "2026-06-19", title: "Restoring a discarded idea is the second allowed write", context: "Discard already writes the idea's frontmatter.", decision: "Allow restore as the symmetrical, human-triggered write on the same field." },
    { n: 3, slug: "favorite-write", date: "2026-06-20", title: "Favourite flag as a bounded write", context: "The owner wants to pin ideas on the board.", decision: "Write a boolean `favorite` on the idea card only, from one explicit action." },
    { n: 4, slug: "materialized-stats-read-model", date: "2026-07-06", title: "Materialized stats read model", context: "The Informe recomputed git history on every render.", decision: "Write a per-project portada and a factory-wide store, each sealed and re-derived when stale." },
    { n: 5, slug: "services-account-directory", date: "2026-10-12", title: "Services and accounts directory", context: "Projects need to show which service and account each part runs on.", decision: "Join a public provider catalog, a private accounts file and per-project allocations; never read credentials." },
  ],
  docs: {
    "docs/product/prd.md": `# PRD — Mission Control

A local, read-only dashboard for the factory: the ideas board, the portfolio, each project's workspace, the guild and the factory's own configuration. It never calls an AI model and only writes a few human-triggered fields on idea cards.`,
    "docs/product/architecture.md": `# Platform architecture — Mission Control

Next.js Server Components read the factory root (one level up, or \`PANDACORP_FACTORY_ROOT\`). Every reader returns a typed result. The data model is explicitly none ([data-model.json](data-model.json)).`,
    "docs/decision-log.md": `# Decision log — Mission Control

- **2026-10-12** — Services and accounts directory (ADR-0005).
- **2026-09-25** — Parallel canary merged; WO-02-014 waits for its FRD gate.
- **2026-07-06** — Materialized stats read model (ADR-0004).`,
    "DESIGN.md": `# Design — Mission Control

Dark by default, a gamified control room: phases have one colour each, cards carry their state as text and icon, and every screen works with the keyboard.`,
    "docs/design/components.md": `# Component inventory — Mission Control

| Component | Notes |
|---|---|
| IdeaCard | title, category, score, favourite |
| ProjectRail | phase and progress ring |
| StateChip | icon + label |
| CommandCopy | copyable command |`,
    "docs/analytics/events.md": `# Event plan — Mission Control

Internal tool: no product analytics. The live panels read the factory event stream.`,
    "docs/reviews/security-2026-07-06.md": `# Security review — 2026-07-06

No critical or high findings. The app binds to localhost and writes only the bounded idea-card fields.`,
    "docs/rules/README.md": `# Engineering rules for this project

Read every file listed here before writing or changing code. Managed by Pandacorp.`,
  },
  model: NO_DATABASE,
};
