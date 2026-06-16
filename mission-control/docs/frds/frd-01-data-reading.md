# FRD-01 — Data reading layer

Pandacorp reads the factory's and each project's information from disk, without writing (except the discard exception, FRD-02) and without calling Claude.

## Acceptance criteria (EARS)
- WHEN Pandacorp loads and does NOT find `factory/profile.md` (the factory is not yet personalized), the system SHALL show — BEFORE any other view — an **onboarding gate** that explains the factory still needs to be configured and presents the `/pandacorp:onboarding` command with a copy button; the rest of the app stays in the background until the profile exists.
- WHEN `factory/profile.md` exists, the system SHALL read it (name, goals, interests, assets, project types) to personalize greetings and views.
- WHEN Pandacorp loads, the system SHALL read all the cards in `factory/ideas/*.md` (ignoring `_idea-template.md` and `decision-log.md`) with their frontmatter (title, status, `project_type`, `return_type`, score).
- The system SHALL read `panda-corp/factory/portfolio.md` to obtain the list of projects and their paths.
- WHEN a project has `.pandacorp/status.yaml`, the system SHALL read phase, version, running, progress, work order count, `pending_decisions`, `pending_bugs`, `last_green_sha` and `safe_to_test`.
- WHEN a card is `status: in-pipeline`, the system SHALL determine its board column from the linked project's `phase` (the card `status` stays `in-pipeline` as a pointer and is NOT the column source; the project's `status.yaml` is the single source of truth for the phase — see FRD-02).
- The system SHALL read, per project, the product documents in `docs/` (PRD, FRDs, blueprint, work orders) and the owner-facing integration layer in `.pandacorp/` (`comms/progress.md`, `inbox/decisions.md`, `inbox/bugs/`).
- IF a project's path does not exist, THEN the system SHALL mark it as not found and SHALL NOT break the rest of the view.
- The system SHALL NEVER call Claude or any AI API, nor write files (except the FRD-02 case).

## Edge cases
- `factory/profile.md` absent → onboarding gate (an empty profile is not assumed nor invented).
- Empty ideas folder → empty states handled gracefully.
- `status.yaml` absent or malformed → show the project with partial data, without breaking.
