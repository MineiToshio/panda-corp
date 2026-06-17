---
id: FRD-02-blueprint
type: blueprint
parent: FRD-02
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-16'
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
| `CMP-02-card-detail` | UI (Server + client copy) | `components/CardDetail.tsx` | Summary, key points, idea-docs navigator, next-step command (copy). | REQ-02-004 |
| `CMP-02-category-filter` | UI (client) | `components/CategoryFilter.tsx` | Filter the board by `project_type`. | REQ-02-006 |
| `CMP-02-discard-action` | UI (client + Server Action) | `components/DiscardButton.tsx` + `app/board/actions.ts` | "Discard idea" → Server Action calling `lib/discard.ts`. | REQ-02-007 |
| `CMP-02-copy-button` | UI (client) | `components/CopyButton.tsx` | Shared clipboard-copy affordance (introduced here; reused by FRD-01/03). | REQ-02-003, REQ-02-004 |
| `CMP-02-legend` | UI | `components/BoardLegend.tsx` | Legend explaining category / return / score. | REQ-02-008 |
| `IF-02-deriveColumn` | interface | `deriveColumn(card, status): BoardColumn` | The two-axis column derivation. | REQ-02-001 |
| `IF-02-nextStep` | interface | `nextStep(input): NextStep` | status/phase → `{ command, openPath, label }`. | REQ-02-004 |
| `IF-02-discardIdea` | interface | `discardIdea(slug): DiscardResult` | Rewrite one card's `status` to `discarded`, body preserved. | REQ-02-007 |

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

## 5. Platform surfaces

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

> REQ numbering maps the FRD's EARS bullets in document order. The "recommended badge" lives inside
> the first/sixth bullets; the "building indicator" and the legend are folded into REQ-02-008.

---

## 7. AC ⇄ design check

- "the only write" → enforced: `lib/discard.ts` is the sole `fs.write`; all else read-only
  (architecture §7). ✅
- Fallback-to-documented when project/status missing → handled in `deriveColumn` (consumes FRD-01
  `StatusResult` which is fail-soft). ✅
- "board read-only, no drag" → no DnD library, no move action; only the discard Server Action. ✅
- "board visible behind the modal" → modal is an overlay, board stays mounted. ✅

No FRD-02 criterion is unbuildable.
