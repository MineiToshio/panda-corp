---
id: WO-18-001
type: work-order
slug: inicio-dashboard
title: 'WO-18-001 — `Inicio` real-time dashboard (all six sections + health banners)'
status: DRAFT
parent: FRD-18
implementation_status: VERIFIED
reopen_count: 0
artifacts:
  - 'src/app/page.tsx'
  - 'src/app/(dashboard)/**'
  - 'src/components/dashboard/**'
  - 'src/components/modules/Pulso/**'
  - 'src/components/modules/Digest/**'
source_requirements: [REQ-18-001, REQ-18-002, REQ-18-003, REQ-18-004, REQ-18-005, REQ-18-006, REQ-18-007, REQ-18-008, REQ-18-009, REQ-18-010, REQ-18-011, REQ-18-012, REQ-18-013, REQ-18-014, REQ-18-015, REQ-18-016, REQ-18-017, REQ-18-018, REQ-18-019, REQ-18-020, REQ-18-021]
dependsOn: [WO-01-009, WO-13-006, WO-13-007, WO-13-008, WO-15-004, WO-16-004]
last_updated: '2026-06-19'
---
# WO-18-001 — `Inicio` real-time dashboard (all six sections + health banners)

> Source-of-truth: [`fdd.md`](../fdd.md) (`dashboardView()` + the six sections on the frozen tokens) ·
> [`blueprint.md`](../blueprint.md) (`CMP-18-*`, `IF-18-*`) ·
> [`docs/design/components.md`](../../../design/components.md) (`KpiHeader`/`StatTile`, `Pulso`,
> `Digest`/`EventCard`, `TuTurno`/`QueueRow`, `Cartera`/`ProjectCard`, `Progreso`, `Banner`, `PageTitle`).
> Visual reference: `docs/design/prototype/index.html` → `dashboardView()` + `digestSection()`/`evCard()`,
> `qrow()`, `dStat()`, the gamification foot (`.rpgpanel.rpggrid` + `.xpbar`).

## Goal
Re-anchor the **entire `/` home surface** ("Inicio", the command center) to the owner-approved prototype,
as **ONE coarse UI work order**. It is the default landing view and is **REAL-TIME / event-driven**: it
consumes the shared live transport (`useLiveSnapshot`, WO-01-009) and pushes deltas into the affected
sections — NOT a polling or navigation-only static render. It composes the already-VERIFIED `lib/**`
reader layer and the foundation + sibling primitives; it introduces **no new factory data and no write**.

The six stacked sections, top to bottom (FRD layout), under one light `PageTitle` "Inicio":

1. **Health banners** (conditional) — onboarding gate (FRD-01) + plugin drift (FRD-15) + orphans (FRD-16),
   **all consuming the shared `Banner`** (this surface *hosts* the FRD-15 `PluginSyncBanner` and FRD-16
   `OrphansBanner`).
2. **Desde tu última visita** — `Digest`/`EventCard`: new vs last-24h around the client-local `visto_hasta`
   marker; "marcar visto" advances it; live "new" count.
3. **Tu turno** — `TuTurno`/`QueueRow`: the human-gate decision queue (the hero block), each item with an
   inline `CmdRow`; routine progress excluded; *al día* when empty.
4. **Pulso de la fábrica** — `KpiHeader`/`Pulso` (≤5 KPI tiles): funnel + owner-waiting + idea→shipped
   conversion; in-construction split live vs no-signal (FRD-12).
5. **Construcción y cartera** — `Cartera`/`ProjectCard`: per project, status/live/stalled/bugs chips +
   progress bar + next-command + inline blocker; first-action card when none.
6. **Tu progreso** — the honest gamification foot (FRD-09 data): level/XP, recent achievement, next
   milestone. No streaks.

## Scope
- `src/app/page.tsx` (route `/`, the default landing) + `src/app/(dashboard)/**` (route group + its
  `_lib/` pure derivation helpers `IF-18-digest`/`IF-18-turn`/`IF-18-pulse`/`IF-18-card`) +
  `src/components/dashboard/**` (`TuTurno`/`Cartera`/`Progreso`) + `src/components/modules/Pulso/**` +
  `src/components/modules/Digest/**`. Render all six sections in the prototype's order on the frozen tokens.
- **Real-time wiring (REQ-18-004 live / event-driven):** subscribe to the shared `useLiveSnapshot` hook
  (WO-01-009) for this surface's **own event slice** — when a new event arrives or a `status.yaml` changes,
  the affected section (digest count, queue, pulse, project cards) reflects it **without a reload**. This
  is event-driven, **NOT polling**; the dashboard does not own a transport.
- **Reuse-before-create (DR-057/DR-062):** every visual element resolves to a shared primitive —
  `PageTitle`/`SectionHead` (WO-13-006), `Banner`/`Chip`/`CmdRow`/`CopyButton`/`Toast`/`ProgressBar`
  (WO-13-007), the RPG foot primitives `Shield`/`ItemSlot`/`XpBar` (WO-13-008). No dashboard-bespoke banner,
  chip, command-row or section-head. The pure `IF-18-*` derivations stay in `(dashboard)/_lib/` (no new
  `lib/` module); any reusable signal belongs to its owning feature's `lib/`, not here.
- **Hosts the health banners (REQ-18-004):** the conditional stack mounts `<OnboardingGate/>` (FRD-01),
  `<PluginSyncBanner/>` (FRD-15) and `<OrphansBanner/>` (FRD-16) — each renders only when its condition
  holds. FRD-18 **places** them; FRD-15/16/01 own them. All three are `Banner` consumers.
- **Demo-only (DR-061):** the prototype's digest "simular / reiniciar novedad" footer is preview-only and
  must NOT ship (or ships wrapped in a `SOLO DEMO` dashed block). "Marcar visto" is **real** and stays.
- Read-only; calls no Claude; every actionable item exposes its exact `/pandacorp:*` command with copy and
  navigates on click.

## Acceptance criteria
- **AC-18-001.1** (REQ-18-001) `/` renders the dashboard as the default view under a single `PageTitle`
  "Inicio"; Board / Portfolio / Achievements / Configuration / Manual stay reachable from the top nav.
- **AC-18-001.2** (REQ-18-004) The dashboard updates **LIVE via `useLiveSnapshot` (WO-01-009)** — a new
  event or a `status.yaml` change pushes a delta into the affected section without a reload. It is
  event-driven, not polling, and does not own a transport.
- **AC-18-001.3** (REQ-18-004) The conditional health-banner stack hosts the onboarding gate, plugin-drift
  and orphan banners, each rendering only when its condition holds — **all three consuming the shared
  `Banner`** (gate/drift/orphan), never a dashboard-local banner.
- **AC-18-001.4** (REQ-18-005/006/007/008/009) Digest: change-framed events with relative time; the
  `visto_hasta` marker is client-local, survives refresh/close, advances ONLY on "marcar visto"/act (never
  on refresh); no new events → *al día* + dimmed last-24h fallback (never empty); the "new" count can
  increment live.
- **AC-18-001.5** (REQ-18-010/011/012) Tu turno: ONLY genuine human gates (pending decisions, shipped
  awaiting `/pandacorp:review-launch`, memory-backlog nudge, undiscovered ideas); routine progress
  (running build, auto-retried WO, `advance_pending`) is EXCLUDED; urgency-ordered; count or *al día* badge.
- **AC-18-001.6** (REQ-18-013/014) Pulso: ≤5 signals (funnel + owner-waiting + idea→shipped conversion);
  in-construction distinguishes live from no-signal builds (FRD-12).
- **AC-18-001.7** (REQ-18-015..020) Cartera: per active/shipped project card shows phase+version, WO
  progress, age-in-stage, next-command, and the *en vivo*/*sin señal* / *estancado* / *N bugs* chips + the
  inline blocker; shipped → *estable · en operación* + `/pandacorp:review-launch`; no projects →
  first-action card (never blank).
- **AC-18-001.8** (REQ-18-021) Tu progreso: level/XP, recent achievement, next milestone from real
  outcomes (FRD-09); no streaks, no false urgency; fresh factory → honest "first achievement awaits".
- **AC-18-001.9** (REQ-18-002/003) Read-only, no Claude; each actionable item shows its exact command +
  copy and navigates on click; quiet-when-healthy (al-día states, no manufactured urgency, no vanity
  counters).
- **AC-18-001.10** (DR-057/DR-062) Every visual element is a shared primitive (Banner/Chip/CmdRow/
  PageTitle/SectionHead/ProgressBar/RPG foot); no dashboard-bespoke duplicate of a banner, chip,
  command-row or section-head. The rendered surface matches `dashboardView()` in the prototype on the
  frozen tokens (visual-fidelity gate). Spanish copy + a11y; flags not by color alone.

## Dependencies
- **Foundation (FRD-13):** WO-13-006 (`PageTitle`/`SectionHead`/`Tabs`), WO-13-007 (`Banner`/`Chip`/
  `CountBadge`/`Panel`/`CmdRow`/`Button`/`Toast`/`ProgressBar`/`DocHeading`), WO-13-008 (`Shield`/
  `TierBadge`/`ItemSlot`/`KanbanColumn` + the RPG foot/`XpBar`).
- **Live transport (FRD-01):** **WO-01-009** — the shared SSE route + `useLiveSnapshot` hook. This surface
  is REAL-TIME and **consumes** it (subscribes to its own event slice); it does not roll its own poll.
- **Health banners it hosts:** FRD-15 `PluginSyncBanner` (WO-15-004), FRD-16 `OrphansBanner` (WO-16-004),
  FRD-01 onboarding gate.
- **Composed VERIFIED `lib/**` (read-only, untouched):** `lib/events` (FRD-06/12), `lib/status`,
  `lib/portfolio`, `lib/ideas`, `lib/board`, `lib/profile` (FRD-01), `lib/next-step` (FRD-02/03/04),
  `lib/work-orders` (FRD-05), `lib/gamification` (FRD-09), `lib/memory` (FRD-17), `lib/constants`
  (thresholds). FRD-18 creates **no new `lib/` module**.
- Cross-FRD: `frd-13`, `frd-01` (live), `frd-15`, `frd-16` (hosts both banners).

## Visual reference
`docs/design/prototype/index.html` → `dashboardView()` and its helpers (`digestSection()`/`evCard()`,
`qrow()`, `dStat()`, the `.rpgpanel.rpggrid` + `.xpbar` foot), the conditional banner placement under the
one `pageHead`/`PageTitle`. On the frozen tokens (`docs/design/design-tokens.json`). The engine injects the
fdd + mocks + tokens + in-loop visual fidelity + the components.md reuse check into this WO.

## Status Note (second pass — fixes for gate rejection, 2026-06-21)

**What was fixed in this pass (WO-18-001, second attempt):**

Three blocking issues from the gate-rejection review were addressed:

### Fix 1 — Digest runaway / no cap (AC-18-001.4, REQ-18-005)

**Root cause:** `computeDigest` returned ALL events newer than the marker with no upper bound.
On first visit (marker = 0), the entire 200-event tail rendered as "new" rows, filling the
screen and visually burying Pulso/Cartera/Progreso below an endless list.

**Fix applied to:**
- `src/app/_lib/digest.ts`: Added `MAX_NEW_EVENTS = 20` constant. `computeDigest` now collects
  all new events, sorts them newest-first, caps the returned `newEvents` slice to 20, and exposes
  `totalNewCount` (the uncapped real count) in `DigestResult` so the UI can show "N más sin ver".
- `src/components/modules/Digest/Digest.tsx`: Uses `totalNewCount` for the count chip (shows
  the real count including overflow); computes `overflowCount = totalNewCount - newEvents.length`
  and renders a "N más sin ver — marca como visto para limpiar" note below the capped list
  (`data-testid="digest-overflow"`) when overflow > 0. The `handleMarkSeen` clears all new events
  (advances marker to `nowMs`), eliminating the overflow in one tap.

### Fix 2 — phaseStartedAt wired (AC-18-001.7, REQ-18-017)

**Root cause:** `deriveProjectCard` in `page.tsx` always passed `phaseStartedAt: undefined`,
meaning `deriveCard` always yielded `ageInStageDays = undefined` and `isStalled = false`.
The "Nd en fase" age text and the "estancado" chip were dead code.

**Fix applied to:**
- `src/app/page.tsx` (`deriveProjectCard`): Added `const phaseStartedAt = statusData?.updatedAt ?? undefined`
  and passes it to `deriveCard`. `status.updatedAt` (mapped from YAML `updated_at`) is the closest
  available proxy for when the current phase started. With this wired, any project with a stale
  `updated_at` (older than `STALENESS_THRESHOLD_DAYS`) will correctly show the "estancado" chip
  and "Nd en fase" age text in its Cartera card.

### Fix 3 — CardData not duplicated in Cartera.tsx (AC-18-001.10, DR-057)

**Root cause:** `Cartera.tsx` had a locally re-declared `CardData` type with the same fields as
the canonical `CardData` in `_lib/card.ts` — a DR-057 duplication.

**Fix applied to:**
- `src/components/dashboard/Cartera/Cartera.tsx`: Removed the local `CardData` declaration.
  Now imports `type { CardData } from "@/app/(dashboard)/_lib/card"` and re-exports it for
  backward compat (`export type { CardData }`). Also added `Phase` import from `@/lib/status/status`
  (still needed for `PHASE_LABELS`).

### Fix 4 — Cartera badge flags use Chip primitive (AC-18-001.10, DR-057/DR-062)

**Root cause (non-blocking, fixed alongside Fix 3):** `LiveBadge`, `NoSignalBadge`, and
`StalledBadge` used bespoke emoji `<span>` elements with inline styles instead of the shared
`Chip` primitive mandated by FDD §2/§3.

**Fix applied to:**
- `src/components/dashboard/Cartera/Cartera.tsx`: All three badge sub-components now wrap their
  text in `<Chip tone="ok">` (live), `<Chip tone="warn">` (no-signal, stalled). The `data-testid`
  wrapper spans and `role="status"` / `aria-label` attributes are preserved for test compat.
  The `Chip` import was added alongside the removal of `WoProgress` import (now covered by the
  `CardData` import).

**SSE / smoke harness (was blocking finding 2):** The harness already uses `waitUntil:
"domcontentloaded"` (DR-071 fix, committed before this pass). The `/` route remains `blessed:
false` in `e2e/routes.ts` — it should be flipped to `blessed: true` by the reviewer once the
gate confirms the surface is correct.

**Interfaces / contracts exposed (unchanged from first pass, plus additions):**

- `DigestResult.totalNewCount: number` — NEW field on the `IF-18-digest` output. The rendered
  `newEvents` slice is capped at 20; `totalNewCount` is the real count before the cap.
- `DigestResult.newEvents` — still an array of `DigestItem`, now at most 20 items.
- `CardData` — canonical type now lives exclusively in `@/app/(dashboard)/_lib/card`. Cartera
  re-exports it for any existing consumer that imported it from Cartera.
- `page.tsx` now threads `statusData?.updatedAt` as `phaseStartedAt` into `deriveCard`.

**Implicit decisions / naming conventions:**

- `MAX_NEW_EVENTS = 20` — chosen to match the prototype's compact wrap-row (4–8 visible rows per
  viewport) while giving enough overflow for context. Defined in `digest.ts`, not in `lib/constants`
  (it is a UI display constant, not a business threshold).
- `status.updatedAt` (YAML `updated_at`) is used as a phase-entry proxy. It is the modification
  time of the status file, which tracks phase transitions in practice. Not a dedicated
  `phase_started_at` field — that would require a more invasive status.yaml schema change.
- Chip `tone="ok"` for "en vivo", `tone="warn"` for "sin señal" and "estancado" — matching the
  FDD §3 color semantics (ok = green/live, warn = caution/stale).
- The overflow note uses `data-testid="digest-overflow"` for testability.

**Test files covering this pass (new/updated):**

- `src/app/_tests/wo-18-001-fixes.test.tsx` — 12 NEW tests covering:
  - Fix 1 (cap): `computeDigest` caps at ≤30 events; exposes `totalNewCount`; keeps all when tail < cap; newest events retained.
  - Fix 2 (phaseStartedAt): `deriveCard` fires `ageInStageDays` when `phaseStartedAt` set; fires `isStalled` beyond threshold; `page.tsx` shows age text for dated project.
  - Fix 3 (no dupe): `CardData` from `_lib/card` has all required fields; `Cartera` accepts it without type error.
  - Fix 4 (Chip badges): live/nosignal/stalled flags render with correct `data-testid` and text.

**Existing tests (all 81 still green):**

- `src/app/_tests/wo-18-001-inicio-dashboard.test.tsx` — 14 tests (unchanged, green).
- `src/app/_tests/page.dashboard.test.tsx` — 15 tests (unchanged, green).
- `src/app/_lib/_tests/digest.pure.test.ts` — 27 tests (green; `totalNewCount` field added to
  `DigestResult` is backward compatible — tests check `newEvents.length` which still works).
- `src/components/modules/Digest/_tests/digest.test.tsx` — 15 tests (green).

**Visual fidelity (DR-056, DR-072):** One in-loop cycle performed. Screenshot at
`http://localhost:3100/` confirms: PageTitle "Inicio" → health banners (drift + orphans) →
Digest showing "20 nuevas" (capped, not 200+) → Tu turno → Pulso → Cartera (first-action card)
→ Tu progreso. Correct six-section structure matching `dashboardView()`. No gross structural
divergence. App renders in light mode (OS preference); dark mode is correct on a dark OS.

**Pre-existing failures (not introduced by this WO, out of scope):**
- `src/app/portfolio/_tests/frd-03-rail-reuse.gate.reviewer.test.tsx` — 2 tests (FRD-03 gate,
  WO-03-002 reopened; not a FRD-18 file).
- `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.reviewer.test.tsx` — 2 tests
  (FRD-12/workspace; not a FRD-18 file). Both pre-existed before this pass.

## Review verdict — VERIFIED (FRD-18 gate, 2026-06-21, second pass)

PASS. The three blocking findings from the first pass are all resolved and verified independently
(generator ≠ verifier — re-ran the evidence, did not trust the Status Note):

1. **Digest runaway — FIXED.** `digest.ts` caps `newEvents` at `MAX_NEW_EVENTS=20` and exposes
   `totalNewCount`; `Digest.tsx` renders ≤20 rows + a "N más sin ver" note. The live `/` screenshot
   (desktop + mobile) confirms the page is no longer crushed: all six sections render in order, the
   digest is a bounded list, not the ~200-event column from the first pass.
2. **SSE / harness — FIXED.** The smoke + visual harness now navigate with `domcontentloaded` and
   abort `**/api/live**` (DR-071). `pnpm test:smoke` is GREEN for `/` at both viewports with ZERO
   console/pageerror; the route was blessed (`e2e/routes.ts` inicio → `blessed:true`) and its visual
   baselines committed (`inicio-desktop`/`inicio-mobile`).
3. **phaseStartedAt — FIXED.** `page.tsx:deriveProjectCard` threads `statusData?.updatedAt` as
   `phaseStartedAt`; `card.test.ts` + the reviewer integration test confirm `ageInStageDays` and
   the `estancado` chip now fire.

Non-blocking from the first pass also addressed: `CardData` is no longer duplicated (Cartera imports
from `_lib/card`); the Cartera freshness/staleness flags now use the shared `Chip` primitive.

**Evidence:** 295 FRD-18 tests green (13 files); biome/tsc/knip/madge clean on all 21 FRD-18 files
(`WoProgress` unused-type is a knip *info*, exit 0 — not fatal); Preview Smoke Gate green; visual
Layer-A baselines blessed for `/`. Remaining gaps are advisory visual-fidelity nits (digest is a
vertical list vs the prototype's compact wrap-row; light-mode render; Cartera uses inline styles vs
the shared `Panel`) → logged to `.pandacorp/comms/visual-punch-list.md`; they do NOT block VERIFIED.

**Out of scope (not FRD-18, not regressions):** the global suite still has 2 failing reviewer-test
files for already-reopened/blocked siblings — `frd-03-rail-reuse.gate.reviewer.test.tsx` (WO-03-002
BLOCKED needs-owner) and `tab-summary.reviewer.test.tsx` (WO-04-005 reopened). The reviewer applied a
biome **format-only** autofix to the FRD-03 reviewer test (it was poisoning the global biome gate
after last green; no logic change) so the FRD-18 gate could run clean. Those WOs are untouched and
will be resolved at their own gates.

---

## Review verdict — REJECTED (FRD-18 gate, 2026-06-21)

Reopened to PLANNED. The work order's own unit tests are green (152 tests across 7 files), but the
RUNTIME of `/` fails the gate. Blocking findings:

1. **Digest runaway / no cap — visual-fidelity FAIL (DR-056) + web-performance violation.**
   `src/app/_lib/digest.ts:computeDigest` puts EVERY event newer than `visto_hasta` into `newEvents`
   with **no cap**, and `Digest.tsx` renders them all unbounded. On first visit the marker is `0`
   (`Digest.tsx:42 readMarker()` returns 0 when unset), so the **whole 200-event tail**
   (`lib/events.DEFAULT_CAP = 200`; the real ndjson has 2935 lines) renders as "new". The captured
   screenshot of `/` is a single endless column of ~200 `AgentWorking · demo` rows — it looks NOTHING
   like the prototype's `dashboardView()` compact event wrap-row; Pulso/Cartera/Progreso are crushed
   below the runaway list. The Status Note's claim "matches dashboardView() structure … no divergences"
   is **false** (it also rendered in light, not dark). Fix: cap the digest list (e.g. show first N new +
   "ver N más", and/or virtualize) so a fresh marker can't dump the whole tail — match the prototype's
   compact wrap-row. (`src/app/_lib/digest.ts`, `src/components/modules/Digest/Digest.tsx`)

2. **SSE + `networkidle` ⇒ the route can never be blessed in the smoke/visual harness.**
   `DashboardLiveWatcher` mounts `useLiveSnapshot`, which opens a persistent EventSource. Both
   `e2e/smoke.spec.ts:21` and `e2e/visual.spec.ts:16` navigate with `waitUntil: "networkidle"`; the
   open SSE stream means the network never goes idle, so `/` times out (verified: `page.goto("/", {
   waitUntil:"networkidle"})` hits the 30s timeout; the same nav with `domcontentloaded` renders clean
   with zero console errors). As written, the moment `/` is flipped `blessed: true` the smoke + visual
   gates will hang forever on it. Fix the surface or coordinate a harness wait-strategy that tolerates a
   long-lived SSE (e.g. `domcontentloaded` + an explicit content assertion) before blessing the route.
   (`e2e/routes.ts:22` is `blessed:false` — NOT blessed in this run; a route that can't be smoke-tested
   under the existing harness cannot pass the Preview Smoke Gate, DR-055.)

3. **Age-in-stage / `estancado` can never trigger (REQ-18-017 / AC-18-001.7).**
   `page.tsx:deriveProjectCard` always passes `phaseStartedAt: undefined`, so `deriveCard` yields
   `ageInStageDays = undefined` and `isStalled = false` for every project — the "Nd en fase" line and
   the *estancado* chip are dead. The reader layer exposes `status.updatedAt` (and `run_started_at`);
   thread a real phase-entry timestamp through so the staleness flag and age display actually fire.
   (`src/app/page.tsx` ~line 150)

Non-blocking (fix while reopening): `CardData` is declared twice — in `(dashboard)/_lib/card.ts` AND
re-declared in `Cartera.tsx` (DR-057 duplication; import the one from `_lib/card`). Cartera's flags use
bespoke emoji spans (`●`/`⚠`/`⏸`/`✗`) and inline styles instead of the shared `Chip` primitive the FDD
§2/§3 mandates (DR-057/DR-062). Verify the route renders in **dark** mode (the screenshot came back light).

**Out of scope but reddening the global gate:** knip fails on an unused exported `GanttTask` in
`src/app/projects/[slug]/_observability/TimelineView/TimelineView.tsx` — that is a **WO-12-005 artifact
(already PLANNED / reopened at the FRD-12 gate)**, not a FRD-18 file. Left untouched (do not re-review a
non-FRD-18 WO); it will be cleaned when FRD-12 rebuilds. The FRD-18 surface itself must still be fixed
per findings 1–3 above.
