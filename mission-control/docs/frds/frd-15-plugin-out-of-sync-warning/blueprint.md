---
id: BP-15
type: blueprint
slug: plugin-out-of-sync-warning
title: 'Blueprint — FRD-15 Plugin out-of-sync warning (v2 «Órbita»)'
status: ACTIVE
parent: FRD-15
implementation_status: PLANNED
readiness_gate: passed 2026-10-22
grounding_gate: passed 2026-10-22
consistency_gate: passed 2026-10-22
last_updated: 2026-10-22
---

# Blueprint — FRD-15 Plugin out-of-sync warning (v2 «Órbita»)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Per-feature blueprint (DR-049) on the platform of
> [`docs/product/architecture.md`](../../product/architecture.md) (§6 read interfaces, §7 read-only
> invariant, Route map `/api/plugin-sync`). It does not restate the platform.

## Purpose

Detect the most common factory slip, an installed plugin whose semver `version` is behind the source
`version`, and warn with the exact recovery command, read-only. v2 keeps the verdict and the route as
built and redraws the warning in Órbita in two places: the coral `AlertBanner` that opens Inicio
(FRD-18's WO-18-002) and the coral «Plugin desactualizado» pill in the sidebar on every screen (FRD-19's
WO-19-003). FRD-15 has **no new work order**: both surfaces fold into the work order that builds their
host (each alone would be under 20 minutes, DR-100).

## Components & Interfaces

| ID | Kind | Name / location | Responsibility | Traces | Built by |
|---|---|---|---|---|---|
| IF-15-sync | reader | `src/lib/plugin-sync/plugin-sync.ts` (`readInstalledVersion`, `readPluginSourceVersion`, `getPluginSyncState`) | Two JSON reads per runtime, numeric semver compare, `drift` / `reason` (`behind`, `in-sync`, `unknown`), per-runtime verdicts for Claude and Codex folded into `drift`; never throws | REQ-15-002, REQ-15-004, REQ-15-005 | WO-15-001, WO-15-002 (kept) |
| CMP-15-route | route handler | `GET /api/plugin-sync` (`src/app/api/plugin-sync/route.ts`) | Returns `getPluginSyncState()` as JSON, always 200, `no-store`, no write | REQ-15-004, REQ-15-005 | WO-15-003 (kept) |
| CMP-15-banner | UI | Inicio's `AlertBanner` (FRD-13 primitive) in `src/app/_components/plugin-sync-banner/` | Heading «El plugin instalado está atrás», both versions, the copyable command, the two recovery steps; polls the route and disappears on its own; nothing for `in-sync` / `unknown` | REQ-15-002 (AC-15-002.1..3), REQ-15-004, AC-15-004.1 | WO-18-002 (FRD-18) |
| CMP-15-pill | UI | `PluginPill` (`src/components/modules/AppShell/PluginPill.tsx`) | Coral sidebar pill while `drift`, title with both versions, links to the banner on Inicio | REQ-15-006 (AC-15-006.1) | WO-19-003 (FRD-19) |

### Traceability

| Requirement | Components | Work order(s) |
|---|---|---|
| REQ-15-002 (AC-15-002.1, AC-15-002.2, AC-15-002.3, AC-15-004.1) | IF-15-sync, CMP-15-banner | WO-15-001, WO-15-002 (verdict, kept); WO-18-002 owns the four ACs |
| REQ-15-004 lifecycle (self-clear) | CMP-15-route, CMP-15-banner, CMP-15-pill | WO-15-003 (kept), WO-18-002, WO-19-003 |
| REQ-15-005 read-only | IF-15-sync, CMP-15-route; both surfaces only copy the command | WO-15-001..003 (kept), WO-18-002, WO-19-003 |
| REQ-15-006 (AC-15-006.1) | CMP-15-pill | WO-19-003 |
| Runtime adapters (R9) | IF-15-sync (`runtimes.claude`, `runtimes.codex`) | kept as built |

## Contracts

- **Verdict (IF-15-sync).** `PluginSyncState = { installedVersion, sourceVersion, drift, reason, detail,
  runtimes }`. `drift` is true only on a positive signal (an installed version strictly behind its
  source, either runtime); `unknown` and `in-sync` never alarm; unreadable input yields `null` fields
  and `unknown`, never a throw. The reader's `detail` string is not rendered by the v2 surfaces: their
  Spanish copy comes from the catalogue through `t()` (`inicio.pluginBanner.*`, `shell.plugin.*`).
- **Route (CMP-15-route).** Unchanged: `GET`, `runtime = "nodejs"`, `dynamic = "force-dynamic"`,
  `Cache-Control: no-store`, always 200 with the state. Its file and time reads adopt WO-01-010's seams in
  WO-01-011 (no behaviour change).
- **Surfaces.** Server-rendered from `getPluginSyncState()` on each request; the banner additionally
  polls the route so it clears without a reload. Both render nothing unless `drift`. The banner is the
  only coral `AlertBanner` of the app; the pill mirrors it (DR-057). Neither executes anything.
- The uncommitted-changes banner variant of the prototype is removed (FRD-15 amendment, M1).

## Visual spec

| Surface | Mocks and oracle states | Built by |
|---|---|---|
| Inicio banner | `mocks/plugin-out-of-sync-warning.html#plugin-banner` (375, 768, 1280) | WO-18-002 |
| Sidebar pill | FRD-19 `app-shell.html#shell-expanded`, `#shell-pending-chip` (pill beside the pending pill) | WO-19-003 |

The fixture home (`docs/design/prototype/fixtures/home/.claude`) holds the installed version that makes
the oracle state behind (technical-assumptions §2).

## Dependencies & Risks

- Upstream: FRD-01 `lib/config` (paths, `HOME` seam); FRD-13 (`AlertBanner`, `CommandBox`, tokens).
- Downstream: FRD-18 (banner placement, WO-18-002), FRD-19 (pill, WO-19-003).
- Risk: `installed_plugins.json` shape varies by Claude version; parsed defensively (array or object
  entry), absence → `unknown`. Kept as built.

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-15-001 | — | `src/lib/plugin-sync/plugin-sync.ts`, `src/lib/plugin-sync/_tests/plugin-sync.test.ts` | false | W0 · kept live, built (no rebuild) |
| WO-15-002 | WO-15-001 | `src/lib/plugin-sync/plugin-sync.ts`, `src/lib/plugin-sync/_tests/plugin-sync.test.ts` | false | W1 · kept live, built (no rebuild) |
| WO-15-003 | WO-15-002 | `src/app/api/plugin-sync/route.ts`, `src/app/api/plugin-sync/_tests/route.test.ts`, `src/app/api/plugin-sync/_tests/route.integration.adversarial.test.ts` | false | W2 · kept live, built (no rebuild) |

- All three are legacy work orders kept live (`implementation_status: VERIFIED`); the engine does not
  rebuild them; their waves come from their own `dependsOn` and their files are touched by no v2 WO of
  the same wave. Later writer: WO-01-011 (W5, `src/app/api/plugin-sync/**`, seam adoption).
- FRD-15's live ACs are owned cross-FRD: AC-15-002.1, AC-15-002.2, AC-15-002.3 and AC-15-004.1 by
  **WO-18-002** (W5), AC-15-006.1 by **WO-19-003** (W6). FRD-15's gate re-checks the kept WOs and those
  owners.

## Work Orders

Live: WO-15-001, WO-15-002, WO-15-003 (kept). Index: [`work-orders/README.md`](work-orders/README.md).

## Superseded (v1 history)

- WO-15-004 `PluginSyncBanner` on the v1 `Banner` → WO-18-002 (the Órbita `AlertBanner` on Inicio)

## Readiness check (DR-100)

REQ-15-002, REQ-15-004, REQ-15-005 and REQ-15-006 map to components above; the five live ACs are owned
once (four by WO-18-002, one by WO-19-003); `dependsOn` names live work orders only; no open
clarification marker remains.
