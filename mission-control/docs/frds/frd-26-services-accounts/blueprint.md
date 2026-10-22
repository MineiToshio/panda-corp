---
id: FRD-26-blueprint
type: blueprint
parent: FRD-26
status: DRAFT
implementation_status: PLANNED
readiness_gate:
grounding_gate:
consistency_gate:
last_updated: '2026-10-22'
---
# FRD-26 — Services and account directory — Feature blueprint (v2 «Órbita»)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how the read-only services and accounts views are built on top
> of the platform. It references the platform architecture
> ([`../../product/architecture.md`](../../product/architecture.md)): § "Services and account directory
> (FRD-26)", § 6 (`services/`), § 7 (read-only invariant, copy accessor, URL as state) and the Route map;
> the decision is [ADR-0011](../../adr/ADR-0011-services-account-directory.md). FRD-26 defines no `REQ-26-*`
> ids: its acceptance criteria are the requirements (`AC-26-NNN.1`, and `AC-26-011.1`).

## Purpose

The reader and its safe DTO shipped in v1 and are kept. v2 draws two views of the same table on the Órbita
system: the project's **Cuentas** tab (the workspace's fifth tab) and the factory-wide directory as the third
Portafolio view, **Cuentas**, with a search, a state filter and a row dialog, plus the bounded invalid-source
notice. One work order, WO-26-001 (W3), rebuilds the UI and aligns the reader's issue codes with the design;
WO-03-007 mounts the directory in Portafolio and WO-04-010 mounts the project table in the workspace.

## Data boundary (kept from v1)

`src/lib/services/services.ts` is the single read-only, request-cached join (`getServicesDirectory`, a
`React.cache`). The catalog parser projects provider recipes; the private parser whitelists identity, date,
access, automation and known quota fields. Unknown extensions, `credential_ref`, raw shared config and
secrets never enter the DTO. Private account identities are excluded from the Manual's separate public
projection (`manual.ts`).

The factory root resolves through `PANDACORP_FACTORY_ROOT`; `PANDACORP_ACCOUNTS_FILE` may override the
private registry (default: the sibling `../pandacorp-vault/services/accounts.yaml`). Project relationships
derive from the existing portfolio pointers plus the private registry's project pointers, restricted by
canonical filesystem path to the factory's projects parent. The reader scans no folder, no environment file,
no cloud account and no client-supplied path.

Schema v1 (catalog, private registry, project links) is unchanged: catalog providers expose
id / name / type / purpose / adoption / dashboard_url / reuse_policy / environment_policy / automation /
quota_notes / sources; private accounts expose id / provider_id / login_email / display_name / access_status /
observed_at / plan / accepting_new_projects / automation_status / next_step / notes and an optional quota
snapshot; project links carry project_id / resource_slug / services whose resources expose only environment /
resource_name / native_resource_id. HTTPS dashboard links reject userinfo, fragments, non-HTTPS protocols and
arbitrary query parameters (a stable non-secret `project` query is allowed). Duplicated ids / slugs,
malformed states, unknown providers, dangling account references and production-as-dev resource names fail
explicitly; shared native provider projects (Google OAuth, Vercel, Sentry) stay valid, and the environment
resource check is scoped to Cloudflare environment resources. These metadata checks do not certify
cloud-side permissions.

## Components & Interfaces

| ID | Kind | Artifact | Responsibility | Traces |
|---|---|---|---|---|
| `CMP-26-reader` | module | `src/lib/services/{services,parsers,validation,types}.ts` | The read-only join and the whitelisted DTO; v2 changes only the issue shape. | AC-26-006.1, AC-26-007.1, AC-26-008.1, AC-26-010.1 |
| `CMP-26-views` (v2) | module | `src/lib/services/views.ts` | The single derivation of both tables: project rows (ordered) and directory rows with their derived state. | AC-26-003.1, AC-26-005.1, AC-26-011.1 |
| `CMP-26-manual-projection` | module | `src/lib/services/manual.ts` | Public recipes and sources for the Documentación Services pages; never identities. | AC-26-009.1 |
| `CMP-26-accounts-table` | UI | `src/components/modules/ServicesDirectory/AccountsTable.tsx` | The one table of both views (service link, copy-able login, environment chips, status; cards below 1024 px). | AC-26-003.1, AC-26-011.1, AC-26-010.1 |
| `CMP-26-project-accounts` | UI | `src/components/modules/ServicesDirectory/ProjectAccounts.tsx` | Project tab body: intro, issue notice, table, empty state. | AC-26-006.1, AC-26-007.1, AC-26-011.1 |
| `CMP-26-accounts-directory` | UI (client) | `src/components/modules/ServicesDirectory/AccountsDirectory.tsx` (+ the account dialog) | Global view body: intro, issue notice, search, state chips with counts, table, row dialog. | AC-26-001.1, AC-26-002.1, AC-26-004.1, AC-26-005.1, AC-26-007.1 |
| `CMP-26-facade` (transitional) | UI | `src/components/modules/ServicesDirectory/ServicesDirectory.tsx`, `copy.ts` | Keeps the two v1 call sites compiling until WO-03-007 and WO-04-010 move; deleted by the last consumer. | none (history) |
| `IF-26-getServicesDirectory` | interface | `getServicesDirectory(): ServicesDirectoryData` | The request-scoped sole data source of both private views. | AC-26-006.1, AC-26-008.1 |
| `IF-26-readServiceCatalog` | interface | `readServiceCatalog(root?)` | Public recipes only. | AC-26-009.1 |
| `IF-26-projectServiceRows` (v2) | interface | `projectServiceRows(data, projectId): ProjectServiceRow[]` | One row per allocation, ordered by status then A to Z; its length is the tab's count badge. | AC-26-011.1, AC-26-006.1 |
| `IF-26-directoryAccountRows` (v2) | interface | `directoryAccountRows(data): DirectoryAccountRow[]` | One row per account plus one per provider with no account, each with one derived state; multiple identities of one provider stay separate. | AC-26-003.1, AC-26-005.1 |

## Contracts

**DTO (unchanged, `types.ts`).** `ServiceProvider` (public recipe), `ServiceAccount` (whitelisted identity),
`ServiceAllocation` (derived project link, no secret reference), `ServicesDirectoryData` (`providers`,
`accounts`, `allocations`, `issues`). Nothing else reaches the browser.

**Issue (changed).** `ServiceIssue = { code, source }`.

| Field | Values |
|---|---|
| `code` | `missing` (file absent), `unreadable` (any other read failure, oversized registry), `invalid` (YAML or contract failure), `duplicate` (repeated id or project slug), `dangling` (reference to an absent provider or account), `productionAsDev` |
| `source` | a closed-set file label: `factory/services/catalog.yaml`, `services/accounts.yaml`, `projects/<project folder>/.pandacorp/accounts/services.yaml`; never an absolute path, raw value or exception text |

The labels and reasons rendered are the catalogue keys `workspace.cuentas.issues.*` (the same notice in both
views). A broken private registry yields no accounts and one `invalid` issue; a bad project link yields one
issue for that project and leaves the others intact.

**Views (new, pure).**
- `ProjectServiceRow`: provider name and validated dashboard URL, purpose (source language), login or none,
  environments (name plus resource name), status. Order: `configured`, `proposed`, `inactive`, then any
  other status, then A to Z by provider name, one row per allocation (a provider can appear twice).
- `DirectoryAccountRow`: row key (`<provider-id>:<account-id or candidate>`), provider, optional account,
  its allocations, and a **directory state** `active | pending | candidate | reference`, mutually exclusive,
  precedence `reference`, `candidate`, `pending`, `active`; the captured counts are 7 / 1 / 2 / 0.

**Component props (published for WO-03-007 and WO-04-010).**
- `AccountsTable`: `{ variant: "project"; services: ServicesDirectoryData; projectId: string }` or
  `{ variant: "directory"; rows: DirectoryAccountRow[]; onOpenDetail(rowKey: string): void }`.
- `ProjectAccounts`: `{ services: ServicesDirectoryData; projectId: string }`.
- `AccountsDirectory`: `{ services: ServicesDirectoryData }`; search, filter and the open row live in the
  URL (`accountsQuery`, `accountsState`, `account`, keys shipped by WO-25-001, `view=cuentas` set by the
  Portafolio page).

**URL.** The Cuentas view is `/portfolio?view=cuentas`; `portfolioView=accounts` is accepted and normalized
to it (FRD-25 `normalizeLegacyNavigation`, applied by the Portafolio page). Search typing replaces history;
no URL write runs a mutation.

## Dependencies & Risks

- Upstream: FRD-13 primitives (WO-13-012: `Table`, `Dialog`, `Notice`, `SearchField`, `FilterChip`, `Chip`,
  `StateDot`, `CopyText`, `EmptyState`), FRD-25 keys (WO-25-001), `t()` (WO-13-010), the factory service
  catalog and the vault registry (read-only). Downstream: WO-03-007 (Portafolio), WO-04-010 (workspace),
  the Documentación Services pages (`manual.ts`).
- Risk, oracle: the captured `accounts-source-error` shows every account listed **plus** two notices; a
  genuinely broken registry lists none. The state is replayed by a reader-level injection of the close-out
  Visual QA harness (oracle-recipes F2), not by the product; WO-26-001 proves the notice with real malformed
  fixtures.
- Risk, directory state: the precedence rule is a derivation; it must reproduce the captured 7 / 1 / 2 / 0
  from the prototype fixture, otherwise the builder reports it instead of adjusting.
- Risk, transition: the facade and `copy.ts` stay until WO-03-007 (W4) and WO-04-010 (W5) stop importing
  them; a forgotten deletion is caught by knip once unreferenced.

## Build Plan

> The build engine reads this table; it does not infer dependencies.

| WO | Depends on | Artifacts | Foundation | Parallel with |
|---|---|---|---|---|
| WO-26-001 | WO-13-012, WO-25-001 | `src/components/modules/ServicesDirectory/**`, `src/lib/services/**`, `e2e/cuentas.spec.ts` | false | W3; with WO-19-002, WO-21-003 and the other W3 surface work orders |

- **Order and parallelism.** One coarse work order: the reader's issue shape, the two derivations and the
  three components are one cohesive capability that two later surfaces consume; splitting it would put two
  writers on `ServicesDirectory/` and `src/lib/services/`.
- **Artifacts, disjoint within a wave (DR-060).** No other W3 work order writes `src/lib/services/**` or the
  `ServicesDirectory` folder. `PortfolioViews.tsx` (inside that folder) is deleted by WO-03-007 in W4, and
  the facade and `copy.ts` by their last consumer; serialized by wave, never parallel.
- **Integration order.** WO-26-001 (W3) before WO-03-007 (W4) and WO-04-010 (W5).
- **Cross-FRD dependencies.** WO-13-012 (primitives) and WO-25-001 (codec keys). It adds `WO-25-001` to the
  map's `dependsOn` because it consumes `useUrlSearch` and the Cuentas keys; the wave does not change.
- **Visual spec.** `mocks/services-accounts.html`: `#accounts-project`, `#portfolio-accounts`,
  `#portfolio-accounts-filter`, `#portfolio-accounts-dialog`, `#accounts-source-error` (FDD-26); assets: none
  beyond the exported icons.

## Superseded (v1 history)

`work-orders.md` (SVC-01 to SVC-04, the 2026-10-20 attended delivery slices) is kept as delivery history;
the scripts ignore it. There was no v1 work-order file, so nothing is superseded.

## Work Orders

[`WO-26-001`](work-orders/wo-26-001-cuentas.md): the only one. Index:
[`work-orders/README.md`](work-orders/README.md).
