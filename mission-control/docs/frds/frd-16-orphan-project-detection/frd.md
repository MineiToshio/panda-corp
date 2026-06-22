---
id: FRD-16
type: frd
title: FRD-16 — Orphan project detection (REMOVED)
status: REMOVED
implementation_status: REMOVED
removed: '2026-06-22'
ui: false
last_updated: '2026-06-22'
---
# FRD-16 — Orphan project detection — REMOVED (2026-06-22)

> **This feature was removed at the owner's request.** It was never wanted and had ended up
> implemented anyway. On 2026-06-22 the whole capability was deleted from Mission Control:
> the bounded folder scan (`lib/orphans.ts`), the `GET /api/orphans` route, the `OrphansBanner`
> dashboard banner, and all of their tests. The shared `Banner` no longer carries the `orphan`
> kind. See the [decision log](../../decision-log.md) for the why.

## What it used to do (historical)

It caught the inverse of a registered project: a sibling repo carrying a `.pandacorp/` marker that
the factory didn't know about — surfaced as a dismissible dashboard banner offering to adopt it:

- **Orphan** = `.pandacorp/` marker, missing from the portfolio, never went through the handoff → `/pandacorp:adopt`.
- **Unlisted** = `.pandacorp/` marker, already a factory project but its portfolio row was lost → `/pandacorp:sync-portfolio`.

That always-on scan is gone. If the same need ever returns, prefer the on-demand skills
(`/pandacorp:adopt`, `/pandacorp:sync-portfolio`) over a dashboard scan, and write a fresh FRD.

> The original requirement/EARS text and implementation design live in this folder's other files
> (`blueprint.md`, `fdd.md`, `work-orders/`) and in git history; they describe code that no longer
> exists and are retained only as a historical record.
