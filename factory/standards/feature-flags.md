# Feature flags

> Domain: Product · Severity: **SHOULD** (MVP: no flags) / **MUST** (hygiene, once flags exist) · Enforcement: blueprint review + `reviewer` quality lens (review-only). No injected rule file — the MVP default is NO flags; this standard is consulted at blueprint/iterate time (stated deliberately, DR-051).

## Rule — MVP default: no flag system
- **A new product ships with NO feature-flag system.** Ship the feature or don't; a half-built feature waits in the change queue or on a branch, never behind a flag. Flags at MVP are speculative machinery — complexity, dead paths and test-matrix growth with zero users to protect.

## Rule — flags earn their place at first real users
Adopt flags (a blueprint/iterate decision, recorded as an ADR) when there is something real to protect:
- **Kill-switch** for a risky third-party integration (turn it off without a deploy — pairs with the bulkhead rule in [resilience.md](resilience.md)).
- **Gradual rollout** of a risky change to real users.
- **PostHog feature flags are the golden path** — already in the stack, no second flag system, evaluation near the analytics that measure the rollout.

## Rule — flag hygiene (once flags exist)
- Every flag declares a **kebab-case name scoped to its feature, an owner, and an expiry date** (in the flag's PostHog description).
- **A flag past its expiry is a defect** — a review finding to remove (either the rollout finished → delete the flag and the dead branch, or it became permanent config → promote it to real configuration, not an eternal flag).
- **Never flag-gate a security fix.** Fixes ship to 100%, always.

## How it is verified
- **No-flags default / adoption decision**: blueprint review — the architect proposes flags only against one of the named triggers, recorded as an ADR (named manual step).
- **Hygiene (name/owner/expiry, expired flags, no flag-gated fixes)**: `reviewer` quality lens on changes that touch flags (review-only); the `/pandacorp:review-launch` loop lists expired flags alongside the cost ceilings check (named manual step).

## Why
Flags trade deploy-time risk for run-time complexity — a good trade only when real users exist. Without expiry discipline they accrete into a combinatorial state space nobody tests; with PostHog already in the stack, the marginal cost of doing flags *right* (when earned) is near zero.
