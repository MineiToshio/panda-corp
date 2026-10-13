---
id: LESSON-0303
type: gotcha
domain: testing
tags: [playwright, chromium, headless-shell, browser-install, cache]
context: a scratch/ad-hoc Playwright install needs a headless Chromium build but the project's declared Playwright version doesn't match what's cached locally
trigger: use this when a fresh/scratch Playwright install (e.g. via npm/npx outside a project's own node_modules) fails because it expects a chromium_headless_shell build that `npx playwright install` would download, and you want to avoid triggering a fresh download
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred): npm playwright@1.58.2 run as a scratch install expected a chromium_headless_shell build absent from ~/Library/Caches/ms-playwright"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0079, LESSON-0040]
---

**Situation:** a one-off/scratch Playwright install (a version invoked directly via npm/npx, not a
project's pinned `node_modules`) needed a headless Chromium (`chromium_headless_shell`) build for
screenshot/axe checks, but the exact build its version expected was not present under
`~/Library/Caches/ms-playwright`, and the default path is to let it download one.

**Lesson:** the cache directory usually already holds a compatible-enough `chromium_headless_shell-NNNN`
build from a prior install (the project's own Playwright, a different scratch run). Pointing the scratch
script's `executablePath` directly at that already-cached build's binary works for screenshot/axe
harnesses without waiting on or triggering a new download.

**Apply next time:** before letting a scratch Playwright script download its own browser,
`ls ~/Library/Caches/ms-playwright` for an existing `chromium_headless_shell-*` (or `chromium-*`)
directory and pass its executable via `launch({ executablePath: ... })`; only fall back to a real
install/download if none exists or the cached build actually fails to launch.
