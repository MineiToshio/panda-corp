---
id: WO-17-004
type: work-order
slug: proposals-surface
title: 'WO-17-004 — Proposals surface: stream/card + promotions queue + memory health + badge/chip'
status: DRAFT
parent: FRD-17
implementation_status: IN_REVIEW
artifacts:
  - 'src/app/proposals/**'
  - 'src/components/modules/PromotionsQueue/**'
  - 'src/components/modules/MemoryHealth/**'
  - 'src/components/modules/ProposalsBadge/**'
  - 'src/components/modules/ProposalsDismiss/**'
source_requirements: [AC-17-001.1, AC-17-001.2, AC-17-001.3, AC-17-004.1, AC-17-004.2, AC-17-004.3, AC-17-004.4, AC-17-004.5, AC-17-004.6, AC-17-005.1, AC-17-005.2, AC-17-005.3, AC-17-005.4, AC-17-005.5, AC-17-006.1, AC-17-006.2, AC-17-006.3, AC-17-006.4, AC-17-006.5, AC-17-006.6, AC-17-007.1, AC-17-007.2, AC-17-007.3, AC-17-007.4, AC-17-007.5]
last_updated: '2026-06-19'
---
# WO-17-004 — Proposals surface: stream/card + promotions queue + memory health + badge/chip

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-17-page`, `CMP-17-stream`, `CMP-17-proposalcard`, `CMP-17-promoqueue`, `CMP-17-health`, `CMP-17-badge`, `CMP-17-dismiss`](../blueprint.md#3-components--interfaces).
FDD: [the Propuestas screen — `propuestasView()`, the four kind groups, the memory-health panel](../fdd.md).

> **Phase 2 re-plan (DR-062 cohesion / prototype fidelity).** This single coarse UI work order
> re-implements the **Proposals inbox** presentational surface to match the owner-approved prototype
> (`docs/design/prototype/index.html`, the canonical **Propuestas** view `propuestasView()` ~L1404,
> reached from the top-bar tab `tabProp()`). The `lib/memory` + `lib/self-suggest` readers
> (WO-17-001/002/003) are **VERIFIED and untouched** — this WO consumes them. The engine injects the
> standard UI envelope (read fdd.md + mocks/ + tokens + in-loop visual fidelity + reuse
> `components.md`) into this WO.

## Goal
Build the `app/proposals` surface faithfully to the prototype: a light `PageTitle` "Propuestas" block
with an open-count tail, the **memory-health** panel, then the **four proposal-kind groups** with the
activating command shown **at GROUP level** (per REQ-17-001), the **promotions queue**, and the
top-bar **badge** + per-project rail **chip**, with honest client-local **dismissal**.

- **`ProposalStream` / `DismissableProposalStream`** — the four groups (candidate lessons → prunable
  adjacent → promotions → self-suggestions), each with its GROUP-level command under the title when the
  group shares one skill (`/pandacorp:memory` for candidates+prune); dismissible client-locally.
- **`ProposalCard`** — one card, 4 kinds; `itemslot` icon + `LESSON-NNNN` id + eval-gate/target chip +
  title + evidence; **per-item command only when its group lacks one** (promotions / self-suggestions).
- **`PromotionsQueue`** — the durable `promotion: proposed` list (target/rationale/evidence +
  `/pandacorp:learn` copy command; reject is state-only; high-risk display-only).
- **`MemoryHealthPanel`** — raw-notes / candidates / last-run counters + the staleness nudge,
  **refactored onto the shared `Banner`** (DR-057); doubles as the refine-trigger surface.
- **`ProposalsBadge` / `ProposalsChip`** — top-bar open-count badge (`CountBadge` preset) + portfolio
  rail chip (`Chip` preset), extending FRD-14's pending-decisions/bugs chips with a third stream.

## Scope
Components from `docs/design/components.md` (reuse → adapt → create; never fork a near-duplicate):
- **`PageTitle`** (core) — the one light "Propuestas" title block (icon + H1 + subtitle + open-count
  tail); **not** a heavy `gxHero` (the canonical inbox uses the light title, DR-062).
- **`SectionHead`** (core) — every group divider + the "Salud de la memoria" header; no bespoke header.
- **`ProposalStream` / `DismissableProposalStream`** (route module) — group-level command, dismiss.
- **`ProposalCard`** (route module) — `rpgpanel` card, 4 kinds, command only when group lacks one.
- **`PromotionsQueue`** (module) — durable proposed→reviewed→approved·rejected view.
- **`MemoryHealthPanel`** (module) — counters + **shared `Banner`** staleness nudge (DR-057).
- **`ProposalsBadge` / `ProposalsChip`** (module) — `CountBadge` / `Chip` presets, NOT new pills.
- **`Chip`** (core) — eval-gate (ok/warn) + promotion-target (accent) presets; icon+text, not color alone.
- **`CmdRow`** (core) — the copy-only `/pandacorp:*` command chip (group-level or per-card).
- **`Banner`** (core, DR-057 single source) — the staleness nudge consumes it; no second banner.

## Acceptance criteria (FRD-17 EARS / REQ)
- **AC-17-001.1/.2/.3** — Group-level command shown once under the group title when the group shares a
  skill; per-item command only when it genuinely differs; lesson groups (candidates then prunable)
  adjacent and first, before promotions and self-suggestions.
- **AC-17-004.1** — The page renders all four streams; each lists its proposals.
- **AC-17-004.2** — Each card shows evidence/source + suggested action + the exact copyable command;
  no card runs the command (read-only).
- **AC-17-004.3** — Candidate lessons visually distinct from active, each showing the eval-gate state.
- **AC-17-004.4** — High-risk proposals are display-only (copy + navigate only).
- **AC-17-004.5** — Empty state → a calm *al día* guild message, never blank or fake urgency.
- **AC-17-004.6** — Spanish copy + a11y (FRD-13); state not by color alone.
- **AC-17-005.1/.2/.3/.4/.5** — Memory-health panel shows raw-notes/candidates/last-run; nudge only
  above threshold (no nagging); first-run invite when no memory yet; last-run labelled approximate;
  Spanish + staleness by text+icon, not color alone.
- **AC-17-006.1–.6** — Promotions queue lists exactly `promotion: proposed`, durable; each shows
  target/rationale/evidence + `/pandacorp:learn` copy command; reject state-only; high-risk
  display-only; calm empty state; Spanish + a11y.
- **AC-17-007.1/.2/.3/.4/.5** — Top-bar badge (links to `app/proposals`) + portfolio-rail chip (third
  stream); dismissal removes from count+list and survives refresh (localStorage, NOT a factory write);
  calm when empty (no false urgency); Spanish + count not by color alone.

## Dependencies
- **Foundation (FRD-13):** WO-13-006 (`PageTitle`/`SectionHead`/`Tabs`), WO-13-007 (the one `Banner` +
  `Chip`/`CountBadge`/`CmdRow`/`Button`).
- **Data (intra-FRD, VERIFIED):** WO-17-002 (`candidateLessons`/`promotionQueue`/`prunable`/
  `memoryHealth`), WO-17-003 (`computeSuggestions` + `gatherSuggestionsInput`).
- **Cross-FRD:** `frd-13` (foundation primitives + tokens); FRD-02 `CopyButton`; FRD-14 chip placement
  in the portfolio rail; FRD-09 the honest/White-Hat dismissibility framing.

## Visual reference
`docs/design/prototype/index.html` — `propuestasView()` (~L1404), `tabProp()` (~L652), `bPropGroup`
(~L1401, group-level command), `bPropCard` (~L1394, one card 4 kinds), the memory-health block + `MEM`
data (~L352/~L1408). See [fdd.md](../fdd.md) (the canonical render-fn contract) and
[mocks/README.md](../mocks/README.md) for the token slice. (The mocks README's "prototype does not yet
draw this screen" note is **superseded** by the FDD re-anchor: `propuestasView()` is now canonical.)

## Status Note

**What was built:** The complete `app/proposals` surface for the FRD-17 proposals inbox — a Server
Component page (`src/app/proposals/page.tsx`) that composes four dismissable proposal streams, a
memory-health panel, a durable promotions queue, and a top-bar badge.

**Key interfaces and signatures exposed:**

- `ProposalCard(props: ProposalCardProps): React.JSX.Element` — discriminated union on `kind`
  (`"candidate-lesson" | "promotion" | "prune" | "self-suggestion"`). Consumes `Lesson` (from
  `@/lib/memory/memory`) or `Suggestion` (from `@/lib/self-suggest/self-suggest`). The `withCommand`
  prop (boolean, default `false` for candidate/prune, `true` for promotion/self-suggestion) controls
  whether the per-card `CmdRow` is rendered — when `false`, the card defers to the group-level command
  (REQ-17-001). Located at `src/app/proposals/_components/ProposalCard/ProposalCard.tsx`.

- `DismissableProposalStream(props: DismissableProposalStreamProps): React.JSX.Element` — discriminated
  union on `kind`. The `groupCmd?: string` prop (only on `"candidate-lesson"` and `"prune"` variants)
  renders a shared `CmdRow` once under the `SectionHead` when the stream is non-empty, and sets
  `withCommand=false` on all child cards (REQ-17-001). Uses `proposalsDismissStore` (localStorage) for
  client-local dismissal. Located at
  `src/app/proposals/_components/DismissableProposalStream/DismissableProposalStream.tsx`.

- `ProposalsPage(): React.JSX.Element` — Next.js Server Component (no `"use server"` directive). Reads
  four data streams: `candidateLessons()`, `prunable()`, `promotionQueue()`, `computeSuggestions()`.
  Renders in AC-17-001.3 order: candidates → prune → promotions + `PromotionsQueue` →
  self-suggestions. Open-count tail = `candidates.length + prunables.length + promotions.length +
  suggestions.length`. Located at `src/app/proposals/page.tsx`.

**Implicit decisions and conventions:**

- `groupCmd` shown only when `!isEmpty` — the group command never appears on an empty stream (UX:
  nothing to run `/pandacorp:memory` on).
- `MEMORY_GROUP_CMD = "/pandacorp:memory"` — the single activating command for both candidates and
  prune groups. If the memory skill is renamed, update this constant in `page.tsx`.
- `withCommand` default by kind: `candidate-lesson` → `false`, `promotion` → `true`, `prune` →
  `false`, `self-suggestion` → `true`. Matches REQ-17-001: per-card command only when the group has
  no shared command.
- `proposal-card-source` data-testid holds the **lesson id** (e.g. `LESSON-0001`) in monospace; the
  source field (project name + WO reference) is rendered below the title in the evidence line.
- `EvalGateChip` uses shared `<Chip tone="ok"|"warn">` — not a bespoke badge. State communicated by
  `data-eval-gate` attribute + Spanish text label (not color alone).
- `KindIcon` is a 32px inline `<span>` with `background: color-mix(in oklch, …)` and icon-specific
  color from `KIND_META`. It is NOT a new `components/core` primitive (route-local, not shared).
- `SectionIcon` per kind: `ti-bulb` (candidate), `ti-arrow-up-right` (promotion), `ti-trash` (prune),
  `ti-sparkles` (self-suggestion). Tabler icon classes.
- Dismiss button uses `ti-x` Tabler icon + "Descartar" label. Dismissal ID for lessons =
  `lessonProposalId(lesson)`, for suggestions = `suggestionProposalId(suggestion)` (from
  `streamMeta.ts`).
- `PromotionsQueue` appears inside the promotions stream block (after `DismissableProposalStream
  kind="promotion"`), rendering the same `promotionQueue()` data as a durable reviewed list.

**Test files:**
- `src/app/proposals/_tests/wo-17-004-req17001.test.tsx` — 14 tests covering REQ-17-001 / AC-17-001.1/
  .2/.3 and DR-062 canonical-primitive usage (PageTitle, SectionHead, rpgpanel Panel).
- `src/app/proposals/_components/ProposalCard/_tests/ProposalCard.test.tsx` — 18 tests covering all
  four card kinds, eval-gate badge, withCommand behavior, display-only invariant.
- `src/app/proposals/_tests/proposals-page.test.tsx` — proposals page integration tests.
- `src/app/proposals/_tests/proposals-integration.reviewer.test.tsx` — adversarial integration tests.

**Gates passed:** 6710 tests passing (0 failures), `tsc --noEmit` clean, `biome check src/` clean,
Next.js build clean (static `/proposals` route). Visual fidelity check (DR-056): screenshot matched
prototype `propuestasView()` layout — PageTitle + accent chip, MemoryHealth panel with stats, four
SectionHead dividers, rpgpanel cards with dismiss buttons, empty-state Italian italic guild copy.
