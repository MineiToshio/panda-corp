# Work orders — FRD-18 Dashboard ("Inicio")

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Design: [`blueprint.md`](../blueprint.md). Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

TDD per WO (RED → GREEN → refactor). Gate: `.pandacorp/verify.sh` (biome → tsc → vitest).
FRD-18 is the **heaviest composition surface**; sequence it LAST among data-consuming features.

## List & order

| WO | Title | Layer | Depends on |
|---|---|---|---|
| WO-18-001 | `IF-18-digest` derivation + `Digest` client component (`visto_hasta`) | derivation + `components/` | `lib/events` (FRD-06/12) |
| WO-18-002 | `IF-18-turn` human-gate queue derivation + `TuTurno` component | derivation + `components/` | `lib/status`, `lib/ideas`, `lib/board`, `lib/next-step`, `lib/memory` |
| WO-18-003 | `IF-18-pulse` funnel + conversion + `Pulso` component | derivation + `components/` | `lib/ideas`, `lib/board`, `lib/portfolio`, `lib/events` |
| WO-18-004 | `IF-18-card` per-project derivation + `Cartera` cards (live/stale/blocker/first-action) | derivation + `components/` | `lib/status`, `lib/work-orders`, `lib/events`, `lib/next-step` |
| WO-18-005 | `Progreso` gamification strip | `components/` | FRD-09 data |
| WO-18-006 | `app/page.tsx` assembly: banners + 6 sections, default landing | `app/` | WO-18-001..005, FRD-15/16/17 banners |

## Parallelization

- WO-18-001..005 are independent of one another (each consumes a different reader slice) → parallel.
- WO-18-006 is the join point: it places the banners and the five sections; runs last.
- Each derivation (`IF-18-*`) is a pure function unit-tested with fixtures before its component.

## Cross-feature dependencies (the broadest in the project)

- **FRD-01** `lib/config`, `lib/ideas`, `lib/profile`, `lib/portfolio`, `lib/status`, `lib/events` — the reader layer.
- **FRD-02** `lib/board`, `lib/next-step`, `CopyButton`.
- **FRD-05** `lib/work-orders` — WO progress + blocker reason.
- **FRD-06 / FRD-12** `lib/events` — digest, live/no-signal, last-event time.
- **FRD-09** gamification (level/XP, achievement, next milestone) — the progress strip.
- **FRD-15** `PluginSyncBanner`, **FRD-16** `OrphansBanner` — placed in the banner stack (WO-18-006).
- **FRD-17** `lib/memory` (`memoryHealth`) — the memory-backlog nudge in "Tu turno"; the proposals nudge.

> Because FRD-18 only composes, each WO can be built against a stubbed/fixture version of any
> not-yet-shipped reader and lit up when it lands — but the FULL dashboard (WO-18-006) is "done" only
> once its upstream readers + the FRD-15/16/17 components exist.
