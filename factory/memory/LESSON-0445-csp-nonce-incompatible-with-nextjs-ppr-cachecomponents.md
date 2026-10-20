---
id: LESSON-0445
type: gotcha
domain: nextjs
tags: [csp, nonce, ppr, cachecomponents, security-audit]
context: enforcing a nonce-based Content-Security-Policy on a Next.js app that uses `cacheComponents`/Partial Prerendering (PPR)
trigger: use this when deciding whether to move a Next.js app's CSP from report-only to enforced with a per-request nonce, on a project that uses `cacheComponents`/PPR
source: "funko-tracker docs/reviews/security-2026-10-19.md SEC-09 (close-out security audit) — accepted/deferred, not fixed: \"nonce enforcement is incompatible with the current cacheComponents/PPR shell according to the installed Next CSP guide; no e2e-certified rendering migration exists\""
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a close-out security audit flagged the project's CSP as report-only, allowing arbitrary
inline scripts with no reporting destination. Moving to enforced nonce-based CSP — the normal fix — was
found to be INCOMPATIBLE with the project's current `cacheComponents`/PPR rendering shell per Next's own
CSP documentation, and no e2e-certified rendering migration existed to resolve the conflict within the
audit's scope. The finding was accepted/deferred rather than fixed.

**Lesson:** a per-request nonce requires the HTML response to be generated fresh per request (the nonce
must be embedded in both the CSP header and every inline script tag for that exact response); Partial
Prerendering's whole premise is serving a largely STATIC, cached shell with dynamic holes filled in later
— a cached shell cannot carry a fresh per-request nonce without breaking the caching that PPR exists to
provide. This is a structural tension, not a configuration bug: enabling one can require re-architecting
how the other is used (e.g. moving inline scripts to external files with `strict-dynamic`, or hashing
static inline scripts instead of nonce-ing them).

**Apply next time:** before promising enforced nonce-based CSP as a quick security fix on a Next.js
project, check whether the project uses PPR/`cacheComponents` — if so, budget it as a rendering-strategy
decision (hash-based CSP for static inline scripts, `strict-dynamic`, or dropping PPR for the affected
routes) rather than a drop-in header change, and don't treat "add a nonce" as a low-risk one-line audit
fix on such a project.
