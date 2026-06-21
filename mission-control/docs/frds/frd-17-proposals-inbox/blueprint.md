---
id: FRD-17-blueprint
type: blueprint
parent: FRD-17
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-21'
---
# Feature blueprint — FRD-17 Proposals inbox (self-learning gate + self-suggestion)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how FRD-17 is implemented on top of the platform in
> [`docs/product/architecture.md`](../../product/architecture.md). It references the platform; it does
> not restate it.

## 1. Summary

The owner-facing surface of the factory's self-learning loop (DR-047) and the place where Mission
Control **suggests improvements on its own**. It is **strictly read-only** (like FRD-15/16): it
aggregates four proposal streams, shows each one's evidence + the exact command to act, and never
harvests, promotes, prunes, or runs any skill — the owner does, through `/pandacorp:memory`,
`/pandacorp:learn`, `/pandacorp:decide`, `/pandacorp:review-launch`.

Four proposal kinds (REQ-17-002):
1. **Candidate lessons** — `factory/memory/*.md` with `status: candidate` (awaiting corroboration/owner).
2. **Promotions** — lessons with `promotion: proposed` (a recurring lesson → standard/rule/skill, DR-047 high-risk tier).
3. **Prune** — lessons proposed for deprecation/reconciliation by `/pandacorp:memory review`.
4. **Self-suggestions** — computed **locally** by Mission Control from data it already reads, **no Claude calls**.

Plus a **memory-health panel** (REQ-17-005) and a durable **promotions queue** (REQ-17-006).

It extends FRD-14's chips/feedback channels with a third stream and consumes FRD-12's event tail.
**All state is written by the skills + the `librarian`, never by Mission Control** (FRD non-goal).

## 2. Platform references

- **Data sources** (architecture §4.6, §4.7, §4.5):
  - `factory/memory/*.md` — lessons with `status`, `promotion`, `source`, `links`, body (skip
    `_lesson-template.md`, `README.md`, `_inbox.md` except where counted below).
  - `factory/memory/_inbox.md` + per-project `.pandacorp/run/lessons.md` — raw notes count (memory-health).
  - `~/.claude/dashboard-events.ndjson` (tail, capped) — velocity + unused-capability + last-run signals.
  - per-project `.pandacorp/status.yaml` — phase/age for bottleneck + velocity self-suggestions.
  - `factory/decisions/registry.yaml` — `requiere_humano: false` rules for policy-friction self-suggestion.
  - per-project `.pandacorp/inbox/decisions.md` — recurring decisions (policy friction).
  - `plugin/skills/*/SKILL.md` + `plugin/agents/*.md` frontmatter — capability list for unused-capability.
- **`lib/` modules** (architecture §6): **`lib/memory.ts`** (new, owns memory reads). Reuses
  `lib/events.ts` (FRD-06/12), `lib/status.ts` + `lib/board.ts` (FRD-01/02), `lib/registry.ts` (FRD-07),
  `lib/reference.ts` (FRD-07/08), `lib/portfolio.ts` (FRD-01).
- **New module:** **`lib/self-suggest.ts`** — pure derivation of self-suggestions from the readers
  above (declared here; architecture §6 lists `memory`/`events`/`status` as the FRD-17 modules — this
  is the composition layer over them, kept separate so the derivation rules are unit-testable in isolation).
- **Surface** (architecture §11): `app/proposals` + badges (top-bar guild badge, portfolio-rail chip).
- **Read-only / no Claude** (architecture §7, FRD): every suggestion is derived from existing
  files/events; nothing is generated on the fly; no write to `factory/memory|standards|decisions` or `plugin/`.

## 3. Components & interfaces

### Interfaces (`lib/**`)

**`IF-17-memory` — `lib/memory.ts`** (new module, architecture §6).

```ts
type PromotionState = "none" | "proposed" | "approved" | "rejected";
type LessonStatus = "candidate" | "active" | "deprecated";
type Lesson = {
  id: string;            // LESSON-NNNN
  type: string;          // problem-solution | library-verdict | pattern | gotcha | anti-pattern
  domain: string;
  status: LessonStatus;
  promotion: PromotionState;
  source: string;        // project + capture point / doc ref (the evidence)
  links: string[];       // DR-* etc.
  projects: string[];    // distinct projects parsed from source (for "≥2 projects" corroboration)
  body: string;          // Situation / Lesson / Apply next time
  evalGate: "corroborated" | "awaiting-2nd";  // active or seen in ≥2 projects → corroborated; else awaiting
};

readLessons(): Lesson[];                 // all factory/memory/LESSON-*.md, parsed (gray-matter), skipping templates/README/_inbox
candidateLessons(): Lesson[];            // status === "candidate"
promotionQueue(): Lesson[];              // promotion === "proposed"
prunable(): Lesson[];                    // status === "deprecated" OR flagged for reconciliation (promotion notes)
memoryHealth(): {
  rawNotes: number;                      // _inbox.md lines + each project's .pandacorp/run/lessons.md lines
  candidates: number;
  lastMemoryRunAt: string | null;        // most recent memory-run signal (event or file mtime); null if unknown
  staleDays: number | null;              // days since lastMemoryRunAt
};
```

**`IF-17-suggest` — `lib/self-suggest.ts`** (new module).

```ts
type SuggestionKind =
  | "bottleneck"        // N ideas stuck in one phase (board derivation)
  | "velocity"          // a phase running far longer than the portfolio norm (events + status)
  | "unused-capability" // a skill/agent with no recorded usage in the event tail
  | "policy-friction"   // a requiere_humano:false rule recurring in inbox/decisions.md
  | "recurring-lesson"  // a lesson seen in ≥2 projects → propose promotion
  | "launch-review";    // a shipped project whose age/metrics merit /pandacorp:review-launch (DR-043)

type Suggestion = {
  kind: SuggestionKind;
  title: string;          // Spanish, change-framed
  evidence: string;       // the metric / LESSON id / project + the data point
  command: string;        // exact /pandacorp:* command to act
  target?: string;        // project slug / lesson id / rule id, for navigation
  severity: "info" | "nudge";
};

computeSuggestions(): Suggestion[];       // pure, derived from the readers; NO Claude, NO network
```

Threshold constants (`bottleneck` N, `velocity` factor over the portfolio median, `launch-review`
age, memory `staleDays`) live in `lib/constants.ts` (no magic numbers, AGENTS.md).

### UI surfaces (`app/**`, `components/**`)

**`CMP-17-page` — `app/proposals/page.tsx`** (Server Component).
Reads `IF-17-memory` + `IF-17-suggest`; renders the four streams. Theme: the guild's *crónica*
(the `librarian` as cronista), honest/White-Hat (REQ-17-007) — no false urgency, no streaks.

**`CMP-17-stream` — proposal list components** (Server, one per kind): candidate lessons,
promotions, prune, self-suggestions. Each row → `CMP-17-proposalcard`.

**`CMP-17-proposalcard`** — for each proposal: evidence/source, suggested action, and the exact
**copyable command** (`CopyButton`, FRD-02). Read-only — never runs (REQ-17-003). Candidate lessons
are **visually distinct** from `active`, with the eval-gate state shown (REQ-17-008).

**`CMP-17-health` — `components/memory-health.tsx`** — the memory-health panel: raw-notes count,
candidate count, last-`/pandacorp:memory`-run + staleness nudge with the exact command (REQ-17-005).
Doubles as the on-demand refine-trigger surface (scheduled sweep + this reminder).

**`CMP-17-promoqueue` — promotions queue** (inside `CMP-17-page`): the durable list of
`promotion: proposed` lessons, each with target (standard/rule/skill), rationale, evidence, and the
`/pandacorp:learn` command to promote (approve) — reject is informational (the skill flips
`promotion: rejected`; MC only shows it). MC never promotes (REQ-17-006).

**`CMP-17-badge`** — top-bar guild badge with the open proposal count, and a per-project portfolio-rail
chip (extends FRD-14's pending-decisions/bugs chips with a third stream) (REQ-17-001).

**`CMP-17-dismiss`** — dismissing a proposal is remembered client-locally (`localStorage`, like FRD-18's
marker / FRD-16's dismissal — NOT a factory write) (REQ-17-007).

## 4. Self-suggestion derivation (REQ-17-004) — local, no Claude

| Kind | Source data | Rule |
|---|---|---|
| `bottleneck` | board derivation (`lib/board` + `lib/status`) | ≥ N ideas in the same phase → suggest |
| `velocity` | event tail (`lib/events`) + `status.phase` age | a phase running ≫ portfolio median → alert |
| `unused-capability` | `lib/reference` capability list vs `agent`/`session` seen in event tail | a skill/agent with zero recorded usage |
| `policy-friction` | `.pandacorp/inbox/decisions.md` vs `registry.yaml` | a `requiere_humano:false` rule recurring → suggest tightening (`/pandacorp:decide`) |
| `recurring-lesson` | `lib/memory` (`projects.length ≥ 2`) | propose promotion (`/pandacorp:learn`) |
| `launch-review` | `lib/status` + portfolio | shipped project past the age threshold → `/pandacorp:review-launch` |

All six are pure functions of already-read files; each is unit-tested with fixtures.

## 5. Traceability (`REQ-17-MMM` → AC → components)

IDs assigned per FRD acceptance bullet, in order.

| REQ | Acceptance criterion (EARS, summarized) | Satisfied by |
|---|---|---|
| REQ-17-001 | Proposals inbox at guild level (top-bar badge) + per project (rail chip), as a 3rd stream over FRD-14 | `CMP-17-badge`, `CMP-17-page` |
| REQ-17-002 | Aggregate 4 kinds: candidate lessons, promotions, prune, self-suggestions | `IF-17-memory`, `IF-17-suggest`, `CMP-17-stream` |
| REQ-17-003 | Each proposal shows evidence/source + suggested action + exact copyable command; MC never runs it | `CMP-17-proposalcard`, `CopyButton`, architecture §7 |
| REQ-17-004 | Self-suggestions computed locally, no Claude, from existing data (6 derivations) | `IF-17-suggest` (`computeSuggestions`), §4 |
| REQ-17-005 | Memory-health panel: raw-notes count, candidate count, last-run + staleness nudge | `CMP-17-health`, `IF-17-memory` (`memoryHealth`) |
| REQ-17-006 | Durable promotions queue (`promotion: proposed`) with target/rationale/evidence + `/pandacorp:learn`; MC never promotes | `CMP-17-promoqueue`, `IF-17-memory` (`promotionQueue`) |
| REQ-17-007 | Candidate visually distinct + eval-gate state shown | `CMP-17-proposalcard` (eval-gate badge), `IF-17-memory` (`evalGate`) — see note |
| REQ-17-008 | Honest & dismissible (White-Hat): no false urgency, no nagging; dismissal remembered; guild theme | `CMP-17-dismiss`, `CMP-17-page`, FRD-09 |
| REQ-17-009 | High-risk proposals only ever displayed; approval routes to the owner running the skill | `CMP-17-proposalcard` (display + command only), architecture §7 |

> Note: the FRD lists the eval-gate/visually-distinct requirement and the honest/dismissible
> requirement as two separate bullets; mapped here as REQ-17-007 (visual distinction + eval-gate) and
> REQ-17-008 (honest/dismissible). REQ-17-009 = the high-risk display-only bullet.

All REQ map to concrete components. None unsatisfiable on the platform.

## 6. Notes / risks

- **`projects` parsing from `source`.** The `≥2 projects` corroboration (recurring-lesson + eval-gate)
  parses distinct project names from the lesson's `source:` / `links:`. The format is semi-structured
  ("project + capture point") — parse defensively, and when ambiguous, fall back to `awaiting-2nd`
  (conservative; never auto-propose a promotion on a guess). Anchored to LESSON-0001 (DR-047): never
  trust a derived signal that isn't evidence-anchored.
- **`lastMemoryRunAt` signal.** There is no explicit "memory ran" event in the §5 vocabulary; derive it
  from the most recent `factory/memory/LESSON-*.md` mtime and/or `_inbox.md` mtime as a proxy, and
  label it as approximate. If no signal, `null` → the panel nudges to run a first harvest. (Flag: a
  dedicated `memory_run` event from `/pandacorp:memory` would make this exact — capture as a lesson.)
- **No write, ever** — `lib/memory.ts` and `lib/self-suggest.ts` are read-only; the only place the loop
  mutates state is the skills + the `librarian` (FRD non-goal). Auditable: no write path in these modules.
- **Capped event tail** (architecture §3, FRD-12): velocity/unused-capability read the same capped tail
  (100–200) — long histories never degrade the page.

## Build Plan (Phase 2)

Phase 2 re-anchors the **presentational** Proposals surface to the owner-approved prototype
(`docs/design/prototype/index.html`, the now-canonical **Propuestas** view `propuestasView()`); the
`lib/memory` + `lib/self-suggest` data layers are already correct.

**State:**
- **VERIFIED (do not rebuild):** WO-17-001 (`lib/memory` reader), WO-17-002 (`lib/memory` views),
  WO-17-003 (`lib/self-suggest` + `gatherSuggestionsInput`) — the read-only data layers, verified.
- **PLANNED (Phase 2 UI):** WO-17-004 — the single coarse Proposals-surface work order
  (`ProposalStream`/`DismissableProposalStream` + `ProposalCard` + `PromotionsQueue` +
  `MemoryHealthPanel` + `ProposalsBadge`/`ProposalsChip`).

**Coarse DAG & parallelism:**

```
[VERIFIED data: WO-17-001 → WO-17-002 · WO-17-003]   [FRD-13 foundation: WO-13-006/007]
                 └───────────────────────┬───────────────────────────┘
                                         ▼
                          WO-17-004 (Proposals surface — UI)
```

WO-17-004 is a single sequential UI WO (no intra-FRD UI peer). The earlier per-component WOs were
collapsed because their pieces are all composed into one rendered surface (`app/proposals`) — the prior
build's repeated FRD-gate reopens were caused by sibling components built in isolation and left
orphaned (un-composed); the coarse WO makes the page the single composition owner from the start.

**Disjoint artifacts:** all under `src/app/proposals/**` and the four `src/components/modules/`
sub-trees (`PromotionsQueue`, `MemoryHealth`, `ProposalsBadge`, `ProposalsDismiss`). The top-bar badge
mounts in `app/layout.tsx` and the rail chip extends FRD-14's `StatusChips` — those are the only
cross-surface touch points, owned here as the proposals third stream.

**Cross-FRD deps:** `frd-13` (foundation `PageTitle`/`SectionHead`/the one `Banner`/`Chip`/`CountBadge`/
`CmdRow`, tokens, `tabular-nums`); FRD-02 `CopyButton`; FRD-14 portfolio-rail chip placement; FRD-09
White-Hat dismissibility framing.
