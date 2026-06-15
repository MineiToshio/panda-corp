# FRD-03 — Portfolio and project navigation

View of the active projects with vertical navigation and an activity indicator.

## Acceptance criteria (EARS)
- The portfolio SHALL list, in a vertical panel on the left, the projects in `architecture`, `building` and `shipped`.
- EACH project in the list SHALL show its title, its stage and an indicator: "building" if `running`, "stopped" if not.
- EACH `shipped` project SHALL also show its **business snapshot** when present in the portfolio (active users / return metric / last review verdict, filled by `/pandacorp:review-launch`, DR-043), so the owner sees winners vs zombies at a glance.
- WHEN the owner selects a project in the list, the system SHALL show its workspace (FRD-04) in the right-hand panel.
- WHEN no project is selected, the system SHALL select the first one by default.
- IF there are no active projects, THEN the system SHALL show an empty state gracefully.
