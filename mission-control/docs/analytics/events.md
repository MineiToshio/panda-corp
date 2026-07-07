---
type: analytics
status: ACTIVE
---
# Analytics / event plan — Mission Control

## Verification 2026-07-05

**No event plan exists for this project, and none is needed.**

Mission Control's `return_type` is **`personal`** (`.pandacorp/status.yaml`), and it is explicitly
scoped as an **internal tool**, not a product with a market-facing value hypothesis to validate:

- `docs/product/architecture.md` §10 (Deploy strategy), verbatim: *"The economic arc (demand-gate,
  unit-economics, landing, GTM, **telemetry**) does **not** apply (`return_type: personal`,
  internal tool)."*
- `docs/decision-log.md` (MC-origin entry): *"`return_type` personal so the economic arc is
  skipped; `/release` = run locally on `127.0.0.1` (no deploy, no production gate)."*
- `CLAUDE.md` (Mission Control specifics): *"Internal tool, not a product (`return_type`:
  personal). The economic arc does NOT apply: no demand-gate, unit-economics, landing, GTM or
  market telemetry."*
- The PRD's "Success metrics" (`docs/product/prd.md`) are owner-experience statements evaluated by
  the sole operator directly using the app daily ("the operator comes back daily"; "zero calls to
  Claude from Pandacorp"), not business/product-usage metrics that require event instrumentation
  to validate a value hypothesis for an external audience. There is no `return_type: opportunity`
  or `monetary` signal to instrument either (DR-042).
- The app itself is **read-only over the factory** and **never deployed** (`127.0.0.1` only, no
  auth, no production gate) — there is no PostHog project, no analytics SDK, and no env-keyed
  telemetry wiring anywhere in `src/` (confirmed by search: the only `PostHog` references in this
  codebase are inside Mission Control's own **Manual content** and **architecture-doc renderer**,
  describing the factory's telemetry standard for *other* Pandacorp products — not live
  instrumentation of Mission Control itself).

Per DR-085 hardening, the applicable action for a project with no event plan and no need for one is
to record that determination here rather than fabricate metrics. This entry is that record.

| Item | Status |
|---|---|
| `docs/analytics/events.md` (event plan) | not-applicable — `return_type: personal`, internal tool, no economic arc (architecture.md §10) |
| PostHog / analytics SDK wiring | not-applicable — never added, none required |
| Activation milestone / kill-signals (DR-043) | not-applicable — no value hypothesis requiring product telemetry; success is evaluated by the sole operator's own daily use, not measured events |
| Opportunity metric (DR-042, `return_type: opportunity`) | not-applicable — `return_type` is `personal`, not `opportunity` |

No code changes were made (there is no instrumentation gap to fix: there is nothing to instrument).

## Verification 2026-07-06

Re-run of the DR-085 hardening check (BL-0012). Re-confirmed, no drift since 2026-07-05:

- `.pandacorp/status.yaml`: `deploy_target: internal` (`# internal tool (runs on 127.0.0.1) — no
  external host (DR-085)`); `target_platforms: desktop`.
- `docs/product/prd.md` "Value hypothesis" and "Success metrics" sections are still owner-experience
  statements evaluated by the sole operator directly ("see the state... without opening files",
  "zero calls to Claude", "the operator comes back daily") — not product-usage metrics needing
  event instrumentation. No `return_type: opportunity` reach/audience signal applies (DR-042).
- `docs/product/architecture.md:325`: economic arc (demand-gate, unit-economics, landing, GTM,
  **telemetry**) explicitly does not apply, `return_type: personal`.
- `package.json`: no PostHog/analytics SDK dependency of any kind.
- `src/`: searched for `posthog` (case-insensitive) — the only hits are `src/app/manual/manualPages.tsx`
  and `src/lib/manual/skill-flows.ts` (the Manual's static explainer content describing the factory's
  telemetry standard for *other* Pandacorp products, e.g. `/pandacorp:review-launch`'s use of PostHog)
  and their renderer tests (`src/lib/architecture/_tests/*.test.ts`) — no live capture calls, no SDK
  import, no env-keyed client anywhere in application code.

| Item | Status |
|---|---|
| `docs/analytics/events.md` (event plan) | not-applicable — `return_type: personal`, internal tool, no economic arc (unchanged from 2026-07-05) |
| PostHog / analytics SDK wiring | not-applicable — confirmed absent again (no dependency, no capture calls in `src/`) |
| Activation milestone / kill-signals (DR-043) | not-applicable — no value hypothesis requiring product telemetry |
| Opportunity metric (DR-042) | not-applicable — `return_type` is `personal`, not `opportunity` |

No code changes were made. This re-verification finds the same determination still true.

## Verification 2026-07-07

Re-run of the DR-085 hardening check (BL-0012). Re-confirmed, no drift since 2026-07-06:

- `.pandacorp/status.yaml`: `deploy_target: internal` (`# internal tool (runs on 127.0.0.1) — no
  external host (DR-085)`); `target_platforms: desktop`. Project is well past v1 (`work_orders_total:
  104`, all `VERIFIED`), still no `return_type: opportunity`/`monetary` signal anywhere in the repo.
- `docs/product/prd.md` "Value hypothesis" (line 43) and "Success metrics" (lines 68-71) are still
  owner-experience statements evaluated by the sole operator directly ("see the state of each
  idea/project... without opening files", "zero calls to Claude from Pandacorp", "the operator
  comes back daily") — not product-usage metrics needing event instrumentation to validate a
  value hypothesis for an external audience. No opportunity metric (reach/contacts/positioning)
  applies (DR-042).
- `docs/product/architecture.md:324-325`: economic arc (demand-gate, unit-economics, landing, GTM,
  **telemetry**) explicitly does not apply, `return_type: personal`, internal tool, `$0/month` by
  construction.
- `package.json`: no PostHog/analytics SDK dependency of any kind (checked again).
- `src/`: searched for `posthog` (case-insensitive) — same four hits as prior runs, all Manual
  static explainer content/renderer tests describing the factory's telemetry standard for *other*
  Pandacorp products (`src/app/manual/manualPages.tsx`, `src/lib/manual/skill-flows.ts`,
  `src/lib/architecture/_tests/env.test.ts`, `src/lib/architecture/_tests/architecture.test.ts`) —
  no live capture calls, no SDK import, no env-keyed client anywhere in application code.

| Item | Status |
|---|---|
| `docs/analytics/events.md` (event plan) | not-applicable — `return_type: personal`, internal tool, no economic arc (unchanged from 2026-07-05/06) |
| PostHog / analytics SDK wiring | not-applicable — confirmed absent again (no dependency, no capture calls in `src/`) |
| Activation milestone / kill-signals (DR-043) | not-applicable — no value hypothesis requiring product telemetry |
| Opportunity metric (DR-042) | not-applicable — `return_type` is `personal`, not `opportunity` |

No code changes were made. This re-verification finds the same determination still true.
