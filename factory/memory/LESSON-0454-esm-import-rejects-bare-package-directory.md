---
id: LESSON-0454
type: gotcha
domain: nodejs
tags: [esm, import, module-resolution, playwright]
context: a Node ESM script resolves a third-party package's entry point from an env var or config value that may hold a package DIRECTORY rather than an explicit file
trigger: use this when a Node script's own `import(moduleRef)` (or dynamic import) silently fails/reports "unavailable" for a value that is a valid, installed package directory
source: "mission-control .pandacorp/run/lessons.md 2026-10 (agent-inferred) — plugin/skills/design/scripts/preflight-round.mjs's playwrightAvailable() does import(PLAYWRIGHT_MODULE) and fails when PLAYWRIGHT_MODULE is a bare package directory, while the sibling fidelity/lib.mjs resolves the same directory value correctly; filed as factory/backlog/BL-0243 (open) for the specific script fix"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0243]
---

**Situation:** a script probing whether a Playwright install is usable called `import(PLAYWRIGHT_MODULE)`
directly. When `PLAYWRIGHT_MODULE` held a bare package DIRECTORY path (not an explicit entry file), Node's
ESM loader refused to resolve it and the import threw — the probe then reported "browser unavailable" even
though a real, working Playwright install existed at that exact path. A sibling helper in the same codebase
that resolves the SAME env var via its own internal directory-aware logic worked fine with the identical
value, so the two paths silently disagreed about what counts as a valid value.

**Lesson:** plain ESM `import()` of a bare directory path is not guaranteed to resolve the way `require()`
or a package-aware loader helper might (auto-appending `index.js`/`package.json#main` resolution) — Node's
pure ESM resolver expects either a bare specifier it can resolve via `node_modules`, or an explicit file
path, and a raw directory string can throw or silently fail depending on the Node version and loader
configuration. Two independent code paths that each implement their OWN resolution for the same
env-var-configured module reference are a reliability trap: one can quietly diverge from the other and
start reporting the wrong availability.

**Apply next time:** when a dynamic `import()` target is read from an env var/config value that a human
or another script might set to a package directory, either (a) always resolve it to an explicit entry file
before importing (e.g. `path.join(dir, "index.mjs")`, or read `package.json#main`/`#exports`), or (b)
reuse ONE shared resolution helper across every code path that consumes that same env var — never let two
independent probes silently disagree about what a valid value looks like.
