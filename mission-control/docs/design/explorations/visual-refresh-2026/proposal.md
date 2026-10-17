# Mission Control visual refresh — Órbita

**Status: PROPOSED. Owner review, 2026-10-17.** This is a design study, not a new accepted design contract, implemented behavior, a frozen prototype or an instruction to start a build. The existing `DESIGN.md`, PRD/FRDs, runtime, routes and project/build state remain authoritative.

## Recommendation

Recompose Mission Control as a contemporary, calm operations workspace with a distinctive guild identity. Put the operator's next decision first, expose progress without a wall of equally important cards, and give each content type a suitable presentation. Use restrained lilac on graphite/porcelain, Manrope headings with Inter body text, lightweight surfaces and deliberate spacing. Preserve sprites, campaign, achievements, ranks, rarity, XP, all read surfaces and every existing action.

The owner's current instruction explicitly authorizes exploration beyond the historical global RPG finish: color, fonts, placement and composition may change; functionality may not. This does not establish that the owner has approved Órbita or withdrawn the gamification itself. The product keeps its name and existing brand mark. Órbita is the working name of the proposed visual direction.

## Deliverables and boundaries

- [Open the navigable review](preview.html): desktop/tablet/phone preview controls, direct screen selection and light/dark comparison. The preview embeds the same study below; it is review-only chrome, not a new product feature.
- [Navigable design study](index.html): all main destinations, all real idea cards, the nine project sections, light/dark preview and three heading treatments. Round 3 populates the project and document flows from a private, timestamped read-only snapshot; ancillary guild/configuration/proposals examples retain illustrative layouts. None of the captured information is presented as a continuously live feed.
- [Source and preservation inventory](inventory.md): implementation touchpoints and the complete functional preservation matrix.
- [Live evidence](evidence/): page captures and JSON observations of the running app at port 1987. Personal content is kept local through the exploration's evidence ignore file.
- [Prototype verification](verification.md): measured viewport, accessibility and interaction checks, with their limits.

Round 3 includes the full captured project documents, work orders, Spec blocks, architecture artifacts, changes and Manual pages. Scene artwork, ancillary guild/catalog examples and graph geometry remain design demonstrations. Its dialogs never modify factory files. It is deliberately not a production replica or a complete state oracle. The comprehensive preservation inventory, rather than the abbreviated examples, defines what a subsequent design pass must draw and retain. No feature is implicitly removed because its full state is not drawn here.

## Round 3 — real project journeys

The owner likes the visual direction and requests a more complete iteration before judging the final result. Both Board detail and Portfolio now consume one shared project presentation for Spec, Architecture and Documents. A searchable project dialog shows all five projects with phase, FRD/document counts and actual work-order progress. The static local capture contains 22 ideas, 718 full documents, 170 work orders, 52 FRDs, 23 ADRs, 43 changes and 38 Manual pages. PandaSaga supplies a real 39-entity/95-relationship model; absent source artifacts remain explicit. Review uses the same stable `preview.html` URL, initially opening PandaSaga Architecture.

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

No automatic phase advancement, queue drain, scope expansion, public publication, external communication or production change is part of this study.
