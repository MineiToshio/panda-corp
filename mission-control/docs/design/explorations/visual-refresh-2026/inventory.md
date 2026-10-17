# Source inventory and functional preservation matrix

**Purpose:** constrain a visual-only redesign. Existing behavior wins if an abbreviated demonstration omits a detail. This inventory is based on source read and live observations in this session; it is not a pass receipt for the existing product.

## Eight page families

| Family | Current implementation home | Preserve |
|---|---|---|
| Inicio `/` | `src/app/page.tsx`, `src/components/dashboard/`, `modules/Digest`, `modules/Pulso` | Conditional onboarding/plugin warnings; digest/count/mark-seen; real human-gate queue; pulse/conversion; cartera/project commands and feedback; factory worktrees; XP/progress/milestones |
| Tablero `/board/**` | `src/app/board/_components/BoardShell/`, `IdeaBoardView/`, `CardDetail/`, `src/components/modules/IdeaCard/` | Six read-only phase columns, source-derived position, search title/body, category/reset, score, return/project type, recommended/building, favorite, capture, discarded list, selected idea and all detail sections |
| Portfolio `/portfolio/**` | `src/app/portfolio/page.tsx`, `PortfolioLayout.tsx`, `WorkspaceSlot.tsx`, `src/components/modules/ProjectRail/` | Real project selection, status/version/freshness/feedback, collapsible rail and preference, embedded shared workspace, graceful empty/missing state |
| Direct project `/projects/[slug]/**` | `src/app/projects/[slug]/ProjectWorkspace.tsx`, `workspace-route.ts`, `_components/` | Same nine-section workspace and content as embedded context; meaningful back navigation; correct heading level/context |
| Propuestas `/proposals/**` | `src/app/proposals/page.tsx`, `_components/ProposalsTabs/`, `BacklogPanel/`, `DismissableProposalStream/` | Memoria/Backlog split, honest counts/health, full proposal detail, existing commands/dismiss/discard/history/error states |
| Logros `/achievements/**` | `src/app/achievements/_components/HallTabs.tsx`, achievement module folders | Five sections, guild identity, XP/ranks, mission/saga chains, uniques/secrets/seals/rarity, category filters, progress, operational report/statistics/records/ledger |
| Configuración `/configuration/**` | `src/app/configuration/ConfigurationShell.tsx`, `SectionTabs.tsx`, sections and detail readers | Habilidades/Agentes/Reglas de decisión/Estándares; complete source definitions, flow/role/model/XP, related skill links, approval distinctions and creation-command affordances |
| Documentación `/manual/**` | `src/app/manual/ManualShell.tsx`, `DocNav.tsx`, `DocReader.tsx`, `_components/`, `src/lib/manual/` | All authored/catalog groups, references, diagrams, copy commands, safe links, history, selected item/anchors |

## Board detail and bounded writes

| Existing surface/action | Preservation constraint | Visual proposal |
|---|---|---|
| Propuesta | Preserve complete pitch, evidence, feasibility, risks, source links and business context | Clear section headings and readable flow; no new scoring |
| Spec | Conditional on published digest; preserve full PRD/research/FRD view and real count | Structured overview with complete expandable content |
| Arquitectura | Shared ArchitectureDigest and model, not a second implementation | Same visual content/components as project architecture |
| Documentos | Full tree, summary entry and lazy actual markdown reads | Responsive index/reader |
| Campaña | Real phase mapping, six stage details/checklists, contextual next commands/build modes | Refined journey; keep status facts intact |
| Favorite | Existing bounded flag write, any applicable card context | Small labelled toggle, no change to persistence |
| Discard/restore | Existing eligible status changes, reason, confirmation, restore semantics | Predictable dialog hierarchy; never one-click destructive redesign |
| Capture dialog | Four current copyable workflow commands; no app-side agent execution | Refined action list |
| Search/filter/reset | Existing scope and URL semantics, not a new global search | Stacked phone filters; preserve clear/reset |

Observed source: `BoardShell.tsx` passes discard/restore/favorite/readDoc actions; `CardDetail.tsx` defines Propuesta/Spec/Arquitectura/Documentos/Campaña with stage-dependent visibility/defaults. `IdeaBoardView.tsx` actually defines six columns; its older introductory comment mentioning seven is not treated as runtime truth.

## Nine project sections

| Section | Current implementation | Preserve through redesign |
|---|---|---|
| Resumen | `_components/tab-summary/`, `snapshot-panel/`, `workspace-header.tsx`, `objectives-bar.tsx` | Full summary/key points, deployed target/URL, phase/version, objective count, overlay warning, verified snapshot vs building now, worktree command, decisions, pending merges and activity |
| Spec | `_components/tab-spec.tsx`; shared `CardDetail/SpecDigest/` | Complete digest, live FRD count, document links, pending state, original project context |
| Work orders | `_components/tab-work-orders/`, `wo-board/`, `wo-frd-filter/`, `wo-state-filter/`, `wo-detail/` | FRD grouping/filter, exact four-state mapping, all orders, selected WO/detail tabs, document/notes, URL, live refresh; page vertical scroll rather than nested column scroll |
| Arquitectura | Shared `CardDetail/ArchitectureDigest/`, `src/components/modules/DataModelViewer/`, `GraphControls/` | Complete stack, integration flows/operations, model plus env/ADRs/plan; authored distinctions and actual sources |
| Cambios | `_components/tab-changes/`, `_actions/discard-change.ts` | Ready/draft/building/closing groups, done/discarded toggles, ordering, parser errors, full detail and existing targeted command/discard confirmation |
| Party | `_party/PartyTab/`, `FraguaScene/`, `CampaignStrip/`, `EventFeed/`, `DeepRelay/`, scene engine/view model | Project isolation, actual WO structure, zones/sprites, queue/vault/archive, gates/judge/reviewer, deep relay, tents, liveness/freshness/off-state, actual elapsed time, bitácora, honest mode display; no pause/reset/agent controls |
| Observabilidad | `_observability/ObservabilidadTab/`, `TimelineView/`, `WoDag/` | Timeline/DAG switch, durable actual time scale, current selected WO/dependency tracing, legends, fit/pan/zoom/reset/expand, live update, missing track states |
| Documentos | `_components/tab-documents/`, `document-links.ts`, shared Markdown | Full document tree/content, selected doc URL, markdown/table/code, safe scoped resolution and history |
| Comandos | `_components/tab-commands/`, `mode-selector/`, `src/lib/command-modes.ts`, mode store | Canonical mode labels/flags, per-project memory, stage-aware commands, FRD/change target inputs, copy feedback; never execute |

## Model and graph contract

The logical model's canonical artifact/reader, ELK worker/layout, relationship routing and camera are not candidates for replacement by a prettier static diagram. Preserve:

- Designed / explicitly no-persistence / missing / invalid distinctions; no implication that the model is a queried operational database.
- Entities, attributes, full names, data types, primary/foreign/unique keys, optionality, both relationship endpoint cardinalities and source explanations.
- Diagram default at every width; Esquema initially collapsed with one entity open.
- Search, selection, repeat-click clearing and existing selection styling, keyboard alternatives, nonselectable diagram labels/copyable schema.
- GraphControls top-right treatment; native browser fullscreen plus fallback; zoom/pan/fit/reset and actual-opener focus restoration.
- Host-width content within the 1240 px outer frame; prose width limits do not restrict structured model tables.
- DAG dependencies, selected edge trace hues, work-order detail links and status semantics.

## Five achievement sections

| Section | Preserve |
|---|---|
| Resumen | Guild rank/name/crest, actual level/XP/threshold, Party/summary values, recent trophies, almost-there progress |
| Misiones | Saga ordering, chain stages, progress, unlock criteria, completed/locked states and detail |
| Trofeos | Uniques, secrets, seals where currently displayed, rarity, category filtering, conditions and dates; reveal by keyboard/touch |
| Estadísticas | Executive pulse; six operational bands (time, use, funnel/flow, health and next actions); radar attributes; records; raw ledger; source/freshness/error/unwired states |
| Rangos | Full rank ladder, acts, level ranges, XP thresholds, attained/current/locked status, existing rank art |

Current source: `HallTabs.tsx` has five actual tabs, including Rangos; its legacy comment referring to four must not cause an omission. `Informe/Informe.tsx` describes the six report bands and explicit unwired/error contract. These features must survive even though the exploratory preview simplifies the report.

## Proposals and configuration detail

Memory retains health, notes, candidate lessons, promotions, pruning, self-suggestions, source/evidence/IDs, group versus per-item commands, per-card local dismissal and the existing ver-más threshold. Backlog retains open/doing ordering, done/discarded history, parsing warnings, full markdown, copyable targeted/general commands and eligible discard.

Configuration retains scope grouping of skills, the skill workflow diagram, linked agents, agent model/tier/XP/level and reverse links, decision-rule default/domain/auto versus human status and related commands, standard definitions and detail navigation. The design may truncate a presentation summary only if the complete authoritative text remains accessible in detail.

## Cross-cutting preservation and future acceptance ledger

| Concern | Future acceptance evidence |
|---|---|
| URLs | Every currently addressable project/tab/document/WO/dialog/view/filter reopens with refresh/back/forward; immutable identities, aliases and case-sensitive document/ID rules remain intact |
| Data truth | Same readers/resolvers/counts; no alternative producer, duplicate state or invented health/live signals |
| Unknown/error states | Missing, malformed, valid-empty, stale, unwired and not-found retain distinct messages; no false zero or false green |
| Existing writes | Same bounded eligibility, persistence, confirmation/reason/error/success behavior for idea flags/status and existing backlog/change discard; no new writes |
| Clipboard | Same canonical commands and mode flags; success/error feedback; no command execution |
| Live refresh | Correct project isolation; selected tab/document/scroll/camera preserved; actual phase/running/freshness kept distinct |
| Keyboard | All navigation/actions reachable; visible focus; active item discoverable; dialog Escape/trap/return; no focus obscured by chrome |
| Touch | Every current hover-reveal has a touch path; graph alternatives; ordinary controls target 44 px; phone retains all actions |
| Responsive | Test 320/375/390/768/1024/1280/1440 and zoom; no page overflow; 2D canvases contain their own overflow; long actual names and populated data |
| Themes | Complete dark/light states, semantic contrast, stable category/rarity/trace meaning; preserve user/system appearance choices |
| Motion | Respect reduced-motion; restrained transforms; no endless ambient dashboard animation |
| Scope | No public deployment/auth/team system, new command runner, global search, extra analytics, data migration or gamification mechanic |

## Evidence scope

`live-audit.json` contains 21 base-route observations. `nested-audit.json` contains 52 nested/direct observations, including selected-tab receipts after waiting for `aria-selected=true`; four dark screenshots supplement the base set. Some observations intentionally repeat defaults and are not distinct features. Screenshots document the running state, not every possible state. The model/diagram fallback, destructive-write success/failure, real live build and real-device interaction are preserved by the source inventory but not fully exercised in this proposal audit.
