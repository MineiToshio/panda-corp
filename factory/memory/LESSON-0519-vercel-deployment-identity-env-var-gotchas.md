---
id: LESSON-0519
type: gotcha
domain: vercel
tags: [vercel, env-vars, deployment-identity, preview-vs-production, secrets]
context: configuring environment variables on Vercel that must vary by deployment environment (preview vs production) or that carry secret values
trigger: use this when a Vercel build fails with a rendering/environment-identity mismatch (e.g. a pinned SHA/env marker disagreeing with the actual deploy), or when you need to change which environments a Vercel env var targets
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred, unconfirmed live on Vercel) — build failed with \"Invalid rendering environment: [DEPLOYMENT_ENV, DEPLOYMENT_SHA]\" because a fixed DEPLOYMENT_SHA env var disagreed with the per-build VERCEL_GIT_COMMIT_SHA while DEPLOYMENT_ENV stayed pinned to production on a VERCEL_ENV=preview build; separately, a legacy Vercel \"Secret\" (type encrypted, visibility secret) env var could not have its environment targets PATCHed under the team's sensitive-env policy until converted to type sensitive"
provenance: agent-inferred
created: 2026-10-25
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** two independent Vercel env-var failures on the same project. (1) A deployment-identity
check compared a fixed `DEPLOYMENT_SHA` env var against the per-build `VERCEL_GIT_COMMIT_SHA` — since
the fixed value never changes but every new build has a new commit SHA, and `DEPLOYMENT_ENV` was pinned
to `production` regardless of the actual `VERCEL_ENV`, every new deploy (and every preview build) failed
the check. (2) A legacy-type "Secret" env var (type `encrypted`, visibility `secret`) rejected an attempt
to change which environments it targets (PATCH), because the team's sensitive-env policy only allows
retargeting on the newer `sensitive` type.

**Lesson:** Vercel env vars carry TWO axes that are easy to assume are simpler than they are: (a) a value
meant to identify "this specific deployment" (a commit SHA, an environment name) must be DERIVED at
build time from Vercel's own build-time variables (`VERCEL_GIT_COMMIT_SHA`, `VERCEL_ENV`), never hardcoded
as a fixed env var — a fixed value is correct for exactly one build and breaks every subsequent one,
including previews; (b) an env var's TYPE (legacy `encrypted`/`secret` vs the newer `sensitive`) is not
just a storage detail — it gates which API operations (like retargeting environments) are even allowed
under a team's security policy, and migrating type is a separate, explicit step.

**Apply next time:** never hardcode a per-build identity value (commit SHA, deploy environment name) as a
static Vercel env var — read it from the platform's own build-time variables instead. Before assuming a
Vercel env var's targets can be changed via API/CLI, check its `type` first; a legacy `secret`/`encrypted`
var must be converted to `sensitive` before a target-environment PATCH will succeed under a
sensitive-env team policy.
