---
id: EVENTS               # the event/telemetry plan (one per project, global)
type: events
slug: event-plan
title: Replace with the product title — event plan
status: DRAFT            # DRAFT | ACTIVE | BLOCKED | SUPERSEDED
last_updated: YYYY-MM-DD
---

# Event plan — Replace with the product title

> Telemetry stays **global** (metrics → events), one plan per project. Each PRD success metric must
> map to at least one event here, or the metric is unmeasurable. Provider + conventions:
> `factory/standards/observability.md` / `external-services.md` (PostHog by default).

## Metrics → events

One row per PRD success metric → the event(s) that measure it. If a metric has no event, it is not
yet measurable — close the gap here.

| Metric (from PRD) | Event(s) | How it's computed |
|---|---|---|

## Event catalog

Each event: a stable `snake_case` name, when it fires, and its properties (name · type · purpose).
Keep names and properties consistent across the app (a constants module owns the names).

| Event | Fires when | Properties |
|---|---|---|

## Activation milestone (DR-043)

The ONE event (from the catalog above) that means "value delivered" — the PRD's activation milestone,
named here so `/pandacorp:review-launch` can read it mechanically: `<event_name>` + the threshold that
counts as activated. Keep it in sync with the PRD's "Activation milestone & kill-signals" section.

## Identification

How users/groups are identified (anonymous → identified transition), and what is deliberately **not**
captured (privacy — see `factory/standards/privacy.md`). PII never goes in event properties.

## Verification

How we confirm each event actually fires (the `analytics` agent verifies post-build). A metric whose
event was never observed firing is not done.
