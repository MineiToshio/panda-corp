---
id: LESSON-0721
type: anti-pattern
domain: ops-tooling
tags: [error-handling, cli, diagnosability, security]
context: an internal ops/admin CLI wraps every thrown error in a generic sanitized body (e.g. "Unexpected error") to avoid leaking exception messages/stack traces from a production-adjacent command
trigger: "use this when designing or debugging an ops/admin CLI's error-reporting layer — especially when a command fails with a generic message and the real cause turns out to be a caller-fixable precondition (missing flag, wrong environment profile, missing required artifact)"
source: funko-tracker — .pandacorp/run/lessons.md note (2026-11-22), confirmed live by reading `scripts/ops/lib/unexpected.ts` (`unexpectedErrorBody`, explicit comment "it never exposes exception messages or metadata") plus `scripts/ops/commands/universePublishLogos.ts`/`universeBindLogos.ts` — an `--apply` run against the frozen franchise-logos list needs `--receipt <run>/cache-invalidation.json` and, in dev, the `ops-definitive` profile; a missing one of those surfaces only as the generic body, not the actual thrown `Error("...")` message
provenance: agent-inferred
created: 2026-11-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---
**Situation:** a security-motivated design choice — sanitize every uncaught error before it reaches the CLI's JSON output, so a stack trace or internal detail never leaks — was applied uniformly to ALL thrown errors, including `throw new Error(...)` calls the command's OWN code uses to report a caller-fixable precondition (wrong `--receipt`, wrong environment profile, a missing frozen-list entry). The caller then sees the identical generic `{code: "unexpected", message: "Unexpected error"}` for both "you made a usage mistake, here's exactly what to fix" and "something genuinely broke internally" — burning debugging time re-deriving the real cause from source instead of the message.

**Lesson:** a blanket error-sanitizing wrapper is the right instinct for TRUE internal exceptions (DB errors, unexpected exceptions, anything that might carry secrets/internals) but is an anti-pattern when applied indiscriminately to precondition/validation errors the command itself raises deliberately and already knows the safe, actionable text for. The two are structurally different: one is "I don't trust what's inside this error", the other is "I wrote this error message on purpose for the caller to read."

**Apply next time:** give deliberate precondition/validation failures their own typed error class (or a tagged union / `Result` discriminant) that BYPASSES the generic sanitizer and is always safe to surface verbatim — it's already author-written, safe-by-construction text. Reserve the blanket "Unexpected error" sanitizer for the `catch`-all around genuinely unanticipated exceptions. This preserves the security property (no internal/exception-derived text ever leaks) while keeping the CLI/API diagnosable for its own legitimate operators.
