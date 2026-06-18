---
id: FRD-02-blueprint
type: blueprint
parent: FRD-02
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-18'
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
| `CMP-02-card-detail` | UI (Server + client copy) | `components/CardDetail.tsx` | The **tabbed card-detail container** (Campaña · Documentos · Comandos); hosts the three tab bodies; default tab Campaña; tab state persists. | REQ-02-004, REQ-02-009 |
| `CMP-02-campaign-pipeline` | UI (client) | `components/CampaignPipeline.tsx` | **La Campaña** view: the 6-phase pipeline, derived active phase, per-phase ficha (description + reads/writes + the WHOLE team), Construcción → host-navigate to Party, read-only. | REQ-02-010 |
| `CMP-02-phase-from-status` | module | `lib/campaign.ts` | Pure `phaseFromStatus(status)` derivation: card status / project phase → active phase index (0–5), with a safe fallback to `research`. | REQ-02-010 |
| `CMP-02-go-party` | UI (client glue) | host-navigation callback (`mcGoParty(slug)`) | Navigate the host app to Portfolio → that project → the Party tab (FRD-06), no inner reload. | REQ-02-010 |
| `CMP-02-category-filter` | UI (client) | `components/CategoryFilter.tsx` | Filter the board by `project_type`. | REQ-02-006 |
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

**Tabbed container (`CMP-02-card-detail`, REQ-02-009).** `CardDetail` becomes a tabbed shell with the
**same tab pattern as the Portfolio project pane** (the `stab` selector row): three tabs
**Campaña · Documentos · Comandos**, default **Campaña**.
- **Campaña** (default) → `<CampaignPipeline>`.
- **Documentos** → the **existing** doc navigator + body (the current REQ-02-004 behavior, unchanged).
- **Comandos** → the **existing** next-step / iterate command panel (current REQ-02-004 behavior).
- Tab state is local client state on the open card and **persists across re-renders** (AC-02-009.4).
- Clicking a document entry **selects the Documentos tab** and shows that doc (AC-02-009.3).

**`phaseFromStatus` (`CMP-02-phase-from-status`, `lib/campaign.ts`) — pure derivation:**

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

**`CampaignPipeline` (`CMP-02-campaign-pipeline`) — the view.** Static phase model (the 6 phases, in
order, each with: name, deliverable, what it reads/writes, and its **whole team** of specialists with
role + one-line "what it does"), faithful to `party-redesign-spec.md` §2. Renders each phase as
done / current / locked by its position vs the derived active phase (AC-02-010.3); clicking a phase
opens its **ficha** (description + LEE/ESCRIBE + the whole team — every specialist, AC-02-010.4). The
teams are fixed: research=`researcher`; product=`product-manager`; design=`designer`+`copywriter`;
architecture=`architect`; build=`implementer`+`reviewer`+`analytics`; release=`security-auditor`+
`devops`. **Read-only** — no Claude, no write, no build (AC-02-010.6); locked future phases render a
graceful empty state (AC-02-010.7).

**Host navigation (`CMP-02-go-party`, AC-02-010.5).** The build phase's "Entrar a La Fragua" action
calls the host `mcGoParty(slug)` which switches the host to Portfolio → that project → the **Party**
tab (FRD-06). In the app this is direct host state navigation (not an iframe `window.parent` bridge as
in the prototype) — no inner reload of the card detail. The pipeline component receives the project
`slug` and a `onEnterForge(slug)` callback wired to the host router.



- **`lib/**`** (architecture §6): creates `board.ts`, `next-step.ts`, `discard.ts`. Consumes FRD-01's
  `ideas.ts`, `status.ts`, `docs.ts`.
- **App surface** (architecture §11): `app/board/page.tsx` (+ `actions.ts`), card detail. Server
  Components by default; client only for the modal, filter, copy and discard (architecture §3).
- Styling via design tokens only; columns equal-width, **wide**, horizontal scroll when overflowing,
  text wraps (REQ-02-002). `tabular-nums` on the score (architecture §7).

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
| REQ-02-009 | Card detail = 3 tabs (Campaña · Documentos · Comandos), default Campaña; doc click → Documentos; tab persists; Documentos/Comandos keep existing behavior. | `CMP-02-card-detail` |
| REQ-02-010 | La Campaña: 6-phase pipeline, active phase derived from status, done/current/locked, per-phase ficha with the whole team, build→host-navigate to Party, read-only, graceful locked states. | `CMP-02-campaign-pipeline`, `CMP-02-phase-from-status`, `CMP-02-go-party`, `IF-02-phaseFromStatus`, `IF-02-goParty` |

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
- "the whole team per phase, not just the lead" → `CampaignPipeline`'s static phase model enumerates
  every specialist per phase; the ficha renders all of them (AC-02-010.4). ✅
- "Construcción → Party, no inner reload" → host navigation via `mcGoParty(slug)`/`onEnterForge`,
  host router state change, not an iframe reload (AC-02-010.5). ✅
- "read-only" → `CampaignPipeline` has no write, no Claude call, no build trigger; the only app write
  remains discard. ✅
- "tab persists" → tab is client state keyed to the open card, survives detail re-renders
  (AC-02-009.4). ✅

No FRD-02 criterion is unbuildable.
