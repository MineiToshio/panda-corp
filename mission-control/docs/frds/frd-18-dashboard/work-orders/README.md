# Work orders — FRD-18 Dashboard ("Inicio")

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Design: [`blueprint.md`](../blueprint.md). Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

TDD per WO (RED → GREEN → refactor). Gate: `.pandacorp/verify.sh` (biome → tsc → vitest).
FRD-18 is the **heaviest composition surface** and is **REAL-TIME**; sequence it LAST among the UI
features. See the blueprint's **Build Plan (Phase 2)**.

## List & order (Phase 2)

Phase-2 collapses the former six presentational WOs (digest / tu-turno / pulso / cartera / progreso /
page-assembly) into **ONE coarse real-time UI work order** — the whole `/` home surface — re-anchored to
the prototype and reusing the shared primitives.

| WO | Title | Layer | Depends on |
|---|---|---|---|
| WO-18-001 | `Inicio` real-time dashboard — all six sections + the hosted health banners | UI (real-time) | FRD-13 WO-13-006/007/008; FRD-01 WO-01-009 (`useLiveSnapshot`); FRD-15 WO-15-004, FRD-16 WO-16-004 (hosted banners); the VERIFIED `lib/**` reader layer |

## Parallelization

- WO-18-001 is the **single, terminal** Phase-2 work order — no intra-FRD parallelism. It is the join
  point of the whole surface and must run **LAST**, after its foundation, the live transport, and the two
  hosted banners are VERIFIED.
- Each pure derivation (`IF-18-digest`/`-turn`/`-pulse`/`-card`) lives in `(dashboard)/_lib/` and is
  unit-tested with fixtures before its section component, inside this one WO.

## Cross-feature dependencies (the broadest in the project)

- **FRD-01** `lib/config`, `lib/ideas`, `lib/profile`, `lib/portfolio`, `lib/status`, `lib/events` — the reader layer.
- **FRD-02** `lib/board`, `lib/next-step`, `CopyButton`.
- **FRD-05** `lib/work-orders` — WO progress + blocker reason.
- **FRD-06 / FRD-12** `lib/events` — digest, live/no-signal, last-event time.
- **FRD-09** gamification (level/XP, achievement, next milestone) — the progress strip.
- **FRD-13** the shared primitives (`PageTitle`/`SectionHead`, `Banner`/`Chip`/`CmdRow`/`CopyButton`/
  `ProgressBar`/`Toast`, the RPG foot/`XpBar`) — WO-13-006/007/008. Reuse-before-create; no bespoke banner.
- **FRD-01** `lib/config`, `lib/ideas`, `lib/profile`, `lib/portfolio`, `lib/status`, `lib/events` — the
  reader layer — **and WO-01-009 (`useLiveSnapshot`), the shared live transport this surface consumes.**
- **FRD-15** `PluginSyncBanner`, **FRD-16** `OrphansBanner` — **hosted** in the conditional banner stack
  (both `Banner` consumers).
- **FRD-17** `lib/memory` (`memoryHealth`) — the memory-backlog nudge in "Tu turno"; the proposals nudge.

> Because FRD-18 only composes, the surface can be built against a fixture version of any not-yet-shipped
> reader and lit up when it lands — but the FULL dashboard (WO-18-001) is "done" only once its upstream
> readers, the FRD-13 primitives, the FRD-01 live transport, and the FRD-15/16 hosted banners exist.
