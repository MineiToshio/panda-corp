---
id: BL-0126
type: change
area: build-engine
title: "verify.sh's whole-project gate never runs a production build (next build), so dev/prod divergence (e.g. missing CSP unsafe-eval) ships undetected"
status: open
severity: p2
opened: 2026-09-07
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-06 (agent-inferred)"
closes:
links: [LESSON-0193, LESSON-0194]
---

## Problem
`.pandacorp/verify.sh` (the shared build-orchestration gate template) runs biome, tsc, vitest, Playwright
(against `next dev`), knip and madge — but never `next build`. On personal-page-v2 this already produced a
real production-only failure: a blog post page threw only in production, because the production CSP
forbids the `unsafe-eval` that browser-side MDX compilation needs, while `next dev`'s looser CSP let the
same code run without error. A fully green `verify.sh` is therefore not evidence that the deployable
artifact actually builds or behaves the same as what was tested.

## Root cause
The gate's browser layer (Playwright) boots its `webServer` against `next dev` for speed/HMR
convenience, and no separate step in `verify.sh` ever invokes `next build` (or the stack's equivalent
production build command). Dev-mode Next.js intentionally relaxes CSP and duplicates effects (React
Strict Mode) relative to production, so behavior that depends on either can pass the gate and still fail
in the shipped artifact.

## Fix plan
1. Add a production-build step to `verify.sh` (`next build`, generalized per the project's stack) — at
   minimum on the full (non-`--since`) run, given the cost of a cold production build.
2. Consider whether any CSP-sensitive check should run against `next build` + `next start` rather than
   `next dev` (see LESSON-0193/LESSON-0194) — scope this as a follow-up if it needs a bigger redesign of
   the browser layer's webServer target; the minimum fix is just proving the artifact builds.
3. Document the new step and its cost tradeoff in `factory/standards/build-orchestration.md`.

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: a change that passes biome/tsc/vitest/Playwright-against-dev but breaks `next build` (e.g. code
requiring `unsafe-eval` in a client boundary under production CSP, or any build-only type error). RED =
current `verify.sh` reports fully green. GREEN = updated `verify.sh` runs the production build step and
REDs on this fixture.

## Done when
`verify.sh`'s full (non-`--since`) run includes a production-build step that the RED→GREEN fixture proves
catches a real dev/prod divergence; `factory/standards/build-orchestration.md` documents it;
`OVERLAY_VERSION` bumped per DR-034 (MINOR — new gate capability).

## Out of scope
Redesigning the Playwright webServer target to always run against a production build (a larger,
potentially slower change) — this item only adds the missing build-validity check.
