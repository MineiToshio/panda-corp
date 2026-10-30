---
id: WO-25-001
type: work-order
slug: url-contract-v2
title: 'WO-25-001 — URL contract for v2 + the history flake'
status: ACTIVE
parent: FRD-25
foundation: false
implementation_status: IN_REVIEW
difficulty: high
reopen_count: 0
artifacts:
  - 'src/lib/navigation/**'
  - 'e2e/persistent-navigation.spec.ts'
  - 'e2e/persistent-navigation/**'
  - 'src/app/projects/[slug]/_components/wo-detail/**'
  - 'src/app/projects/[slug]/_components/tab-work-orders/**'
  - 'src/app/projects/[slug]/_components/tabbar.tsx'
  - 'src/app/manual/_tests/persistentNavigation.test.tsx'
  - 'src/components/modules/Nav/_tests/persistentNavigation.test.tsx'
  - 'src/app/proposals/_components/BacklogPanel/_tests/persistentNavigation.test.tsx'
  - 'src/app/proposals/_tests/persistentNavigation.test.tsx'
  - 'src/app/configuration/_tests/persistentNavigation.test.tsx'
source_requirements: [AC-25-001.1, AC-25-002.1, AC-25-003.1, AC-25-004.1, AC-25-005.1, AC-25-006.1, AC-25-007.1, AC-25-008.1, AC-25-009.1, AC-25-010.1, AC-25-011.1, AC-25-012.1]
dependsOn: []
last_updated: 2026-10-22
change_ref: persistent-navigation-history-flaky.md
---

# WO-25-001 URL contract for v2 + the history flake

## Summary

Makes the single URL codec ship every v2 key and legacy alias up front, while the current UI keeps working
(aliases and enumerated keys are pure, exported and tested, and each v2 surface applies them when it adopts
its keys), publishes the one place that says which sidebar destination a path belongs to (no shell
exemption), and splits the oracle e2e spec by family so each v2 work order updates only its own steps.
Then it runs the `debugging.md` investigation of the intermittent `persistent-navigation.spec.ts:342`
failure after back / forward and fixes it at its confirmed cause, in the product or in the spec. Rigor is
critical (the spec is an oracle surface).

## In Scope

**1. Codec additions in `src/lib/navigation/`** (all additive: nothing a v1 caller sees changes before its
owner adopts the v2 form; no URL write ever runs a mutation).

- `normalizeLegacyNavigation(href): string` (pure, idempotent, never throws, unknown input returned
  unchanged). It maps legacy forms to their v2 location while retaining the project, tab, document / work
  order, filters and the anchor (AC-25-004.1): workspace `party` to `summary`; `observabilidad` (the v1
  tab id) to `observability`; `work-orders` (path tail `/:wo/:view` or `?tab=Work orders` and the legacy
  display-name tabs) to `observability` with `wo` and `woview` (`summary` or `full`);
  `portfolioView=accounts` to `view=cuentas` (FRD-26 AC-26-002.1, both spellings accepted until every caller
  moved); `/manual/reference/:catalog/:item` to `/configuration/:catalog/:item` (catalog ids `skills`,
  `agents`, `rules`, `standards`; the v1 `commands` catalog maps to `skills`); a legacy `/board?idea=<slug>`
  (with or without `boardTab`, `doc`, `expanded`) to `/board/<slug>[/<tab>]` keeping the remaining keys
  (FRD-02, WO-02-016). It is **not** applied by the codec itself: the v2 owner of each surface calls it at
  its route boundary (WO-03-007 Portafolio, WO-04-010 workspace, WO-07-006 Configuración, WO-08-003
  Documentación, WO-02-016 idea page) and feeds the result to `NavigationCanonical`, because the v1 Party and
  Work orders tabs still exist until WO-04-010 (reconciliation 2026-10-22: this reading of "ships every key
  and alias up front" is confirmed; the codec ships the aliases, the owners apply them).
- `workspaceRouteState()` passes an unknown workspace tab segment through as `{ tab: "unknown", raw }`
  (the raw label kept) instead of calling `notFound()`, so WO-04-010 renders the drawn «Esta sección no
  existe» card under the compact header (REQ-04-002, oracle `project-tab-not-found`). An unknown project
  stays a route not-found (AC-25-007.1).
- A key registry with value sets and bounds for the keys v2 adds, and `validateNavigationQuery(context,
  state)` returning a typed result (`ok`, or `unsupported` with the key and the reason; never a thrown
  exception). Each surface validates the keys it owns; the global bounds gate (`routeHref`: repeated values,
  length, traversal) is unchanged. The key set below is identical, key for key, to the registry table in
  `../blueprint.md` § Key registry (the two must never diverge; gate finding B9). v2 keys:
  Portafolio `view` in `tarjetas`, `lista`, `cuentas`; Observabilidad `view` in `frd`, `tablero`, `deps`,
  `frd` (one FRD id), `state` (a comma-joined set of work-order states in canonical order, because repeated
  keys are rejected; a single value such as `state=review` stays valid), `wo`, `woview` in `summary`, `full`,
  `dag` in `frd`, `wo`, `focus` (a work-order id); these seven are the whole Observabilidad key set (WO-05-008
  and WO-12-007 use exactly these and report any other in the ledger);
  Cuentas `accountsQuery`, `accountsState` in `all`, `active`, `pending`, `candidates`, `reference`, and
  `account` (the open row); Configuración `q`, `type` (Habilidades), `approval` (Reglas), `severity` and
  `domain` (Estándares); Documentación `q` and `index` (present while the folded index is open); Logros
  `category`, `trophy` (the open trophy dialog id) and `eras` (the opened eras, a comma-joined set); the
  data-model viewer's `model` in `Diagrama`, `Esquema` (legacy `diagram` / `schema` aliased). Kept, and
  explicitly round-tripped because v2 surfaces restore from them: Propuestas `proposalsTab` in `resumen`,
  `memory`, `backlog` (the bare `/proposals` is `resumen`), `stream` in `promotions`, `candidate-lesson`,
  `prune`, `lesson` and `backlogItem` (Backlog filters, history paging and the discard confirmation stay out of
  the URL, AC-22-002.4); the FRD-02 surfaces' `boardQuery`, `category`, `discarded`, `idea`, the idea tab
  segment (`proposal`, `spec`, `architecture`, `documents`, `campaign`) plus the legacy `boardTab`, `doc` and
  the `/board/:idea/documents/:doc` segment, `phase`, `specFrd`, `architectureFrd`, `adr`; the data-model
  viewer's `modelQuery`, `entity`, `schemaTable`, `relationship` (the relationship selected through its
  «Relaciones N» row, AC-02-015.5, FRD-02 blueprint C4) and `expanded` in `1` (read as "restore the inline
  viewer", never a fullscreen request). Path-family state, kept: `hallTab`, `configSection`, `configItem`,
  `manualGroup`, `manualPage`; every other v1 key (for example the workspace's `change`) is kept unchanged.
  Unknown optional keys stay retained. No longer produced by any v2 surface (still retained if present):
  `trophyCategory` (Logros uses `category`, WO-10-016), `standardView` (removed by WO-07-006) and
  `backlogGroups` (AC-22-002.4, WO-22-002); per-connector canvas selection is Out of v2 (AC-02-015.2) and never
  had a key.
  A URL fragment (for example Inicio's `#worktrees-card`) survives every codec-built href.
- `activeDestinationPath(pathname): string | null` (single source of the active sidebar destination):
  `/` exact is Inicio; `/board/**` Tablero; `/portfolio/**` and `/projects/**` Portafolio (a project
  workspace keeps Portafolio active); `/proposals/**`, `/achievements/**`, `/manual/**`, `/configuration/**`
  their own; anything else `null`. There is no exemption list (AC-25-010.1). WO-19-002's `Nav` consumes it.
- `useUrlSearch(key)`: the hook every searchable surface uses; it always replaces the history entry, so
  search typing never pushes (AC-25-003.1). `useCanonicalSelection` and `NavigationCanonical` keep their
  contracts.
- One list of workspace tab path words: `routeState.ts` currently repeats the tab list that `urls.ts`
  already owns; both read one exported constant (DR-115). The v1 words (`party`, `work-orders`) stay in it
  until WO-04-010.
- Identity catalog and CLI (`identities.ts`, `identityCatalog.ts`, `scripts/navigation/**`) are unchanged.

**2. Split of the oracle spec by family (mechanical, assertions moved verbatim, titles preserved).** The
current single file is pinned by testids and routes that nine v2 work orders change in different waves; a
shared file would force several same-wave writers (DR-060) and break BL-0051. Result:

| New file | Tests it receives | Updated later by |
|---|---|---|
| `e2e/persistent-navigation.spec.ts` (core) | home and root default resolution; invalid resources, tails and traversal; legacy queries; post-build registration (the flake) | WO-03-007 (W4: the `/portfolio` root step), WO-04-010 (W5: tab steps, work-order aliases) |
| `e2e/persistent-navigation/_location.ts` | the shared `LocationCase` type and `assertLocation` helper | this WO only |
| `e2e/persistent-navigation/board.spec.ts` | the `board` case; Board document reader and campaign phase | WO-02-020 (W3), WO-02-016 (W4) |
| `e2e/persistent-navigation/model.spec.ts` | model schema, entity and search; expanded paste | WO-02-018 (W3) |
| `e2e/persistent-navigation/workspace.spec.ts` | the `portfolio` and `standalone` cases | WO-04-010 (W5) |
| `e2e/persistent-navigation/proposals.spec.ts` | the `proposals` case; the backlog read-only detail | WO-22-002 (W3), WO-17-008 (W4) |
| `e2e/persistent-navigation/achievements.spec.ts` | the `achievements` case | WO-10-016 (W4) |
| `e2e/persistent-navigation/configuration.spec.ts` | the `configuration` case; the configuration and agent read-only details | WO-07-006 (W4) |
| `e2e/persistent-navigation/manual.spec.ts` | authored Manual selection, anchor, paste and history (including the former `/manual/reference/...` detail) | WO-08-003 (W3) |
| `e2e/persistent-navigation/destinations.spec.ts` | nested destinations keep global highlights | WO-19-002 (W3) |

The number of tests and their titles are identical before and after; the first commit of this part changes
no assertion.

**2b. Same split for the unit suite `src/app/manual/_tests/persistentNavigation.test.tsx`** (reconciliation
2026-10-22: it pins five surfaces rebuilt by five W3/W4 work orders, the same DR-060 / BL-0051 problem as the
e2e spec). Cases moved verbatim (titles kept), each next to the module it renders:

| New file | Cases it receives | Updated later by |
|---|---|---|
| `src/app/manual/_tests/persistentNavigation.test.tsx` (kept) | manual reference detail, manual root default, unavailable manual target | WO-08-003 (W3) |
| `src/components/modules/Nav/_tests/persistentNavigation.test.tsx` | complete navigation prefixes and the nested-configuration exemption | WO-19-002 (W3) |
| `src/app/proposals/_components/BacklogPanel/_tests/persistentNavigation.test.tsx` | completed backlog item and status disclosure | WO-22-002 (W3) |
| `src/app/proposals/_tests/persistentNavigation.test.tsx` | proposals tab paste and history; promotion from its collection path | WO-17-008 (W4) |
| `src/app/configuration/_tests/persistentNavigation.test.tsx` | standard detail representation | WO-07-006 (W4) |

**3. The flake, by `docs/rules/debugging.md`** (card `persistent-navigation-history-flaky.md`, step
`persistent-navigation.spec.ts:342` "post-build registration: a non-first project retains identity through
WO Summary/Full/return in both workspaces"). Observed: under `verify.sh` `wo-detail-summary` is missing
after `goBack()`; in an isolated run, after returning to the list the click on the `party` tab does not
change the URL. Cause unconfirmed (product or spec).

1. Reproduce first. Run the step alone at least ten times and inside `bash .pandacorp/verify.sh` at least
   three times; keep each failing run's trace. Record, per run, the failing line, `history.length`, the URL
   and whether the page is hydrated at each step (a mount-gated control is a free oracle, LESSON-0185).
2. Timeline: when it last passed (`git log` on the spec, the navigation folder, `wo-detail`, `tabbar`,
   `NavigationCanonical`), what changed between (commits, upgrades, config), and whether the uncommitted
   pile in the tree or a parallel session was present.
3. Suspects, each discarded with direct evidence (read the code, run the command), never by "unlikely".
   The list always includes (a) another process writing the same state and (b) the harness itself:
   - S1 a parallel writer: the test mutates `e2e/fixtures/factory-root` in place (portfolio row, a new
     project folder) and the app writes `factory/gamification-ledger.json` and its lock while rendering;
     a second run on port 3900, a lane or the engine's gate worktree can share the files or the port
     (LESSON-0040);
   - S2 harness: first-compile of the new routes on `next dev`, cold boot, hydration right after
     `goBack()` or `wo-detail-back` (LESSON-0139, LESSON-0197), expect timeouts under load;
   - S3 product, history semantics: Summary / Full and the tab bar use `router.push`; whether, after
     `page.reload()`, the previous entry still belongs to the Next router, and what `popstate` does on it;
   - S4 product, canonicalization racing history: `NavigationCanonical` calls `router.replace` in an
     effect when the location differs from the server seed; after a back / forward traversal a stale seed
     could rewrite the entry just traversed;
   - S5 product, seed mismatch: `useSyncExternalStore` takes the server seed as its server snapshot; a
     click before hydration completes is lost;
   - S6 spec: no web-first guard between `toHaveURL(href$)` and the next tab click;
   - S7 isolation: state left by an earlier test of the same worker (ledger lock, server cache).
4. Confirmed cause = it predicts the symptom AND explains why the passing cases pass. Anything less stays
   a labelled hypothesis and does not get a fix.
5. Fix minimal: a product cause is fixed in `src/lib/navigation/**` or, when it lives in the history
   wiring of the Work orders detail or the tab bar, in `wo-detail/**`, `tab-work-orders/**` or `tabbar.tsx`
   (declared above for that reason; WO-05-008, WO-05-009 and WO-04-010 rewrite them later and inherit the
   regression test). A spec / harness cause is fixed in the spec with web-first assertions or a hydration
   guard, never with a hard wait, and never by weakening what the step proves.
6. Sibling audit: once confirmed, check every other step and every other `router.push` / `replace` caller
   that shares the cause.
7. Regression: a test anchored in the cause (unit when the cause is in the codec, e2e otherwise). A bug that
   passed every gate silently also names a missing oracle: add it.
8. If a genuine audit finds no cause, do not close as a mystery: land attribution guards (the per-step
   timeline logging of step 1 kept as an opt-in trace, a pre-step hydration assertion, a fixture-isolation
   assertion), record what was ruled out in the Status Note, and leave the card open.

## Out of Scope

- Applying the aliases or the validators in a surface (each v2 owner does, see above); changing any
  surface component outside the contingent files named in item 3.
- The behaviour of the expanded model viewer and of the sidebar (AC-25-011.1 and AC-25-010.1 halves that
  live in `DataModelViewer` and `AppShell`): WO-02-018 and WO-19-002 cite those ACs without owning them.
  Reconciliation 2026-10-22 (binding): ownership stays here per map §8.5 (this work order owns the URL halves
  and proves them with unit tests at the FRD-25 gate); WO-19-002 (`Nav` consumes `activeDestinationPath`) and
  WO-02-018 (inline restore, no native fullscreen) each cite the AC id in their own tests and their FRD
  gates re-verify the surface halves. No README table changes.
- The identity catalog schema, the CLI writer and `factory/navigation-identities.json`.
- Visual baselines: untouched (this WO changes no pixels).

## Requirements & Acceptance Criteria

FRD-25 is a headless contract; its criteria have no `REQ-25-*` ids (the ACs are the requirements).

- **AC-25-001.1** — (renamed from "AC-25-001", amended 2026-10-22, v2 plan) WHEN a user selects an idea/project, tab, document, Work Order, read-only reference/detail, campaign phase, model mode/entity/search, or supported list filter, THEN Mission Control SHALL encode that semantic location in the URL.
- **AC-25-002.1** — (renamed from "AC-25-002", amended 2026-10-22, v2 plan) WHEN the user reloads, pastes a copied URL into a new session, or uses Back/Forward, THEN the application SHALL restore the addressed resource/tab/detail/filter without executing a mutation or build command.
- **AC-25-003.1** — (renamed from "AC-25-003", amended 2026-10-22, v2 plan) WHEN a root page automatically chooses a project/tab/default Manual page, THEN the application SHALL replace the current history entry with the resolved explicit location; search typing SHALL replace rather than push each keystroke.
- **AC-25-004.1** — (renamed from "AC-25-004", amended 2026-10-22, v2 plan) WHEN old query-based Portfolio or standalone project links are opened, THEN the compatibility resolver SHALL retain the selected project, tab, document/WO, filters and anchor while normalizing to the corresponding presentation context.
- **AC-25-005.1** — (renamed from "AC-25-005", amended 2026-10-22, v2 plan) WHEN a project display name, card filename or folder changes and its dedicated identity reference is retained/reconciled, THEN the identity catalog SHALL retain its immutable ID and reserved public slug; an explicit public-slug rename SHALL preserve the previous slug as an alias.
- **AC-25-006.1** — (renamed from "AC-25-006", amended 2026-10-22, v2 plan) WHEN a future idea/project is registered after the dashboard build, THEN the same dynamic route families SHALL resolve it without generating a new page or rebuilding Mission Control.
- **AC-25-007.1** — (renamed from "AC-25-007", amended 2026-10-22, v2 plan) WHEN an explicit project/idea is unknown or a legacy alias is ambiguous, THEN the application SHALL show an unavailable/not-found result rather than choosing the first unrelated item.
- **AC-25-008.1** — (renamed from "AC-25-008", amended 2026-10-22, v2 plan) WHEN a path/query has an unsupported tab/tail, repeated query values, excessive length, traversal, or an unknown document/detail, THEN routing SHALL reject it or display bounded unavailable content; document reads SHALL retain the existing scoped allowlist.
- **AC-25-009.1** — (renamed from "AC-25-009", amended 2026-10-22, v2 plan: no Party tab in v2) WHEN navigation occurs inside an embedded Portfolio workspace or a standalone project workspace, THEN every child/return link SHALL retain that context and identity, including a non-first project's WO Summary/Full, documents and Changes.
- **AC-25-010.1** — (renamed from "AC-25-010", amended 2026-10-22, v2 plan: no shell exemption in v2) WHEN a descendant route is active on phone/tablet/desktop, THEN the global destination highlight (a project workspace keeps Portafolio active), the sidebar navigation (tablet rail, phone drawer) and keyboard behavior SHALL remain correct, and no route SHALL be exempt from the shell.
- **AC-25-011.1** — (renamed from "AC-25-011", amended 2026-10-22, v2 plan: no viewport-filling dialog in v2) WHEN an expanded model URL is restored, THEN the inline model viewer SHALL be restored without requesting native fullscreen until a user gesture; hover, drag coordinates, transient loading/errors, unsaved forms and destructive confirmations SHALL remain ephemeral.
- **AC-25-012.1** — (renamed from "AC-25-012", amended 2026-10-22, v2 plan) WHEN catalog registration is repeated or reads occur, THEN one explicit CLI writer SHALL allocate identities idempotently and atomically, GET reads SHALL never allocate/write identities, and an existing corrupt catalog SHALL fail loudly.

**How each is proven at this work order's gate** (the v1 UI is still mounted at W0, so the behavioural halves
that live in v2 surfaces are cited, not owned, by those surfaces' work orders):

| AC | Evidence in this WO | v2 surface that re-verifies it (cites the AC) |
|---|---|---|
| 001.1, 002.1 | codec round trip (`parse(serialize(state))`) for every family and every v2 key; the family e2e specs (direct, reload, fresh paste, Back, Forward); the repaired step 342 | each surface's own family spec |
| 003.1 | unit tests with a history spy: `useCanonicalSelection` and `useUrlSearch` replace, never push; the core spec's root-default step | WO-03-007, every searchable surface |
| 004.1 | `normalizeLegacyNavigation` cases keeping project, tab, document / WO, filters and anchor; the core spec's legacy-queries step | WO-04-010 |
| 005.1, 006.1, 012.1 | existing identity tests (`identities.test.ts`, the reviewer CLI suite) re-cited with the new ids; the post-build registration step (new project resolved without rebuild; CLI repeat adds nothing) | none (unchanged) |
| 007.1, 008.1 | resolver and bounds tests: unknown project / idea, ambiguous alias, repeated and oversized query values, traversal; enumerated-key validator tests | each surface that validates its keys |
| 009.1 | the repaired step 342 (non-first project keeps identity through WO Summary / Full / return in both workspaces); `navigationHref` preserves context | WO-04-010, WO-05-008 |
| 010.1 | `activeDestinationPath` table test (no exemption, workspace keeps Portafolio) | WO-19-002 (shell, phone / tablet / desktop, keyboard) |
| 011.1 | codec: `expanded` is a retained, validated selection that never implies a fullscreen request | WO-02-018 (inline restore, no dialog) |

## Components & Interfaces

`CMP-25-codec` (`urls.ts`, `routeState.ts`), `CMP-25-aliases`, `CMP-25-key-registry`,
`CMP-25-destination`, `CMP-25-url-state` (`useUrlState`, `useUrlSearch`, `useCanonicalSelection`,
`NavigationCanonical`), `CMP-25-identity` (unchanged), `CMP-25-e2e-oracle` (the split spec). Interfaces
`IF-25-parse`, `IF-25-href`, `IF-25-normalize`, `IF-25-validate`, `IF-25-destination`, `IF-25-search`.
Definitions in `../blueprint.md`.

## Reuse

Everything extends `src/lib/navigation/`; no second codec (DR-057, DR-115). The e2e helpers keep using
`gotoHydrated` from `e2e/_hydration.ts` (canonical, untouched).

## Installs

None.

## Visual reference

N/A: headless contract, no screen and no oracle state.

## Tests this WO owns

- Unit tests next to the codec: round trips per family and v2 key, `normalizeLegacyNavigation` (including
  idempotence and unknown input), `validateNavigationQuery`, `activeDestinationPath`, the history spy tests.
  Property-based round trip (fast-check) for `parse(serialize(state))`.
- The split e2e specs and the split unit suite (both mechanical, items 2 and 2b) and the regression test of
  the confirmed cause.
- Updated citations of the new ids in implementer-authored tests; the existing reviewer suites
  (`src/lib/navigation/_tests/*.reviewer.test.ts`) are never edited by the implementer.

## Derogated tests

- `src/lib/navigation/_tests/*.reviewer.test.ts` cite the old ids `AC-25-NNN`. They are listed to the
  FRD-25 gate reviewer for re-citation (DR-080); the additive codec changes must keep them green as they
  are.
- `e2e/persistent-navigation.spec.ts` steps that v2 surfaces change are NOT touched here: the `party` tab
  step, the `/portfolio` auto-select step and the work-order tail steps stay valid on the v1 UI mounted at
  W0 and are replaced by WO-03-007 and WO-04-010 in their own waves.

## Definition of done

- Written first (RED), then GREEN; the AC evidence table above is met; the repaired step passes ten
  consecutive isolated runs and three consecutive `verify.sh` runs.
- `.pandacorp/verify.sh` green: biome, `tsc --strict`, vitest, knip, madge, smoke, shell.
- Error path per failure mode: an unsupported value, repeated or oversized query, traversal and an unknown
  resource each reject or show bounded unavailable content; an existing corrupt catalog still fails loudly.
- Non-functional: all of it is pure and server-or-client safe; no filesystem access moves into client
  bundles; no new dependency.
- Cite `LESSON-0185` (e2e flake family) and `LESSON-0365` (URL state keys stable ids, never display names).

## Dependencies

None (W0). Consumers: every v2 surface WO (they depend on this one in the map).

## Status Note

### 2026-10-30 — Independent gate repair

Owner-directed repair supersedes the earlier surface deferral for AC-25-004.1,
AC-25-010.1 and AC-25-011.1. Both workspace route boundaries now normalize aliases
before selection, preserving context and WO representation; their canonical replace
keeps the fragment. The shell has no exemptions and Nav uses the destination resolver.
Canonical Esquema restores schema mode. URL restoration keeps the model inline;
only an explicit expand gesture can open the existing fullscreen presentation.
Malformed Board tails remain unchanged by the normalizer. Six approved v2 test
repairs were applied and the three independent reviewer probes restored byte-for-byte.
No visual baseline or identity catalog changed.

Verification (2026-10-30, PORT=PANDACORP_E2E_PORT=4310):

- Final targeted navigation/model/shell suite: 142/142 passed across 31 files, including
  the restored reviewer boundaries and acceptance probes, workspace alias regressions,
  and the gesture/history regression (`restoration.test.tsx`).
- Workspace integration suite: 153 passed, 1 failed. The unchanged v1 test in
  `wo-detail.integration.test.tsx` demands `wo-board` for legacy `tab=work-orders`;
  FRD-25 requires that location to resolve to Observability. It was left red,
  without weakening the test.
- `bash .pandacorp/verify.sh --only=biome,tsc,knip,vitest`: Biome, TypeScript and
  knip passed; Vitest 8,074 passed / 15 failed. Thirteen failures are in the
  explicitly excluded snapshot-panel scope. The other two are the v1 board assertion
  above and `BuildModePicker.test.tsx`'s failed-storage fallback (expected Equilibrado
  pressed, observed false). No BuildModePicker code or tests were changed.
- Desktop and mobile aliases E2E both failed before executing their bodies: Chromium
  aborted with macOS `MachPortRendezvousServer: Permission denied (1100)`. The full
  38-case navigation E2E attempt was interrupted after the same launch failure.
  Browser acceptance, reload/history and responsive behavior remain unverified.
- Reviewer probes match the source archive byte-for-byte (SHA-256 comparison).
  `git diff --check` passed. No blessed baselines or `.pandacorp` state were staged.

Logs and the temporary port-4310 Playwright override were retained in
`/private/tmp/frd25-evidence/`. The override was removed from the working tree.
The Next server on 4310 (PID 3154) remained after interrupting Playwright; an explicit
attempt to stop that PID was denied by the process sandbox. This is not a green
FRD gate: WO-25-001 is IN_REVIEW, not VERIFIED.

Commit limitation (2026-10-30): explicit-path `git add` and the requested Conventional
Commit both failed because the sandbox denied creating
`/Users/Shared/Proyectos/panda-corp/.git/worktrees/orch-frd-25/index.lock`.
No commit was created; edits remain in this worktree.


2026-10-30 implementation hand-off (fast lane, DR-126).

Delivered the additive URL contract: `WORKSPACE_TABS` is shared with the workspace grammar;
`workspaceRouteState(href, segments): NavigationState` preserves an unsupported tab as
`{ project, tab: "unknown", raw }`, including Spanish labels, while malformed tails still reject.
The independent ruling d69cffa5 resolved the previous contradictory reviewer vector; reviewer tests
are untouched by this implementation.

New pure interfaces: `normalizeLegacyNavigation(href: string): string` (opt-in, idempotent,
unknown/malformed input unchanged); `validateNavigationQuery(context: NavigationContext,
state: NavigationState): NavigationQueryResult` (`{ ok: true }` or `{ ok: false, key, reason }`);
`activeDestinationPath(pathname: string): string | null`; `useUrlSearch(key: string)` returns
`[string, (string | ((previous: string) => string)) => void]` with replace-only writes.
`NAVIGATION_KEYS` publishes each surface's owned rules. `WORK_ORDER_STATE_ORDER` publishes
`todo, in_progress, review, done, fail` for canonical comma-joined state sets.

Consumer seams and inherited decisions: aliases are NOT implicitly applied by the codec;
v2 surface owners call the normalizer at their route boundary. The v1 path-to-tab spelling
(`observabilidad`, `memoria`, Spanish board/hall tab ids) is intentionally retained until those
owners adopt v2. Public project references remain the existing dedicated identity catalog,
not a slug guessed from a display name (LESSON-0365). Dynamic catalog/filter ids are bounded
syntactically here; the owning surface validates membership against its loaded catalog.
Accounts search counts Unicode code points (200), whereas the existing global route bounds
remain unchanged. Expanded model state is a selection, never a fullscreen command. Unknown
optional keys and fragments survive. No identities, CLI, components, dependencies or visual
baselines changed. Visual reference is N/A (headless WO).

Moved the navigation E2E oracle into the eight declared family specs plus `_location.ts`;
core retains roots, invalid URLs, legacy queries and post-build registration. The formerly
multi-family read-only-details test retains its title/assertions in each destination's spec.
The unit suite is split among Manual, Nav, BacklogPanel, Proposals and Configuration with
its original case titles/assertions intact. The standalone behaviour spec covers detail
reload and Back/Forward while observing command requests.

History investigation (LESSON-0185): the initial ten-run reproduction yielded 9 passes and
one failed card navigation. Its retained trace (`.pandacorp/run/wo25-evidence/repro-repeat3.zip`)
shows Fast Refresh cancelling the detail GET and reloading the list while this builder was
editing code. That run is contaminated, NOT evidence of the original defect's cause. A second
stable-code run passed 10/10; log `.pandacorp/run/wo25-repro-stable.log`. Process inspection
found no competing project dev server on 3900; the unrelated 4030 server was left alone.
The v1 navigation wiring still uses Next push/replace; no production history change is justified
by this reproduction. The original cause remains UNCONFIRMED and its card remains open.
As prescribed by the inconclusive-audit fallback, `_history.ts` records URL/history length,
actual-node hydration and push/replace/popstate stacks as test attachments (console output
opt-in via `NAVIGATION_TRACE`), asserts fixture isolation, and guards the next interactive
node after reload/native return without fixed waits or click retries.

Tests: `src/lib/navigation/_tests/{aliases,keys,destinations,routeState,useUrlState,urls,identities}.test.*`,
the five split persistentNavigation unit files, `e2e/persistent-navigation.spec.ts`,
`e2e/persistent-navigation/*.spec.ts`, and `e2e/frd-25-persistent-navigation.behaviour.spec.ts`.
The round-trip property is exercised over a deterministic Unicode/delimiter corpus with the
installed test runner; fast-check is not installed and this WO forbids new dependencies.
Local unit verification: 14 files / 61 tests passed; final scoped and browser verdicts follow
through the build engine commands. The fast-lane single scoped self-verify replaces the older
three-full-verify reproduction requirement; no full-gate certification is claimed here.
