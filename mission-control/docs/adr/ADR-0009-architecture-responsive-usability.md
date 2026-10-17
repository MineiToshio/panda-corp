# ADR-0009 — Architecture usability and responsive navigation

- **Status:** Accepted under the owner's explicit direct correction
- **Date:** 2026-10-17
- **Decision agent/runtime:** OpenAI Codex
- **Amends:** ADR-0006/0008 schema presentation and selection only; the global shell's original Phase A responsive design
- **Traces:** FRD-02 AC-02-013.2, AC-02-015.4/.5/.13/.14; FRD-04 AC-04-012.2; FRD-19 REQ-19-003

## Decision

Clicking the currently selected relationship again clears selection. Compare the selected kind/ID, not the appearance of an edge highlighted by an entity neighborhood: its first activation must still select it. Disable text selection only inside diagram entity cards, including WebKit; clear retained browser ranges on canvas pointer-down. Schema code stays selectable.

Esquema uses one column of native grouped `details`, all initially closed, with unique per-viewer group names. Opening one entity closes the previous one; clicking it again closes it. Summaries show names, field counts and chevrons; content has natural height and local horizontal overflow. This implements the owner's one-entity-at-a-time preference and removes equal-height stretched grids without introducing accordion state or dependencies. Browser checks must verify native exclusivity, not assume it from jsdom.

The shared Architecture order is hero, Stack & tecnologías, Integraciones y operación, Modelo de datos, environment-variable names, ADRs, implementation plan and per-FRD cards. Stack explains choices and why; integrations explain flows, responsibilities and operational tasks. Inspection of the actual project digest found operational facts such as cron, mail flows and backup retention that would disappear under vendor-name deduplication. Preserve all authored service facts and clarify the distinction with short introductory copy. Split the existing service/environment renderer into separate bands without changing readers. The Modelo de datos heading remains unchanged.

Remove the 1240px shell frame cap and the shared Propuesta/Spec 920px panel cap. Panels use the available host width and consistent page gutters. Preserve introductory prose limits (720px, and existing 640px plan prose) for readable line lengths; these do not constrain diagrams, panels or tabs.

Keep identity, hamburger and destinations in one header grid. Above 1100px navigation is inline. At/below 1100px the toggle sits at the top-right beside the brand and the expanded navigation fills a row inside the same header: three columns through tablet widths, two at/below 600px. Every destination, including the wrapped Propuestas link, is at least 44px high. `ShellNavigation` owns local disclosure state, keyed by route by AppShell, with Escape/outside/link/route closure and Escape focus restoration. Scoped CSS owns responsive structure; shared Nav retains its default display. Shell exemptions and destinations remain unchanged.

## Consequences and evidence boundary

No model artifact, API, source producer, ELK layout, project phase or work-order machine state changes. The older prototype's flat schema blocks, section order and fixed panel widths are superseded by this owner correction. Dedicated responsive shell/model qualification does not certify every destination's own tables or kanban, nor change frozen build-state platform declarations. Require independent interaction regressions, browser accordion behavior, 320–1600px light/dark header review, actual large-project model checks and production-bundle qualification. Current evidence belongs to `docs/reviews/architecture-responsive-usability/delivery.md`.
