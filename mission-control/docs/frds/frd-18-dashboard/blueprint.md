---
id: FRD-18-blueprint
type: blueprint
parent: FRD-18
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-18'
---
# Feature blueprint — FRD-18 Dashboard ("Inicio", the command center)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how FRD-18 is implemented on top of the platform in
> [`docs/product/architecture.md`](../../product/architecture.md). It references the platform and the
> sibling features it composes; it does not restate them.

## 1. Summary

The default landing of Mission Control: a read-only **command center** that answers, at a glance,
*"what needs me now, what changed while I was away, and what's the next command"* across the whole
factory. It is **almost entirely a composition layer** — it surfaces existing signals and reads the
existing `lib/**` layer; it introduces no new factory data, no new write.

Six stacked sections (FRD layout, top to bottom):
1. **Health banners** (conditional) — onboarding gate (FRD-01) + plugin drift (FRD-15) + orphans (FRD-16).
2. **Desde tu última visita** — the digest of events since the operator last acknowledged (`visto_hasta`).
3. **Tu turno** — the human-gate decision queue (hero block).
4. **Pulso de la fábrica** — the funnel + the one metric that matters (idea→shipped).
5. **Construcción y cartera** — one card per active/shipped project.
6. **Tu progreso** — the honest gamification strip (FRD-09).

Visual reference: `prototype/index.html` view `dashboard` (`dashboardView()`, lines 610–679;
`digestSection()` 593–609; `pluginBanner()` 563–567). The persisted digest marker uses `localStorage`
(survives refresh/close); in the prototype events/age are mocked — the app reads the real layer.

Approved as a **first version** (owner: "good to ship and iterate"); the "Tu turno" composition, the
digest ack model and the pulse framing are expected to evolve (FRD note).

## 2. Platform references

- **Composes existing `lib/**`** (architecture §6) — FRD-18 creates **no new `lib/` module**:
  - `lib/events.ts` (FRD-06/12) — the capped event tail for the digest + live/no-signal + last-event time.
  - `lib/status.ts` (FRD-01/04) — phase, version, progress, age-in-stage, `pending_decisions`, `running`.
  - `lib/portfolio.ts` (FRD-01/03) — the project list for the build & portfolio cards.
  - `lib/ideas.ts` + `lib/board.ts` (FRD-01/02) — ideas-alive funnel + "Descubierta" awaiting prioritization.
  - `lib/next-step.ts` (FRD-02/03/04) — the next command per project/idea.
  - `lib/work-orders.ts` (FRD-05) — work-order progress + failing/blocked blocker reason.
  - `lib/memory.ts` (FRD-17) — the memory-backlog nudge for "Tu turno".
  - `lib/profile.ts` (FRD-01) — the onboarding-gate banner.
- **Composes sibling banners**: `PluginSyncBanner` (FRD-15 `CMP-15-banner`), `OrphansBanner`
  (FRD-16 `CMP-16-banner`), and the proposals/memory-health nudge (FRD-17).
- **Reuses honest indicators**: live / no-signal + age-in-stage (FRD-12); honest gamification strip (FRD-09);
  visual/a11y system (FRD-13).
- **Client-local UI state** (architecture §4.8): the `visto_hasta` digest marker + dismissals →
  `localStorage`. NOT a factory or project write — consistent with the read-only invariant (FRD-01).
- **Surface** (architecture §11): `app/` (the default landing route `/`).

## 3. Components & interfaces

FRD-18 is a composition feature: its "interface" is a small set of **pure derivation helpers**
(`IF-18-*`) over the already-read `lib/**` data, plus the page + section components. No new `lib/`
module; the derivations live in the feature folder (e.g. `app/(dashboard)/_lib/`), unit-tested.

### Derivation helpers (pure, unit-tested)

**`IF-18-digest`** — given the event tail + the `visto_hasta` marker, split events into **new**
(newer than the marker, highlighted + counted) vs the **last-24h** rolling-window fallback; produce
the *al día* state when there are no new events. The marker is supplied by the client; the helper is
pure over (events, marker).

**`IF-18-turn`** — build the **human-gate queue** from: pending decisions (`status.pending_decisions`
+ `.pandacorp/inbox/decisions.md` kinds: spend money / deploy prod / design-stack choice / delete
data), shipped projects awaiting `/pandacorp:review-launch` (DR-043), the memory-backlog nudge
(FRD-17 `memoryHealth`), and ideas in "Descubierta" awaiting prioritization. **Excludes** routine
progress: running builds, auto-retried failed WOs, and `advance_pending` (DR-032) are NOT gates.
Ordered by urgency.

**`IF-18-pulse`** — the funnel (ideas alive → in construction → shipped), the count awaiting the owner,
and the **idea→shipped conversion** (the one metric). ≤5 signals; "in construction" distinguishes live
from stale builds via the FRD-12 live/no-signal indicator.

**`IF-18-card`** — per project, derive: phase + version, work-order progress, age-in-stage, next
command, and the freshness/staleness/blocker flags (live/no-signal from the last event time; *estancado*
when phase age exceeds the staleness threshold; inline blocker reason from a failing/blocked WO; shipped
→ *estable · en operación* with `/pandacorp:review-launch`).

Thresholds (no-signal freshness, phase-staleness, last-24h window) in `lib/constants.ts` (no magic numbers).

### UI surfaces

**`CMP-18-page` — `app/page.tsx`** (Server Component, the default route `/`). Reads the `lib/**`
layer, computes `IF-18-turn` / `IF-18-pulse` / `IF-18-card` server-side, and renders the six sections.
The Board / Portfolio / Achievements / Configuration / Manual tabs remain reachable from the top nav.

**`CMP-18-banners`** — the conditional health-banner stack: onboarding gate (FRD-01) +
`PluginSyncBanner` (FRD-15) + `OrphansBanner` (FRD-16). FRD-18 **places** them; FRD-15/16 own them.

**`CMP-18-digest` — `components/dashboard/digest.tsx`** (`"use client"`, owns the `visto_hasta` marker).
Reads the marker from `localStorage`, renders new vs last-24h via `IF-18-digest`, shows the "marcar
visto" action that advances the marker, and (always-open) increments the "new" count live as events
arrive. A refresh or mere visit does NOT advance the marker.

**`CMP-18-turn`** — the "Tu turno" hero queue (server-rendered from `IF-18-turn`), each item with its
copyable command (`CopyButton`) and a click that navigates to the project/idea/board; *al día* badge
when empty.

**`CMP-18-pulse`** — the funnel + conversion metric (from `IF-18-pulse`).

**`CMP-18-cartera`** — the build & portfolio cards (from `IF-18-card`), incl. the first-action card when
there are no active projects.

**`CMP-18-progress`** — the honest gamification strip (FRD-09 data; recent achievement + next milestone).

## 4. The `visto_hasta` marker (client-local, REQ-18 digest)

- Persisted in `localStorage`; survives refresh + tab close (architecture §4.8). NOT a factory/project write.
- Advances ONLY on acknowledge ("marcar visto") or on acting on an item — never on refresh/visit.
- Events newer than the marker are "new" (highlighted + counted); a refresh never loses unseen events.
- No new events → *al día* + the last-24h activity (dimmed) as a rolling-window fallback (never empty).
- Prototype parity: `lsGet`/`lsSet`/`seenMs`/`markSeen` (lines 581–588) — same model in the app.

## 5. Traceability (`REQ-18-MMM` → AC → components)

IDs grouped by the FRD's labelled sections. The FRD has general ACs + per-section ACs; mapped below.

| REQ | Acceptance criterion (EARS, summarized) | Satisfied by |
|---|---|---|
| REQ-18-001 | Dashboard is the default landing; other tabs reachable from top nav | `CMP-18-page` (route `/`), top nav |
| REQ-18-002 | Read-only, no Claude; every actionable item shows the exact command + copy; click navigates | `CMP-18-page`, `CopyButton`, `lib/next-step` |
| REQ-18-003 | Exception-first / quiet when healthy (no manufactured urgency, no vanity counters) | all sections (*al día* states), FRD-09 |
| REQ-18-004 | Banners section: onboarding gate + plugin drift + orphans (conditional) | `CMP-18-banners` (composes FRD-01/15/16) |
| REQ-18-005 | Digest shows change-framed events with relative time from the event stream + diffs (not totals) | `CMP-18-digest`, `IF-18-digest`, `lib/events` |
| REQ-18-006 | `visto_hasta` locally persisted; survives refresh/close; refresh/visit does NOT advance it | `CMP-18-digest`, §4 |
| REQ-18-007 | Marker advances only on acknowledge/act; events newer than marker are "new" | `CMP-18-digest`, `IF-18-digest` |
| REQ-18-008 | No new events → *al día* + last-24h (dimmed) fallback, never empty | `IF-18-digest`, `CMP-18-digest` |
| REQ-18-009 | (SHOULD) live-update the "new" count without a refresh | `CMP-18-digest` (poll/live) |
| REQ-18-010 | "Tu turno" contains ONLY genuine human gates (decisions, review-launch, memory nudge, undiscovered ideas) | `IF-18-turn`, `CMP-18-turn` |
| REQ-18-011 | Routine progress (running build, auto-retried WO, `advance_pending`) NOT in the queue | `IF-18-turn` (exclusion rules) |
| REQ-18-012 | Queue urgency-ordered; header shows count waiting or *al día* | `IF-18-turn`, `CMP-18-turn` |
| REQ-18-013 | Pulse = funnel + owner-waiting count + idea→shipped conversion; composes FRD-12; ≤5 signals | `IF-18-pulse`, `CMP-18-pulse` |
| REQ-18-014 | "In construction" distinguishes live from stale builds (FRD-12 live/no-signal) | `IF-18-pulse`, `IF-18-card` |
| REQ-18-015 | Per active/shipped project card: phase+version, WO progress, age-in-stage, next command | `IF-18-card`, `CMP-18-cartera` |
| REQ-18-016 | Stale running build → *sin señal* + last-event time; fresh → *en vivo* | `IF-18-card` (`lib/events` last-event) |
| REQ-18-017 | Phase beyond staleness threshold → *estancado* + age | `IF-18-card` (`lib/status` age) |
| REQ-18-018 | Failing/blocked WO → inline blocker reason (no need to open logs) | `IF-18-card` (`lib/work-orders`) |
| REQ-18-019 | Shipped project → *estable · en operación* + `/pandacorp:review-launch` next | `IF-18-card`, `lib/next-step` |
| REQ-18-020 | No active projects → first-action card with the start command (never blank) | `CMP-18-cartera` |
| REQ-18-021 | Gamification strip: level/XP, recent achievement, next milestone, from real outcomes; no streaks | `CMP-18-progress`, FRD-09 |

All REQ map to concrete components/derivations. None unsatisfiable on the platform.

## 6. Edge cases (FRD)

- `visto_hasta` is client-local UI state (a preference), not a write (architecture §4.8).
- Fresh factory (no event stream) → digest *al día*; portfolio first-action cards; nothing faked (REQ-18-008/020).
- Many waiting items → the "Tu turno" queue stays urgency-ordered and does not truncate silently (REQ-18-012).

## 7. Notes / risks

- **Composition, not duplication.** FRD-18 must NOT re-implement live/no-signal, the next-step map, the
  board derivation, the memory-health read, or the banners — it consumes them. Any logic that would be
  reusable belongs in the owning feature's `lib/` module, not in the dashboard folder.
- **Heaviest dependency surface in the project**: FRD-18 transitively depends on FRD-01's whole reader
  layer + FRD-02 board/next-step + FRD-05 work-orders + FRD-06/12 events + FRD-09 gamification + FRD-15/16
  banners + FRD-17 memory. Sequence it LAST among the data-consuming features (see work-orders README).
- **`advance_pending` placement** (DR-032): explicitly NOT in "Tu turno" — it is a Board signal. The
  exclusion is an AC (WO-18-001), not an afterthought.

## Build Plan (Phase 2)

Phase-2 re-anchors the **whole `/` home surface** to the owner-approved prototype and makes it
**REAL-TIME**. FRD-18 owns no `lib/` data of its own — it composes the already-VERIFIED reader layer; so
there is **no lib-only WO to keep**. The six former presentational WOs (digest / tu-turno / pulso / cartera
/ progreso / page-assembly) are **collapsed into ONE coarse UI work order** — the surface is a single
cohesive composition and was splitting cleanly anyway only at the section level, which the prototype
re-anchor + the shared-primitive reuse make moot.

**Coarse WO set:**

| WO | Status | Layer | Artifacts (disjoint) |
|---|---|---|---|
| WO-18-001 `inicio-dashboard` | **PLANNED** (re-plan, collapses old 001–006) | UI (real-time) | `src/app/page.tsx`, `src/app/(dashboard)/**`, `src/components/dashboard/**`, `src/components/modules/Pulso/**`, `src/components/modules/Digest/**` |

**Collapsed / deleted:** the old `wo-18-001-digest`, `wo-18-002-tu-turno`, `wo-18-003-pulso`,
`wo-18-004-cartera`, `wo-18-005-progreso`, `wo-18-006-page-assembly` files are removed — their scope is
fully subsumed by the one coarse WO-18-001 (id reused as the lowest existing UI id).

**DAG / parallelism:** WO-18-001 is the **single, terminal** Phase-2 work order. It is the heaviest
dependency surface in the project and must be sequenced **LAST** among the UI work orders: it cannot start
until its foundation, transport and hosted-banner dependencies are VERIFIED — FRD-13 WO-13-006/007/008
(primitives), FRD-01 WO-01-009 (the live transport), and the banners it hosts (FRD-15 WO-15-004, FRD-16
WO-16-004). No intra-FRD parallelism (one WO). Its artifact globs are **disjoint** from FRD-15's
`plugin-sync-banner/**` and FRD-16's `orphans-banner/**` (which it merely *mounts*, not edits).

**Cross-FRD deps:** `frd-13` (shared primitives — WO-13-006/007/008), `frd-01` (the `useLiveSnapshot`
real-time transport — WO-01-009; this surface is event-driven, NOT polling), `frd-15` and `frd-16` (it
**hosts** both health banners, both `Banner` consumers). The dashboard composes — it must NOT re-implement
live/no-signal, the next-step map, the board derivation, the memory-health read, or the banners.
