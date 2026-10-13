---
id: LESSON-0303
type: gotcha
domain: testing
tags: [playwright, chromium, headless-shell, browser-install, cache, executablepath, system-browser]
context: a Playwright-driven QA check (scratch install OR a project's bundled Playwright) can't launch because the Chromium/headless-shell build it expects isn't present
trigger: use this when a Playwright launch fails because the chromium/chromium_headless_shell revision it expects is missing (scratch install outside a project's node_modules, or a project's bundled Playwright pointing at an absent revision) and you want to avoid a fresh download or assuming the product/environment is broken
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred): npm playwright@1.58.2 run as a scratch install expected a chromium_headless_shell build absent from ~/Library/Caches/ms-playwright. CORROBORATED by pandasaga .pandacorp/run/lessons.md 2026-10-13 (agent-inferred): the project's bundled Playwright expected Chromium revision 1234, absent locally; the system-installed Chrome at /Applications/Google Chrome.app/Contents/MacOS/Google Chrome launched successfully via `executablePath`, a distinct fallback (a real browser install, not a Playwright-managed cache dir) for the same root failure shape."
provenance: agent-inferred
created: 2026-10-13
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0079, LESSON-0040]
---

**Situation:** a Playwright launch (either a one-off scratch install via npm/npx, or a project's own
bundled Playwright) needs a specific Chromium/`chromium_headless_shell` build for screenshot/axe checks,
but the exact revision it expects is missing locally, and the default reflex is either to let it
download a fresh one or to suspect the product/environment is broken.

**Lesson:** a missing expected-revision Chromium build does not mean no usable browser exists — there
are usually TWO fallback paths before downloading or diagnosing the product: (1) an already-cached,
compatible-enough `chromium_headless_shell-NNNN`/`chromium-*` build from a prior Playwright install
elsewhere in `~/Library/Caches/ms-playwright`, or (2) a real system-installed browser (e.g.
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on macOS). Either, pointed to via
`launch({ executablePath: ... })`, satisfies screenshot/axe-style QA harnesses without waiting on or
triggering a new download — and rules out "environment/product is broken" before it's even considered.
Corroborated independently across two projects (funko-tracker: cached alternate revision; pandasaga:
system Chrome), so this generalizes beyond either single fallback.

**Apply next time:** when a Playwright launch fails on a missing expected browser revision, before
downloading or diagnosing further: (a) `ls ~/Library/Caches/ms-playwright` for an existing
`chromium_headless_shell-*`/`chromium-*` directory, or (b) check for a system-installed Chrome/Chromium
binary; pass whichever is found via `launch({ executablePath: ... })`. Only fall back to a real
install/download if neither exists or both fail to launch. Don't install or change the product's own
declared stack just to satisfy ad-hoc QA.
