---
id: WO-14-002
type: work-order
slug: snapshot-panel
title: 'WO-14-002 — SnapshotPanel: último commit en verde + worktree command'
status: DRAFT
parent: FRD-14
implementation_status: PLANNED
artifacts:
  - 'src/app/projects/[slug]/_components/snapshot-panel/**'
  - 'src/app/preview-wo14002/page.tsx'
source_requirements: [REQ-14-001, REQ-14-002, REQ-14-003]
last_updated: '2026-06-20'
---
# WO-14-002 — SnapshotPanel: último commit en verde + worktree command

## Goal
Re-implement the **snapshot panel** so it renders faithfully to the prototype `snapshotPanel()` /
`bStalenessPanel()` on the frozen tokens, with the **clear** canonical copy and its warning refactored
onto the shared **`Banner`** (FRD-13). The pure helpers (`buildSnapshot`, `isSnapshotStale`,
`SNAPSHOT_STALE_*` in `lib/snapshot.ts`) are correct and **VERIFIED** — this WO is **presentational only**.

## Scope
- **`SnapshotPanel`** (`_components/snapshot-panel/**`, Server) — consumes `buildSnapshot(slug, status)`
  (WO-14-001, VERIFIED). Three clearly-separated parts, per the FDD's re-anchored copy:
  1. **Último commit en verde** — `Panel` with a left `ti-circle-check` (`var(--ok)`) icon, the line
     **"Último commit en verde · seguro para probar"** + the closed-FRD green `Chip`, then the muted
     line "commit `<sha>` — pasó todos los gates. Pruébalo en un worktree aparte sin parar el build."
     SHA `tabular-nums`. The copyable **`git worktree add ../<slug>-review <sha>`** in a shared
     **`CmdRow`** + `CopyButton`.
  2. **Building-now line** (when `running`) — visually distinct hammer-icon (`var(--accent)`) line:
     "El build sigue avanzando: `<progreso>` · eso aún no está en verde, no lo pruebes" — never
     conflated with the last-green commit.
  3. **Staleness warning** (when `stale`) — refactored onto the shared **`Banner`** (`tone="warn"`):
     "El último commit en verde quedó atrás del build … lo que pruebes ahí ya no refleja lo que el build
     lleva construido." Warn carried by **icon + text**, not color alone.
- **Omit the whole panel** when `buildSnapshot` returns `null` (no `last_green_sha`) — no empty shell.
- **Copy guardrails:** the canonical "green = last build commit that passed ALL gates, safe to test in a
  separate worktree" wording — **NOT** local-vs-remote, **NOT** the old "punto verde" jargon.
- **Read-only:** MC never runs `git worktree` (FRD-14 non-goal); the panel only surfaces the command.
- **Reuse before create** (`docs/design/components.md`): `Panel`, `Chip`, `CmdRow`, `CopyButton`,
  `Toast`, and the **ONE shared `Banner`** for the staleness warning — no second banner/panel fork.

## Acceptance criteria
- **AC-14-001.1** FOR a building project, the panel SHALL render "Último commit en verde · seguro para
  probar" + the closed-FRD green chip + `last_green_sha`.
- **AC-14-001.2** It SHALL render `git worktree add ../<slug>-review <last_green_sha>` with a copy button.
- **AC-14-001.3** WHEN `last_green_sha` is absent, the panel SHALL be omitted entirely — no broken command.
- **AC-14-002.1** WHEN `running`, it SHALL show the "building now … eso aún no está en verde, no lo
  pruebes" line, visually distinct from the last-green commit.
- **AC-14-003.1** WHEN `stale`, it SHALL show the staleness warning on the shared `Banner` (icon + text,
  not color alone).
- Copy uses the canonical clear wording (no "punto verde", no local-vs-remote framing).
- Rendered output matches `snapshotPanel()` / `bStalenessPanel()` on the frozen tokens; the browser
  fidelity/smoke gate is clean.

## Dependencies
- **Foundation (FRD-13):** WO-13-007 (the **ONE `Banner`** + `Chip`/`Panel`/`CmdRow`/`Button`/`Toast`).
- **Intra (FRD-14):** WO-14-001 (`buildSnapshot`/`isSnapshotStale`/`SNAPSHOT_STALE_*`) — VERIFIED lib.
- **Cross-FRD:** `frd-13` (foundation primitives), `frd-04` (workspace mounts this panel via the Tabbar
  shell seam; FRD-01 `lib/status.ts` supplies the fields).

## Visual reference
`docs/design/prototype/index.html` → `snapshotPanel(i)` (~L867) + `bStalenessPanel(i)` (~L876), on the
frozen tokens. Fidelity, not novelty (DR-056) — see `../fdd.md` and `../mocks/README.md`.

## Status Note

**What was built:**

`SnapshotPanel` (`src/app/projects/[slug]/_components/snapshot-panel/snapshot-panel.tsx`, Server Component) — re-implemented presentationally to match `snapshotPanel(i)` + `bStalenessPanel(i)` on frozen tokens, using the shared foundation primitives (DR-057). The component was already partially built but used bespoke inline styles instead of the shared primitives; this WO replaced the whole presentation layer.

**Interfaces/contracts exposed:**

```ts
// snapshot-panel.tsx
export interface SnapshotPanelProps {
  slug: string;            // project slug (passed through — command is pre-built in snapshot)
  snapshot: SnapshotInfo | null;  // from buildSnapshot() (WO-14-001 VERIFIED)
}
export function SnapshotPanel(props: SnapshotPanelProps): React.JSX.Element | null;
// null when snapshot === null (AC-14-001.3 — panel omitted entirely)
```

**Primitives reused (DR-057):**

| Primitive | Role in SnapshotPanel |
|---|---|
| `Panel` (`src/components/core/Panel/Panel.tsx`) | Outer embossed container (replaces bespoke panel styles) |
| `Chip tone="ok"` (`src/components/core/Chip/Chip.tsx`) | Green "en verde" status signal (replaces bespoke badge) |
| `CmdRow` (`src/components/core/CmdRow/CmdRow.tsx`) | The `git worktree add` command row with copy button |
| `Banner tone="warn"` (`src/components/core/Banner/Banner.tsx`) | Staleness warning (DR-057 dup-fix: one banner, not a second custom panel) |

**Implicit decisions and assumptions:**

- `SnapshotInfo` (WO-14-001 VERIFIED) has no `frd` field, so the green `Chip` carries the label "en verde" instead of the prototype's `i.green.frd` FRD identifier. This is an acceptable semantic equivalent — "en verde" is the status signal; the FRD name would require a new field in the lib (out of scope for this presentational WO).
- The staleness warning uses the shared `Banner tone="warn"` (WO spec) rather than the prototype's bespoke `.panel border-color:var(--warn)` + `ti-clock-exclamation`. The `Banner` renders a triangle SVG instead of `ti-clock-exclamation` — intentional DR-057 convergence. Heading: "El último commit en verde quedó atrás del build". Detail: "Lo que pruebes ahí ya no refleja lo que el build lleva construido."
- The building-now line uses `buildingNow` verbatim from `SnapshotInfo` (e.g. "building now: 67%"), which comes from `buildSnapshot()`. The prototype shows `i.progreso` directly (e.g. "67%") — the slightly different format is inherited from the VERIFIED lib and is acceptable.
- Tabler icons are used via `<i className="ti ti-...">` (same as prototype). The `ti-circle-check` (ok color) and `ti-hammer` (accent color) render correctly because the Tabler icon font is loaded globally.
- The outer `<section>` carries `data-testid="snapshot-panel"` + `aria-label` as the landmark; the `Panel` inside has its own `data-testid="panel"`.
- URL token names: `var(--color-ok)`, `var(--color-accent)`, `var(--color-text2)`, `var(--color-text3)`, `var(--color-panel)` — matching the token contract from `design-tokens.json` / `globals.css`.

**Integration seams:**

- `page.tsx` already imports and renders `<SnapshotPanel slug={slug} snapshot={snapshot} />` (mounted in WO-04-004 chrome, above the tab bar). No page-level changes needed.
- The `buildSnapshot(slug, status)` call in `page.tsx` feeds the panel's `snapshot` prop directly — stale is `false` by default (no git probe yet; see blueprint §5 flag).
- When the git probe is added (future WO), the caller calls `isSnapshotStale(commitsBehind, hours)` and sets `snapshot.stale = true` to trigger the `Banner` warning — a one-line change.

**In-loop fidelity check (DR-056) — completed 2026-06-20:**

- Preview route: `src/app/preview-wo14002/page.tsx` → `/preview-wo14002` (four states: normal, building, stale+building, null).
- HTTP 200, zero console errors. Screenshot at `/tmp/wo14002-preview-full.png`.
- All four states render correctly: Panel + Chip + SHA code + CmdRow for normal/building; Banner warn strip below the Panel for stale; nothing for null.
- Divergences from prototype (both intentional, documented above): Chip shows "en verde" not FRD name; Banner replaces bespoke stale panel (DR-057).
- No cycle-2 corrections needed.

**Gate results (2026-06-20):**

- `vitest run` (WO-14-002 scope: 2 files) — **46 passed | 0 failed**
- `vitest run` (full suite) — **6854 passed | 3 pre-existing failures (FraguaScene WO-06-007 RED anchor, out of scope) | 2 expected-fail** — no regressions
- `tsc --noEmit` — 0 errors
- `biome check` (WO scope: 4 files) — clean (0 errors, 0 warnings)

**Test files:**

- `src/app/projects/[slug]/_components/snapshot-panel/_tests/snapshot-panel.test.tsx` — 30 tests (AC-14-001.1/.2/.3, AC-14-002.1, AC-14-003.1, a11y + DR-057 primitive assertions)
- `src/app/projects/[slug]/_components/snapshot-panel/_tests/snapshot-panel.adversarial.test.tsx` — 16 tests (end-to-end buildSnapshot→SnapshotPanel, staleness wiring, progress edges, safeToTest gap, slug robustness — all updated to query via shared primitive testids)
