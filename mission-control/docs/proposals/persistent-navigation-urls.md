# Persistent navigation URLs — research and proposed contract

Date: 2026-10-17. Status: APPROVED for implementation by the owner. Canonical behavior is now specified in [FRD-25](../frds/frd-25-persistent-navigation/frd.md); the observations below record the pre-change research baseline. Audited source baseline: `91821c015e06f9dfbf9045637baf24fcf19160b4`. Owner asks for a complete inventory before implementation. Preserve the centered application frame and current shared content components.

## Findings and evidence boundary

The app has eight navigable page families: `/`, `/board`, `/portfolio`, `/projects/[slug]`, `/proposals`, `/achievements`, `/manual`, `/configuration`. API routes are transports/actions, not navigation destinations.

A real Chromium browser against the current port1987 service reproduced three refresh failures: selecting board project → Spec leaves `/board` and refresh returns to the board; Proposals → Backlog leaves `/proposals` and refresh returns to Memoria; Achievements → Rangos leaves `/achievements` and refresh returns to Resumen. Private receipts: `.pandacorp/comms/persistent-navigation-urls/`. Other inventory findings below are source-audited, not claimed as browser-exercised.

| Surface | Current ownership / observation | Required addressable location |
|---|---|---|
| Inicio `/` | Existing links into projects; no top-level tab shell | Root, and generated links to canonical project destinations |
| Tablero | `BoardShell` owns local query/category/openSlug/discarded/intake; `CardDetail` owns local activeTab/doc selection | Card identity, Propuesta/Spec/Arquitectura/Documentos/Campaña, selected document, campaign phase; list search/category/discarded view |
| Portfolio | `page.tsx` reads `?project`, `?tab`, `?doc`, `?wo`, `?wotab`; selected project matches display name, falling back to first row | Stable project identity plus all nine workspace tabs and nested selections; normalize a default auto-selected project into its own URL |
| Standalone project | `/projects/[slug]` recomputes the slug from current display name via `nameToSlug`; tab/subselection are queries | The standalone workspace also needs stable identity/tab/detail paths, reusing the same resolver/route codec while retaining its current standalone presentation |
| Propuestas | `ProposalsTabs` local Memoria/Backlog; stream/promotion/backlog selection is local | Both tabs, selected BL item or lesson/promotion detail, expanded source stream and status filters |
| Logros | `HallTabs` local Resumen/Misiones/Trofeos/Estadísticas/Rangos; trophy category local | All five tabs, category/filter and existing meaningful detail targets |
| Documentación | `ManualShell` local authored group/page, reference catalog and cross-nav skill/agent; `DocReader` also has local agent selection | All Tutorial/Guides/Concepts/Workflows pages, four reference catalogs and skill/agent/rule/standard details; heading anchors |
| Configuración | `ConfigurationShell` local Skills/Agents/Rules/Standards; child selection state | Four sections and selected skill/agent/rule/standard; standard summary/detail representation |
| Workspace nested views | WO FRD/state filters; Cambios selected card/status disclosure; Observabilidad timeline/DAG; document reader; shared Spec/Architecture FRD and ADR modals; logical model diagram/schema/search/selection | Restore these meaningful locations alongside the parent project/tab, including selected schema entity |

Source anchors: `src/app/board/_components/{BoardShell/BoardShell,CardDetail/CardDetail}.tsx`; `src/app/portfolio/{page.tsx,selection.ts}`; `src/app/projects/[slug]/{page.tsx,ProjectWorkspace.tsx,_components/tabbar.tsx}`; `src/app/proposals/_components/ProposalsTabs/ProposalsTabs.tsx`; `src/app/achievements/_components/HallTabs.tsx`; `src/app/manual/{ManualShell,DocReader,DocNav}.tsx`; `src/app/configuration/ConfigurationShell.tsx`; `src/components/modules/DataModelViewer/DataModelViewer.tsx`.

### Existing context-loss seam

ProjectRail uses `?project=<display name>`. Workspace TabBar merges its query correctly, and the document-link adapter explicitly retains context. However, `wo-board.tsx`, `wo-detail.tsx` and its back link construct bare `?tab=work-orders...` links that omit `project`. On the embedded Portfolio page the selection resolver then defaults to the first project when the query loses that field. This must be covered by a non-first-project integration test. Other producers to migrate include dashboard cards, GoParty/Enter Forge, FrdDriftBadge, document Markdown links, manual cross-links and nav active-state matching. `isNavActive` currently uses exact paths, so nested routes would lose their destination highlight without a bounded prefix-aware update. Configuration shell exemptions currently match only the exact configuration root and must include its descendants.

## Recommended identity model

Use an immutable internal ID plus a readable public slug **stored once**, rather than recomputing routes from the display name. Public examples remain `/board/pandasaga/spec` and `/portfolio/personal-page/work-orders`; these are proposed readable slugs, not claims that those aliases are registered today.

- IDs survive display-name changes, card filename changes, folder moves and idea → project handoff. An idea keeps its identity when it advances; a created/adopted project has its own identity, with an explicit idea→project reference. Do not equate every board card with a project or merge distinct ideas that point to one project. Folder moves require registration reconciliation; an ID alone cannot discover an unknown new filesystem location.
- The public slug is reserved within its resource namespace (idea vs project), independently of display names. Board and Portfolio may use the same readable label for related but distinct resources. Renaming a project changes the visible title, not its URL. An explicit URL rename reserves a new slug and retains the old slug as a permanent alias/redirect; never recycle old aliases for another project.
- Names alone are insufficient: the current project resolver is name-derived and cannot identify a renamed project from its old name. Existing `IdeaCard`/`PortfolioEntry`/`ProjectListItem`/`ProjectStatus` reader contracts expose no persistent project UUID; this capability needs a real identity migration, not a claim that current slugs are already immutable.
- Recommended source: an owner-private factory identity catalog, with resource kind, immutable ID, canonical public slug and aliases. Cards and a dedicated project identity metadata file carry **references** to that record. Do not put navigation identity into build `status.yaml`, infer it from absolute paths, or make Mission Control write identities during page rendering.
- Before coding, pin the catalog schema/location and producer contract in the blueprint/ADR. It must have one writer, an explicit idea→project bridge, uniqueness/reserved-word checks, idempotent allocation and atomic writes. The central catalog's locator/backup contract must survive factory relocation; the vault is a backup, not a second writable identity source. Add owner-data ignore/backup rules before creating the catalog. If the catalog is unavailable, report it; never regenerate IDs during reads.
- Existing-project backfill reconciles card → portfolio → project path first, assigns one ID per verified idea or project entity (retaining their explicit relationship), previews ambiguities/collisions and retains all existing names/known slugs as aliases. Old URLs already broken by an undocumented past rename cannot be recovered automatically without historical alias evidence.

This is preferable to exposing opaque UUIDs everywhere: readable URLs and rename stability can coexist. W3C's persistent-URI guidance supports separating addresses from changeable names/organization: [Cool URIs don't change](https://www.w3.org/Provider/Style/URI.html).

## Proposed route map

Retain current top-level English bases to avoid an unrelated base-path migration; visible UI labels remain Spanish. Use lowercase public slugs and fixed route words. Preserve case in entity IDs (e.g. WO-02-007) and document keys; encode and validate them rather than lowercasing them. Never expose absolute filesystem paths.

| Family | Canonical examples / route grammar |
|---|---|
| Inicio | `/` |
| Board | `/board`; `/board/<slug>/<tab>` with `proposal`, `spec`, `architecture`, `documents`, `campaign` |
| Portfolio | `/portfolio/<slug>/<tab>` with `summary`, `spec`, `work-orders`, `architecture`, `changes`, `party`, `observability`, `documents`, `commands` |
| Work-order detail | `/portfolio/<slug>/work-orders/WO-02-007`; `/portfolio/<slug>/work-orders/WO-02-007/full` |
| Project documents | `/portfolio/<slug>/documents/<document-key-segments>`; same document-tail grammar under board Documents and standalone project Documents; heading via `#anchor` |
| Proposals | `/proposals/memory`; `/proposals/backlog`; `/proposals/backlog/BL-0240`; `/proposals/memory/<collection>/<lesson-id>` for existing selectable items |
| Achievements | `/achievements/<tab>` with `summary`, `missions`, `trophies`, `statistics`, `ranks`, e.g. `/achievements/ranks` |
| Authored Manual | `/manual/<group>/<page-slug>`; groups `tutorial`, `guides`, `concepts`, `workflows` |
| Manual reference | `/manual/reference/<catalog>[/<entry-id>]`; catalogs `commands`, `agents`, `rules`, `standards` |
| Configuration | `/configuration/<section>[/<entry-id>]`; sections `skills`, `agents`, `rules`, `standards` |
| Standalone project | `/projects/<slug>/<tab>` with the same workspace tab/detail grammar; legacy `/projects/<old-slug>?tab=...` canonicalizes within this standalone context, retaining nested selection/query/anchor |

The existing root layout already exports `dynamic = "force-dynamic"`; retain request-time discovery. These are dynamic route families, **not one generated page/file per project**. A newly registered idea/project is addressable immediately through the same route handlers; it must not require a Mission Control rebuild. Next.js provides dynamic and optional catch-all segments for this: [Dynamic Route Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes). Consult the installed Next16.2.9 contracts during implementation; the online current reference may describe newer optional capabilities, which are not prerequisites here.

Paths identify the resource/tab; query parameters preserve view state and filters, e.g. `/portfolio/pandasaga/architecture?model=schema&entity=User`, `/portfolio/pandasaga/observability?view=dag&wo=WO-02-007`, `/portfolio/pandasaga/work-orders?frd=FRD-02&state=IN_REVIEW`, `/board?q=story&category=ai&discarded=1`, `/proposals/backlog?state=doing`, `/achievements/trophies?category=quality`. Use namespaced query keys for overlapping controls. FRD/ADR read dialogs can use `?frd=FRD-02` / `?adr=ADR-0009`; Changes uses the stable selected change-card key. Unknown/unsupported values must have explicit validation behavior.

## Navigation behavior and refresh contract

1. The URL is the source of truth for selected resource, tab, nested reader/detail and meaningful view/filter state. Components may keep ephemeral display state; they must not maintain a conflicting selected-tab copy.
2. Direct paste, refresh, a copied link in a fresh session, and Back/Forward must render the same semantic selection. LocalStorage may preserve theme/collapsed-rail preferences, but is not a substitute for addressable navigation.
3. Ordinary meaningful navigation uses history push; search typing/high-frequency view updates use bounded replace/debounce rather than adding one history entry per keystroke. Next integrates the native History API with its router, but server-owned selections still require actual resolvable routes and server validation: [Next linking/navigation](https://nextjs.org/docs/app/getting-started/linking-and-navigating).
4. Resolve/canonicalize root defaults with replace. If `/board/<slug>` chooses the stage-default tab, write the resulting explicit tab into the canonical URL so phase changes do not move an already-shared location on refresh. If `/portfolio` auto-selects a first project, canonicalize that resolved identity/tab so list reordering cannot silently switch it.
5. Explicit invalid/unknown projects never fall back silently to the first project. Show a bounded not-found/unavailable state. A valid but unpublished Spec/Architecture target stays addressable and explains that the artifact is pending. Distinguish invalid tab from valid-but-unavailable content; choose and test a canonical policy for the former.
6. Preserve context while switching nested readers and returning from detail. Generated hrefs come from one typed route codec/catalog, reused across both workspaces and cross-links. URL parser and serializer must round-trip; no ad-hoc `?tab=` concatenation.
7. Existing `/portfolio?project=...&tab=...&wo=...&wotab=...&doc=...` and `/projects/...` links migrate through a deterministic compatibility resolver, retaining available filters/anchors and their embedded-vs-standalone presentation context. Name-based legacy keys need a recorded alias migration, not recomputation from a renamed current title.
8. Restore document heading anchors and use browser-compatible scroll restoration for history/reload where possible; distinguish semantic location from exact diagram pixels. Preserve selected entity/schema mode/filter rather than encode every animation frame, hover, tooltip or drag coordinate. Persist theme/rail preferences separately.
9. Fullscreen has a browser constraint: native fullscreen cannot be automatically requested merely because a refreshed URL says expanded. The standard requires transient user activation. Restore the expanded viewport-filling model dialog, with a user action to re-enter native fullscreen: [Fullscreen standard](https://fullscreen.spec.whatwg.org/). Never promise automatic native fullscreen restoration.
10. Do not restore destructive confirmation dialogs or replay actions/build commands on GET/reload. Read-only content dialogs are addressable; transient copy/error/loading states, live cursors and unsaved user input are not automatically reconstructible navigation. Any new form draft persistence requires its own explicit contract.

## Implementation seams, lifecycle and documentation scope

1. Pin the identity, routing and compatibility contracts before implementing. Mission Control FRDs02/03/04/07/08/10/19/22 own affected behavior, with related FRDs05/11/12/13 for WO, command-mode, observability and accessible focus. Add a cross-cutting navigation FRD or explicitly shared contract instead of copying router rules into each feature.
2. Implement identity readers and a pure typed route parser/serializer; create server-resolvable dynamic route adapters around existing shared components. Keep Portfolio and the standalone project workspace shared. No one-page-per-project generation or filesystem reads moved to the browser.
3. Route board, Portfolio/legacy project pages, then Proposals/Achievements/Manual/Configuration and nested detail/filter state. Keep shell active destination, keyboard behavior, accessible titles/focus, and mobile menu behavior correct on descendant routes.
4. Update all internal route producers together: dashboard, rails, Work Orders, back links, Markdown docs, changes/drift shortcuts, Party links, Manual diagrams and reference cross-navigation. Do not change the SSE event project key merely because public navigation IDs change; explicitly adapt that bridge.
5. Separate factory producer work: `new-idea`, `scaffold`/`spec`, `adopt`, registration reconciliation and any explicit rename flow must reserve/reuse identity, preserve aliases, bridge card/project metadata, and never overwrite identity during overlay upgrade. Version the contract, backfill existing owner records non-destructively and include the personal identity catalog in vault backup/sync. Update relevant templates/standards and the Manual (DR-046) if that operating surface changes. New-project registration must be tested end-to-end.
6. Align the PRD, owning FRDs/FDDs/blueprints/work-order scope, routing ADR, API/document-link contract, shell exemptions, E2E route catalog and decision log when implementation lands. This proposal does not mark those future requirements implemented or mutate machine-status fields.

## Required acceptance evidence

- Navigate → refresh → same project/tab/nested selection for every family and supported nested state; repeat through pasted URLs and fresh contexts, Back/Forward and mobile navigation.
- Choose a **non-first** Portfolio project, open a WO, switch Summary/Full and return: identity never changes. Repeat document/Markdown and Party/Changes shortcuts.
- Display-name rename, different same-name projects, card filename/folder move, project handoff and explicit public-slug rename preserve identity/old links or produce an explicit unresolved diagnostic; collisions never route to a different project.
- Add/adopt a new project after Mission Control's production build: its URLs resolve without rebuilding the dashboard; rerun registration with no new identity/alias allocation.
- Direct unknown ID/slug/tab/document/detail, encoded path traversal, oversized/duplicate parameters and unavailable project artifacts never select an unrelated first item or read arbitrary files. Resolve document keys only through the existing project-scoped allowlist.
- All old supported URL forms preserve resource/tab/detail/anchor through canonical redirects; ambiguous legacy aliases fail clearly rather than pick by list order.
- Live refresh/SSE changes data without resetting explicit URL selection; stale responses cannot swap content from another project.
- Model diagram/schema and expanded fallback restore appropriately; native fullscreen still requires an actual user gesture. Destructive actions never replay during navigation.

## Research sources

Primary code anchors above and current browser receipts are the source for this app's behavior. External primary references establish framework/browser feasibility and URI persistence, not that this app already satisfies the proposal: Next.js dynamic route segments, Next.js linking/navigation, W3C persistent URI guidance, WHATWG Fullscreen Standard (linked inline). No new dependency is required by the proposed route-family approach.
