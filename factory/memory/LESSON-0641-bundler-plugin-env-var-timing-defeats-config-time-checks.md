---
id: LESSON-0641
type: gotcha
domain: nextjs
tags: [sentry, env-vars, build-config, next-config, timing]
context: an environment-variable-based guard/classifier that runs at next.config load time and checks a provider-prefixed env var (e.g. a ^SENTRY_ scan) to decide whether a provider is "configured"
trigger: use this when a next.config-time check scans process.env for a provider-prefixed variable to classify a build, and that provider's own bundler plugin (e.g. withSentryConfig) is also wired into the same next.config
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-07 (agent-inferred): withSentryConfig's bundler plugin sets process.env.SENTRY_PIPELINE AFTER next.config finishes loading, so a ^SENTRY_ provider-configured scan done inside an env guard at config-load time misclassified local fixture builds as provider-configured; config-time unit tests cannot observe this at all — it only reproduces with the real gate build"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an env-based guard scanned `process.env` for any `^SENTRY_`-prefixed variable, at the time
`next.config` was being loaded, to decide whether Sentry was "configured" for this build. The guard
misclassified local/fixture builds (which should NOT look provider-configured) as configured — because
`withSentryConfig`'s own webpack/bundler plugin sets `process.env.SENTRY_PIPELINE` itself, but only AFTER
`next.config` has finished evaluating and the actual build/bundle phase starts.

**Lesson:** a bundler plugin wired into `next.config` (via a `withXConfig` wrapper) can have side effects
— including setting env vars — that only happen during the LATER build/bundle phase, not during the
synchronous evaluation of `next.config` itself. Any guard that inspects `process.env` for that provider's
own variables AT config-load time is racing the plugin's own side effect and will see a stale/empty state
regardless of what the actual build later does. A config-time unit test (which only evaluates
`next.config`, never runs a real build) structurally cannot see this gap — it will pass even though the
real build misclassifies.

**Apply next time:** when a provider-configured guard needs to check for a bundler plugin's own env-var
side effects, don't check it at `next.config` evaluation time — check it later (at request/runtime, or
read the plugin's own exported config object instead of an env var it sets as a side effect). Reproduce
and verify any such guard with an actual production-mode build, not a config-time unit test; the two
reproduce fundamentally different timing.
