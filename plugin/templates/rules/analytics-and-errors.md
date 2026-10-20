---
description: Analytics (PostHog) and error tracking (Sentry) — centralized events; capture only unexpected errors, PII-redacted.
applies_when: posthog
also_applies_when: sentry
globs: ["src/**", "**/*.ts", "**/*.tsx"]
source: Pandacorp stack — PostHog & Sentry
---

# Analytics & error tracking

> Ships only for PostHog and/or Sentry explicitly approved for the current version in the architecture decision round (DR-026/131). Apply only the approved tool section. Deferred/excluded providers add no SDKs, placeholder helpers, credentials, required env validation or provider-specific checks; structured logs remain mandatory.

## PostHog (analytics)
- **Every event name lives in a single `POSTHOG_EVENTS` constant** (`src/lib/constants.ts`) — never loose strings scattered in the code.
- Prefer the **declarative** `data-ph-event` / `data-ph-props` attributes consumed by a global click delegate; fall back to manual `posthog.capture()` only for logic the delegate can't express.
- Capture **meaningful interactions** (CTAs, navigation, forms, toggles). Don't track hover or every keystroke.

## Sentry (errors)
- **Capture only unexpected errors** (bugs, broken dependencies). **Expected** errors (validation, permissions, rate limits) are handled in-flow, **not** reported — unless you're watching for an abnormal spike.
- Route capture through **one small helper** that standardizes tags/context and **redacts PII** — don't sprinkle `captureException` everywhere.
