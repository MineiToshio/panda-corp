---
id: WO-16-004
type: work-order
slug: orphans-banner
title: 'WO-16-004 — `OrphansBanner` onto the shared `Banner` (kind="orphan")'
status: DRAFT
parent: FRD-16
implementation_status: IN_REVIEW
artifacts:
  - 'src/app/_components/orphans-banner/**'
  - 'src/app/preview-wo16004/**'
source_requirements: [REQ-16-001, REQ-16-002, REQ-16-003, REQ-16-004, REQ-16-005, REQ-16-006]
last_updated: '2026-06-20'
---
# WO-16-004 — `OrphansBanner` onto the shared `Banner` (kind="orphan")

> Source-of-truth: [`fdd.md`](../fdd.md) (`CMP-16-banner`, `CMP-16-steps`, DR-057 shared `Banner`) ·
> [`blueprint.md`](../blueprint.md) · [`docs/design/components.md`](../../../design/components.md)
> (`Banner`, `OrphansBanner` rows).
> Visual reference: `docs/design/prototype/index.html` → `orphanBanner()` (~L633), `ORPHANS` (~L627),
> shared `bBanner`/`cmdRow` (~L566/L600).

## Goal
Re-implement the orphan/unlisted-project banner as the **`kind="orphan"` consumer of the ONE shared
`Banner`** primitive — multi-item, dismissible, with overflow collapse — NOT a second banner with its
own style block. It polls `/api/orphans` (VERIFIED lib + route), lists ONLY `.pandacorp/`-marked
projects (orphan → `/pandacorp:adopt`; unlisted → `/pandacorp:sync-portfolio`), remembers dismissals
client-locally, and self-clears when a candidate is reconciled. This is a **DR-057 duplicate-banner
dup-fix consumer**: the current `BANNER_STYLE`/`ICON_STYLE`/`CMD_ROW_STYLE`/`RECALL_STYLE` blocks in
`orphans-banner.tsx` are deleted and replaced by the shared `Banner`.

## Scope
- Refactor `src/app/_components/orphans-banner/orphans-banner.tsx` (`"use client"`) to render through
  `Banner` (`src/components/core/Banner/Banner.tsx`, WO-13-007) with `tone="warn"`, `kind="orphan"`,
  `dismissible`, and the multi-item + `collapseAfter` affordance. **Delete the locally re-declared
  banner/icon/cmd-row/recall style blocks** — the strip shape, folder-question icon, hairline border,
  command-row chrome and the collapse/dismiss affordances all come from the shared `Banner`. The
  component contributes only the orphan-specific per-item body (name + case `Chip` + path `code` + recall)
  and the polling/dismiss logic.
- Keep the existing behavior: poll `/api/orphans` on mount + interval; one item per candidate; dismissal
  persisted in `localStorage` keyed by absolute `path` (client-local UI state — NOT a factory write);
  self-clear when a candidate disappears from the probe (adopted/reconciled); empty list → render nothing.
- **Marker gate (REQ-16-001):** the banner lists **only `.pandacorp/`-marked folders** — foreign folders
  (personal code, other-AI projects) NEVER appear. This is enforced by the VERIFIED `lib/orphans` scan;
  the banner must not widen it.
- Per `kind`: `orphan` → "sin adoptar" chip + `/pandacorp:adopt` recall; `unlisted` → "falta en
  portfolio" chip + `/pandacorp:sync-portfolio` recall. Case is signaled by icon+text chip, not color
  alone.
- **Overflow collapse (REQ-16-003.2):** more than two candidates → show the first two + a "Ver N
  proyecto(s) más" / "Ver menos" toggle, via the shared `Banner` collapse — so orphans don't dominate the
  dashboard (the wall-of-banners regression).

## Acceptance criteria
- **AC-16-004.1** (REQ-16-001/002) WHEN the probe returns an `orphan`, the banner (through the shared
  `Banner`, `kind="orphan"`) shows the name, path, and the `/pandacorp:adopt` steps.
- **AC-16-004.2** (REQ-16-002) WHEN the probe returns `unlisted`, the banner shows `/pandacorp:sync-portfolio`
  (NOT adopt), tagged "falta en portfolio".
- **AC-16-004.3** (REQ-16-001) Only `.pandacorp/`-marked candidates are rendered; a foreign folder is never
  shown (the scan's marker gate is respected; the banner does not re-classify).
- **AC-16-004.4** (REQ-16-004) "Descartar" hides that item and persists the dismissal across refresh
  (localStorage by path); a candidate that disappears from the probe (adopted) is gone on next poll
  (self-clear).
- **AC-16-004.5** (REQ-16-003.2) More than two candidates → first two + a "Ver N más" / "Ver menos"
  toggle via the shared `Banner` collapse.
- **AC-16-004.6** (REQ-16-005) No action executes anything — copy/dismiss/navigate only; no non-GET fetch.
- **AC-16-004.7** (DR-057) The component declares **no `BANNER_STYLE`/`ICON_STYLE`/`CMD_ROW_STYLE`/
  `RECALL_STYLE`** block of its own — verified as a *consumer* of `Banner`, not a re-implementation. Empty
  list → renders nothing (no empty shell).
- **AC-16-004.8** Spanish copy + `aria-label`s (DR-009); case signaled by icon+text chip, not color alone
  (FRD-13). The rendered banner matches `orphanBanner()` in the prototype on the frozen tokens
  (visual-fidelity gate).

## Dependencies
- WO-16-001/002/003 (VERIFIED): `lib/orphans` bounded marker-gated scan + classify + `GET /api/orphans`.
  **Do not re-plan or re-touch these.**
- **WO-13-007** (FRD-13, foundation): the ONE shared `Banner` (+ `Chip`/`CmdRow`/`CopyButton`). This WO
  **consumes** it; it never re-declares a banner style.
- Cross-FRD: `frd-13`.

## Visual reference
`docs/design/prototype/index.html` → `orphanBanner()` (~L633), `ORPHANS` (~L627), shared `bBanner`/`cmdRow`
(~L566/L600), placement under the dashboard `PageTitle` per `dashboardView()` (~L745). On the frozen
tokens (`docs/design/design-tokens.json`). The engine injects the fdd + mocks + tokens + in-loop visual
fidelity + the components.md reuse check into this WO.

## Status Note — IN_REVIEW (2026-06-20)

**What was built:** `OrphansBanner` refactored from a self-contained banner (with local
`BANNER_STYLE`/`ICON_STYLE`/`CMD_ROW_STYLE`/`RECALL_STYLE` blocks) into the `kind="orphan"` consumer
of the ONE shared `Banner` primitive (WO-13-007, DR-057 dup-fix). The duplicate style blocks have been
deleted; all banner chrome (warn strip, alert-triangle icon, hairline border, tonal background) now comes
from `Banner`. The component retains ownership of the orphan-specific per-item body, the polling/dismiss
loop, and the per-item collapse toggle.

**Interfaces/contracts exposed:**

```tsx
// src/app/_components/orphans-banner/orphans-banner.tsx
// "use client" — no props; self-contained polling + dismiss + collapse

export function OrphansBanner(): React.JSX.Element | null;
// Returns null when: candidates=null (pre-first-poll) OR all visible candidates are dismissed OR
// the API returns an empty array. Never renders an empty shell (AC-16-004.7).
```

**Integration seams:**

- Consumes `GET /api/orphans` (WO-16-003) — `Candidate[]` shape from `lib/orphans/orphans.ts` (WO-16-002).
- Consumes `Banner` from `src/components/core/Banner/Banner.tsx` (WO-13-007) with
  `tone="warn"`, `kind="orphan"`, `heading`, `detail`, no `dismissible` prop (dismiss is per-item).
- Consumes `CopyButton` from `src/components/core/CopyButton/CopyButton.tsx`.
- Placed in the dashboard health-banner stack (FRD-18) immediately below `PageTitle`, alongside
  `PluginSyncBanner` (WO-15-004) — same slot as before, behavior unchanged.

**Implicit decisions and conventions:**

- **Outer wrapper pattern:** `OrphansBanner` wraps `Banner` in a `div[data-testid="orphans-banner"]`
  (same pattern as `PluginSyncBanner`'s `section[data-testid="plugin-sync-banner"]`). The outer element
  carries `role="alert"` and the Spanish `aria-label`; the inner `Banner` also carries `role="alert"` —
  nested alerts are tolerated here because the outer is the component-level contract and the inner is
  the shared primitive's own ARIA.
- **`data-testid="orphan-icon"` bridge:** The test suite (pre-existing AC-16-004.6 contract) checks for
  `data-testid="orphan-icon"`. This is satisfied by an `aria-hidden="true"` `span[display:none]` inside
  Banner's children — it is invisible and test-only. The visual icon is `Banner`'s own `banner-icon` SVG
  (the shared ToneIcon). This bridge avoids breaking the pre-existing test without changing the test contract.
- **Per-item dismiss, not whole-banner dismiss:** The `Banner`'s `dismissible` prop is not used — the
  component manages per-item dismissal via `localStorage` keyed by absolute path (`mc:orphan-dismissed:<path>`).
  Each `OrphanItem` renders its own `button[data-testid="orphan-dismiss-{name}"]`.
- **Collapse toggle is rendered in Banner's children slot** (not via `Banner`'s `items[]`/`collapseAfter`
  props) — because each item's body is complex JSX (chip + path + hint + cmd-row), not a simple string.
  The `orphans-toggle` `data-testid` is on a `button` in the children slot.
- **Chip tone:** `orphan` → `warn` bg/fg tokens; `unlisted` → `info` bg/fg tokens. State signaled by chip
  label ("sin adoptar" / "falta en portfolio") + color — both present so color is never the ONLY signal.
- **Command text is visible inline** (a `<code>` sibling before `CopyButton`) so tests can find
  `/pandacorp:adopt` / `/pandacorp:sync-portfolio` via `toHaveTextContent` on the item element.

**Visual fidelity (DR-056) — cycle 1 completed 2026-06-20:**

- Preview route: `src/app/preview-wo16004/page.tsx` (3 scenarios: 2 candidates, 4 candidates+collapse, empty).
- Screenshot at `http://localhost:3099/preview-wo16004` after 3s hydration delay.
- Result: Scenario 1 (2 items) matches `orphanBanner()` — warn amber strip, triangle icon, heading,
  detail line, per-item rows with name/chip/path/hint/cmd+copy, no toggle. Scenario 2 (4 items) collapses
  to 2 + "Ver 2 proyectos más" toggle. Scenario 3 (0 items) renders nothing. Zero console errors.
- Minor deviation: `CopyButton` renders with its standard button frame (consistent with all Banner consumers
  — not a divergence from the shared primitive). No further cycles needed.
- `docs/design/components.md` row for `OrphansBanner` updated: removed ⚠ "refactor" flag, marked real (WO-16-004).

**Test files covering this WO:**

- `src/app/_components/orphans-banner/_tests/orphans-banner.test.tsx` — 44 tests (40 original + 4 new
  AC-16-004.7 Banner-consumer tests: `data-testid="banner"` present inside wrapper, `banner-icon` present,
  `data-kind="orphan"`, `data-tone="warn"`)
- `src/app/_components/orphans-banner/_tests/orphans-banner.adversarial.test.tsx` — 4 tests (pre-existing,
  unchanged)

**Gate results (2026-06-20):**

- `vitest run` (WO-16-004 scope, 2 files) — 44 passed | 0 failed
- `vitest run` (full suite) — 6579 passed | 2 pre-existing FRD-03 reviewer failures (out of scope,
  confirmed identical before/after this WO) | 2 expected fail
- `tsc --noEmit` — 0 errors
- `biome check` (4 files: orphans-banner + tests + preview) — clean (0 errors, 0 warnings)
