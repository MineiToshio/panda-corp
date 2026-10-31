---
id: WO-12-007
type: work-order
slug: dependency-map
title: 'WO-12-007 Dependencias: deterministic two-level dependency map'
status: ACTIVE
parent: FRD-12
foundation: false
implementation_status: VERIFIED
difficulty: high
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_components/deps/**'
  - 'src/lib/deps-layout/**'
  - 'src/lib/frds/frd-index.ts'
  - 'src/lib/frds/_tests/frd-index.test.ts'
source_requirements: [REQ-12-004, REQ-12-006]
dependsOn: [WO-13-012, WO-25-001, WO-05-001]
last_updated: 2026-10-30
---

# WO-12-007 Dependencias: deterministic two-level dependency map

> **`implementation_status` is the build engine's source of truth.** `PLANNED → IN_PROGRESS → IN_REVIEW →
> VERIFIED`; never hand-set `VERIFIED` without the FRD gate passing.

## Summary

Builds the Observabilidad «Dependencias» view as a self-loading `DependencyMap`: the «Grafo de dependencias» card
with its two levels, FRD boxes two per row with aggregated cross-FRD lines, and the work-order graph in depth
columns with curved edges, both laid out by a pure, byte-deterministic port of the prototype's placement arithmetic
from structure only; chain highlight with pin, Escape and «Quitar foco»; the «Work order en foco» card kept in the
URL; ordered build lists below 900 px; real `dependsOn` edges only. It also provides the project's FRD index, the
one resolver every surface uses to name an FRD.

## In Scope

- **`src/lib/deps-layout/`** (pure): port verbatim the placement of `frdDagView` (FRD level: chain rank inside
  each FRD, FRD depth over the dominant-direction links, boxes sorted by depth then code, two per row, three items
  per row inside a box, the link geometry and its count / back-count label) and of `depsView` (work-order level:
  depth = longest chain of in-scope prerequisites, columns sorted by FRD then id, node size and gaps, edge curves,
  the FRD-scoped set plus its direct neighbours marked out-of-scope, upstream and downstream sets for a focus,
  the steps for the narrow list) from `docs/design/prototype/prototype.js`. Input: `{ id, frd, dependsOn }[]` and
  the FRD order; output: serializable geometry (blueprint Contracts). State is never an input.
- URL keys: exactly WO-25-001's Observabilidad set (`dag` frd|wo, `focus` one work-order id, `frd` one FRD id;
  `view`, `state`, `wo`, `woview` belong to WO-05-008); this work order never edits `src/lib/navigation/**` and
  reports any other key or value in the ledger (reconciliation 2026-10-22).
- **`src/lib/frds/frd-index.ts`**: `listProjectFrds(projectPath)` (slug, `FRD-NN`, display title by the
  prototype's precedence: Spec digest title, Architecture digest title, `frd.md` H1 without the code, humanized
  slug), deduped per request; fail loud on an unreadable folder listing, tolerant of a missing `frd.md`.
- **`src/app/projects/[slug]/_components/deps/`**: `DependencyMap({ project, route })` (RSC) with
  `DependencyFrdBox` / `DependencyFrdItem`, `DependencyNode`, `DependencySide` (the «Work order en foco» card),
  the narrow lists, and the client island `DependencyCanvas`:
  - Card «Grafo de dependencias» with the count chip («N FRDs» at the FRD level, «N work orders» of the scoped set
    at the work-order level) and the `Segmented` «Nivel del grafo» Por FRD · Por work order (URL `dag`).
  - FRD level: the intro line, the canvas region «Mapa de dependencias entre FRDs, desplazable», FRD boxes (head
    button titled «Ver las work orders de FRD-NN en el grafo detallado» opening the work-order level filtered to
    that FRD; code tag, title, «done/total», state bar), their mini nodes (state dot, mono id, clamped title;
    activation opens the order through the `wo` key), aggregated curves with count and «⇄» back count and the
    tooltip «FRD-NN → FRD-MM: N dependencia(s)» (plus «(y N en sentido contrario)»).
  - Work-order level: the «Filtrar el grafo por FRD» select («Todos los FRDs» + one per FRD, URL `frd`), the
    intro line, the canvas region «Grafo de dependencias, desplazable», nodes 176 × 46 tinted by state with
    title tooltip «id · title · state», out-of-scope neighbours dashed, curved edges; click pins the focus
    (`focus` key): the chain (upstream and downstream) lit in one highlight colour and outlined, everything else
    dimmed, edges on the chain lit; click again, background click, Escape or «Quitar foco» clears it; hover lights
    a chain transiently. The focus card below the graph (above the list below 900 px): state chip, id, title,
    «Abrir work order» (`wo` key), «Depende de · N» and «Desbloquea · N» lists or their empty sentences.
  - Below 900 px: FRD level → `ol.dag-list` of `details.dl-frd` («n/m verificadas», Depende de / Desbloquea FRD
    chips or «Nada: es un punto de partida» / «Nada», the FRD's work orders as rows); work-order level → steps
    «Paso N · M work orders» with rows (the focused one tinted, `aria-pressed`) and the narrow intro line.
  - Natural size inside the bounded, keyboard-scrollable region; the page never scrolls sideways; NO zoom, fit,
    fullscreen, wheel zoom or drag-pan; NO «saltar al primer error»; NO follow mode.

## Out of Scope

- Mounting the view, the `Segmented` view switch of the tab, and the live refresher (WO-05-008, W6); the e2e spec
  that exercises it (`e2e/observability.spec.ts`, WO-05-008).
- Deleting the v1 `WoDag` (WO-05-008) and the Dagre dependency (WO-13-013).
- Changing the Spec or Architecture digest parsers (WO-02-017): read them only.

## Requirements & Acceptance Criteria

REQ-12-004, REQ-12-006. Owned criteria, copied from the current FRD:

- **AC-12-004.1** — WHEN the **Dependencias** view is selected THE system SHALL render the card "Grafo de dependencias" (with a count chip, e.g. "23 FRDs") as a **work-order dependency graph** at two levels (AC-12-006.1): the FRDs as boxes placed **two per row** by a deterministic layout, and the work orders in **depth columns** (left to right: what goes first → what it unblocks). Hand-rolled deterministic layout — no Dagre/ELK runtime dependency. (Replaces the earlier force-layout clusters; adopted at M1 2026-10-22.)
- **AC-12-004.7** — (real dependencies, no fabrication, DR-087; renamed from "AC-12-004.1a", amended 2026-10-22, v2 plan) Edges SHALL come from each work order's **`dependsOn` frontmatter** (read by `lib/work-orders`), the machine-readable source of truth. A work order with no declared dependencies is an **independent node** (no edge); cross-FRD and fan-in/fan-out edges render as-is. The system SHALL NOT fabricate edges — in particular it SHALL NOT invent a "depends on the previous work order in its FRD" sequential chain when a WO has no real dependency (that drew a linear chain that misrepresented the real graph).
- **AC-12-004.8** — (deterministic layout; renamed from "AC-12-004.1b", amended 2026-10-22, v2 plan) The layout SHALL be computed from **STRUCTURE ONLY** (WO ids + deps + frd) and be **byte-deterministic**, so it is stable across server reads + live updates: a WO **state** change only recolors its card — boxes never jump. Edges are **two levels**: **intra-FRD** WO→WO lines and **cross-FRD** lines **aggregated to one FRD→FRD line per directed pair**, whose tooltip reads "FRD-01 → FRD-02: 1 dependencia" / "N dependencias".
- **AC-12-004.2 (chain highlight)** — WHEN the operator hovers or **clicks to pin** a card THE system SHALL highlight its **full upstream and downstream chain** in ONE highlight colour (the work orders it depends on and the ones it unblocks), outline the chain's cards, and **dim** the rest. At rest every edge is uniform accent. Click the card again / the background / Escape clears the pin.
- **AC-12-004.3** — **Out of v2 (owner decision 2026-10-21):** The DAG SHALL offer **"saltar al primer error"** that selects/highlights the first failed work order and its chain.
- **AC-12-004.4** — **Out of v2 (owner decision 2026-10-21):** The DAG SHALL offer a **"seguir al paso activo" follow-mode** toggle that, when ON, marks/centers the work order currently in execution.
- **AC-12-004.5** — The graph SHALL render at a **legible natural size** (never auto-shrunk to fit the column) and **pan inside its own bounded, scrollable container** — a wide graph never forces the whole page to scroll horizontally. **Out of v2 (owner decision 2026-10-21):** the floating **zoom / fit / fullscreen toolbar** (zoom out · % readout · zoom in · fit-to-view), the mouse-wheel zoom-to-cursor, grab-dragging the canvas and the browser fullscreen toggle on the dependency map (the data-model viewer of FRD-02 keeps its own toolbar).
- **AC-12-004.6** — Each node SHALL keep its text **inside the card**: the title is clamped to ≤2 lines with the full title in a tooltip (never spilling past the card edge), and the redundant `WO-NN-MMM —` id prefix is stripped from the title (the id is shown once).
- **AC-12-006.1** — THE Dependencias view SHALL switch between an FRD-level map ("Por FRD", FRD boxes) and a work-order graph ("Por work order"), and WHEN an FRD title is activated THE system SHALL open that FRD in the work-order graph.
- **AC-12-006.2** — WHEN a work order is focused, THE system SHALL show the card "Work order en foco" with "Depende de · N", "Desbloquea · N" and a link "Abrir work order", and SHALL keep the focus in the URL.
- **AC-12-006.3** — WHERE the viewport is narrower than 900 px, THE dependency map SHALL render as an ordered build list ("Paso N · M work orders") whose FRDs unfold to their work orders.

AC-12-004.3, AC-12-004.4 and the toolbar part of AC-12-004.5 are «Out of v2»: met by absence (tests prove no such
control exists). AC-12-004.6's clamp follows the prototype's node (one line with an ellipsis, within the ≤2-line
bound).

**Completeness and NFRs.** Error paths: no work orders → the catalogue's no-dependencies sentence (defensive; the
panel's empty state precedes it); a `focus` or `frd` value not in the set is ignored; dependencies on unknown ids
are dropped, never drawn dangling. Accessibility: every node and FRD head is a `button` with a full name; the
canvases are focusable regions with names; chain lighting works with keyboard focus as with click; Escape clears;
state by dot plus word; lit chain outlined (not colour alone); 44 px targets on touch layouts. Performance: layout
computed once on the server per request (pure, cached), no client layout pass, no per-frame state; only the
highlight toggles classes. Reduced motion: no animation added.

## Components built (blueprint)

CMP-12-dependency-map, CMP-12-frd-box, CMP-12-node, CMP-12-canvas, CMP-12-focus-card, IF-12-deps-layout,
IF-12-frd-index. Reuse `Card`/`CardHeader`, `EmptyState` (WO-13-012), `Segmented`, `SelectField`, `Chip`,
`StateDot` with the shared work-order state map, `StackBar`, `Button` (WO-13-011), `Icon`. components.md rows used
as named: `DependencyFrdBox` / `DependencyFrdItem`, `DependencyNode`, `DependencyList` / `DependencySide`.
Installs: none (no graph library).

## Visual reference

- **Mock screens to reproduce:** `docs/frds/frd-12-observability-dataviz/mocks/observability-dataviz.html`
  sections `observability-deps-frd`, `observability-deps-wo`, `observability-deps-focus`,
  `observability-deps-frd-open` (1280 only), `observability-deps-list-open` (375 and 768).
- **Prototype:** `dagLevels`, `frdDagView`, `depsView` (`docs/design/prototype/prototype.js`); the recorded hooks
  of the blueprint's visual spec (`.fdag-box`, `.fdag-head[data-dag-frd]`, `path.fdag-link`, `text.fdag-n`,
  `.dag-node`, `path.dag-edge`, `ol.dag-list`, `details.dl-frd`, `.dag-side`, …).
- **Token slice:** teal card hue, state hues via `data-tone`, the one highlight colour for a lit chain, uniform
  accent edges at rest, dashed out-of-scope nodes, mono ids, 12 px floor.
- **FDD pointer:** `docs/frds/frd-12-observability-dataviz/fdd.md` (Dependencias, States, Responsive).
- **Fidelity criterion:** the map matches the five sections on the frozen tokens; canvases compared by computed
  styles of boxes, nodes and lines plus the box coordinates (technical-assumptions §4.3).

## Tests

- **Layout (Vitest, pure):** a golden test pins the FRD-level box and item coordinates and the work-order node
  coordinates for production-shaped sets (the fixture factory's `mission-control` and `funko-tracker` work orders)
  to the values the prototype's arithmetic yields; byte-identical output when only states change; aggregation per
  directed pair with dominant direction and back count; no edge for an order without `dependsOn` and no invented
  sequential chain; dangling ids dropped; cycles do not loop.
- **FRD index:** precedence of the four title sources against real Spec / Architecture digests and `frd.md`
  files; a folder without `frd.md` still listed by slug; an unreadable `docs/frds` fails loud.
- **Component (RTL, `getByRole`):** level switch writes `dag`; FRD head opens the work-order level filtered;
  click pins `focus`, the focus card shows its counts and «Abrir work order»; Escape, background click and «Quitar
  foco» clear; hover lights transiently; no zoom/fit/fullscreen control, no jump-to-error, no follow toggle; the
  narrow lists are present with their steps and unfoldable FRDs; node titles without the id prefix and with the
  full tooltip.
- **Behaviour e2e:** in `e2e/observability.spec.ts` (WO-05-008, the mount). No derogated test (the v1 `WoDag`
  tests go with its deletion in WO-05-008).

## Definition of done

- `bash .pandacorp/verify.sh --since <base>` green; knip counts the module and the index as used through tests.
- Every owned criterion met by a test that fails without the change; no Dagre / ELK import; strings through
  `t()`; tokens only.

## Dependencies

WO-13-012 (W2, primitives), WO-25-001 (W0, `dag` / `focus` / `frd` / `wo` keys), WO-05-001 (reader, VERIFIED; edge
added to the map's list because this WO imports it, DR-087; the wave stays W3).

## Status Note

- 2026-10-30 (S1C): Built the self-loading two-level map, server-only geometry, URL-owned selections, transient/pinned chain highlight, direct-dependency focus details, bounded canvases and ordered narrow lists. Added the shared cached FRD index with Spec > Architecture > H1 > humanized slug precedence and explicit listing failures.
- 2026-10-30: Layout golden fixtures were extracted directly from the frozen prototype arithmetic, without executing its UI: Mission Control (110 work orders, 23 FRD boxes, 1048×2792 canvas) and Funko Tracker (48 work orders, 8 boxes, 1048×1080). Full and FRD-scoped work-order coordinates match, as do FRD box and item coordinates. State changes produce byte-identical geometry; independent and dangling references never fabricate edges. Cycle tests also require finite geometry.
- 2026-10-30: Scoped TypeScript and Biome passed. Scoped Vitest passed (5 files, 15 tests), including real frontmatter reads, title-source precedence, all clearing actions and URL state. Initial RED was observed before the layout modules existed. AC references in each of this stream's three WO acceptance sections are cited by tests (11 / 24 / 11 references respectively).
- 2026-10-30: No Playwright, browser, visual fidelity or full gate was run per stream instructions; the mount and behavior e2e remain with WO-05-008. No shared primitive, reviewer-authored test, visual baseline, navigation codec or decision log was edited. The template's fixed e2e server-env port is outside this WO; no server was started in this stream. All scoped commands exported PORT=3942 and PANDACORP_E2E_PORT=3942.
- 2026-10-30: Git staging/commit is blocked by sandbox denial when creating `.git/worktrees/orch-s1c/index.lock`. No merge, push, merge queue or main-checkout write was attempted. Reviewable changes remain in this checkout with per-WO patches prepared outside the repository.

- 2026-10-30: Final scoped stream verification: 60 tests in 13 files passed; after the final account-placeholder accessibility fix, its 7 component tests passed again. Biome checked 61 scoped files without diagnostics; scoped TypeScript and `git diff --check` passed. Scope audit found exactly 60 changed files, all within these WOs or their authorized status documents.

- 2026-10-30 (S1C round 2): Round 2 review patch: own-property checks ignore prototype-key FRD values; the scroll region is capped by its local 640px token. DependencyEdge is internal. A real-file composition test exercises DependencyMap so knip counts the module through tests, as the DoD requires. Integration mismatch remains: the blueprint uses the FRD folder slug, while src/lib/navigation/keys.ts:49 accepts only ^FRD-\d+$; the navigation codec is outside this patch.

- 2026-10-30 (S1C round 2 verification): Reproduced 13 failing reviewer cases before the patch (68 passing); the same scoped regression now passes, with 237 tests across 25 files, including reviewer suites and the real-file DependencyMap composition test. The added signal-age boundary test passes separately (1 test). Full `pnpm knip` exits 0 (configuration hints only); `pnpm exec tsc --noEmit` passes; scoped Biome passes. Commands export `PORT=3942` and `PANDACORP_E2E_PORT=3942`, with Vitest `--maxWorkers=2`. Work remains IN_REVIEW and uncommitted. Reviewer tests and blessed baselines are unchanged. Browser rendering, Playwright, visual fidelity and the full verify.sh gate were not executed.
