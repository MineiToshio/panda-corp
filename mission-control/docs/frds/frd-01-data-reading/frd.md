---
id: FRD-01
type: frd
title: FRD-01 — Data reading layer
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-07-01'
---
# FRD-01 — Data reading layer

Pandacorp reads the factory's and each project's information from disk, without writing (except the discard exception, FRD-02) and without calling Claude.

## Acceptance criteria (EARS)
- WHEN Pandacorp loads and does NOT find `factory/profile.md` (the factory is not yet personalized), the system SHALL show — BEFORE any other view — an **onboarding gate** that explains the factory still needs to be configured and presents the `/pandacorp:onboarding` command with a copy button; the rest of the app stays in the background until the profile exists.
- WHEN `factory/profile.md` exists, the system SHALL read it (name, goals, interests, assets, project types) to personalize greetings and views.
- WHEN Pandacorp loads, the system SHALL read all the cards in `factory/ideas/*.md` (ignoring `_idea-template.md` and `decision-log.md`) with their frontmatter (title, status, `project_type`, `return_type`, score).
- The system SHALL read `panda-corp/factory/portfolio.md` to obtain the list of projects and their paths.
- WHEN a project has `.pandacorp/status.yaml`, the system SHALL read phase, version, running, `last_green_sha` and `safe_to_test`. Work-order counts are derived live from work-order files via `listWorkOrders` (never a status.yaml cache); `pending_decisions`/`pending_bugs` are likewise overridden with a live count from the project's inbox (`readStatusWithLiveInboxCounts`); the old `progress`/`work_orders_total`/`work_orders_done` status.yaml fields have no reader (dead fields, DR-092/DR-115).
- WHEN a card is `status: in-pipeline`, the system SHALL determine its board column from the linked project's `phase` (the card `status` stays `in-pipeline` as a pointer and is NOT the column source; the project's `status.yaml` is the single source of truth for the phase — see FRD-02).
- The system SHALL read, per project, the **feature-centric** product documents in `docs/` (DR-049): the product layer (`docs/product/prd.md` — with its living feature-landscape table — and, when present, `docs/product/architecture.md`), and each feature module under `docs/frds/frd-NN-<slug>/` (`frd.md`, and when present `fdd.md`, `blueprint.md`, `mocks/` and the feature's `work-orders/`); plus the global `docs/adr/`, `docs/analytics/` and `docs/decision-log.md`. It SHALL also read the owner-facing integration layer in `.pandacorp/` (`comms/progress.md`, `inbox/decisions.md`, `inbox/bugs/`).
- The system SHALL read the **event stream** (`~/.claude/dashboard-events.ndjson`) and compute state diffs to build the dashboard digest and the live / no-signal indicators (the last-event timestamp per running build) and each project's time-in-current-phase (age-in-stage) — see [FRD-18](../frd-18-dashboard/frd.md) and FRD-12.
- WHERE a consumer reads the event stream **for one project** (`readEvents({project})`, `/api/live?project=`), the system SHALL apply the project filter **BEFORE the tail cap** — the global stream is dominated by other sessions' hook events (`SubagentStop`/`SupervisorTick` from every Claude conversation), so capping first crowds a build's own events out of the tail (2026-07-01; consumer rationale in [FRD-06](../frd-06-party/frd.md) AC-06-011.3).
- WHERE the stream is scoped to a project (`/api/live?project=`), the SSE SHALL also watch the
  project's MACHINE STATE (`.pandacorp/status.yaml` + `docs/frds/*/work-orders/`) and stamp each
  frame with `stateVersion` (the state's max mtime), so a build that advances state WITHOUT
  emitting an event (cold start, a long gate) still signals consumers to re-read — the feed must
  not look dead while the state file moves (DR-066 fix 3, change `mc-observability-consumer-dr066`,
  2026-07-02). The reader also honors the `PANDACORP_EVENTS_FILE` env override of the NDJSON path
  (e2e fixtures).
- The system SHALL persist the dashboard's "seen" marker (`visto_hasta`, FRD-18) as **client-local UI state** that survives a refresh and a tab close; this is a UI preference, NOT a write to the factory or a project (the read-only constraint below is unaffected).
- IF a project's path does not exist, THEN the system SHALL mark it as not found and SHALL NOT break the rest of the view.
- The system SHALL NEVER call Claude or any AI API, nor write to the factory's or projects' files (except the FRD-02 discard case; the local UI marker above is not a factory/project write).

## Edge cases
- `factory/profile.md` absent → onboarding gate (an empty profile is not assumed nor invented).
- Empty ideas folder → empty states handled gracefully.
- `status.yaml` absent or malformed → show the project with partial data, without breaking.

## Proposal 32 R9 — Runtime-neutral observability

- WHEN Mission Control reads live build telemetry THEN it SHALL merge the legacy Claude transport and the Codex-local transport, normalize both through the single canonical event vocabulary, and preserve the existing La Fragua display names.
- WHEN two transport records carry the same `event_id` THEN Mission Control SHALL retain exactly one observation.
- WHEN vocabulary aliases describe the same result-bearing act THEN XP and achievement derivations SHALL ledger it once by `(run_id, event_name, subject)`.
- IF either event transport is missing, malformed, changed, or deleted THEN phase, work-order state, and build state SHALL remain derived exclusively from canonical project files and SHALL NOT change because of the event stream.
- WHEN both runtime transports contain events outside file order THEN Mission Control SHALL merge them chronologically before applying the bounded tail cap.
- IF an event reports only dispatch completion or change reconciliation THEN Mission Control SHALL preserve it as a non-result semantic act and SHALL NOT normalize it as WO completion or change integration.
