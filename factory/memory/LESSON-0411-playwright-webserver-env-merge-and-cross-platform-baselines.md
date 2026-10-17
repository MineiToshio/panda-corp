---
id: LESSON-0411
type: gotcha
domain: testing
tags: [playwright, webserver, env, ci, toHaveScreenshot, cross-platform, visual-regression]
context: a project with a committed e2e/server-env.json and per-work-order toHaveScreenshot visual-regression specs, run both locally (macOS) and in CI (Linux)
trigger: use this when a CI run's Playwright webServer seems to ignore a CI-only env var, or when toHaveScreenshot specs fail in CI but pass locally with no code difference
source: "pandasaga .pandacorp/run/lessons.md 2026-10-15 (agent-inferred): Playwright 1.64 webServer env is {...process.env, ...options.env}, so a committed e2e/server-env.json overrides CI's DATABASE_URL; and per-WO toHaveScreenshot specs fail on Linux CI when only -darwin baselines exist (updateSnapshots: none in CI). Plan the CI env rewrite and Linux blessing up front."
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0040]
---

**Situation:** Playwright 1.64's `webServer` option builds its child process environment as
`{...process.env, ...options.env}` — the options object (sourced here from a committed
`e2e/server-env.json`) is applied LAST and therefore wins over whatever the surrounding process already
had set, including a CI-provided `DATABASE_URL`. A committed, dev-oriented env file silently overrides a
CI secret/connection string with no error — the webServer just connects to the wrong database. Separately,
work-order-scoped `toHaveScreenshot` visual-regression specs that only ever had their reference baselines
captured on a developer's macOS machine fail outright in Linux CI, because Playwright's `toHaveScreenshot`
keys baselines by platform suffix (`-darwin` vs `-linux`) and CI is configured with `updateSnapshots: none`
(correctly refusing to silently accept new baselines in CI).

**Lesson:** two independent cross-environment gotchas compound on any project that (a) commits a
webServer env file for local/dev convenience and (b) runs visual-regression specs in both a local macOS
dev loop and Linux CI: the env file is a silent override, not a fallback-only default: and screenshot
baselines are platform-specific artifacts that must be explicitly produced for every platform the suite
runs on, not just the one a developer happened to run it on first.

**Apply next time:** when wiring Playwright webServer env for a project that will also run in CI, either
keep CI-sensitive vars (`DATABASE_URL`, secrets) OUT of the committed env file (let `process.env` supply
them) or have the CI pipeline rewrite/strip that file before the webServer launches — decide this
explicitly rather than discovering the override live. For `toHaveScreenshot` work, generate and commit the
Linux-blessed baseline set (`--update-snapshots` run once in a Linux container/CI, reviewed and committed)
alongside the macOS set before relying on CI visual-regression gates; plan both the env rewrite and the
cross-platform baseline blessing during initial e2e setup, not after the first confusing CI failure.
