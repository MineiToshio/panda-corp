---
id: LESSON-0302
type: pattern
domain: product-scoping
tags: [analytics, single-user, observability, posthog, scope-reduction]
context: scoping whether a product needs an analytics SDK (e.g. PostHog) and an event-instrumentation plan
trigger: "use this when scoping observability/analytics for a tool with exactly one user (the owner) — check whether the app's own structured data (a status/outcome table) already answers the success metric before adding an analytics SDK"
source: "pandacast docs/decision-log.md, 2026-10-10 — \"No analytics in v1\": owner decided no PostHog and no event-instrumentation plan (\"como solo lo voy a usar yo, las métricas no son necesarias\"); the PRD's success metrics became qualitative, observed directly in the existing outcome table (every publish attempt's result) instead of via a separate SDK"
provenance: owner-stated
created: 2026-10-13
status: active
promotion: proposed   # 2026-10-18 (librarian review) — target: factory/decisions/registry.yaml (new DR default: for a single-user/owner-only tool, default to "no analytics SDK" when the app's own structured data already answers the PRD's success metrics; propose instrumentation only when a metric genuinely isn't observable from app data). Cited by 2 distinct projects (pandacast, pandasaga) with zero contradicting evidence — this is a recurring scoping DECISION with a clear default, not just a one-off engineering fact, so registry.yaml is the more precise home than a standard.
confidence: medium
times_applied: 2
applied_in: [pandasaga, funko-tracker]
links: []
---

**Situation:** scoping a single-user tool's observability, the golden-path default (an analytics SDK +
an event-instrumentation plan) was proposed — then dropped once it was noticed that the app's own
database already records every relevant outcome (a table logging each action's result), which is exactly
what the success metric needed.

**Lesson:** for a tool with exactly ONE user, a dedicated analytics SDK and event plan can be pure
duplication rather than genuine observability gain — if a structured table the app already writes
(status/outcome rows) already answers the PRD's success metric, the SDK adds a dependency, a CSP origin
to allow, and a consent surface, for data you can already query directly. This is a scope trade-off, not
a universal rule: it stops applying the moment there is more than one user, or the metric needs
aggregation/trends an ad-hoc table query can't give cheaply.

**Apply next time:** before defaulting to an analytics SDK for a new project, check (a) is there exactly
one user (commonly: the owner's own personal tool) and (b) does the app's own data model already capture
the fact the success metric needs. If both are true, propose dropping the SDK and observing the metric
directly from existing data instead — but surface this explicitly as a scoping question/trade-off to the
owner rather than silently skipping analytics by default.
