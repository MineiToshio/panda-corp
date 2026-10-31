---
id: WO-26-001
type: work-order
slug: cuentas
title: 'WO-26-001 — Cuentas: project table and global directory'
status: ACTIVE
parent: FRD-26
foundation: false
implementation_status: IN_REVIEW
difficulty: medium
reopen_count: 0
artifacts:
  - 'src/components/modules/ServicesDirectory/**'
  - 'src/lib/services/**'
  - 'e2e/cuentas.spec.ts'
source_requirements: [AC-26-001.1, AC-26-002.1, AC-26-003.1, AC-26-004.1, AC-26-005.1, AC-26-006.1, AC-26-007.1, AC-26-008.1, AC-26-009.1, AC-26-010.1, AC-26-011.1]
dependsOn: [WO-13-012, WO-25-001]
last_updated: 2026-10-30
---

# WO-26-001 Cuentas: project table and global directory

## Summary

Rebuilds the two read-only views of the services and accounts reader on the Órbita system: the project's
**Cuentas** table (service, purpose, copy-able login, teal environment chips, status; one card per row below
1024 px) and the factory-wide **Cuentas** directory (search by service, email or project; state filter
chips with counts; a row dialog «Detalles»; a bounded coral notice for an invalid source). It also aligns
the reader's issue codes and source names with what the design draws, and keeps the whitelisted DTO as the
only thing that reaches the browser. It publishes `AccountsTable`, `AccountsDirectory` and `ProjectAccounts`
for WO-03-007 (Portafolio third view) and WO-04-010 (the workspace Cuentas panel).

## In Scope

**Reader (`src/lib/services/`).** The join, the whitelisted DTO, the HTTPS-link rules and the
production-as-dev checks are kept (v1, verified). Changes:

- `ServiceIssue` becomes `{ code, source }` with `code` in `missing`, `unreadable`, `invalid`, `duplicate`,
  `dangling`, `productionAsDev` and `source` a non-sensitive, closed-set file label the notice can name:
  `factory/services/catalog.yaml`, `services/accounts.yaml` (relative to the private vault root) or
  `projects/<project folder>/.pandacorp/accounts/services.yaml`. Never an absolute path, a raw value or an
  exception text (AC-26-008.1). A missing file is `missing`; any other read failure (permissions, oversized
  registry) `unreadable`; a YAML or contract failure `invalid`; a repeated id or project slug `duplicate`;
  a reference to a provider or account that does not exist `dangling`; a production resource used as a dev
  one `productionAsDev`. One pure mapping function from the reader's internal error ids to these codes.
- A broken private `accounts.yaml` stays honest: no accounts and one `invalid` issue for it (never a
  guessed list). A bad project link adds one issue for that project and leaves every other link intact.
- `src/lib/services/views.ts` (pure, the single derivation of both tables, DR-115): `projectServiceRows(data,
  projectId)` (one row per allocation: provider name and dashboard link, purpose, login or none, environment
  chips with their resource name, status; ordered by status `configured`, `proposed`, `inactive`, then any
  other status, then A to Z by name) and `directoryAccountRows(data)` (one row per account plus one per
  provider with no account, with one derived **directory state** `active`, `pending`, `candidate` or
  `reference`; precedence `reference`, then `candidate`, then `pending`, then `active`; the counts of the
  captured directory are 7 / 1 / 2 / 0, which the builder checks against the prototype fixture and reports
  if the rule disagrees instead of guessing). WO-04-010 reads `projectServiceRows(...).length` for the tab's
  count badge.
- The Manual projection `src/lib/services/manual.ts` is unchanged in contract: public recipes and sources
  only, never identities (AC-26-009.1); the Documentación page merges it.

**Components (`src/components/modules/ServicesDirectory/`).** All copy through `t()`
(`portafolio.accounts.*`, `workspace.cuentas.*`, `dialogs.account.*`); all visuals from tokens and the
primitives of FRD-13; no arbitrary value.

- `AccountsTable`: props `variant: "project"` with `services` (the DTO) and `projectId`, or `variant:
  "directory"` with `rows` and `onOpenDetail(rowKey)`. The component sits in a named region («Servicios del
  proyecto» / «Cuentas de la fábrica»). Service name: bold link to the validated dashboard URL in a new tab
  (title «Abrir el panel de {provider} en una pestaña nueva», visually hidden «(se abre en una pestaña
  nueva)»). Login: mono text button that copies on click (`CopyText`; accessible name «Copiar el usuario de
  {provider}: {login}»; a «Copiar» hint above on hover and focus; the credentials are never shown). A cell
  with no value shows a faint dash, never blank; an account with no known login shows «Cuenta pendiente de
  identificar». Environments: one chip per environment in the single teal hue, the resource name as title.
  State: `StateDot` plus word, never colour alone. Below 1024 px one card per row (one DOM, `data-label`
  captions, heads hidden).
- `ProjectAccounts`: intro line, the issue notice (when `issues` is not empty), `AccountsTable` project
  variant, and the empty state `workspace.cuentas.empty` (no captured state draws it; the catalogue key is
  the only wording, reported in the ledger).
- `AccountsDirectory`: intro paragraph, the issue notice, a toolbar with `SearchField` («Buscar servicio,
  correo o proyecto…»), the filter chips «Todas», «Activas», «Pendientes», «Candidatos», «Referencia» with
  counts (`FilterChip`, selected neutral) and the count line («{count} cuenta» / «{count} cuentas», `.one`
  when the count is 1 else `.other`), the table, the no-match line (`portafolio.accounts.noMatches`, not
  captured, key only) and the **account dialog** («Detalles»
  button per row, last column headed «Detalle» for screen readers only, accessible name «Detalles:
  {name}»). The dialog (`Dialog`, kicker «Cuenta · {provider}»): state and the «Opcional» / adoption chip,
  the label and value list (Finalidad, Correo as a copy button, Identidad y acceso with its dated
  observation, Plan registrado, Automatización, Acepta proyectos nuevos, Siguiente paso), «Proyectos
  vinculados» with environment chips (an account without links uses `dialogs.account.noLinks`, not
  captured, key only), «Cómo reutilizarlo» (the provider recipe paragraph and numbered steps, in their source language) and the
  «Abrir el panel de {provider}» button. Focus returns to the opening button on close.
- URL state through the FRD-25 codec (WO-25-001): search `accountsQuery` (written with `useUrlSearch`, so it
  replaces history), filter `accountsState`, open row `account`; the project selection and unrelated URL
  state survive a view change. Cuentas works with no project selected and with an empty portfolio.
- Transitional compatibility until their owners move (so every wave stays green): `ServicesDirectory.tsx`
  stays as a thin facade (`projectId` set renders `ProjectAccounts`, otherwise `AccountsDirectory`) for the
  two v1 call sites (`ProjectWorkspace.tsx`, the v1 `portfolio/page.tsx`); `PortfolioViews.tsx` is left
  untouched; `copy.ts` is cut down to the three keys `PortfolioViews.tsx` and `tabbar.tsx` still import
  (`projectsTab`, `accountsTab`, `portfolioTabs`). WO-03-007 deletes `PortfolioViews.tsx`; the facade and
  `copy.ts` are deleted by the last consumer (see the ledger).

## Out of Scope

- The Portafolio page, the `Segmented` view switch and its legacy-key normalization (WO-03-007).
- The workspace Cuentas panel, tab bar and count badge wiring (WO-04-010).
- The Documentación Services pages (WO-08-004 and the page that merges `readServiceManualPages`).
- Cloud API calls, provisioning, any registry write, any change to the vault or the project link files.
- The oracle state `accounts-source-error` replay: it needs a reader-level injection that the close-out
  Visual QA harness provides (oracle-recipes F2); this WO tests the notice with real malformed fixtures.

## Requirements & Acceptance Criteria

- **AC-26-001.1** — (renamed from "AC-26-001", amended 2026-10-22, v2 plan) WHEN the Portafolio opens, THEN it SHALL expose the views Tarjetas, Lista and Cuentas (FRD-03 REQ-03-009), the Cuentas view working independently of project selection, including an empty portfolio.
- **AC-26-002.1** — (renamed from "AC-26-002", amended 2026-10-22, v2 plan) WHEN views change or history is restored, THEN the selected project and unrelated URL state SHALL survive; the Cuentas view SHALL use the URL key `view=cuentas` (the key of the captured prototype, `/portfolio?view=cuentas`), never an ambiguous project slug; WHEN a legacy link carries `portfolioView=accounts`, THEN the application SHALL accept it as an alias and normalize it to `view=cuentas`.
- **AC-26-003.1** — (renamed from "AC-26-003", amended 2026-10-22, v2 plan) WHEN accounts render, THEN each account row SHALL show provider (the service name, a link to its dashboard), type, purpose, organization, email or explicit unknown, a dated identity/access status and a validated HTTPS dashboard link opening a new tab.
- **AC-26-004.1** — (renamed from "AC-26-004", amended 2026-10-22, v2 plan) WHEN an account row is activated, THEN a dialog SHALL show derived consumers, environment resources, dated plan/quota observations, automation evidence level, pending step and the public provider recipe.
- **AC-26-005.1** — (renamed from "AC-26-005", amended 2026-10-22, v2 plan) WHEN the user searches or filters, THEN the directory SHALL search service/email/project and offer a state filter over the states active, pending, candidate and reference, with the filter chips "Activas", "Pendientes", "Candidatos" and "Referencia" (plus "Todas") and the row labels "Activa", "Pendiente", "Candidato" and "Referencia", as captured in the prototype directory view (a state SHALL never print its raw key); the per-project Cuentas tab keeps its own labels "Configurado", "Propuesto" and "Inactivo" (AC-26-011.1); multiple identities of one provider SHALL remain separate.
- **AC-26-006.1** — (renamed from "AC-26-006", amended 2026-10-22, v2 plan) WHEN the project Cuentas tab opens, THEN it SHALL show only that project's declared integration/account links and resources; it SHALL NOT infer account ownership from SDKs, variable names or an active browser session.
- **AC-26-007.1** — (renamed from "AC-26-007", amended 2026-10-22, v2 plan) WHEN a source is missing, malformed, duplicated or contains a dangling reference or production-as-dev resource, THEN the reader SHALL show an explicit bounded issue rather than silent empty success, in the project Cuentas tab and in the global Cuentas view (state `accounts-source-error`, M1 2026-10-22).
- **AC-26-008.1** — (renamed from "AC-26-008", amended 2026-10-22, v2 plan) WHEN private files contain unknown fields or credential references, THEN only the reader's whitelisted non-secret DTO SHALL reach the browser; no raw YAML, exception text, passwords, tokens or credential references SHALL be rendered or logged.
- **AC-26-009.1** — (renamed from "AC-26-009", amended 2026-10-22, v2 plan) WHEN the Documentación opens Services, THEN it SHALL derive recipes and sources from the public canonical catalog, link the private directory, and SHALL NOT read or publish account identities.
- **AC-26-010.1** — (renamed from "AC-26-010", amended 2026-10-22, v2 plan) WHEN the page renders or filters, THEN it SHALL make no cloud API calls, write no registries, and remain usable by keyboard and on phones with the existing shell tokens and tab primitive.
- **AC-26-011.1** WHEN the project Cuentas tab lists services, THEN it SHALL order them by status (configurado, then propuesto, then inactivo) and then A to Z, SHALL open each service's dashboard in a new tab from its name, SHALL copy the login on click (the text "Copiar" as the hint, the credentials never shown), SHALL show the environments as chips in one teal hue, and SHALL render one card per row below 1024 px.

**Where each is proven.** 001.1 and 002.1: the component and e2e tests of the views with an empty
portfolio and the URL keys (the Segmented switch itself is WO-03-007's and re-verifies them); 003.1, 004.1,
005.1: component tests over a committed fixture of providers, accounts and allocations (labels,
precedence, counts, separate identities of one provider); 006.1, 007.1, 008.1: reader tests with malformed,
duplicated, dangling, production-as-dev and secret-bearing fixtures (the DTO has no credential field; a
sentinel secret never appears in the rendered HTML); 009.1: `manual.ts` test (no identity in the
projection); 010.1: no `fetch`, no write, keyboard and phone assertions; 011.1: ordering and card layout.

## Components & Interfaces

`CMP-26-reader` (`services.ts`, `parsers.ts`, `validation.ts`, `types.ts`, kept), `CMP-26-views`
(`views.ts`, new), `CMP-26-accounts-table`, `CMP-26-project-accounts`, `CMP-26-accounts-directory` (with
the account dialog), `CMP-26-manual-projection` (`manual.ts`, kept), `CMP-26-facade` (transitional).
Interfaces `IF-26-getServicesDirectory`, `IF-26-projectServiceRows`, `IF-26-directoryAccountRows`,
`IF-26-readServiceCatalog`. See `../blueprint.md`.

## Reuse

Reuse before create (DR-057): `Segmented` (WO-03-007), `SearchField`, `FilterChip`, `StateDot`, `Chip`,
`CopyText`, `Table`, `Notice`, `Dialog`, `EmptyState`, `Tabs` come from WO-13-011 / WO-13-012 under their
v1 names or restyled; `AccountsTable` is the `restyle (ServicesDirectory)` row of `components.md`. Nothing
new is created beyond `ProjectAccounts` and `AccountsDirectory`, which are compositions of those rows; if a
primitive is missing, report it (design defect), never fork it.

## Installs

None.

## Visual reference

- **Mock screen(s) to reproduce:** `docs/frds/frd-26-services-accounts/mocks/services-accounts.html`, states
  `#accounts-project`, `#portfolio-accounts`, `#portfolio-accounts-filter`, `#portfolio-accounts-dialog`,
  `#accounts-source-error`; screenshots in `mocks/screenshots/`. Oracle states in
  `docs/design/prototype/reference/oracle-states.json`: `accounts-project`, `portfolio-accounts`,
  `portfolio-accounts-filter`, `portfolio-accounts-dialog`, `accounts-source-error`, and the scenario states
  `accounts-project-empty` (project with no allocated service), `portfolio-accounts-nomatch` (search with no
  match) and `accounts-dialog-unlinked` (account without documented links), each reproduced from its
  `docs/design/prototype/reference/oracle-recipes.json` double in this WO's tests and at the close-out Visual
  QA. Keep the recorded
  hooks (`.acc-table`, `.acc-name`, `.copy-text`, `.env-chips`, `.state-dot`, ids, `data-*` and `aria-*`).
- **Token slice:** teal environment chips and status dot hues, the coral notice, table / card surface,
  radius and spacing of `Card`, `Table` and `Chip`; light and dark.
- **FDD pointer:** `docs/frds/frd-26-services-accounts/fdd.md` (screens, states, components, copy).
- **Fidelity acceptance criterion:** the built screens match the mocks (layout, structure, components,
  density) on the frozen tokens, not an approximation; verified by the preview smoke gate (DR-055) and the
  close-out Visual QA.
- Strings come from `docs/design/microcopy.es.json`; the captured «Información incompleta o inválida» and
  its reasons from `workspace.cuentas.issues.*`; the project-tab unreadable-source state is not captured
  separately (reported in the ledger) and reuses the same notice and keys.

## Tests this WO owns

- `src/lib/services/_tests/` additions: issue code mapping and source labels, `views.ts` ordering and
  states, no-secret DTO, manual projection. The existing `services.test.ts` is updated where it pinned the
  old issue shape (implementer-authored).
- `src/components/modules/ServicesDirectory/_tests/`: `AccountsTable` (both variants, copy button, new-tab
  links, dash for empty cells, card layout hook), `AccountsDirectory` (search, chips and counts, dialog open /
  close / focus return, notice), `ProjectAccounts` (empty state, notice). `getByRole` first.
- `e2e/cuentas.spec.ts` (one behaviour spec, hydration-safe with `gotoHydrated`): the directory view opens
  with an empty portfolio and a missing registry, shows the bounded notice and a working search, and keeps
  its filter in the URL across reload and Back.

## Derogated tests

`src/components/modules/ServicesDirectory/_tests/ServicesDirectory.test.tsx` pins the v1 card-and-details
markup and the one-select filter; it is rewritten or deleted in this work order (implementer-authored). No
reviewer-authored test covers this folder.

## Definition of done

- Tests first (RED, then GREEN); `.pandacorp/verify.sh` green: biome, `tsc --strict`, vitest, knip, madge.
- Error path per failure mode: missing, unreadable, malformed, duplicated, dangling and production-as-dev
  sources each show one bounded issue; the rest of the directory stays usable; no raw value, path or
  exception text is rendered or logged.
- Non-functional: the DTO crosses the server / client boundary without credential fields; no outbound call;
  keyboard operable (Tab order, Escape closes the dialog, focus returns); WCAG AA in both themes; 44 px design
  target; reduced motion honoured; state by dot plus word.
- Cite the `LESSON-NNNN` that shapes a choice in the commit or the Status Note (rule 8).

## Dependencies

WO-13-012 (primitives and framing patterns, including the transitive tokens, `t()` and `Icon`) and WO-25-001
(the URL keys and `useUrlSearch`). Consumers: WO-03-007, WO-04-010.

## Status Note

- 2026-10-30 (S1C): Built shared project/directory tables, exclusive directory states, URL search/filter/dialog, bounded issue mapping and compatibility facade. Frozen prototype services reproduce 7 active / 1 pending / 2 candidate / 0 reference.
- 2026-10-30: Scoped Vitest passed (3 files, 23 tests); scoped TypeScript passed using `/private/tmp/s1c-tsconfig.json` (project options, explicit Next CSS declarations and test setup); Biome passed on `src/lib/services`, `src/components/modules/ServicesDirectory`, `e2e/cuentas.spec.ts`. RED was observed before the new views existed.
- 2026-10-30: Browser/visual, phone layout and Playwright were not executed per stream instructions. The behavior spec assumes the shared e2e factory has no private registry. Portfolio assembly/empty-portfolio rendering is reverified by WO-03-007.
- 2026-10-30: Integration gap for S1A: current `CopyText` accepts only `text` and `onResult`, so its accessible name is the generic catalogue copy action rather than `workspace.cuentas.copyUserAria`. Core was not edited. The table's responsive card layout is inherited from `Table`; native dialog styling/focus is inherited from `Modal` and must be rechecked after S1A lands. Empty/no-match/unlinked defensive wording uses catalogue keys only, as recorded in this WO.

- 2026-10-30: Final stream regression includes 25 account tests. The e2e spec now temporarily empties only the test portfolio and restores its original bytes in finally; execution in Chromium remains unverified. Git staging/commit was denied by the sandbox; per-WO patch prepared.

- 2026-10-30: Final scoped stream verification: 60 tests in 13 files passed; after the final account-placeholder accessibility fix, its 7 component tests passed again. Biome checked 61 scoped files without diagnostics; scoped TypeScript and `git diff --check` passed. Scope audit found exactly 60 changed files, all within these WOs or their authorized status documents.

- 2026-10-30 (S1C round 2): Round 2 review patch: account rows now include provider type, organization and dated access observations (AC-26-003.1 takes precedence over the five-column FDD). Unassigned allocations retain a candidate row even when the provider has accounts. A failed catalog stops the join with its single bounded issue. Dialogs retain provider automation evidence, allocation status, environment/resource pairs and environment policy; account-only facts are omitted for candidates. Dashboard actions use button styling and announce the new tab. Both login copy surfaces report clipboard success/failure.

- 2026-10-30 (S1C round 2 verification): Reproduced 13 failing reviewer cases before the patch (68 passing); the same scoped regression now passes, with 237 tests across 25 files, including reviewer suites and the real-file DependencyMap composition test. The added signal-age boundary test passes separately (1 test). Full `pnpm knip` exits 0 (configuration hints only); `pnpm exec tsc --noEmit` passes; scoped Biome passes. Commands export `PORT=3942` and `PANDACORP_E2E_PORT=3942`, with Vitest `--maxWorkers=2`. Work remains IN_REVIEW and uncommitted. Reviewer tests and blessed baselines are unchanged. Browser rendering, Playwright, visual fidelity and the full verify.sh gate were not executed.
