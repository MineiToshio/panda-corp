# Observability (operation / production)

> Domain: Operation · Severity: **MUST** for the baseline; the rest staged. Enforcement: checklist + CI. Complements `infra.md` (which covers only local dev).

## Rule
- **Mandatory baseline (every project), cheap:**
  - **Structured JSON logs** (Pino or equivalent) with `service.name` = the project's name in the portfolio, level and timestamp; `trace_id`/`span_id` when there is request context.
  - **Error-tracking** integrated (Sentry, from the stack) from day 1 (DR-026).
  - **Never log PII or secrets** (see `privacy.md`).
- **Staged (when the project needs it):** portable instrumentation with **OpenTelemetry** (vendor-neutral): library auto-instrumentation, environment resource attributes, `instrumentation.ts` (Next's native hook) in the web golden path.

## How it is verified
- Checklist in `/pandacorp:release`: structured logs? Sentry connected? `service.name` correct?
- The data goes to **Sentry** (errors/traces) and **PostHog** (analytics), already present — OTel is the instrumentation layer, **not a parallel pipeline**.

## Why
Without observability you can't operate a portfolio: a production failure must be visible and attributable. OTel Traces/Metrics are stable; **Logs via OTel are experimental** (adopt with caution). Don't impose traces+metrics+logs from the MVP (it clashes with DR-012 minimal cut).

Sources: opentelemetry.io/docs/languages/js
