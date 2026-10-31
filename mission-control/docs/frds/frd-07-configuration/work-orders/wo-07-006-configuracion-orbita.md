---
id: WO-07-006
type: work-order
slug: configuracion-orbita
title: 'WO-07-006 — Configuración Órbita: hub, catalog tabs, filters, dialogs'
status: ACTIVE
parent: FRD-07
foundation: false
implementation_status: VERIFIED
difficulty: high
reopen_count: 0
artifacts:
  - 'src/app/configuration/**'
  - 'src/lib/reference/**'
  - 'src/lib/registry/**'
  - 'src/lib/standards/**'
  - 'e2e/configuration.spec.ts'
  - 'e2e/persistent-navigation/configuration.spec.ts'
source_requirements: [REQ-07-001, REQ-07-002, REQ-07-003, REQ-07-004, REQ-07-005, REQ-07-006, REQ-07-007, REQ-07-008, REQ-07-009, REQ-07-010, REQ-07-011, REQ-07-012, REQ-07-013]
dependsOn: [WO-13-012, WO-25-001, WO-07-001, WO-07-003, WO-07-004, WO-08-003]
last_updated: '2026-10-30'
---

# WO-07-006 Configuración Órbita: hub, catalog tabs, filters, dialogs

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Blueprint: [`blueprint.md`](../blueprint.md) · FRD: [`frd.md`](../frd.md) · FDD: [`fdd.md`](../fdd.md).

## Summary

Rebuilds the whole Configuración surface (`/configuration`, `/configuration/:section`, `/configuration/:section/:item`) as the Órbita design: a Resumen hub (one search across the four catalogs, four count tiles, «Tus comandos» copied on click) and the four catalogs Habilidades, Agentes, Reglas de decisión and Estándares with their search, filters, grouping, paging, dialogs and inline rule accordion, fed by the existing factory readers plus a fail-loud result variant so an unreadable source shows an error notice instead of an empty list. It also removes the v1 pieces the design dropped (skill mini-flow, rule explainer, creation buttons, agent level and XP).

## In Scope

- **Page and shell.** `page.tsx` (Server Component) loads the four catalogs through ONE request-scoped resolver (`loadConfigurationCatalogs`, `React.cache`) and passes plain DTOs to the client shell; `ConfigurationShell` renders `PageHead` (h1 «Configuración», subtitle from the catalogue) and the `Tabs` navigation «Secciones de configuración» (Resumen · Habilidades · Agentes · Reglas de decisión · Estándares, count on each catalog tab). Selected tab, open item, search term and filters are URL state through the FRD-25 codec (`useUrlState`); typing replaces history.
- **Resumen hub (AC-07-013.1).** `SearchField` «Buscar en toda la configuración» over the four catalogs; four count tiles with the derived one-liners; card «Tus comandos» listing the owner commands (non-internal skills) as `CopyText` (accessible name «Copiar /pandacorp:<slug>») over a one-line description that opens the skill dialog. With a term typed, tiles and the command card give way to «Resultados» (title, excerpt of the matching text, kind chip Habilidad / Agente / Regla; a standard hit also opens its dialog). Choosing a hit opens that item.
- **Habilidades (AC-07-013.2).** Search, count, `FilterChip` group «Tipo de habilidad» (Todas · Comandos tuyos · Motores internos, each with its count), three `SectionHeading` groups «Dentro de un proyecto», «En la fábrica», «Otras» (an undeclared scope is never dropped), rows with the command, a one-line description and either the compact copy button or the chip «Motor interno». The row name opens the skill dialog.
- **Skill dialog.** Kicker «Habilidad», command as title, chips for where it runs and who runs it («Comando tuyo» / «Motor interno»), description, «Agentes:» chips that open that agent's dialog (REQ-07-008), the command chip with its copy button, «Definición completa» (the `SKILL.md` as `Markdown`).
- **Agentes (AC-07-013.3).** Search, count, groups by model tier (Opus, Sonnet, Modelo heredado for an agent whose `model` is absent or unknown) with `SectionHeading` count and the one-line tier explanation; each agent card has the `Avatar` (the agent's sprite if one exists, otherwise two-letter initials), name, the chip «esfuerzo alto» / «esfuerzo medio» / «esfuerzo bajo» where the agent declares an effort, and its description. Agent dialog: kicker «Agente», chips for model and effort, description, «Herramientas:», «Lo usan:» chips that open the skill dialog, «Definición completa».
- **Reglas de decisión (AC-07-013.4).** Search, `FilterChip` group «Aprobación» (Todas · Automáticas · Requieren tu OK, with counts), count, one `ListRow` per rule (id, the decision it governs, chip «Auto» or «Tu OK», default text), the first 30 rows and a full-width `MoreBar` «Mostrar N más · quedan N» revealing the next page. A row opens in place as an accordion (no dialog); the open rule is the `:item` URL segment.
- **Estándares (AC-07-013.5).** One `Card` «Estándares» with the mandatory standards first, `FilterChip` group «Severidad» (Todos · Obligatorios · Recomendados, a standard of severity MAY reads «Opcional»), the `SelectField` «Filtrar por dominio» (options from the domains actually present, each with its count), count («N de M» when filtered), rows with title, the line `<file>.md · <enforcement>`, domain chip and severity chip. Standard dialog: kicker «Estándar · <dominio>», title, severity / domain / enforcement chips, the standard's `Markdown`.
- **Fail-loud read errors (DR-078).** A catalog whose source cannot be read or parsed renders the shared `Notice` (error variant) naming the failing source, in place of that catalog; the other catalogs keep working. See the Out of Scope note on the wording.
- **Readers (additive).** Beside the existing `readSkills` / `readAgents` / `readDecisionRules` / `readStandards` (behaviour unchanged for their other consumers), add a result-typed variant per catalog (`{ ok: true, data } | { ok: false, source, reason }`) that the array readers delegate to, extend `AgentRef` with `tools` and a normalised `effort`, and add the one composed resolver `loadConfigurationCatalogs` (see the blueprint, `IF-07-catalogs`) that also derives the hub counts, the owner-command list and the skill-to-agent inversion once.
- **Behaviour e2e.** `e2e/configuration.spec.ts` (one spec for the surface): opens the hub, searches across catalogs, filters Habilidades, opens a skill dialog and jumps to an agent, expands a rule, filters Estándares by severity and domain. Starts every navigation with `gotoHydrated`; selects by role and name.
- **Landmark and route boundary.** The page renders no `<main>` (the shell's `main#content` is the page's only main landmark, AC-19-001.5, REQ-13-009); the tests under `src/app/configuration/_tests/` that query `getByRole("main")` are updated here. Legacy `/manual/reference/...` links are normalised by WO-08-003 (`normalizeLegacyNavigation`) before they reach this route; this page applies the same normaliser at its own boundary for any legacy configuration query, and uses the WO-25-001 keys `q`, `type`, `approval`, `severity`, `domain`.
- **Split oracle files (WO-25-001).** `e2e/persistent-navigation/configuration.spec.ts` (the `configuration` case and the configuration and agent read-only details, including the former `/manual/reference/agents/reviewer` detail now at `/configuration/agents/reviewer`) and `src/app/configuration/_tests/persistentNavigation.test.tsx` (the standard-detail case, whose `standardView` sub-tabs this work order removes) are updated here (AC-25-001.1, AC-25-002.1 re-verified, BL-0051).

## Out of Scope

- Editing any item or running a command: the copy buttons only write the string to the clipboard.
- The Documentación Referencia (FRD-08 points to this surface and re-implements nothing).
- The sidebar, theme or any other page.
- Wording for the read-error notice: the frozen catalogue has no key for it (the FDD describes the state without drawing it). The implementer builds the structure (error `Notice`, role `alert`, the failing source path, the reader's reason) and takes the title and body from a catalogue key that DESIGN must add (ledger item); the implementer does NOT invent a Spanish sentence. Until the key exists the WO reports it (DR-130) instead of closing that state.
- REQ-07-007 «what it produces»: the captured `config-skill-dialog` does not draw it, so it is not rendered (the reader keeps `produces`). Reported in the ledger.

### Removed in this WO (v1 pieces the design dropped; delete code, routes, exports and tests together)

1. The skill mini-flow and the curated workflow explainer: delete `src/app/configuration/FlowDiagram.tsx`, remove the `FlowGraph` import and every `getSkillFlow` use from `SkillDetail.tsx` and from `_tests/skills.test.tsx` (the `FlowGraph` component file and the skill-flows data are deleted by WO-13-013).
2. The decision-rule explainer and the «New decision rule» and «New standard» buttons (and their `/pandacorp:learn` copy).
3. Agent level, title and XP bar, the «levels up by completing work orders» text, the per-agent model explanation and the pixel-art avatar for every agent: remove the `computeAgentLevel` / `readLedger` / `durableEvents` use from `page.tsx` and the `levels` prop from the shell (the XP engine file `src/lib/gamification/agents.ts` is deleted by WO-13-013).
4. The Resumen / Detalle `SubTabs` pair in the standard detail (a standard opens one dialog with its markdown) and the bespoke `SectionTabs`, `SectionHero`-style title blocks and card grids that the shared `PageHead`, `Tabs`, `ListRow`, `Card` replace.
5. Every unused export left by the above (knip does not catch a tested-but-unmounted leftover: delete the tests of removed pieces in the same WO).

## Requirements & Acceptance Criteria

Requirements traced: REQ-07-001 to REQ-07-013 (REQ-07-007's mini-flow, REQ-07-009's explainer and creation button, REQ-07-010's creation button, REQ-07-011's pixel art, level and title and REQ-07-012 are Out of v2 in the FRD and are removed, not built).

- **AC-07-013.1** — THE Configuración SHALL open on a Resumen that offers one search across skills, agents, rules and standards, four count tiles, and "Tus comandos" (the owner's commands, copied on click).
- **AC-07-013.2** — EACH catalog tab SHALL offer a search, and Habilidades SHALL filter by the chips "Todas · Comandos tuyos · Motores internos" and offer a copy button per row.
- **AC-07-013.3** — THE Agentes tab SHALL group agents by model tier, each group header explaining the tier in one line, and each agent SHALL carry an effort chip.
- **AC-07-013.4** — THE Reglas de decisión tab SHALL filter by the chips "Todas · Automáticas · Requieren tu OK", SHALL mark each rule with its Auto or Tu OK chip, and SHALL list 30 rules at a time with "Mostrar más".
- **AC-07-013.5** — THE Estándares tab SHALL list the Obligatorio standards first in one list, SHALL filter by severity facets and by domain select, and SHALL show each standard's enforcement line under its title.

Worked example (AC-07-013.4): 48 rules, 13 needing the owner's OK. Hub tile «13 requieren tu OK · 35 automáticas»; chip «Requieren tu OK» lists those 13; chip «Todas» lists 30 and the `MoreBar` «Mostrar 18 más · quedan 18» reveals the remaining 18.

Completeness (definition of done beyond the ACs):

- **Error paths:** one error `Notice` per failing source (skills, agents, rules, standards); a source that fails does not blank the others; an unknown `:section` or `:item` is the bounded not-found of FRD-25 (never the first item).
- **Empty states:** a catalog whose filters match nothing shows its empty sentence, and the hub results show the no-match sentence, all from the `configuracion` catalogue keys (`skills.empty`, `agents.empty`, `rules.empty`, `standards.empty`, `hub.noMatch`); these states are not captured in the mocks, so no literal is typed in code.
- **Security:** read-only; no write path, no command execution; shown content (descriptions, rule text, markdown) is rendered through `Markdown` or as text, never as raw HTML.
- **Performance:** the four catalogs are read once per request (`loadConfigurationCatalogs` is `React.cache`d); the Server Component passes only the fields each client view uses; the 30-row rule page and the dialogs keep the first render small (no virtualization needed at 48 rules).
- **Accessibility:** native `dialog` (focus in, trap, Escape, focus return to the opener); `Tabs` is the navigation «Secciones de configuración» with arrow keys; every search field has its accessible name; chips and filters carry text, never colour alone; copy buttons are named «Copiar /pandacorp:<slug>»; 44 px targets on touch layouts; `prefers-reduced-motion` honoured.
- **Copy:** every Spanish string comes from `t()` (`configuracion.*`, `dialogs.skill.*`, `dialogs.agent.*`, `dialogs.standard.*`); item names, descriptions, rule text and standards markdown are shown content and keep their source language (LESSON-0490).
- **Fidelity:** the built screen matches `mocks/configuration.html` on the frozen tokens (layout, structure, components, density) in light and dark at 375 / 768 / 1280, keeping the prototype's recorded ids, class names and `data-*` / `aria-*` hooks; verified by the Preview Smoke gate (DR-055) and, at the close-out, by the computed-style and pixel diff against the twelve oracle states.

## Components and interfaces built

From the [blueprint](../blueprint.md): `CMP-07-config-page`, `CMP-07-config-shell`, `CMP-07-config-hub`, `CMP-07-skills-catalog`, `CMP-07-skill-dialog`, `CMP-07-agents-catalog`, `CMP-07-agent-dialog`, `CMP-07-rules-catalog`, `CMP-07-standards-catalog`, `CMP-07-standard-dialog`, `CMP-07-read-error`; `IF-07-reference`, `IF-07-registry`, `IF-07-standards` (additive result variants), `IF-07-catalogs` (the composed resolver). Route-private components live in `src/app/configuration/_components/<Name>/` (project-structure: feature-first); nothing is promoted to `components/modules` because no second route uses them (Documentación now links here instead of embedding).

## Reuse (components.md: reuse, then adapt, then create)

All from the inventory, nothing new: `PageHead`, `Tabs`, `SearchField` / `SelectField`, `Card` + `CardHeader`, `SectionHeading`, `CommandBox` (compact) and `CopyText`, `ListRow`, `Chip` family (`FilterChip`, status and neutral chips), `Avatar`, `MoreBar`, `Dialog`, `Markdown`, `Notice`, `StateTile` look for the hub tiles. Restyle in place: keep an existing component's file and exported name only where it is reused; otherwise delete it (list above). A near-duplicate of an inventory component is a defect.

## Installs

None.

## Derogated tests (BL-0051: same WO, never a later one)

- Implementer-authored tests of replaced behaviour, updated or deleted in this WO: `src/app/configuration/_tests/{page,agents,skills,visual-structure,dr057-reuse,page.integration}.test.tsx`, `src/app/configuration/StandardsSection/_tests/StandardsSection.test.tsx`, `src/app/configuration/_rules/DecisionRulesSection/_tests/DecisionRulesSection.test.tsx`, plus the tests of the readers this WO extends (`src/lib/{reference,registry,standards}/_tests/*` stay green; new cases are added beside them).
- Reviewer-authored tests, NOT edited here (DR-080); the FRD-07 gate reviewer re-blesses or rewrites them: `src/app/configuration/_tests/page.integration.reviewer.test.tsx`, `frd07.gate.reviewer.test.tsx`, `frd07.gate-opus.reviewer.test.tsx`, `frd07.detail-edges.reviewer.test.tsx`, `frd07.cross-nav-reverse.gate-opus.reviewer.test.tsx`. They pin v1 behaviour (level and XP, mini-flow, SubTabs, bespoke tabs) and will be red until then.
- Blessed visual baselines of `/configuration` (`e2e/visual.spec.ts-snapshots/**`): never touched; re-blessed by the reviewer at the close-out Visual QA.

## Tests this WO owns

- Unit and component tests beside the code (`getByRole` first): the composed resolver (counts, owner commands, skill-to-agent inversion, model-tier grouping with `unknown` to «Modelo heredado», effort normalisation, a malformed source returning the explicit error variant, DR-078), the hub search (cross-catalog hits, kind chips), each catalog's filter and paging logic (30 + next page, severity and domain combine, mandatory first), the dialogs' cross-navigation both ways, the accordion, the error notice, the URL round trip (reload restores tab, item, search and filters).
- Reader fixtures are hermetic temp trees; no test reads the real factory through the default root (LESSON-0450).
- `e2e/configuration.spec.ts`, as listed under In Scope.
- The reviewer-authored acceptance suite and the blessed baselines are not edited.

## Visual reference

- **Mock screen(s) to reproduce:** `docs/frds/frd-07-configuration/mocks/configuration.html`, sections `config-hub`, `config-hub-search`, `config-skills`, `config-skill-dialog`, `config-agents`, `config-agent-dialog`, `config-rules`, `config-rules-search`, `config-rule-detail`, `config-standards`, `config-standards-must`, `config-standard-dialog`; screenshots in `mocks/screenshots/<id>-<width>-<theme>.jpg` at 375 / 768 / 1280, light and dark (the three dialogs at 375 and 1280).
- **Oracle states** (`docs/design/prototype/reference/oracle-states.json`, `frd_slug` frd-07-configuration): the same twelve ids, build routes `/configuration`, `/configuration/skills`, `/configuration/agents`, `/configuration/rules`, `/configuration/standards`.
- **Token slice:** one hue per catalog via `data-tone` (skills `--violet`, agents `--blue`, decision rules `--amber`, standards `--teal`); red, amber and green only for status (Auto / Tu OK and severity chips carry their word); `--surface`, `--surface-2`, `--line`, `--text`, `--text-2`, `--text-3`, `--focus`, `--shadow-dialog`; radius and spacing tokens as in `docs/design/design-tokens.json`; fonts: Space Grotesk titles, Inter body, JetBrains Mono for commands, ids and paths only; nothing under 12 px, `tabular-nums` on counts.
- **FDD pointer:** `docs/frds/frd-07-configuration/fdd.md` (states, components used, interaction, responsive and accessibility).
- **Assets:** the exported SVG icons through `Icon`; agent sprites from `public/` (staged by WO-13-010) where one exists, initials otherwise.

## Dependencies

WO-13-012 (composite primitives and framing patterns), WO-25-001 (URL codec: `configSection`, `configItem` plus the filter keys), WO-07-001 / WO-07-003 / WO-07-004 (the readers, extended additively here), WO-08-003 (removes the Documentación Referencia embed of this surface's components before this WO rewrites them, so the tree compiles at every step). Full ordering: the blueprint's Build Plan.

## Status Note

- 2026-10-30 (S4C round 2 verification): Scoped Vitest completed with 58 passing files, 2 failing files, 490 passing tests and 2 failing tests (492 total), using --maxWorkers=2. The remaining frozen reviewer failures are selector conflicts: frd-10.s4c-blockers rejects the substring `0 XP` inside the valid `Faltan 40 XP` next-rank text although the threshold now reads Inicio; frd07.gate-opus queries the internal skill by an unanchored name matching both its detail and its newly required copy button. No reviewer file was changed. Knip exited 0 (nine configuration hints), tsc --noEmit exited 0 including generated Next page types, scoped Biome checked 154 files without fixes, and git diff --check passed. The 12 desktop/mobile Playwright cases could not launch Chromium (sandbox permission denial); browser interaction and mobile overflow remain unverified.

- 2026-10-30 (S4C round 2): Patched the mobile single-column grid, copy on every skill row, model/effort chips on every agent (undeclared effort reads the catalogue's default-effort key), closed full-definition disclosures, and standard summaries with retained source/enforcement metadata. Filtered counts only appear when a filter is active. The reverse-link index uses a Map and serializes through Object.fromEntries: a null-prototype DTO was rejected by React's Server Component boundary in the HTTP rehearsal. Removed the unused getSkillFlow lookup and its unconsumed data; shared renderer types remain.
- 2026-10-30 (S4C round 2): The e2e fixture's implement skill contains no agent references, so its journey now checks the existing owner-command chip and opens reviewer from the agents catalogue. Added a required page-props object for Next's generated page validation; the shared unit helper passes an empty object. Reviewer tests and blessed visual baselines remain unchanged. Work remains uncommitted on orch/s4c. Browser journeys could not execute because Chromium launch is denied by the sandbox (MachPortRendezvousServer); HTTP /configuration rendered 200 with its page marker after the serialization fix.

- 2026-10-30: Built the URL-controlled Resumen hub, four catalog tabs, cross-catalog search, filters, progressive rule reveal, bidirectional skill/agent dialogs and standard markdown dialog. Removed v1 mini-flow, creation actions, agent XP and standard SubTabs. Catalog results expose source failures independently; legacy array readers retain tolerant behavior. LESSON-0450: reader and UI fixtures use hermetic temporary roots.
- 2026-10-30: Reader tests: 99 passed; configuration component/navigation tests: 7 passed. TypeScript and scoped Biome passed after incremental fixes. Browser, pixel fidelity and focus behavior in a real browser are not verified (Playwright excluded by the task). Error notice has source and reason; the frozen catalogue still lacks configuration read-error title/body keys, as the WO's design ledger already records.
- 2026-10-30: Final verification: 166 owned tests passed across both WOs; 322 tests passed in the earlier configuration/readers/Manual integration run. Final scoped Biome: 80 files, no fixes/errors. Full TypeScript is red only on five removed-module imports in FRD-10 reviewer suites; the production-only TypeScript project passes. Knip is red on those imports and the now-unused `getSkillFlow` export in `src/lib/manual/skill-flows.ts`, whose deletion belongs to WO-13-013 and is outside this WO's artifacts.
- 2026-10-30: Reviewer suites left unchanged and requiring reconciliation: `_tests/page.integration.reviewer.test.tsx` (async server boundary, v1 XP/card hooks); `_tests/frd07.gate.reviewer.test.tsx` (v1 lists, domain groups and creation actions); `_tests/frd07.gate-opus.reviewer.test.tsx` (mini-flow, produces and per-agent explanations); `_tests/frd07.detail-edges.reviewer.test.tsx` (mini-flow, XP, standard SubTabs); `_tests/frd07.cross-nav-reverse.gate-opus.reviewer.test.tsx` (v1 detail hooks). Their final run reports 27 failures and 2 passes; the new suite covers cross-navigation, native dialogs and URL restoration.
- 2026-10-30: AC-07-013.1 through AC-07-013.5 are cited in `_tests/orbita.test.tsx`; URL restoration is cited in `_tests/persistentNavigation.test.tsx`. Behavior specs added/updated without writing any e2e fixture. Changes are uncommitted on `orch/s4c`; no reviewer test, baseline, `.pandacorp` state or decision log was modified.
