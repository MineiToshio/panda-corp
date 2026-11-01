---
id: FDD-07
type: fdd
slug: configuration
title: Configuración (read-only hub and four catalogs)
status: ACTIVE
parent: FRD-07
ui: true
visual_source: docs/design/prototype/index.html
mock: docs/frds/frd-07-configuration/mocks/configuration.html
last_updated: '2026-10-22'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-07 Configuración

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> This is the Órbita design (round 5, iteration 28), frozen from the approved prototype. It describes only what the captured states of `mocks/configuration.html` draw (DR-130). The surface is read-only: it never edits, runs a command or calls Claude. Items the FRD marks **Out of v2** (the skill mini-flow and workflow explainer, the «new decision rule» and «new standard» buttons, the explainer of what a decision rule is, agent level, title and XP, the pixel-art avatar for every agent) are not drawn and are not specified.

Colour rule (iteration 22): one hue per catalog (skills violet, agents blue, decision rules amber, standards teal). Red, amber and green keep their status meaning only; domain chips and model tiers are neutral labels.

## Screens

The page title block is the shared `PageHead`: one `h1` «Configuración» (equal to the nav label), the subtitle «Las habilidades, el equipo y las reglas con las que trabaja tu fábrica, leídas de sus archivos.», then the tab row «Resumen», «Habilidades», «Agentes», «Reglas de decisión», «Estándares», each catalog tab with its count. The tab row is the navigation «Secciones de configuración».

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| Resumen hub | Entry point: one search across the four catalogs, four count tiles, the owner's commands | `config-hub` | REQ-07-001, AC-07-013.1, REQ-07-004 |
| Hub search results | The same search typed into: matches from every catalog in one list | `config-hub-search` | AC-07-013.1 |
| Habilidades catalog | Skills grouped by where they run, with type filter, search and copy buttons on owner-command rows | `config-skills` | REQ-07-002, REQ-07-004, REQ-07-005, REQ-07-006, AC-07-013.2 |
| Skill detail dialog | What a skill is for, where it runs, the agents it uses, its full definition | `config-skill-dialog` | REQ-07-003, REQ-07-006, REQ-07-007, REQ-07-008, REQ-07-004 |
| Agentes catalog | Agents grouped by model tier, each with avatar, explicit effort text and compact description | `config-agents` | REQ-07-002, REQ-07-011, AC-07-013.3 |
| Agent detail dialog | An agent's model, effort, tools, the skills that use it and its full definition | `config-agent-dialog` | REQ-07-003, REQ-07-008, REQ-07-011 |
| Reglas de decisión catalog | Every decision rule with its Auto or Tu OK chip, filter, search and paging | `config-rules` | REQ-07-002, REQ-07-009, AC-07-013.4 |
| Decision rule opened | A rule's default text as an inline accordion | `config-rule-detail` | REQ-07-003, REQ-07-009 |
| Estándares catalog | One list of standards, mandatory first, with severity facets and a domain select | `config-standards` | REQ-07-002, REQ-07-010, AC-07-013.5 |
| Standard detail dialog | The standard's markdown | `config-standard-dialog` | REQ-07-003, REQ-07-010 |

## States

| State | How it looks | Oracle state | ACs |
|---|---|---|---|
| Hub at rest | The search field (label «Buscar en toda la configuración», placeholder «Buscar en habilidades, agentes, reglas y estándares…»). Four tiles, one per catalog, each with its count and one line: «20 comandos tuyos · 7 motores internos», «10 sonnet · 5 opus · 1 modelo heredado», «13 requieren tu OK · 35 automáticas», «4 obligatorios · 13 recomendados». Below, the card «Tus comandos» with its count and the intro «Las habilidades que corres tú. Clic en el comando para copiarlo; en el nombre de la fila para ver qué hace.», then the owner commands in a three-column grid at 1280: each shows the `/pandacorp:<slug>` command in monospace (click to copy, accessible name «Copiar /pandacorp:adopt» and so on) over a one-line description that opens the skill. | `config-hub` | AC-07-013.1, REQ-07-004 |
| Hub search active | With a term typed, the tiles and the command card give way to a «Resultados» card with its count. Each hit shows its title, an excerpt of the matching text and a kind chip: «Habilidad», «Agente» or «Regla». | `config-hub-search` | AC-07-013.1 |
| Skills at rest | Search «Buscar habilidad…» and the count «27 habilidades». The filter group «Tipo de habilidad» with the chips «Todas», «Comandos tuyos» and «Motores internos», each with its count. Three groups under their own headings with a count: «Dentro de un proyecto» («Se corren en la carpeta del proyecto.»), «En la fábrica» («Se corren en la carpeta de panda-corp.») and «Otras». Each row: the command, a one-line description and either the copy button or the chip «Motor interno». | `config-skills` | REQ-07-005, REQ-07-006, REQ-07-004, AC-07-013.2 |
| Skill dialog open | Dialog kicker «Habilidad», the command as the title, the close button «Cerrar». Chips for where it runs («Dentro de un proyecto») and for who runs it («Comando tuyo»). The description, then «Agentes:» with one chip per agent it uses, then the command chip with its copy button. The full definition sits behind «Definición completa», rendered as markdown. | `config-skill-dialog` | REQ-07-007, REQ-07-006, REQ-07-008, REQ-07-004 |
| Agents at rest | Search «Buscar agente…» and the count «16 agentes». Groups by model tier, each header with the tier name, its count and one line: «Opus» («5 agentes»), «Sonnet» («10 agentes») and «Modelo heredado» («1 agente», «Usa el modelo de la sesión que lo llama.»). Each agent card: avatar (the agent's sprite, or two-letter initials such as DR, IM, LI and ME), the name, the effort text «esfuerzo alto» or «esfuerzo medio» where the agent declares it, and its description. | `config-agents` | REQ-07-011, AC-07-013.3 |
| Agent dialog open | Dialog kicker «Agente», the agent's name as the title, «Cerrar». Chips «Opus» and «esfuerzo alto», the description, «Herramientas:» with one chip per tool, «Lo usan:» with one chip per skill that uses the agent, and «Definición completa» with the agent's markdown. | `config-agent-dialog` | REQ-07-011, REQ-07-008, REQ-07-003 |
| Rules at rest | Search «Buscar regla…». The filter group «Aprobación» with the chips «Todas», «Automáticas» and «Requieren tu OK», each with its count, and the count «48 reglas». One row per rule: its id, the decision it governs, the chip «Auto» or «Tu OK», and its default text. A full-width dashed bar «Mostrar 18 más · quedan 18» closes the page. | `config-rules` | REQ-07-009, AC-07-013.4 |
| Rules filtered by search | Typing a term narrows the list and the count reads «1 regla». | `config-rules-search` | AC-07-013.4 |
| Rule opened | The first row expands in place to show its full default text; the other rows stay closed. No dialog. | `config-rule-detail` | REQ-07-003, REQ-07-009 |
| Standards at rest | Search «Buscar estándar…» and the count «17 estándares». The filter group «Severidad» with «Todos», «Obligatorios» and «Recomendados», each with its count, and the select «Filtrar por dominio» with «Todos los dominios» and one option per domain present, with its count (for example «Calidad (1)»). The card «Estándares» lists the mandatory standards first. Each row: the title, the line `api-design.md · lint/CI` (file and enforcement), the domain chip and the severity chip «Obligatorio» or «Recomendado». | `config-standards` | REQ-07-010, AC-07-013.5 |
| Standards, mandatory only | The chip «Obligatorios» is selected, the count reads «4 de 17» and the card «Estándares» lists those 4. | `config-standards-must` | AC-07-013.5, REQ-07-010 |
| Standard dialog open | Kicker «Estándar · Programación», the standard's title, «Cerrar». Chips for severity («Obligatorio»), domain and enforcement («lint/CI»), then the standard's markdown (rules, how it is verified, why). | `config-standard-dialog` | REQ-07-010, REQ-07-003 |

Behaviour with no picture: a catalog source that cannot be read or parsed returns an explicit error and the page shows the shared error notice naming the source, never an empty list (DR-078). The content is read from `plugin/skills`, `plugin/agents`, `factory/decisions/registry.yaml` and `factory/standards/`, and shown in its source language (English), while the interface around it is Spanish.

## Components used

From `docs/design/components.md`. Nothing new is introduced by this FRD.

| On screen | Component | Notes |
|---|---|---|
| Title block | `PageHead` | eyebrow, one `h1` equal to the nav label, subtitle |
| Tab row «Resumen · Habilidades · Agentes · Reglas de decisión · Estándares» | `Tabs` | count badge on each catalog tab; one hue per catalog |
| Hub search, catalog searches | `SearchField` | one width; full width on phones |
| Domain select | `SelectField` | data-driven options with counts |
| Hub count tiles | `StateTile` look in `Card` | one tile per catalog, hue per catalog |
| «Tus comandos», «Resultados», «Estándares» | `Card` with `CardHeader` | tinted icon tile, one title size, count pill in the same hue |
| Group headings «Dentro de un proyecto», «En la fábrica», «Otras», tier headers | `SectionHeading` | icon in the section hue, hairline, count and note at the right |
| Command and its copy action | `CopyText` in the hub, `CommandBox` (compact in rows) | copy writes the string to the clipboard and nothing else |
| Skill, rule and standard rows | `ListRow` | `divided`; chips move under the title on phones |
| «Motor interno», «Auto», «Tu OK», severity, domain, effort and model chips | `Chip` family | status colour only where it is status |
| Type, approval and severity filters | `FilterChip` (in `Chip` family) | selected state is neutral |
| Agent card avatar | `Avatar` | sprite or initials |
| «Mostrar 18 más · quedan 18» | `MoreBar` | full-width dashed bar |
| Skill, agent and standard detail | `Dialog` | native `dialog`, tinted head with kicker, title, «Cerrar» |
| Definition and standard body | `Markdown` | in the catalog's hue |

## Interaction & flow

- Entry: «Configuración» in the primary nav opens the Resumen (`config-hub`). The selected tab, the filters and the search term live in the URL (FRD-25), so reload and Back restore them.
- Typing in the hub search replaces the tiles with «Resultados» across all four catalogs (`config-hub-search`). Choosing a hit opens that item's detail.
- Clicking a command (the hub's command text, or the copy button on a Habilidades row) writes `/pandacorp:<slug>` to the clipboard and does nothing else (`config-hub`, `config-skills`). Clicking the row's name opens the skill dialog (`config-skill-dialog`).
- Habilidades: the chips «Todas», «Comandos tuyos» and «Motores internos» filter the grouped list; the search narrows it (`config-skills`).
- Cross-navigation: in the skill dialog a chip under «Agentes:» opens that agent's dialog; in the agent dialog a chip under «Lo usan:» opens that skill's dialog (`config-skill-dialog`, `config-agent-dialog`).
- Reglas de decisión: the three approval chips filter the list; a row opens as an accordion, not a dialog (`config-rule-detail`); the dashed bar reveals the next page of rules (`config-rules`).
- Estándares: severity facets and the domain select combine; activating a row opens the dialog with the standard's markdown (`config-standards`, `config-standards-must`, `config-standard-dialog`).
- Dialogs close with «Cerrar» or Escape and return focus to the control that opened them.

## Responsive & accessibility

- At 1280 the agent cards sit in three columns and the hub tiles in one row of four and the command grid in three columns; at 375 the tiles are two by two, command rows stack their description under the command, and the tab row scrolls sideways with overflow arrows. Rows keep a 44px touch target.
- Every field has a programmatic label (the search fields carry their label as the accessible name). The copy buttons are named «Copiar /pandacorp:<slug>». The tab row is a navigation named «Secciones de configuración» and the selected tab is marked in text colour, tinted icon and a bottom bar, not by colour alone.
- The Auto and Tu OK chips and the severity chips carry their word, never colour alone.
- Dialogs are native `dialog` elements: focus moves in on open, Tab is trapped, Escape closes.

## Copy

Interface strings are the Spanish ones in the states above and in `docs/design/microcopy.es.json`. Item names, descriptions, rule text and standards markdown are shown content and keep their source language. Artifact names stay English.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar; its *How to verify* is the gate): the component catalogue (`docs/design/prototype/components.html`), measured styles (`docs/design/prototype/reference/computed-styles.json`), the exported icons and logo (`docs/design/prototype/{icons,logo}/`), the copy file and the whole-app prototype for states and motion.

prototype_blessed_at: 409a0564

- **Mock:** `docs/frds/frd-07-configuration/mocks/configuration.html` (sections `config-hub`, `config-hub-search`, `config-skills`, `config-skill-dialog`, `config-agents`, `config-agent-dialog`, `config-rules`, `config-rules-search`, `config-rule-detail`, `config-standards`, `config-standards-must`, `config-standard-dialog`).
- **Mock screenshots** in `mocks/screenshots/`: `<id>-<width>-<theme>.jpg` at 375, 768 and 1280, light and dark (the three dialogs at 375 and 1280).
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#configuracion` (tabs by `?tab=`).
- **Oracle entries** (`docs/design/freeze/fidelity.config.json`, `states["frd-07-configuration"]`): the twelve ids above.
- **Reference files:** root `DESIGN.md`, `docs/design/design-tokens.json`, `docs/design/freeze/m1-decisions.md`, `docs/design/freeze/reconciliation.md`, `docs/design/prototype/prototype.css`.
- **components.md rows:** `PageHead`, `Tabs`, `SearchField` / `SelectField`, `Card` and `CardHeader`, `SectionHeading`, `CommandBox`, `ListRow`, `Chip` family, `Avatar`, `MoreBar`, `Dialog`, `Markdown`.

## Visual close-out (2026-10-31)

Tabs show gauge, bolt, users, shield and book icons. The rules tab remains amber, while the hub rules tile is pink as drawn in the approved prototype. Tus comandos uses the terminal icon and JetBrains Mono command text. Skill and catalog source errors remain visible.

## Independent review corrections (2026-10-31)

The tab strip and search field are separated by s6 (24 px) on desktop and phone.


## Visual close-out clarification (2026-10-31, lane O)

Skill scopes reuse Card/CardHeader with violet badge icons and divided rows. Agent tiers reuse SectionHead with a separate explanatory paragraph and compact sprite cards. Standards put severity/domain filters before the card and show file/enforcement metadata instead of full extracted prose. Rule rows use a flush card, separate mono ID and inline Markdown title.


## Independent review corrections (2026-10-31, lane O)

Phone skill rows keep the icon to the left and stack title, a two-line summary and the copy action/internal chip on the right. The shared CopyButton text variant supplies the action without overrides. Standard domain/severity chips use a wrapping row with token spacing; the filtered result count appears only in the search toolbar.
