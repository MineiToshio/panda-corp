# Context pack · FRD-07 · Configuration

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-07 copy, S2.1 builds, S2.2 amendments, S2.3-07 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-07-configuration/frd.md` (id FRD-07, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 12 under `states["frd-07-configuration"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 12 AC lines: 5 drawn · 7 partially drawn · 0 not drawn · 0 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-07#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### FRD-07#U1 · drawn · `config-hub`, `config-skills`, `config-agents`, `config-rules`, `config-standards`

> - Configuration SHALL offer sections: **Skills · Agents · Decision rules · Standards**.

**Prototype:** Tabs Resumen (extra hub) · Habilidades 27 · Agentes 16 · Reglas de decisión 48 · Estándares 17, each tab with its count.

### FRD-07#U2 · drawn · `config-skills`, `config-agents`, `config-rules`, `config-standards`

> - EACH section SHALL list its items with a name and a real **description** of what each one does.

**Prototype:** Every item shows a name and a one-sentence description (the description keeps its source language, English). Search field per tab, plus one global search in the hub (config-hub-search).

### FRD-07#U3 · partial · `config-skill-dialog`, `config-agent-dialog`, `config-standard-dialog`, `config-rule-detail`

> - WHEN the owner clicks an item, it SHALL show its **detail** (reading the content / explanation).

**Prototype:** Skills, agents and standards open a dialog; decision rules open an inline accordion row (the FRD says "show its detail"; the owner rule is modal for reveal-more, which rules do not follow).

### FRD-07#U4 · drawn · `config-hub`, `config-skills`, `config-skill-dialog`

> - WHERE a command (skill) is shown, the `/pandacorp:<slug>` chip SHALL offer a **copy-to-clipboard** action; the copy only writes the command string to the clipboard (the app never runs it or calls Claude).

**Prototype:** "Tus comandos" lists 20 copyable commands (click the command to copy); rows in Habilidades end in a "copiar" button; the dialog repeats the command with a copy icon (aria-label "Copiar /pandacorp:architecture"). The app never runs it.

### FRD-07#U5 · drawn · `config-skills`

> - The **Skills** section SHALL be **grouped by run-location**: the skills that run in the **factory** vs the skills that run **inside a project**, each group shown under its own heading with a count.

**Prototype:** Groups "Dentro de un proyecto 14" ("Se corren en la carpeta del proyecto."), "En la fábrica 7" ("Se corren en la carpeta de panda-corp."), "Otras 6", each with its count chip; plus filter chips Todas 27 · Comandos tuyos 20 · Motores internos 7.

### FRD-07#U6 · partial · `config-skills`, `config-skill-dialog`

> - A skill that is **internal** (normally invoked by another skill, not run directly by the owner) SHALL carry an **"interno" flag** on its card and in its detail header.

**Prototype:** The row flag reads "Motor interno" (plain chip). The detail header chip reads "Comando del owner" for owner commands (the captured dialog is an owner command); the internal chip in the dialog header is drawn by the same code but not captured.

### FRD-07#U7 · partial · `config-skill-dialog`

> - The detail of a **skill** SHALL show what it is for, where it runs (factory/project), what it produces, and a high-level **mini-flow** (chips with the agents it uses, colored per agent, with arrows) — the "graph of how the skill works".

**Prototype:** Detail shows the scope chip (raw "project"/"factory"), the owner/internal chip, the description, "Agentes:" chips, the command and a disclosure "Definición completa" (SKILL.md as markdown). A mini-flow with arrows and "what it produces" are NOT drawn (the skill workflow diagram stays out of v2).

### FRD-07#U8 · drawn · `config-skill-dialog`, `config-agent-dialog`

> - The Skills and Agents sections SHALL support **cross-navigation**: from a skill's detail the owner SHALL be able to jump to any agent it uses, and from an agent's detail to any skill that uses it (clicking the linked chip opens the other item's detail).

**Prototype:** Skill dialog lists "Agentes:" as buttons that open the agent; the agent dialog lists "Lo usan:" skills that open the skill.

### FRD-07#U9 · partial · `config-rules`, `config-rules-search`, `config-rule-detail`

> - The **Decision rules** section SHALL explain what a decision rule IS, show ALL the DRs with an **auto-approves (●) / asks you (●)** indicator, their detail (pre-approved default), and a **"New decision rule"** button that copies `/pandacorp:learn`.

**Prototype:** All 48 rules with id, title, domain chip and an Auto (green) / Owner (amber) chip, filter chips Todas 48 · Automáticas 35 · Requieren al owner 13, search, 30 rows at a time ("Mostrar 18 más · quedan 18"), accordion detail with the default text. The explanation of what a decision rule IS and the "New decision rule" button (copies /pandacorp:learn) are NOT drawn (creation affordances stay out of v2).

### FRD-07#U10 · partial · `config-standards`, `config-standards-must`, `config-standard-dialog`

> - The **Standards** section SHALL be **categorized by domain** (Programming, Architecture, Design, Technology, Quality, Security, Operation, Data/Privacy, Product/Docs), with **severity** badges (MUST/SHOULD/MAY) and **enforcement** (lint/CI/checklist/human gate); each standard with two views, **Summary** (real key points) and **Detail** (markdown), and a **"New standard"** button that copies `/pandacorp:learn`.

**Prototype:** List ordered MUST first with a severity chip (Obligatorio / Recomendado; MAY does not appear), enforcement under the title ("api-design.md · lint/CI"), a domain select (Calidad, Datos y privacidad, Otros, Producto y docs, Programación, Seguridad) and severity facets Todos 17 · Obligatorios 4 · Recomendados 13. The nine FRD domains are not used (12 of 17 fall in "Otros"). Summary vs Detail views and the "New standard" button are NOT drawn.

### FRD-07#U11 · partial · `config-agents`

> - The **Agents** section SHALL show, per agent: a **pixel-art avatar** (Final Fantasy style), its **level**, its **title** (Apprentice → Engineer → Senior → Architect) and a **model chip** (`opus` / `sonnet`) indicating which model the agent runs on.

**Prototype:** Agents grouped by model tier (Opus 5 · Sonnet 10 · Modelo heredado 1) as cards with name, "esfuerzo high" and a one-line description. Sprite where the agent has one, else initials in a tinted square (not pixel-art for all). Level and title (Apprentice → Engineer → Senior → Architect) are NOT drawn.

### FRD-07#U12 · partial · `config-agent-dialog`

> - WHEN an agent's detail is opened, it SHALL show an **XP bar to the next level**, the explanation that it **levels up by completing work orders** (each closed work order adds XP), and an explanation of its **model assignment** — why it uses `opus` (judgment work: architecture, review, specs — the most capable model) or `sonnet` (mechanical, verifiable work: implementation, search — cheaper and faster).

**Prototype:** Dialog shows model chip, effort chip, description, "Herramientas:", "Lo usan:" and "Definición completa". XP bar, "levels up by completing work orders" and the per-agent model explanation are NOT in the dialog; the tier explanation sits in each group header ("Juicio y diseño: decisiones difíciles, revisión y arquitectura." / "El caballo de batalla: construir, documentar, investigar.").

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `config-hub` | `#configuracion` | (none) | full page | `FRD-07#U1` `FRD-07#U4` |
| `config-hub-search` | `#configuracion` | fill `#cfg-search` = "review" | full page | — |
| `config-skills` | `#configuracion?tab=Habilidades` | (none) | full page | `FRD-07#U1` `FRD-07#U2` `FRD-07#U4` `FRD-07#U5` `FRD-07#U6` |
| `config-skill-dialog` | `#configuracion?tab=Habilidades` | click `[data-skill]` → wait for `dialog[open]` | capture viewport; widths 375/1280 | `FRD-07#U3` `FRD-07#U4` `FRD-07#U6` `FRD-07#U7` `FRD-07#U8` |
| `config-agents` | `#configuracion?tab=Agentes` | (none) | full page | `FRD-07#U1` `FRD-07#U2` `FRD-07#U11` |
| `config-agent-dialog` | `#configuracion?tab=Agentes` | click `[data-agent]` → wait for `dialog[open]` | capture viewport; widths 375/1280 | `FRD-07#U3` `FRD-07#U8` `FRD-07#U12` |
| `config-rules` | `#configuracion?tab=Reglas+de+decisi%C3%B3n` | (none) | full page | `FRD-07#U1` `FRD-07#U2` `FRD-07#U9` |
| `config-rules-search` | `#configuracion?tab=Reglas+de+decisi%C3%B3n` | fill `#rule-search` = "dependency" | full page | `FRD-07#U9` |
| `config-rule-detail` | `#configuracion?tab=Reglas+de+decisi%C3%B3n` | click `#rule-list details summary` | full page | `FRD-07#U3` `FRD-07#U9` |
| `config-standards` | `#configuracion?tab=Est%C3%A1ndares` | (none) | full page | `FRD-07#U1` `FRD-07#U2` `FRD-07#U10` |
| `config-standards-must` | `#configuracion?tab=Est%C3%A1ndares` | click `[data-cfg-sev="MUST"]` | full page | `FRD-07#U10` |
| `config-standard-dialog` | `#configuracion?tab=Est%C3%A1ndares` | click `[data-standard]` → wait for `dialog[open]` | capture viewport; widths 375/1280 | `FRD-07#U3` `FRD-07#U10` |

**Not drawn (0)**: none.

**Partially drawn (7)**: `FRD-07#U3`, `FRD-07#U6`, `FRD-07#U7`, `FRD-07#U9`, `FRD-07#U10`, `FRD-07#U11`, `FRD-07#U12`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): `config-rule-detail`.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### Shared page chrome (listed once, appears in most states of this FRD)

- Captura de la fábrica · 20 oct. 2026, 7:20 p. m.
- Las habilidades, el equipo y las reglas con las que trabaja tu fábrica, leídas de sus archivos.
- Ver secciones anteriores
- Ver más secciones
- Secciones de configuración
- Habilidades 27
- Agentes 16
- Reglas de decisión 48
- Estándares 17

### `config-hub`

- [@aria-label] Buscar en toda la configuración
- [@placeholder] Buscar en habilidades, agentes, reglas y estándares…
- [span] 20 comandos tuyos · 7 motores internos
- [span] 10 sonnet · 5 opus · 1 modelo heredado
- [span] 13 requieren tu OK · 35 automáticas
- [span] 4 obligatorios · 13 recomendados
- [h2] Tus comandos 20
- [p] Las habilidades que corres tú. Clic en el comando para copiarlo; en el nombre de la fila para ver qué hace.
- [@aria-label] Copiar /pandacorp:adopt
- [button] Adopts an EXISTING project that was NOT born from the Pandacorp handoff (a brownfield / external project) i…
- [@aria-label] Copiar /pandacorp:architecture
- [button] Architecture phase of a Pandacorp project - input-readiness preflight, an owner decision round (stack, host…
- [@aria-label] Copiar /pandacorp:change
- [@aria-label] Copiar /pandacorp:decide
- [@aria-label] Copiar /pandacorp:design
- [button] UX/UI design phase of a Pandacorp project - visual research, design system with web fonts, brand and logo (…
- [@aria-label] Copiar /pandacorp:discover
- [@aria-label] Copiar /pandacorp:explore
- [@aria-label] Copiar /pandacorp:implement
- [@aria-label] Copiar /pandacorp:implement-backlog
- [button] Implements factory/backlog/BL-* items — the factory's own actionable defects/changes (plugin, build engine,…
- [@aria-label] Copiar /pandacorp:learn
- [button] Incorporates durable know-how into the Pandacorp factory — an engineering standard, a decision rule, or a n…
- [@aria-label] Copiar /pandacorp:new-idea
- [@aria-label] Copiar /pandacorp:onboarding
- [@aria-label] Copiar /pandacorp:recommend
- [button] Analyzes the Pandacorp ideas base and recommends to the owner which ones to advance, with a justified ranki…
- [@aria-label] Copiar /pandacorp:release
- [button] Performs and executes the release of a Pandacorp project — deploys/launches it (internal OR external), with…
- [@aria-label] Copiar /pandacorp:review-launch
- [button] Closes the post-launch loop of a Pandacorp project — reads the real product metrics (the PostHog event plan…
- [@aria-label] Copiar /pandacorp:spec
- [@aria-label] Copiar /pandacorp:sync
- [button] Reconciles a Pandacorp project's documentation BACKWARDS from changes made directly in the code — the inver…
- [@aria-label] Copiar /pandacorp:sync-portfolio
- [button] Syncs the Pandacorp portfolio - detects cards moved on the ideas kanban (status changes in frontmatter) and…
- [@aria-label] Copiar /pandacorp:upgrade
- [button] Upgrades a Pandacorp project's overlay (the .pandacorp/ integration layer, CLAUDE.md/AGENTS.md imports and …
- [@aria-label] Copiar /pandacorp:worktrees
- [button] Cleans up a repository's git worktrees and leftover branches — the parallel sessions (claude/*, codex/*), r…

### `config-hub-search`

- [h2] Resultados 21
- [strong] DR-013 · implementation of a project (how the work is divided among agents)
- [strong] DR-014 · concurrency and models per subagent (consumption control)
- [strong] DR-015 · ownership of the verification tests (who writes what)
- [strong] DR-016 · mutation testing / property-based testing (when to run them)
- [strong] DR-020 · operation of the construction (how implement runs unattended)
- [strong] DR-022 · port assignment (several projects/worktrees in parallel)
- [strong] DR-023 · test the progress without stopping the construction
- [strong] DR-031 · source of Party events (how Mission Control is fed during the construction)
- [strong] DR-040 · git workflow: branching and pushing to main
- [strong] DR-043 · closing the loop after launch — reading metrics vs the value hypothesis and deciding kill / double-down
- [strong] DR-044 · how changes are made to a Pandacorp product project (free-chat edit vs going through a skill)
- [strong] DR-047 · the factory learns from its own projects — when and how a harvested lesson is stored, applied, or escalated (the self-learning loop)
- [strong] DR-048 · where a project's Pandacorp files live (the .pandacorp/ integration layer) and how a project's overlay is kept current (overlay versioning + auto-upgrade)

### `config-skills`

- [@aria-label] Buscar habilidad…
- [span] 27 habilidades
- [@aria-label] Tipo de habilidad
- [button] Todas 27
- [button] Comandos tuyos 20
- [button] Motores internos 7
- [h2] Dentro de un proyecto 14
- [p] Se corren en la carpeta del proyecto.
- [small] Architecture phase of a Pandacorp project - input-readiness preflight, an owner decision round (stack, host…
- [@aria-label] Copiar /pandacorp:architecture
- [span] Motor interno
- [@aria-label] Copiar /pandacorp:change
- [@aria-label] Copiar /pandacorp:decide
- [small] UX/UI design phase of a Pandacorp project - visual research, design system with web fonts, brand and logo (…
- [@aria-label] Copiar /pandacorp:design
- [@aria-label] Copiar /pandacorp:implement
- [small] Internal engine that integrates a feature or a change into a Pandacorp project at any time (building or shi…
- [small] Internal engine that groups a large batch of changes into a formal milestone (v2, v3…) of a shipped project…
- [small] Performs and executes the release of a Pandacorp project — deploys/launches it (internal OR external), with…
- [@aria-label] Copiar /pandacorp:release
- [small] Closes the post-launch loop of a Pandacorp project — reads the real product metrics (the PostHog event plan…
- [@aria-label] Copiar /pandacorp:review-launch
- [small] Reconciles a Pandacorp project's documentation BACKWARDS from changes made directly in the code — the inver…
- [@aria-label] Copiar /pandacorp:sync
- [small] Upgrades a Pandacorp project's overlay (the .pandacorp/ integration layer, CLAUDE.md/AGENTS.md imports and …
- [@aria-label] Copiar /pandacorp:upgrade
- [h2] En la fábrica 7
- [p] Se corren en la carpeta de panda-corp.
- [small] Studies an external source the owner passes as a URL — a GitHub repo, an article/blog, another agent's skil…
- [small] Implements factory/backlog/BL-* items — the factory's own actionable defects/changes (plugin, build engine,…
- [@aria-label] Copiar /pandacorp:implement-backlog
- [small] Incorporates durable know-how into the Pandacorp factory — an engineering standard, a decision rule, or a n…
- [@aria-label] Copiar /pandacorp:learn
- [@aria-label] Copiar /pandacorp:onboarding
- [@aria-label] Copiar /pandacorp:spec
- [small] Syncs the Pandacorp portfolio - detects cards moved on the ideas kanban (status changes in frontmatter) and…
- [@aria-label] Copiar /pandacorp:sync-portfolio
- [h2] Otras 6
- [small] Adopts an EXISTING project that was NOT born from the Pandacorp handoff (a brownfield / external project) i…
- [@aria-label] Copiar /pandacorp:adopt
- [@aria-label] Copiar /pandacorp:discover
- [@aria-label] Copiar /pandacorp:explore
- [@aria-label] Copiar /pandacorp:new-idea
- [small] Analyzes the Pandacorp ideas base and recommends to the owner which ones to advance, with a justified ranki…
- [@aria-label] Copiar /pandacorp:recommend
- [small] Cleans up a repository's git worktrees and leftover branches — the parallel sessions (claude/*, codex/*), r…
- [@aria-label] Copiar /pandacorp:worktrees

### `config-skill-dialog`

- [dlg p] Skill
- [dlg span] Comando del owner
- [dlg span] Agentes:
- [dlg code] /pandacorp: architecture
- [dlg summary] Definición completa
- [dlg p] Architecture phase. Runs IN the project (requires PRD, FRDs and frozen design). Produces : the technical blueprint (platform + one per FRD) and the work orders ready to build, plus the installed stack and the owner's Spanish digest. The owner decides every owner-visible technical choice in ONE round at the start (DR-131); everything else follows the standards.
- [dlg h2] Team

### `config-agents`

- [@aria-label] Buscar agente…
- [span] 16 agentes (×2 of the same pattern)
- [span] Opus
- [p] Juicio y diseño: decisiones difíciles, revisión y arquitectura.
- [span] Sonnet
- [p] El caballo de batalla: construir, documentar, investigar.
- [span] DR
- [span] esfuerzo medium
- [span] IM
- [span] Modelo heredado
- [p] Usa el modelo de la sesión que lo llama.
- [span] ME
- [b] mech
- [small] Mechanical command runner for the build engine: executes exactly the commands it is given, returns their ou…

### `config-agent-dialog`

- [dlg span] Herramientas:
- [dlg span] Read
- [dlg span] Write
- [dlg span] Edit
- [dlg span] Grep
- [dlg span] Glob
- [dlg span] Lo usan:
- [dlg summary] Definición completa
- [dlg p] You are Pandacorp's architect. You design the MINIMUM that fulfills the FRDs with quality — over-engineering is a defect, not a virtue.
- [dlg li] ( , stable, ONE per project): chosen stack (golden path A/B/C/D and why — see DR-002), high-level architecture (text/mermaid diagram), data model (complete schema), deploy strategy, cross-cutting concerns and service boundaries.
- [dlg li] ( , one per FRD): how THIS feature is implemented on top of the platform — its components and interfaces , API/action contracts and feature-specific external integrations (APIs, limits, costs), each traced to the FRD's . It references rather than re-describing the platform, and its header restates the . Large feature → promote to a folder split by coherent concern (NOT "pillars"). A single global is an anti-pattern — never produce one.
- [dlg code] docs/frds/frd-NN-<slug>/blueprint.md
- [dlg code] CMP-NN-<slug>
- [dlg code] IF-NN-<slug>
- [dlg code] FRD > FDD > design-tokens > blueprint > work order
- [dlg li] : start from the recommended one ( ) at the . It's a suggestion: if for THIS project there's a better technology/library/language, with clear trade-offs. The choice is in the blueprint (DR-002) and recorded as an ADR. The durable conventions ( : structure, quality, patterns) are NOT negotiable.
- [dlg strong] Stack
- [dlg li] ( ): one for each non-obvious decision (cross-feature). Format: context, decision, discarded alternatives, accepted trade-off, agent/model that decided.
- [dlg strong] ADRs
- [dlg code] docs/adr/adr-NNN-<slug>.md
- [dlg li] Design for one-person operation: managed services over self-hosted, Postgres for everything that can use it, no microservices, no Kubernetes, minimal monthly cost (ideally $0 at launch). For external services (storage, email, payments, analytics), account model and secrets, follow (only approved MVP services, provider-specific account/environment reuse and dated preparation evidence; DR-035..038/134).
- [dlg li] Security from the design: where the secrets live (SOPS+age store + the approved three-file environment handoff, see ), what personal data is touched (minimize it), rate limiting on public endpoints.
- [dlg li] Every FRD's must be traceable to blueprint components ( / ) in that FRD's . If an FRD cannot be fulfilled with the design, flag it instead of improvising.
- [dlg li] (per-FRD, at , DR-050):
- [dlg code] docs/frds/frd-NN-<slug>/work-orders/
- [dlg li] break each FRD into a HANDFUL of slices — each a cohesive view / page / capability (e.g. not "registration endpoint that validates email format", but "full auth view: registration + login + session flow"), NOT atomic components. Enough context to build the slice end-to-end, small enough to review on its own (atomic WOs multiply per-slice overhead — a primary cause of slow, expensive builds).
- [dlg li] target ~25–50 min of build / ~1.5–4k LOC per WO; SPLIT above ~4k LOC (rejects escalate superlinearly past it); FOLD a <~20-min slice into a sibling (the FRD gate's fixed ~9-min cost makes it >100% overhead).
- [dlg strong] The Build Plan lives in the FRD's :
- [dlg li] every work order MUST declare (the files/dirs it writes) in its frontmatter, and the Build Plan records each WO's artifacts so the plan is . Design wave-parallel WOs to have non-overlapping — never split one module across sibling WOs that build in the same wave (parallel implementers collide); merge them into one coarse WO or serialize them with a dependency. The engine enforces disjointness from the declared (it serializes any overlap into a later wave), but the plan should be disjoint .
- [dlg li] The API contract is (listed in that backend WO's artifacts), not a single shared .
- [dlg code] docs/api/<wo-id>.md
- [dlg li] ( , DR-047): read FIRST (one line per lesson with its "use when" trigger), open the full lesson files whose trigger matches, then Grep the store by domain/tags for s (prefer what worked, avoid what failed) and for s/ s in this domain. If you choose against a verdict, justify it in the ADR. — the close-out's counts citations and updates / deterministically; NEVER edit those counters by hand (loop v2). The store is the factory's accumulated experience — use it so you don't relearn the same lesson.
- [dlg strong] When a lesson materially informed a choice, CITE its in the ADR/blueprint
- [dlg p] A blueprint with holes produces ambiguous work orders, so an explicit cohesion gate runs — (constitution rule 4: an author grading its own plan is self-certification; same independence DR-102's grounding gate already demands — audit-20 P1-2). The architecture skill spawns that reviewer; on pass it stamps into the blueprint frontmatter and flips DRAFT→ACTIVE (step 9b2), and (that assertion is the "re-check" — a stamp-less ACTIVE blueprint is refused). The gate confirms, fail-closed:
- [dlg code] readiness_gate: passed <date>
- [dlg strong] 's preflight asserts the stamp exists

### `config-rules`

- [@aria-label] Buscar regla
- [@placeholder] Buscar regla…
- [button] Todas 48
- [button] Automáticas 35
- [button] Requieren al owner 13
- [span] 48 reglas
- [button] Mostrar 18 más · quedan 18

### `config-rules-search`

- [span] 1 regla

### `config-rule-detail`

- (no strings beyond the shared chrome and the first state of the same route)

### `config-standards`

- [@aria-label] Buscar estándar…
- [span] 17 estándares
- [button] Todos 17
- [button] Obligatorios 4
- [button] Recomendados 13
- [@aria-label] Filtrar por dominio
- [option] Todos los dominios
- [option] Calidad (1)
- [option] Datos y privacidad (1)
- [option] Otros (12)
- [option] Producto y docs (1)
- [option] Programación (1)
- [option] Seguridad (1)
- [small] api-design.md · lint/CI
- [small] privacy.md · human gate
- [span] Datos y privacidad
- [small] performance.md · CI
- [small] web-security.md · CI
- [small] accessibility.md · checklist
- [span] Otros
- [small] ai-implementation.md · checklist
- [small] auth.md · checklist
- [small] background-jobs.md · checklist
- [small] data-modeling.md · checklist
- [small] debugging.md · checklist
- [small] dependency-lifecycle.md · checklist
- [small] error-handling.md · checklist
- [small] feature-flags.md · checklist
- [small] memory-harvesting.md · checklist
- [small] resilience.md · checklist
- [small] seo-i18n.md · checklist
- [span] Producto y docs
- [small] single-source-of-truth.md · checklist

### `config-standards-must`

- [span] 4 de 17
- [h2] Estándares 4

### `config-standard-dialog`

- [dlg p] Estándar · Programming
- [dlg span] MUST
- [dlg li] HTTP errors return application/problem+json (RFC 9457, which obsoletes 7807) with the 5 members: type (default about:blank), title (stable except for i18n), status, detail, instance.
- [dlg li] Well-named resources, /v1 versioning, pagination, standard HTTP codes.
- [dlg li] Validation at the boundary before the logic (Zod / pydantic), which generates these error bodies consistently. (Reuses the boundary-validation convention from conventions.md, defining its output.)
- [dlg li] verify.sh gate (stack A): a route handler returning 4xx/5xx without the shared problem() helper is RED (fail-closed grep gate; vacuous without API routes). The helper (src/lib/problem.ts) ships as a canonical snippet in stack-a-nextjs/STACK.md. Canaried by canary.sh (DR-079).
- [dlg li] REST conventions (resources, /v1, pagination, codes): reviewer correctness lens (review-only).
- [dlg strong] REST conventions (resources, /v1, pagination, codes)
- [dlg li] Contract-level assertions (required members present, content type) live in the FRD's integration tests when the feature IS an API (test-writer generates them from the EARS criteria).
- [dlg h2] Why

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- Section names "Skills · Agents · Decision rules · Standards" | "Habilidades · Agentes · Reglas de decisión · Estándares" (+ "Resumen").
- "interno" flag | "Motor interno".
- "auto-approves (●) / asks you (●)" | chips "Auto" / "Owner" and filters "Automáticas" / "Requieren al owner".
- Severity badges MUST/SHOULD/MAY | "Obligatorio" / "Recomendado"; the dialog chip still shows the raw "MUST".
- Interface strings left in English: dialog kicker "Skill" (config-skill-dialog), scope chip "project", kicker "Estándar · Programming" (domain in English), agent chip "opus", "esfuerzo high".
- "New decision rule" / "New standard" buttons | absent.
- Pixel-art avatar "Final Fantasy style" | sprite or two-letter initials.

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- Creation affordances ("New decision rule", "New standard" via /pandacorp:learn) are in the FRD but stay out of v2 (owner decision 2026-10-21).
- The mini-flow chips of the skill detail are the "skill workflow diagram" that stays out of v2 (owner decision 2026-10-21); FRD-08 keeps asking for a full flow graph.
- Agent level, title and XP bar (U11/U12) are FRD wants without a drawn counterpart (Group B candidates unless dropped).
- Standard domain taxonomy: FRD lists nine domains, the captured data yields six (data-driven).

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 22 (owner): Configuración gets a Resumen hub with one search across skills, agents, rules and standards, four count tiles and "Tus comandos"; search in every tab; Skills filtered by "Comandos tuyos / Motores internos" with copy on each row; Agents grouped by model tier; Standards as one list ordered MUST first with severity facets and a domain select.
- Iteration 22 colour rule: one hue per catalog (skills violet, agents blue, rules amber, standards teal); red, amber and green stay for status/severity; domain chips and model tiers are neutral labels.
- 2026-10-21 scope: the skill workflow diagram in Configuración and the creation affordances (new standard / rule / skill via /pandacorp:learn) stay out of v2.
- 2026-10-21 language: descriptions of skills and agents, rules, standards keep their source language (English); labels and group headers are Spanish.
- Iteration 26: rules show 30 at a time; the config tab strip scrolls with arrows.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
