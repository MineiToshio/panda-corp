---
id: FRD-25-blueprint
type: blueprint
parent: FRD-25
status: ACTIVE
implementation_status: VERIFIED
readiness_gate: passed 2026-10-22
grounding_gate: passed 2026-10-22
consistency_gate: passed 2026-10-22
last_updated: 2026-10-31
---
# FRD-25 — Persistent navigation URLs — Feature blueprint (v2 «Órbita»)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049) of a headless cross-cutting contract: how every shareable
> selection of every page family lives in the URL. It references the platform architecture
> ([`../../product/architecture.md`](../../product/architecture.md)): § "Persistent navigation and resource
> identity (FRD-25)", the Route map, § 6 (`navigation/`) and § 7 "URL as state". Identity is decided in
> [ADR-0010](../../adr/ADR-0010-persistent-navigation-identity.md). FRD-25 has no `fdd.md`, no screen and no
> oracle state. Its ACs are the requirements (it defines no `REQ-25-*` ids).

## Purpose

v1 shipped the pure codec, the dynamic route adapters and the identity catalog (all kept, see "Boundaries"
and "Identity" below, still accurate). v2 changes the route families (eight workspace tabs, no Party or
separate Work orders tab, Portafolio views, Observabilidad views, a flat Configuración / Documentación
split) and removes the shell exemption and the viewport-filling model dialog. **One work order, WO-25-001
(W0), ships every v2 key and legacy alias up front** so no later work order edits the codec (map §0.1), and
fixes the intermittent history failure of the oracle e2e spec. It is a W0 work order on purpose: every
surface depends on it.

## Boundaries (kept from v1)

`src/lib/navigation/urls.ts` is the single pure path / query codec. `useUrlState.ts` subscribes to browser
history / popstate with `useSyncExternalStore`; the URL owns selection, with an SSR route seed provider for
deep-link hydration. Client-owned selections use atomic native history transitions; workspace / server-owned
changes use Next navigation through the same href codec so data is re-resolved on the server.

Dynamic catch-all page adapters reuse the existing page and component trees. They bound path and query
sizes, reject repeated values and validate tab / tail grammar. Identity resolution stays server-only.
Explicit unknown project / idea paths never fall back. Valid unpublished artifacts stay addressable with their
pending states. No filesystem access moves into client bundles.

## Identity (kept from v1)

See ADR-0010. `factory/navigation-identities.json` is an owner-private schemaVersion 1 catalog with separate
idea and project resources: immutable ID, public slug, aliases, legacy names, locator and an optional
idea-to-project ID. The only writer is `scripts/navigation/identities.mjs` (`--dry-run` / `--apply`, a lock,
atomic replacement). Card `navigation_id` and the project `.pandacorp/navigation-identity.json` are
references. A missing-catalog legacy fallback is read-only; an existing malformed catalog or an
unregistered entity fails loudly. The unit-test harness (`vitest.setup.ts`, `src/test/ownerPrivateState.ts`)
reads the running checkout's own factory root as catalog-absent, so the owner's private catalog never decides a
test outcome (LESSON-0450); fixture roots still use the real reader. Public names are never recomputed after
registration (LESSON-0365: URL state keys stable ids, never display names). All identity code and its tests
are unchanged by v2 except the AC id citations.

## Components & Interfaces

| ID | Kind | Artifact | Responsibility | Traces |
|---|---|---|---|---|
| `CMP-25-codec` | module | `src/lib/navigation/urls.ts`, `routeState.ts` | Parse and serialize every family; bounds gate (`routeHref`); tab-grammar validator reading one exported tab list (was duplicated). | AC-25-001.1, AC-25-002.1, AC-25-008.1 |
| `CMP-25-aliases` (v2) | module | `src/lib/navigation/aliases.ts` | Legacy-to-v2 normalization retaining context. | AC-25-004.1, AC-25-009.1 |
| `CMP-25-key-registry` (v2) | module | `src/lib/navigation/keys.ts` | Enumerated v2 keys, value sets, bounds, typed validator. | AC-25-001.1, AC-25-008.1, AC-25-011.1 |
| `CMP-25-destination` (v2) | module | `src/lib/navigation/destinations.ts` | Which sidebar destination a pathname belongs to; no exemption. | AC-25-010.1 |
| `CMP-25-url-state` | hook module | `src/lib/navigation/useUrlState.ts`, `NavigationCanonical.tsx` | `useUrlState`, `useCanonicalSelection`, `NavigationCanonical`; v2 adds `useUrlSearch`. | AC-25-002.1, AC-25-003.1 |
| `CMP-25-identity` | module | `src/lib/navigation/identities.ts`, `identityCatalog.ts`, `scripts/navigation/**` | Idempotent identity allocation, resolution, aliases; GET reads never write. | AC-25-005.1, AC-25-006.1, AC-25-007.1, AC-25-012.1 |
| `CMP-25-e2e-oracle` (v2) | e2e specs | `e2e/persistent-navigation.spec.ts`, `e2e/persistent-navigation/**` | The oracle: direct, reload, fresh paste, Back / Forward per family, split by family. | all |
| `IF-25-parse` | interface | `parseNavigationUrl(href): NavigationState` | Path and legacy query to one selection record; paths win. | AC-25-001.1, AC-25-002.1 |
| `IF-25-href` | interface | `navigationHref(href, patch): string` | Canonical href preserving unrelated query and the anchor. | AC-25-001.1, AC-25-009.1 |
| `IF-25-normalize` (v2) | interface | `normalizeLegacyNavigation(href): string` | Pure, idempotent, never throws, unknown input unchanged. | AC-25-004.1 |
| `IF-25-validate` (v2) | interface | `validateNavigationQuery(context, state)` | `{ ok: true } \| { ok: false; key; reason }`. | AC-25-008.1 |
| `IF-25-destination` (v2) | interface | `activeDestinationPath(pathname): string \| null` | `"/"`, `"/board"`, `"/portfolio"`, `"/proposals"`, `"/achievements"`, `"/manual"`, `"/configuration"` or `null`. | AC-25-010.1 |
| `IF-25-search` (v2) | interface | `useUrlSearch(key)` | `[value, setValue]`; every write replaces history. | AC-25-003.1 |
| `IF-25-resolve` | interface | `resolveProjectNavigation`, `resolveIdeaNavigation`, `getProjectNavigation`, `getIdeaNavigation` | Server-only identity resolution; unknown means unavailable, never the first item. | AC-25-005.1, AC-25-007.1 |

## Contracts

All shapes are at contract altitude; WO-25-001 owns the code.

### Route families (FRD-25 and the platform Route map; unchanged shape, v2 words)

`/`, `/board/:idea/:tab`, `/portfolio/:project/:tab`, `/projects/:project/:tab`, `/proposals/:tab`,
`/achievements/:tab`, `/manual/:group/:page`, `/configuration/:section/:item`. Paths use English fixed words,
persisted readable slugs and case-preserving encoded document / work-order keys. Workspace tabs:
`summary · spec · observability · architecture · accounts · changes · documents · commands`.

### Legacy aliases (`normalizeLegacyNavigation`)

| Legacy | v2 location | Notes |
|---|---|---|
| `…/party` | `…/summary` | no Party tab in v2 |
| `…/work-orders` and `?tab=Work orders` (and other display-name `tab` values) | `…/observability` | project, filters, anchor retained |
| `…/work-orders/:wo/:view` or `?wo=&wotab=` | `…/observability?wo=:wo&woview=:view` | `view` is `summary` or `full`; `wotab` is renamed `woview` |
| `…/observability?view=timeline` / `?view=dag` | `?view=frd` / `?view=deps` | the Línea de tiempo is gone |
| `?portfolioView=accounts` | `?view=cuentas` | both spellings accepted until every caller moved (AC-26-002.1) |
| `/manual/reference/:catalog/:item` | `/configuration/:catalog/:item` | Referencia now lives in Configuración (FRD-08 REQ-08-007) |
| `?model=diagram` / `?model=schema` | `?model=Diagrama` / `?model=Esquema` | |
| `?project=<name>&tab=…` (old query-based Portfolio / standalone links) | the path form of the same selection | the v1 compatibility, kept |

The codec does not apply aliases by itself. **Portfolio and standalone workspace route boundaries apply
`normalizeLegacyNavigation` now**, including legacy query roots, Party and work-order details. Validation
of the original tail precedes normalization; the hydration seed, resolved selection and canonical URL use
the normalized location. Other surface owners apply their aliases when they adopt v2 (WO-07-006,
WO-08-003, WO-02-016). Both workspace families resolve canonical defaults with server redirects,
including the default document path and WO Summary query. The two Board boundaries also redirect
legacy aliases before rendering, preserving their existing canonicalization contract. Portfolio passes the original request href
through its catch-all boundary, so comparison is against the requested route rather than a synthetic
query-only root. The overview normalizes the synthetic trailing slash before comparison.

**2026-10-31 reviewed repair:** the first finite event timestamp establishes a baseline, just like
`stateVersionMoved`; only a later event or machine-state advance requests a refresh. Existing five-second
coalescing remains. `NavigationProvider` lives in the root layout and wraps imperative workspace
navigation in a shared React transition, marking it pending synchronously before calling Next.
`useBackgroundRefresh` defers requests during that transition, coalesces them, reevaluates the current
subscriber predicate after commit, and cancels requests on unmount. `WoLiveRefresh` (including its
coalescing timer), `FraguaLive` (event/state and expiry timer), `WoNavigationRefresh`, and the dashboard
watcher all use it. `DetailTabs`, `TabBar`, `WoViews`, `FraguaToken` and sidebar `NavigationLink` enter
that same transition. Links retain Next's prefetch and modifier-click behavior through public onNavigate.

Canonical URL renaming through `history.replaceState` with `__NA` is removed: it bypassed Next and
left canonicalUrl/tree stale. `NavigationCanonical` can only mark an exact current URL, without a URL
argument. Shallow client selections still use Next's patched native history bridge and a custom
`missionControlHref` marker. No internal router fields are fabricated or used to detect pending work.

After a native WO return or hard reload, tests wait for the layout POST after hydration commit before
interacting. Deterministic regressions inject live frames through EventSource and delay Full RSC by
500 ms; network latency is an adversarial stimulus, not a completion wait. Canonical refresh asserts
the requested URL and a subsequent history commit. Back to Documents counts RSC requests.

**2026-10-30 gate repair:** the workspace exposes the eight tabs in AC-04-012.1 order. With no selected
work order, Observabilidad renders the v1 work-order list followed by `ObservabilidadTab` until
WO-04-010 replaces that surface; selecting `wo` renders only its detail. The transitional dependency view
accepts canonical `view=deps`, and the global accounts directory restores `view=cuentas` while accepting
`portfolioView=accounts` as a legacy alias. Document and Changes links clear both `wotab` and `woview`.
Party has no tab, render branch or hint. **La Fragua remains unreachable in the UI until WO-06-013 lands**;
its implementation is not re-exposed through Summary or Observabilidad during the transition.
Model URL restoration stays inline; native fullscreen and the expanded presentation require an explicit
expand gesture.

### Key registry (`validateNavigationQuery`) — the complete v2 key set

This table is THE key registry; WO-25-001's In Scope list states the same set, key for key (gate finding B9).
Each surface validates the keys it owns; unsupported means "reject or bounded unavailable content", not a
silent default. Repeated keys stay rejected by the bounds gate, so every multi-valued key is one
comma-joined value in canonical order. Status: **v2** = added or re-spelled by v2; **kept** = a v1 key a v2
surface still produces and restores (explicitly round-tripped).

| Context | Key | Allowed values and bounds | Status |
|---|---|---|---|
| Portafolio (`/portfolio`) | `view` | `tarjetas` (default), `lista`, `cuentas` (`portfolioView=accounts` is the accepted alias) | v2 |
| Portafolio, Cuentas | `accountsQuery` | free text, ≤ 200 characters | v2 |
| | `accountsState` | `all` (default), `active`, `pending`, `candidates`, `reference` | v2 |
| | `account` | the open row key, `<provider-id>:<account-id or candidate>` | v2 |
| Observabilidad (the whole set: these seven) | `view` | `frd` (default), `tablero`, `deps` | v2 |
| | `frd` | one FRD id | v2 |
| | `state` | comma-joined set of the work-order board's state ids, canonical order (a single value such as `state=review` stays valid) | v2 |
| | `wo`, `focus` | a work-order id | v2 |
| | `woview` | `summary` (default), `full` | v2 |
| | `dag` | `frd` (default), `wo` | v2 |
| Configuración (`/configuration`) | `q` | free text search | v2 |
| | `type` (Habilidades), `approval` (Reglas), `severity` and `domain` (Estándares) | the filter's value ids | v2 |
| Documentación (`/manual`) | `q` | free text search | v2 |
| | `index` | present while the folded index is open | v2 |
| Logros (`/achievements`) | `category` | a trophy category id | v2 |
| | `trophy` | the open trophy dialog id | v2 |
| | `eras` | comma-joined set of opened era ids | v2 |
| Propuestas (`/proposals`) | `proposalsTab` | `resumen` (bare `/proposals`), `memory`, `backlog` | kept |
| | `stream` | `promotions`, `candidate-lesson`, `prune` | kept |
| | `lesson`, `backlogItem` | the open lesson / backlog item id (Backlog filters, history paging and the discard confirmation stay out of the URL, AC-22-002.4) | kept |
| Tablero and idea page (`/board`) | `boardQuery`, `category`, `discarded`, `idea` | board search, category filter, discarded view, selected idea | kept |
| | the idea tab segment | `proposal`, `spec`, `architecture`, `documents`, `campaign`; legacy `boardTab` and `doc`, and the `/board/:idea/documents/:doc` segment | kept |
| | `specFrd`, `architectureFrd`, `adr` | the open FRD card / ADR of the digests | kept |
| Idea page, La Campaña | `phase` | a campaign phase id | kept |
| Data-model viewer (idea page and workspace Arquitectura) | `model` | `Diagrama` (default), `Esquema` (legacy `diagram` / `schema` aliased) | v2 |
| | `modelQuery`, `entity`, `schemaTable` | search text, selected entity, open schema table | kept |
| | `relationship` | the relationship selected through its «Relaciones N» row (AC-02-015.5; FRD-02 blueprint C4) | kept |
| | `expanded` | `1`; a restored expanded URL renders the inline viewer and never requests native fullscreen until a user gesture (AC-25-011.1) | kept |

Path-family state, kept (derived from the path, not query keys): `hallTab`, `configSection`, `configItem`,
`manualGroup`, `manualPage`. Every other v1 key (for example the workspace's `change`) is kept unchanged.
Unknown optional keys are retained for compatibility. No longer produced by any v2 surface (still retained
if present, like any unknown optional key): `trophyCategory` (the v1 Trofeos filter; Logros uses `category`,
WO-10-016), `standardView` (the Estándares sub-tabs WO-07-006 removes) and `backlogGroups` (AC-22-002.4,
WO-22-002). Per-connector selection of the data-model canvas is Out of v2 (AC-02-015.2) and never had a key of
its own; `relationship` stays because the «Relaciones N» row selection is a v2 model selection (AC-25-001.1).

### Destination (`activeDestinationPath`)

| Pathname | Result |
|---|---|
| `/` exactly | `/` |
| `/board`, `/board/**` | `/board` |
| `/portfolio/**`, `/projects/**` | `/portfolio` (a project workspace keeps Portafolio active) |
| `/proposals/**`, `/achievements/**`, `/manual/**`, `/configuration/**` | the same root |
| anything else | `null` (no destination highlighted; the shell still renders) |

There is no exemption list: `configuration` and every other route render inside the shell
(`SHELL_EXEMPT = []`, FRD-19).

### Search typing

`useUrlSearch(key)` is the only way a search field writes the URL: it replaces the current entry on every
keystroke and never pushes (AC-25-003.1). Surfaces with a search (Tablero, Configuración, Documentación,
Cuentas, the data-model viewer) use it.


## Decision: the oracle spec is split by family

The v1 `e2e/persistent-navigation.spec.ts` pins testids and routes of ten surfaces that nine v2 work orders
change in different waves, four of them in W3. One shared file would give several same-wave writers (DR-060)
and could not satisfy BL-0051 (a broken step must be repaired in the work order that breaks it). WO-25-001
therefore moves the tests, assertions and titles unchanged, into `e2e/persistent-navigation/<family>.spec.ts`
plus a shared `_location.ts`, and leaves the codec-centric core in `e2e/persistent-navigation.spec.ts`. The
table of who updates which file is in WO-25-001. This is a feature-level decision, not an ADR: it changes no
platform contract. The unit suite `src/app/manual/_tests/persistentNavigation.test.tsx`, which pins the
Manual, the sidebar prefix rule, the Backlog, Propuestas and Configuración, is split the same way by the same
work order (reconciliation 2026-10-22; it was the one W3 artifact overlap between WO-08-003 and WO-19-002).

## Reconciliation (2026-10-22, binding)

- **Aliases are applied by owners, not by the codec.** `normalizeLegacyNavigation` is pure and exported.
  As amended on 2026-10-30, Portfolio and standalone workspace boundaries already apply it, superseding
  the former WO-03-007 / WO-04-010 deferral. Party is removed from workspace navigation and resolves to
  Summary; La Fragua stays unreachable until WO-06-013. Configuración WO-07-006, Documentación WO-08-003
  and idea page WO-02-016 apply their aliases at their own boundaries.
- **AC-25-010.1 / AC-25-011.1 stay owned by WO-25-001** (map §8.5): the URL halves are proven here by unit
  tests; WO-19-002 and WO-02-018 cite the ids in their own tests and their FRD gates re-verify the surface
  halves.
- **Unknown workspace tab** passes through `workspaceRouteState()` as `unknown` with its raw label (WO-04-010
  draws the in-tab not-found card); an unknown project stays a route not-found.
- **Key requests honoured up front:** FRD-02 board and idea keys plus the legacy `/board?idea=` resolution,
  FRD-07 `q`/`type`/`approval`/`severity`/`domain`, FRD-08 `q`/`index`, FRD-10 `category`/`trophy`/`eras`,
  FRD-17/22 `proposalsTab`/`stream`/`lesson`/`backlogItem`, the Observabilidad seven-key set (with a
  comma-joined `state`), the `observabilidad` and `work-orders/<wo>/<view>` aliases; a fragment survives
  every codec-built href.

## Dependencies & Risks

- **History verification (2026-10-31):** the initial 10/10 run did not discriminate the baseline and
  cannot justify closure. Independent review reproduced loss of the Summary entry during live refresh
  and exposed the stale canonical router tree. Canonical-plus-refresh is part of the supported flow,
  not an excluded edge case. The new deterministic tests must fail against the base before closure.
  Isolated fixtures avoid dev HMR noise; they do not fix the application race. The real-root sandbox
  separately denies ledger writes; no factory data is edited by the verification.
- No upstream work order (W0). Downstream: every v2 surface work order depends on WO-25-001 (map): the
  shell (WO-19-002) consumes `activeDestinationPath`; Portafolio, workspace, Configuración and
  Documentación apply `normalizeLegacyNavigation`; every searchable surface uses `useUrlSearch`.
- Risk, history flake: the intermittent failure may be product or harness; the work order investigates under
  `debugging.md` before touching either (LESSON-0185). The contingent product files (`wo-detail/**`,
  `tab-work-orders/**`, `tabbar.tsx`) are declared so a confirmed cause there can be fixed without an
  undeclared write.
- Risk, shared oracle: until each surface work order updates its split spec file, the old steps keep passing
  on the v1 UI; a surface WO that forgets its file turns its own gate red, which is the intended signal.
- Risk, aliases not applied by the codec: a v2 owner that forgets to call the normalizer leaves a legacy URL
  as a 404; the FRD gate's legacy-queries step in the core spec catches it.

## Navigation history verification

The focused configuration at `e2e/persistent-navigation/playwright.config.ts` prepares a copy of the
frozen fixture under ignored `test-results/navigation-fixture`, puts compiler temporaries under
`test-results/navigation-tmp`, and binds the server and mutation test to the same copy. It runs one
worker, zero retries and its own server; it never reuses another lane's listener. The test rejects an
override outside the original fixture or this project's `test-results/` tree. Existing source fixtures
and the default shared Playwright configuration stay unchanged. The fixture teardown still checks
source bytes and restores files. Preparation copies without deleting directories; an interrupted
fixture with stale registration fails its explicit precondition rather than silently passing.
The snapshot excludes the derived ledger's transient lock directory and temporary files before
traversal/read, since the writer can release them concurrently. It still reads the stable ledger for
teardown and all authored sources; unrelated read errors propagate. Filtering after reading caused
two ENOENT failures after successful navigation in the first expanded production run (38/40 passed).

Run from `mission-control/`, with an available isolated port:

```sh
PORT=4902 PANDACORP_PROD_SMOKE=1 PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:4950/pw pnpm exec playwright test --config=e2e/persistent-navigation/playwright.config.ts --repeat-each=10
```

Unset `PANDACORP_PROD_SMOKE` for development. The production mode performs a full `next build` and
`next start`; no TypeScript bypass. The configuration selects only the registration regression and
the history cases, including deterministic live races, canonical refresh and document traversal. Retained failure traces include clicks, requests, browser errors and console
history events with document identity, timestamps, old/new state and stacks, surviving native links
and hard reloads. Filter remote-server traces by the current page id when earlier contexts are present.

**2026-10-31 differential evidence:** the previous candidate lost the Summary history entry in
5/5 executions of the independent delayed-RSC/first-live-frame probe. The new first-frame test also
fails against a production build of base `840f2ce9` (history length remains two instead of three).
The candidate's canonical-refresh regression requested a URL without `woview=summary`, proving the
metadata-only rename did not synchronize Next. The earlier ordinary 10/10 runs were nondiscriminating.

| Suspect | Evidence and disposition |
|---|---|
| Dev/load | Production reproduces deterministically, ruling out dev compilation as the root cause. Fixture/HMR isolation remains useful test hygiene only. |
| Competing router actions | First live frame calls refresh during pending push; refresh's replace semantics lose the Summary entry. Baseline the initial event and defer subsequent refreshes through a shared transition. |
| Canonical metadata | Renaming with __NA bypasses Next canonicalUrl/tree; server redirects now establish both URL and tree before interactive content. |
| Harness | A delay-free run can miss the race. Delay Full RSC and inject the first/live-throttled frame explicitly; assert history length plus hard-reload traversal. Transient ledger locks remain excluded before snapshot reads. |
| Parallel writer | Production baseline and candidate are served sequentially on the owned port from immutable builds; frame injection needs no factory writes. |

Final production verification: eight cases repeated ten times, **80/80 passed** with one worker and
zero retries, including **40/40** targeted first-frame/throttled races, canonical refresh and
Document Back cases. The unchanged independent delayed-RSC probe passed **5/5**, each preserving
history length two to three. The real-factory Portfolio walkthrough retained `woview=summary` after
6.5 seconds, then restored Summary/Full through hard reload and Back/Forward. Its independent
Document Back probe observed the correct canonical tree and zero RSC requests (one measurement,
not a latency guarantee). Focused units passed 84/84 across 13 files; the full production build,
focused TypeScript and Biome checks passed. Evidence: lane B `review2/final.log`, `final-race.log`,
`final-real-walk.log`, `final-real-net.log` and `final-unit.log`. Earlier green runs are not closure
evidence. Real-root ledger writes were denied by the sandbox and file-watcher EMFILE errors were
visible; neither is claimed fixed by this navigation repair.

## Build Plan

> The build engine reads this table; it does not infer dependencies.

| WO | Depends on | Artifacts | Foundation | Parallel with |
|---|---|---|---|---|
| WO-25-001 | — | `src/lib/navigation/**`, `e2e/persistent-navigation.spec.ts`, `e2e/persistent-navigation/**`, `src/app/projects/[slug]/_components/wo-detail/**`, `src/app/projects/[slug]/_components/tab-work-orders/**`, `src/app/projects/[slug]/_components/tabbar.tsx`, `src/app/manual/_tests/persistentNavigation.test.tsx`, `src/components/modules/Nav/_tests/persistentNavigation.test.tsx`, `src/app/proposals/_components/BacklogPanel/_tests/persistentNavigation.test.tsx`, `src/app/proposals/_tests/persistentNavigation.test.tsx`, `src/app/configuration/_tests/persistentNavigation.test.tsx` | false | W0; with WO-13-010, WO-22-001, WO-02-019 |

- **Order and parallelism.** One coarse work order: the codec additions, the spec split and the flake fix
  are one contract and one file family; splitting them would put two writers on `src/lib/navigation/**`.
- **Artifacts, disjoint within a wave (DR-060).** In W0 no other work order writes `src/lib/navigation/**`,
  `e2e/persistent-navigation*` or the three contingent workspace paths (WO-13-010 owns tokens and layout,
  WO-22-001 `src/lib/backlog`, WO-02-019 the DataModelViewer and `e2e/logical-data-model.spec.ts`). Later
  writers of the same paths are serialized by wave: WO-04-010 (W5) for `tabbar.tsx`, WO-05-008 / WO-05-009
  (W6) for `tab-work-orders/**` and `wo-detail/**`, and the family spec owners listed in WO-25-001.
- **Integration order.** WO-25-001 first; every surface after it.
- **Cross-FRD dependencies.** None upstream. Cross-FRD consumers: WO-19-002, WO-03-007, WO-04-010,
  WO-07-006, WO-08-003 and the owners of the split spec files.
- **Visual spec.** None: headless contract, no oracle state.

## Superseded (v1 history)

`work-orders.md` (NAV-01 to NAV-04, the manual 2026-10-17 delivery slices) is kept as delivery history; the
scripts ignore it. There was no v1 work order file, so nothing is superseded.

## Work Orders

[`WO-25-001`](work-orders/wo-25-001-url-contract-v2.md): the only one. Index:
[`work-orders/README.md`](work-orders/README.md).
