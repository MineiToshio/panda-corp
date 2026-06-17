---
id: WO-03-005
type: work-order
slug: empty-and-recovery
title: WO-03-005 — Empty state + path-not-found recovery
status: DRAFT
parent: FRD-03
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-03-005 — Empty state + path-not-found recovery

**Module:** `components/PortfolioEmpty.tsx`, `components/RecoveryHint.tsx`
**IDs touched:** `CMP-03-empty`, `CMP-03-recovery`, `CMP-03-row` (badge); REQ-03-006
**Dependencies:** WO-03-001 (`activeProjects` → `exists`), WO-02-002 (`CopyButton`)

## EARS criteria (from FRD-03)

- AC-03-006.1 — IF there are no active projects, THEN the system SHALL show an **empty state**
  gracefully.
- AC-03-006.2 — IF a project's local path does not exist on disk, the system SHALL show a
  `⚠️ path not found` badge on the project row.
- AC-03-006.3 — IF the project has a `repo:` URL, show the recovery command:
  `git clone <repo> <path>` then re-run `/pandacorp:sync-portfolio` (copyable, same shape as
  FRD-15/16 banners).
- AC-03-006.4 — IF there is no `repo:`, show: "No remote registered — check a local backup or
  recreate with `/pandacorp:spec`."
- AC-03-006.5 — The detection is **read-only**: the app never clones, writes to the portfolio, or
  calls Claude.
- AC-03-006.6 — The badge disappears once the path exists on disk again (next read/sync).

## Design

- `PortfolioEmpty.tsx`: graceful empty state (Spanish) when `activeProjects()` is `[]`. Suggest the
  `/pandacorp:spec` flow with a `CopyButton`. `data-testid="portfolio-empty"`.
- `RecoveryHint.tsx`: rendered on a row whose `exists === false`. Shows the `⚠️ path not found`
  badge; if `repo` present → copyable `git clone <repo> <path>` + `/pandacorp:sync-portfolio`
  (via `CopyButton`); else → the no-remote warning text. `data-testid="recovery-hint"`.
- No state stored — `exists` is recomputed each read, so the badge clears automatically when the path
  reappears (AC-03-006.6). No clone, no portfolio write, no Claude call (AC-03-006.5).

## Definition of done

- `components/PortfolioEmpty.test.tsx` (RED first): renders the empty state + a copyable spec command.
- `components/RecoveryHint.test.tsx` (RED first):
  - `exists: false` + `repo` → badge + copyable `git clone <repo> <path>` and the sync command.
  - `exists: false` + no `repo` → badge + the no-remote warning.
  - `exists: true` → renders nothing (badge cleared).
- Asserts no write / no clone is attempted (pure render of copyable text).
- `.pandacorp/verify.sh` green.

## Status Note

**Built:** `PortfolioEmpty` (CMP-03-empty) and `RecoveryHint` (CMP-03-recovery) as standalone
exported Server-Component-safe components in `components/`.

**Interfaces / contracts exposed:**

```tsx
// components/PortfolioEmpty.tsx
export function PortfolioEmpty(): React.JSX.Element
// data-testid="portfolio-empty", aria-live="polite"
// Renders "Sin proyectos activos" + CopyButton for "/pandacorp:spec"

// components/RecoveryHint.tsx
export interface RecoveryHintProps { exists: boolean; path: string; repo?: string; }
export function RecoveryHint(props: RecoveryHintProps): React.JSX.Element | null
// exists=true  → null (badge cleared, AC-03-006.6)
// exists=false, repo present → data-testid="recovery-hint" with "recovery-hint-badge",
//   "recovery-hint-command" (git clone <repo> <path> && /pandacorp:sync-portfolio),
//   and a CopyButton (data-testid="copy-button")
// exists=false, no repo / empty repo → data-testid="recovery-hint" with "recovery-hint-badge"
//   and "recovery-hint-no-repo" warning mentioning /pandacorp:spec
```

**Integration seams:**
- `PortfolioEmpty` consumed by `ProjectRail` / `app/portfolio/page.tsx` when `activeProjects()` returns `[]`.
- `RecoveryHint` consumed by any project row where `item.exists === false`; replaces the inline `RecoveryHint` sub-component in `ProjectRail.tsx` (which can delegate to this standalone export).
- Both reuse `CopyButton` (WO-02-002, `components/CopyButton.tsx`).
- Both are read-only: no write, no clone, no Claude call (AC-03-006.5).

**Test files:**
- `components/PortfolioEmpty.test.tsx` — 18 tests (rendering, a11y, design-token invariant, read-only invariant)
- `components/RecoveryHint.test.tsx` — 24 tests (exists=true cleared, repo/no-repo paths, a11y, tokens, read-only)
- Full suite: 3331 tests pass, verify.sh green (biome + tsc + vitest).
