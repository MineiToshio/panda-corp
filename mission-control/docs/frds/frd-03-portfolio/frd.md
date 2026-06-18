---
id: FRD-03
type: frd
title: FRD-03 — Portfolio and project navigation
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-18'
---
# FRD-03 — Portfolio and project navigation

View of the active projects with vertical navigation and an activity indicator.

## Acceptance criteria (EARS)
- The portfolio SHALL list, in a vertical panel on the left, the projects in `architecture`, `building` and `shipped`.
- EACH project in the list SHALL show its title, its stage and an indicator: "building" if `running`, "stopped" if not.
- EACH `shipped` project SHALL also show its **business snapshot** when present in the portfolio (active users / return metric / last review verdict, filled by `/pandacorp:review-launch`, DR-043), so the owner sees winners vs zombies at a glance.
- WHEN the owner selects a project in the list, the system SHALL show its workspace (FRD-04) in the right-hand panel.
- WHEN no project is selected, the system SHALL select the first one by default.
- IF there are no active projects, THEN the system SHALL show an empty state gracefully.
- IF a project's local path does not exist on disk (folder deleted or moved), the system SHALL show a `⚠️ path not found` badge on the project row.
  - IF the project has a `repo:` URL in the portfolio, the system SHALL show the recovery command: `git clone <repo> <path>` then re-run `/pandacorp:sync-portfolio` (copyable text, same shape as FRD-15/16 banners).
  - IF there is no `repo:`, the system SHALL show a warning: "No remote registered — check a local backup or recreate with `/pandacorp:spec`."
  - The detection is **read-only**: the app never clones, writes to the portfolio, or calls Claude.
  - The badge disappears once the path exists on disk again (detected on next read/sync).
