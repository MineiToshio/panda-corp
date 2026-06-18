---
description: Analytics (PostHog) and error tracking (Sentry) — centralized events; capture only unexpected errors, PII-redacted.
applies_when: posthog
also_applies_when: sentry
globs: ["src/**", "**/*.ts", "**/*.tsx"]
source: Pandacorp stack — PostHog & Sentry
---

# Analytics & error tracking

> Ships if the stack uses PostHog and/or Sentry. Apply only the section for the tool the project actually uses.

## PostHog (analytics)
- **Every event name lives in a single `POSTHOG_EVENTS` constant** (`src/lib/constants.ts`) — never loose strings scattered in the code.
- Prefer the **declarative** `data-ph-event` / `data-ph-props` attributes consumed by a global click delegate; fall back to manual `posthog.capture()` only for logic the delegate can't express.
- Capture **meaningful interactions** (CTAs, navigation, forms, toggles). Don't track hover or every keystroke.

## Sentry (errors)
- **Capture only unexpected errors** (bugs, broken dependencies). **Expected** errors (validation, permissions, rate limits) are handled in-flow, **not** reported — unless you're watching for an abnormal spike.
- Route capture through **one small helper** that standardizes tags/context and **redacts PII** — don't sprinkle `captureException` everywhere.
