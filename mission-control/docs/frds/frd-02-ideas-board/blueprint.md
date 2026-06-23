---
id: FRD-02-blueprint
type: blueprint
parent: FRD-02
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-22'
---
# FRD-02 — Ideas board — Feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> Feature blueprint (DR-049): how the read-only kanban + idea detail + the single discard write are
> implemented on the platform. References the platform architecture
> ([`../../product/architecture.md`](../../product/architecture.md)) — stack (§2), data model (§4),
> `lib/**` boundary (§6), read-only invariant (§7) — without restating it. Builds on the FRD-01 data
> layer ([`../frd-01-data-reading/blueprint.md`](../frd-01-data-reading/blueprint.md)).

---

## 0. Scope

A **read-only kanban** of the idea base, with: an intake modal (four `/pandacorp:*` commands), a
navigable card detail with the next-step command, category filter, a "building" indicator, and the
**one and only write in the entire app** — discard (`status: discarded`).

The board never moves cards by hand; transitions are written by the skills. The board's column for a
card is **derived from two axes** (card `status` + project `phase`) — this derivation logic is the
heart of the feature (`lib/board.ts`).

---

## 1. Components & interfaces

| ID | Kind | Artifact | Responsibility | Traces |
|---|---|---|---|---|
| `CMP-02-board-derive` | module | `lib/board.ts` | Derive a card's **column** from the two axes (status + linked project phase). | REQ-02-001 |
| `CMP-02-next-step` | module | `lib/next-step.ts` | Pure map: status/phase → next command + folder to open. | REQ-02-004 |
| `CMP-02-discard` | module (**write**) | `lib/discard.ts` | The single write: rewrite `status: discarded` in a card's frontmatter, preserving the body. | REQ-02-007 |
| `CMP-02-board-view` | UI (Server) | `app/board/page.tsx` | Render the kanban columns + cards from `readIdeas` + `readStatus` + `lib/board`. | REQ-02-001, REQ-02-002, REQ-02-005 |
| `CMP-02-card` | UI (Server) | `components/IdeaCard.tsx` | One card: title, score, category + return chips, recommended/building badges. | REQ-02-005, REQ-02-006 |
| `CMP-02-intake-modal` | UI (client) | `components/IntakeModal.tsx` | Modal overlay (backdrop + blur) with the 4 intake commands. | REQ-02-003 |
| `CMP-02-card-detail` | UI (client) | `app/board/_components/CardDetail/CardDetail.tsx` (+ `CardDetail.styles.ts`) | The **tabbed card-detail container** (Campaña · Documentos · Comandos) via the shared `Tabs` primitive (icons, `level="sub"`); default tab Campaña; tab state persists. Root is transparent layout (each tab's own content is the bordered panel below the bare pills). Documentos = rail (Resumen + project docs) + reader; Comandos = `CmdRow` next-step + (building/operation) `workspaceCommands` box. Threads `isRunning` → `CampaignPipeline.running`. | REQ-02-004, REQ-02-008, REQ-02-009 |
| `CMP-02-campaign-pipeline` | UI (client) | `components/modules/CampaignPipeline/CampaignPipeline.tsx` (+ `phases.ts`, `RoamingCast.tsx`) | **La Campaña** view: the 6-phase pipeline (full-width stage, rooms centred in an inner layer), derived active phase, road connectors **under** the rooms, per-phase ficha (header `{n · name} — state` + description + reads/writes + the WHOLE team) shown **by default + pinned**, "en curso"/roam gated on `running`, Construcción → host-navigate to Party, read-only. `PHASE_META` (emoji · short deliverable · accent) feeds rooms + connectors. | REQ-02-010 |
| `CMP-02-roaming-cast` | UI (client) | `components/modules/CampaignPipeline/RoamingCast.tsx` | The active room's cast: a `requestAnimationFrame` roam loop (walk/idle bob, lead halo, speech-on-meet) that runs **only when `state==="current" && running`**; done → idle-bob in place; locked → static + dimmed. Honors `prefers-reduced-motion` (and jsdom/SSR — no `matchMedia` → static). | REQ-02-010 |
| `CMP-02-phase-from-status` | module | `lib/campaign/campaign.ts` | Pure `phaseFromStatus(input)` derivation: card status / project phase → active phase index (0–5), with a safe fallback to `research`. | REQ-02-010 |
| `CMP-02-go-party` | UI (client glue) | host-navigation callback (`onEnterForge(slug)` → `goToParty`) | Navigate the host app to Portfolio → that project → the Party tab (FRD-06), no inner reload. | REQ-02-010 |
| `CMP-02-category-filter` | UI (client) | native `<select>` in `BoardShell` | Filter the board by `project_type`. **Was** a `CategoryFilter` chip component — replaced by a native `<select>` (owner) and the component **deleted** (2026-06-22). | REQ-02-006 |
| `CMP-02-discard-action` | UI (client + Server Action) | `components/DiscardButton.tsx` + `app/board/actions.ts` | "Discard idea" → Server Action calling `lib/discard.ts`. | REQ-02-007 |
| `CMP-02-copy-button` | UI (client) | `components/CopyButton.tsx` | Shared clipboard-copy affordance (introduced here; reused by FRD-01/03). | REQ-02-003, REQ-02-004 |
| `CMP-02-legend` | UI | `components/BoardLegend.tsx` | Legend explaining category / return / score. | REQ-02-008 |
| `IF-02-deriveColumn` | interface | `deriveColumn(card, status): BoardColumn` | The two-axis column derivation. | REQ-02-001 |
| `IF-02-nextStep` | interface | `nextStep(input): NextStep` | status/phase → `{ command, openPath, label }`. | REQ-02-004 |
| `IF-02-discardIdea` | interface | `discardIdea(slug): DiscardResult` | Rewrite one card's `status` to `discarded`, body preserved. | REQ-02-007 |
| `IF-02-phaseFromStatus` | interface | `phaseFromStatus(input): CampaignPhase` | card status / project phase → active phase (0–5), fallback `research`. | REQ-02-010 |
| `IF-02-goParty` | interface | `mcGoParty(slug): void` (host) | Host-navigate to Portfolio → project → Party tab. | REQ-02-010 |

---

## 2. The two-axis column derivation (`lib/board.ts`) — the core

```ts
type BoardColumn =
  | "discovered" | "documented" | "design" | "architecture" | "building"
  | "shipped" | "discarded";

// status from the card (IdeaCard), status from the linked project (StatusResult)
export function deriveColumn(card: IdeaCard, projectStatus: StatusResult | null): BoardColumn;
```

Rules (REQ-02-001, exactly the FRD's mapping):

| Card `status` | Project `phase` | → Column |
|---|---|---|
| `discovered` | — | `discovered` |
| `recommended` | — | `discovered` (+ "recommended" badge) |
| `in-pipeline` | `product` | `documented` |
| `in-pipeline` | `design` | `design` |
| `in-pipeline` | `architecture` | `architecture` |
| `in-pipeline` | `implementation` or `release` | `building` |
| `in-pipeline` | `operation` | `shipped` |
| `in-pipeline` | **missing project / status absent / malformed** | `documented` (fallback, no break) |
| `shipped` | — | `shipped` |
| `discarded` | — | `discarded` |

The function **never expects** `design`/`architecture`/`building` to be a card `status` — those
columns come only from the project phase. `status.yaml` (via FRD-01 `readStatus`) is the single
source of truth for the phase.

---

## 3. The single write (`lib/discard.ts`) — the only mutation in the app

```ts
type DiscardResult = { ok: true } | { ok: false; reason: "not-found" | "parse-error" };
export function discardIdea(slug: string): DiscardResult;
```

- Resolve the card under `config.IDEAS_DIR`. Read with gray-matter, set frontmatter `status:
  discarded`, re-serialize **preserving the body and all other frontmatter fields verbatim**.
- This is the ONLY `fs.write` in the whole codebase (architecture §1/§7). It writes exactly one
  field of one idea card. No other module writes.
- Invoked only through the Server Action `app/board/actions.ts` (human-triggered, REQ-02-007), never
  during a render. Optimistic UI in the client button (update + revert on failure, AGENTS.md).

---

## 4. `lib/next-step.ts` — next command map (shared with FRD-03/04)

```ts
type NextStep = { command: string; openPath?: string; label: string };
export function nextStep(input: { cardStatus?: IdeaStatus; phase?: Phase; advancePending?: boolean }): NextStep;
```

Pure mapping from lifecycle position → the `/pandacorp:*` command to copy + the folder to open.
Owned here (FRD-02) and reused by FRD-03 (portfolio recovery/next) and FRD-04 (workspace). Exact
command strings come from the pipeline (CLAUDE.md operation table); enumerated in this WO's tests.

---

## 4b. The tabbed card detail + La Campaña (REQ-02-009 / REQ-02-010)

> Visual contract: `prototype/party-pipeline.html` embedded in `prototype/index.html`'s board card
> detail (`detailView()` — the `stab` tab row + the `party-pipeline.html?embed=1&active=…&slug=…`
> iframe). The production build replaces the iframe with a native React `CampaignPipeline`.

**Tabbed container (`CMP-02-card-detail`, REQ-02-009).** `CardDetail` is a tabbed shell rendered with
the **shared `Tabs` primitive** (`level="sub"`, the one `.stab` pattern, DR-062) carrying the three
tabs' icons (`ti-map-2 · ti-files · ti-wand`): **Campaña · Documentos · Comandos**, default
**Campaña**. The root is **transparent layout** (`ROOT_STYLE`: a flex column with a 14px gap, no
border/bg); the tab pills are bare, and each tab's own content panel carries the border/padding (so
the body reads as the bordered container *below* the pills) — `PANEL_STYLE` padding is 0.
- **Campaña** (default) → `<CampaignPipeline running={isRunning} …>` (one bordered panel).
- **Documentos** → a **rail (210px) + reader** (`.card-detail-docs-grid`, stacks under ~640px). The
  rail always lists **Resumen** (the summary reader = the markdown body) first, then one item per
  project document (`buildNavEntries` over `ProjectDocsIndex`). For a board card the reader shows the
  summary in full and, for a project doc, a short "open it in the project workspace" pointer.
- **Comandos** → the shared **`CmdRow`** "Siguiente paso · avanzar" (from `nextStep`) plus, for
  building/operation cards (phase `implementation`/`release`/`operation`), a **project-command box**
  from `workspaceCommands(phase)` (the prototype `commandsBox`).
- Tab state is local client state on the open card and **persists across re-renders** (AC-02-009.4);
  a separate `selectedDocKey` drives the Documentos rail/reader.
- Clicking a document entry **selects the Documentos tab** and shows that doc (AC-02-009.3).

**`phaseFromStatus` (`CMP-02-phase-from-status`, `lib/campaign/campaign.ts`) — pure derivation:**

```ts
type CampaignPhase = 0 | 1 | 2 | 3 | 4 | 5; // research · product · design · architecture · build · release
// derive the active phase from the same two axes as deriveColumn (card status + project phase)
export function phaseFromStatus(input: { cardStatus?: IdeaStatus; phase?: Phase }): CampaignPhase;
```

| Card `status` | Project `phase` | → Active phase |
|---|---|---|
| `discovered` / `recommended` | — | `0` research |
| `in-pipeline` | `product` | `1` product |
| `in-pipeline` | `design` | `2` design |
| `in-pipeline` | `architecture` | `3` architecture |
| `in-pipeline` | `implementation` / `release` | `4` build |
| `in-pipeline` | `operation` | `5` release |
| `shipped` | — | `5` release |
| **absent / unrecognized** | — | `0` research (fallback, no break — AC-02-010.2) |

This mirrors `deriveColumn` (it is the same two-axis read), but collapses to the 6-phase index La
Campaña paints. Pure, fully unit-testable from fixtures.

**`CampaignPipeline` (`CMP-02-campaign-pipeline`) — the view.** Static phase model in `phases.ts`
(the 6 phases, in order, each with: name, description, what it reads/writes, and its **whole team** of
specialists with role + one-line "what it does"), faithful to `party-redesign-spec.md` §2; a sibling
`PHASE_META` map (`emo · deliver · col`) carries the short deliverable + accent colour that feed both
the room chips and the connectors. Built on the shared Party primitives (DR-057 / WO-13-009):

- **Stage** — a `width:100%` dark canvas; the `920×560` serpentine sits in an **inner layer**
  (`margin:0 auto`) so the rooms are centred. Rooms `z-index:2`; the **road connectors `z-index:1`**
  (under the rooms); the cast `z-index:3`.
- **`Room`** per phase, `state` done/current/locked by position vs the derived active phase
  (AC-02-010.3), with a `labelNode` (accent-tinted phase number + name) and the deliverable chip
  (`{emoji} {short artifact}` — no "entrega ▸").
- **`StoneBridge variant="road"`** for the 5 connectors (the CSS striped road, not the stone PNG),
  state done/flow/locked by source phase vs active.
- **`RoamingCast`** for the active room's specialists — roams only when `running`, else idle-bobs
  (`CMP-02-roaming-cast`).
- **`AgentSprite`** (`state="idle"`) for each team member in the ficha; the progress bar renders only
  in `work` state, so campaign sprites carry no empty bar.

Clicking a phase pins its **ficha** (description + LEE/ESCRIBE + the whole team — every specialist,
AC-02-010.4) with a header `{n · name} — {state}`; the active phase's ficha shows **by default** and
the ficha **never toggles closed**. The teams are fixed: research=`researcher`;
product=`product-manager`; design=`designer`+`copywriter`; architecture=`architect`;
build=`implementer`+`reviewer`+`analytics`; release=`security-auditor`+`devops`. **Read-only** — no
Claude, no write, no build (AC-02-010.6). A **locked future phase's ficha still renders its full info**
(AC-02-010.7, rewritten 2026-06-22); only the build phase's "Entrar a La Fragua" **action** is gated
on reaching build. The `running` prop is threaded `BoardShell` → `CardDetail` (`isRunning`) →
`CampaignPipeline` → `PhaseRoom`/`RoamingCast`/`FichaContent`, driving "en curso" vs "fase actual".

**Host navigation (`CMP-02-go-party`, AC-02-010.5).** The build phase's "Entrar a La Fragua" action
calls the host (`onEnterForge(slug)` → `goToParty`) which switches the host to Portfolio → that
project → the **Party** tab (FRD-06). In the app this is direct host state navigation (not an iframe
`window.parent` bridge as in the prototype) — no inner reload of the card detail. The pipeline
component receives the project `slug` and the `onEnterForge(slug)` callback wired to the host router.

- **`lib/**`** (architecture §6): creates `board.ts`, `next-step.ts`, `discard.ts`. Consumes FRD-01's
  `ideas.ts`, `status.ts`, `docs.ts`.
- **App surface** (architecture §11): `app/board/page.tsx` (+ `actions.ts`), `BoardShell`, card
  detail. Server Components by default; client only for the modal, the category `<select>`, copy and
  discard (architecture §3). The board page wraps its body in the shared **`PageLayout`** (the
  standard page chrome — single `<main>` + `PageTitle`, passed `titleProps` so the open card swaps
  "Tablero" for its own head); no bespoke per-page `<main>`/padding.
- **Board columns** (`CMP-02-board-view`): the 7 columns use La Campaña's numbered phase names
  (`1 Investigación · 2 Producto · 3 Diseño · 4 Arquitectura · 5 Construcción · 6 Release` +
  `Descartada`) — a label-only change (2026-06-22); the two-axis derivation (§2) is unchanged. Columns
  are equal-width fixed-width panels (`stretch` so empty ones grow to full height), **wide**,
  horizontal scroll when overflowing, text wraps (REQ-02-002). `tabular-nums` on the score
  (architecture §7).
- **Discard button** (`CMP-02-discard-action`): the shared-`Button` `size="sm"` sizing (matches the
  "← Volver al tablero" back button) + a **danger** hover (`.pc-discard`: red border + danger-bg tint
  + danger glow, transition inline per AC-13-005.1) + the `ti-trash` icon, using `--color-danger`.

---

## 6. Requirement → component traceability (REQ-02-MMM)

| REQ | Acceptance criterion (abridged) | Component(s) / interface(s) |
|---|---|---|
| REQ-02-001 | Derive each card's column from two axes (status + phase); fallback to documented; never expect design/arch/building as card status. | `CMP-02-board-derive`, `IF-02-deriveColumn` |
| REQ-02-002 | No manual move; equal-width, wide columns; horizontal scroll; text wraps. | `CMP-02-board-view` |
| REQ-02-003 | "Capture ideas" → modal overlay (backdrop + blur) with 4 intake commands + copy; close on backdrop/✕; board visible behind. | `CMP-02-intake-modal`, `CMP-02-copy-button` |
| REQ-02-004 | Click a card → detail: summary, key points, docs navigator, next-step command (copy). | `CMP-02-card-detail`, `CMP-02-next-step`, `IF-02-nextStep` |
| REQ-02-005 | Each card shows category + return chips besides the score. | `CMP-02-card` |
| REQ-02-006 | Filter by category; recommended card shows a "recommended" badge. | `CMP-02-category-filter`, `CMP-02-card` |
| REQ-02-007 | Discard → rewrite `status: discarded`, preserving the rest of the file (the only write). | `CMP-02-discard`, `CMP-02-discard-action`, `IF-02-discardIdea` |
| REQ-02-008 | Building indicator while `running: true`; legend explaining category/return/score; card with no docs → summary only. | `CMP-02-card` (badge), `CMP-02-legend`, `CMP-02-card-detail` |
| REQ-02-009 | Card detail = 3 tabs (Campaña · Documentos · Comandos) via shared `Tabs` (icons), default Campaña; doc click → Documentos; tab persists; Documentos = rail+reader, Comandos = `CmdRow` + (building/operation) project box. | `CMP-02-card-detail` |
| REQ-02-010 | La Campaña: 6-phase pipeline (full-width stage, road under rooms), active phase derived from status, done/current/locked, per-phase ficha (by default + pinned) with the whole team, "en curso"/roam gated on running, build→host-navigate to Party, read-only; a locked phase's ficha shows full info (only the build action is gated). | `CMP-02-campaign-pipeline`, `CMP-02-roaming-cast`, `CMP-02-phase-from-status`, `CMP-02-go-party`, `IF-02-phaseFromStatus`, `IF-02-goParty` |

> REQ numbering maps the FRD's EARS bullets in document order. The "recommended badge" lives inside
> the first/sixth bullets; the "building indicator" and the legend are folded into REQ-02-008.
> REQ-02-009 / REQ-02-010 are the 2026-06-18 extension (tabbed detail + La Campaña).

---

## 7. AC ⇄ design check

- "the only write" → enforced: `lib/discard.ts` is the sole `fs.write`; all else read-only
  (architecture §7). ✅
- Fallback-to-documented when project/status missing → handled in `deriveColumn` (consumes FRD-01
  `StatusResult` which is fail-soft). ✅
- "board read-only, no drag" → no DnD library, no move action; only the discard Server Action. ✅
- "board visible behind the modal" → modal is an overlay, board stays mounted. ✅
- "La Campaña active phase from real status" → `phaseFromStatus` reads the same two axes as
  `deriveColumn`; fallback to `research` when status absent (FRD-01 `StatusResult` is fail-soft). ✅
- "the whole team per phase, not just the lead" → `CampaignPipeline`'s static phase model (`phases.ts`)
  enumerates every specialist per phase; the ficha renders all of them (AC-02-010.4). ✅
- "a locked phase's ficha shows full info; only the build action is gated" → `FichaContent` always
  renders description + LEE/ESCRIBE + team; the "Entrar a La Fragua" button is conditioned on
  `phase.key === "build" && phaseState !== "locked"` (AC-02-010.7, rewritten 2026-06-22). ✅
- "'en curso' only when genuinely running" → `running` is threaded from `status.yaml` through
  `CardDetail`; the badge reads "fase actual" and `RoamingCast` stays idle unless `current && running`
  (amendment, 2026-06-22). ✅
- "Construcción → Party, no inner reload" → host navigation via `onEnterForge(slug)` → `goToParty`,
  host router state change, not an iframe reload (AC-02-010.5). ✅
- "read-only" → `CampaignPipeline` has no write, no Claude call, no build trigger; the only app write
  remains discard. ✅
- "tab persists" → tab is client state keyed to the open card, survives detail re-renders
  (AC-02-009.4). ✅

No FRD-02 criterion is unbuildable.

---

## Build Plan (Phase 2)

Phase 2 re-implements the **presentational** surfaces to match the approved prototype/mocks. The
`lib/**` read + write layer is VERIFIED and untouched (WO-02-001 `board.ts`, WO-02-003 `next-step.ts`,
WO-02-004 `discard.ts`, WO-02-011 `campaign.ts`, plus the `app/board/actions.ts` discard Server
Action). The UI WOs are collapsed into **two coarse work orders**, each writing a disjoint artifact
set so they parallelize.

**Cross-FRD dependency (foundation-first):** both coarse WOs depend on **`frd-13`** — the foundation
primitives (`PageTitle`/`SectionHead`/`Tabs` · `Banner`/`Chip`/`CountBadge`/`Panel`/`CmdRow`/`Button`/
`Toast`/`ProgressBar`/`DocHeading` · `Shield`/`TierBadge`/`ItemSlot`/`KanbanColumn`) must land
(VERIFIED) before either runs.

**Coarse WO DAG (intra-FRD):**

```
frd-13 (foundation, VERIFIED)
        │
        ├─ WO-02-005  Board surface         artifacts: app/board/**,
        │             (columns + cards +                 components/modules/{IdeaCard,
        │              filter + legend +                 CategoryFilter,BoardLegend}/**
        │              intake + discard)
        │
        └─ WO-02-007  La Campaña card detail artifacts: app/board/_components/CardDetail/**,
                      (3 tabs + 6-phase                  components/modules/CampaignPipeline/**
                       pipeline)
```

- **Parallelism:** WO-02-005 and WO-02-007 write **disjoint artifacts** (the board page/modules vs the
  card-detail `_components/` + `CampaignPipeline` module) and can run in the same wave once `frd-13`
  is VERIFIED. WO-02-007's card detail opens from a board card, but the two are independent at the
  file level; a soft ordering preference is WO-02-005 first if waves are serialized.
- **Read/write layer:** consumed as-is — never re-planned.
- One review/test gate per FRD; Preview Smoke Gate on `/board` (both surfaces render, no console
  error, fidelity vs `mocks/la-campana.html` + `prototype/index.html`).

> **Post-build fidelity changes (2026-06-22, recorded in the decision log).** After this plan ran, an
> owner-QA fidelity pass reworked both surfaces against the *current* prototype (`party-pipeline.html`
> for the campaign): WO-02-005 dropped the `CategoryFilter` component (replaced by a native `<select>`
> in `BoardShell`) and adopted `PageLayout` + the numbered column labels; WO-02-007's card detail
> gained the `RoamingCast`/road-connector/pinned-ficha/Documentos-rail/Comandos-`CmdRow` shape above
> (see §1/§4b and the canonical contract in [`frd.md`](frd.md)). The artifact boxes above record the
> plan **as originally executed**; the components/§4b sections describe current reality.
