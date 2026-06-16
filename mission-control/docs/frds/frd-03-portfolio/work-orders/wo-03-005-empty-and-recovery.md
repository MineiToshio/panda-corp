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
