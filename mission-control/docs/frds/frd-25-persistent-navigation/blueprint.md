---
id: FRD-25-blueprint
type: blueprint
parent: FRD-25
status: DRAFT
implementation_status: PLANNED
readiness_gate:
grounding_gate:
consistency_gate:
last_updated: '2026-10-22'
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

The codec does not apply aliases by itself: applying `party → summary` while the v1 Party tab exists would
make that tab unreachable. Each v2 surface applies the normalizer at its route boundary when it removes the
v1 form (WO-03-007, WO-04-010, WO-07-006, WO-08-003) and passes the result to `NavigationCanonical` (a replace,
never a push).

### Key registry (`validateNavigationQuery`) — keys v2 adds or re-spells

Each surface validates the keys it owns; unsupported means "reject or bounded unavailable content", not a
silent default. Repeated keys stay rejected by the bounds gate, so every multi-valued key is one
comma-joined value in canonical order.

| Context | Key | Allowed values and bounds |
|---|---|---|
| Portafolio (`/portfolio`) | `view` | `tarjetas` (default), `lista`, `cuentas` |
| Portafolio, Cuentas | `accountsQuery` | free text, ≤ 200 characters |
| | `accountsState` | `all` (default), `active`, `pending`, `candidates`, `reference` |
| | `account` | the open row key, `<provider-id>:<account-id or candidate>` |
| Observabilidad | `view` | `frd` (default), `tablero`, `deps` |
| | `frd` | one FRD id |
| | `state` | comma-joined set of the work-order board's state ids, canonical order |
| | `wo`, `focus` | a work-order id |
| | `woview` | `summary` (default), `full` |
| | `dag` | `frd` (default), `wo` |
| Idea page and workspace Spec / Arquitectura | `model` | `Diagrama` (default), `Esquema` |
| | `entity`, `modelQuery`, `schemaTable` | selected entity, search text, open schema table (kept) |
| | `expanded` | `1`; a restored expanded URL renders the inline viewer and never requests native fullscreen until a user gesture (AC-25-011.1) |
| Idea page, La Campaña | `phase` | a campaign phase id (kept) |

Kept unchanged: every other v1 key (`boardTab`, `doc`, `proposalsTab`, `lesson`, `stream`, `backlogItem`,
`hallTab`, `trophyCategory`, `manualGroup`, `manualPage`, `configSection`, `configItem`, `standardView`,
`specFrd`, `architectureFrd`, `adr`, `change`, `boardQuery`, `category`, `discarded`, …). Unknown optional
keys are retained for compatibility. A key the v2 design retires (`relationship`, per-connector selection) is
simply no longer produced.

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
platform contract.

## Dependencies & Risks

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

## Build Plan

> The build engine reads this table; it does not infer dependencies.

| WO | Depends on | Artifacts | Foundation | Parallel with |
|---|---|---|---|---|
| WO-25-001 | — | `src/lib/navigation/**`, `e2e/persistent-navigation.spec.ts`, `e2e/persistent-navigation/**`, `src/app/projects/[slug]/_components/wo-detail/**`, `src/app/projects/[slug]/_components/tab-work-orders/**`, `src/app/projects/[slug]/_components/tabbar.tsx` | false | W0; with WO-13-010, WO-22-001, WO-02-019 |

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
