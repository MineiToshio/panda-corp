---
id: FRD-03
type: frd
title: FRD-03 — Portfolio and project navigation
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-19'
---
# FRD-03 — Portfolio and project navigation

View of the active projects with vertical navigation and an activity indicator.

## Portfolio membership (the rule)
The Portfolio rail shows ONLY projects that **have started development** — those in `building` or `shipped`. Projects still in the `product` / `design` / `architecture` phases are NOT in Portfolio; they live on the Tablero (FRD-01/02) until they reach build. A re-versioned project returns to `implementation` (building), so it stays in Portfolio. This keeps Portfolio as the surface of *what is being built or runs in production*, not the early pipeline.

## Acceptance criteria (EARS)
- The portfolio SHALL list, in a vertical panel on the left, ONLY the projects in `building` and `shipped` (those that have started development); projects in `product` / `design` / `architecture` SHALL NOT appear here (they are on the Tablero).
- WHEN a project is re-versioned and returns to `implementation` (building), it SHALL re-appear in the Portfolio rail.
- EACH project in the list SHALL show its title, its stage and an indicator: "building" if `running`, "stopped" if not.
- EACH project row SHALL show a **pending-decisions count badge** when it has unresolved decisions (count > 0) and a **bugs count badge** when it has bugs awaiting processing (count > 0), so the owner sees what needs attention without opening the workspace.
- WHEN the owner selects a project in the list, the system SHALL show its workspace (FRD-04) in the right-hand panel.
- WHEN no project is selected, the system SHALL select the first one by default.
- IF there are no active projects, THEN the system SHALL show an empty state gracefully.
- IF a project's local path does not exist on disk (folder deleted or moved), the system SHALL show a `⚠️ path not found` badge on the project row.
  - IF the project has a `repo:` URL in the portfolio, the system SHALL show the recovery command: `git clone <repo> <path>` then re-run `/pandacorp:sync-portfolio` (copyable text, same shape as FRD-15/16 banners).
  - IF there is no `repo:`, the system SHALL show a warning: "No remote registered — check a local backup or recreate with `/pandacorp:spec`."
  - The detection is **read-only**: the app never clones, writes to the portfolio, or calls Claude.
  - The badge disappears once the path exists on disk again (detected on next read/sync).

## Out of scope / Future
- **Per-project business snapshot (deferred).** Showing each `shipped` project's business snapshot (active users / return metric / last review verdict from `/pandacorp:review-launch`, DR-043) is **out of scope for now**: it is premature (no deployed, monetizing projects yet, so the metrics are undefined) and would render empty. When sellable products are live, the snapshot returns — sourced from PostHog (product telemetry) for monetary/mixed projects. The rail keeps space for it conceptually but renders nothing today.
