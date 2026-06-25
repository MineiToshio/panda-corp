---
id: WO-14-002
type: work-order
slug: snapshot-panel
title: 'WO-14-002 — SnapshotPanel: último commit en verde + worktree command'
status: DRAFT
parent: FRD-14
implementation_status: VERIFIED
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_components/snapshot-panel/**'
  - 'src/app/preview-wo14002/page.tsx'
source_requirements: [REQ-14-001, REQ-14-002, REQ-14-003]
dependsOn: [WO-14-001, WO-13-006, WO-13-007]
last_updated: '2026-06-21'
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

**What was built (repair pass — 2026-06-21):**

Correctness fix for the gate-reviewer defect: `SnapshotPanel` previously showed "Último commit en verde · seguro para probar" unconditionally, ignoring `safeToTest`. When `safeToTest === false` (HEAD has moved past the last green SHA — the normal state during an active build), claiming "seguro para probar" misleads the operator. This WO repairs that.

**Change summary (presentational only, `_components/snapshot-panel/**`):**

- `snapshot-panel.tsx` — extracts `safeToTest` from `snapshot`; derives `isGreenAndSafe = safeToTest === true`. When `true`: heading = "Último commit en verde · seguro para probar" + `Chip tone="ok" "en verde"`. When `false`: heading = "Último commit en verde" (no safe-to-test claim) + `Chip tone="warn" "aún no seguro"`. The SHA, worktree command, building-now block, and staleness Banner are unchanged.
- `snapshot-panel.adversarial.test.tsx` — replaced the "documented gap" describe block (which pinned the broken behavior, DR-016 decorative test) with 5 correct tests that would fail against the old implementation and pass against the fix. 4 tests added (net +4 from 51 to 55 total).
- `preview-wo14002/page.tsx` — added state 4 (`safeToTest: false`) to the preview route so the new branch is visually verifiable. State 5 is the null state (was state 4).

**Interfaces/contracts exposed (unchanged from prior build):**

```ts
// snapshot-panel.tsx
export interface SnapshotPanelProps {
  slug: string;            // project slug (for aria-label context)
  snapshot: SnapshotInfo | null;  // from buildSnapshot() (WO-14-001 VERIFIED)
}
export function SnapshotPanel(props: SnapshotPanelProps): React.JSX.Element | null;
// null when snapshot === null (AC-14-001.3 — panel omitted entirely)
```

**Primitives reused (DR-057 — unchanged):**

| Primitive | Role in SnapshotPanel |
|---|---|
| `Panel` | Outer embossed container |
| `Chip tone="ok"` | Green "en verde" signal — shown when `safeToTest=true` |
| `Chip tone="warn"` | Amber "aún no seguro" signal — shown when `safeToTest=false` |
| `CmdRow` | The `git worktree add` command row with copy button |
| `Banner tone="warn"` | Staleness warning (shown when `stale=true`) |

**Implicit decisions and assumptions:**

- `safeToTest=false` does NOT hide the SHA or the worktree command — the information is still useful to the operator (they can check out that SHA, just not assume it's the current safe point). Only the "seguro para probar" claim is suppressed.
- The `ti-circle-check` icon in `var(--color-ok)` remains in the heading row even when `safeToTest=false` — it identifies the last green commit (the icon refers to "passed all gates"), not the current safety status. The Chip is the safety signal. This is consistent with icon+text a11y (not color alone).
- `aria-label` on the `<section>` is updated contextually: "Último commit en verde — seguro para probar" when safe; "Último commit en verde — HEAD avanzó, no es el punto seguro actual" when not safe.
- The previous build's other decisions remain: "en verde" (not FRD name) in the ok Chip; Banner over bespoke stale panel (DR-057); `buildingNow` verbatim from `SnapshotInfo`.

**Integration seams (unchanged):**

- `page.tsx` feeds `<SnapshotPanel slug={slug} snapshot={snapshot} />` — the panel now correctly reads `snapshot.safeToTest` which `buildSnapshot()` (WO-14-001) derives from `status.safeToTest === true`.
- The staleness Banner wiring is unaffected.

**In-loop fidelity check (DR-056/DR-072) — completed 2026-06-21:**

- Preview route `/preview-wo14002` extended with 5 states (was 4): normal · building · stale+building · safeToTest=false · null.
- HTTP 200, zero console errors. Screenshot at `/tmp/wo14002-after-fix-full.png`.
- State 4 (`safeToTest=false`): Panel renders with "Último commit en verde" heading + amber "aún no seguro" chip + SHA + building-now block + CmdRow. No "seguro para probar" text visible. Structurally matches the panel layout of states 1–3; only the heading text and chip tone differ.
- No gross structural divergences from the mock. No cycle-2 corrections needed.

**Gate results (2026-06-21):**

- `vitest run "snapshot-panel"` (3 test files) — **55 passed | 0 failed**
- `vitest run` (full suite) — **7008 passed | 7 pre-existing failures (frd-03-rail-reuse, frd-05-reuse, tab-summary.reviewer — RED anchors documented in progress.md, not caused by this WO) | 2 expected-fail** — no regressions
- `tsc --noEmit` — 0 errors
- `biome check` (WO scope: 5 files) — clean (0 errors, 0 warnings)

**Test files:**

- `src/app/projects/[slug]/_components/snapshot-panel/_tests/snapshot-panel.test.tsx` — 30 tests (AC-14-001.1/.2/.3, AC-14-002.1, AC-14-003.1, a11y + DR-057 primitive assertions) — unchanged
- `src/app/projects/[slug]/_components/snapshot-panel/_tests/snapshot-panel.adversarial.test.tsx` — 20 tests (was 16; the "documented gap" decorative block replaced with 5 correct safeToTest tests; net +4)
- `src/app/projects/[slug]/_components/snapshot-panel/_tests/snapshot-panel.gate.reviewer.test.tsx` — 5 tests — unchanged
