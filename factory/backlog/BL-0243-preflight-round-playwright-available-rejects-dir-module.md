---
id: BL-0243
type: bug
area: plugin-skill
title: "design skill's preflight-round.mjs reports 'browser unavailable' when PLAYWRIGHT_MODULE points at a package directory"
status: open
severity: p2
opened: 2026-10-17
closed:
source: "pandasaga .pandacorp/run/lessons.md 2026-10-17 (agent-inferred): \"preflight-round.mjs reports 'browser unavailable' when PLAYWRIGHT_MODULE points to a package DIRECTORY: its playwrightAvailable() does import(dir), which ESM refuses, while fidelity/lib.mjs accepts dirs. Point PLAYWRIGHT_MODULE at <pkg>/index.mjs. Factory backlog: make playwrightAvailable reuse loadChromium().\""
closes:
links: []
---

## Problem

`plugin/skills/design/scripts/preflight-round.mjs`'s `playwrightAvailable()` check calls
`import(PLAYWRIGHT_MODULE)` directly. When `PLAYWRIGHT_MODULE` is set to a package DIRECTORY (rather than
an explicit entry file), Node's ESM loader refuses to resolve a bare directory path and the import throws
— `playwrightAvailable()` then (mis)reports "browser unavailable" even though a real, usable Playwright
install exists at that path. This is inconsistent with the sibling module `fidelity/lib.mjs`'s own
browser-loading helper (`loadChromium()`), which DOES accept a directory value for the same env var and
resolves it correctly (presumably by appending a known entry file internally). The practical workaround
found was to set `PLAYWRIGHT_MODULE` to the package's explicit entry file (`<pkg>/index.mjs`) instead of
its directory — but this means the two preflight paths (`preflight-round.mjs` and `fidelity/lib.mjs`)
silently disagree about what a valid `PLAYWRIGHT_MODULE` value looks like.

## Root cause

`playwrightAvailable()` in `preflight-round.mjs` re-implements its own minimal "can we import Playwright"
probe via a raw `import()` call instead of reusing `fidelity/lib.mjs`'s existing `loadChromium()` helper,
which already handles the directory-vs-entry-file resolution correctly. The duplication is the root cause:
two independent code paths for "resolve and check Playwright" drifted into different (and differently
tolerant) behavior.

## Fix plan

1. In `plugin/skills/design/scripts/preflight-round.mjs`, replace `playwrightAvailable()`'s direct
   `import(PLAYWRIGHT_MODULE)` probe with a call into `fidelity/lib.mjs`'s existing `loadChromium()` (or a
   shared resolution helper factored out of it if `loadChromium()` itself has side effects unsuitable for
   a pure availability check) — the goal is ONE resolution path for `PLAYWRIGHT_MODULE`, not two.
2. Verify the fix against BOTH forms of `PLAYWRIGHT_MODULE` (an explicit entry file, and a bare package
   directory) — both must now report "available" correctly.
3. Note the addition in `plugin/docs/decision-log.md`; bump the plugin version (PATCH).

## Tests (prove the fix — TDD, RED → GREEN)

- RED: set `PLAYWRIGHT_MODULE` to a package directory and call `playwrightAvailable()` — it currently
  throws/reports unavailable even though the package is installed and usable.
- GREEN: after the fix, the same directory value resolves correctly and `playwrightAvailable()` reports
  true; the explicit-entry-file form continues to work as before (no regression).

## Done when

- `playwrightAvailable()` and `loadChromium()` share the same `PLAYWRIGHT_MODULE` resolution logic.
- Both the directory-path and entry-file forms of `PLAYWRIGHT_MODULE` resolve correctly in a test.
- Plugin version bumped (PATCH) + decision-log entry added.

## Out of scope

- Does not change what values are a VALID `PLAYWRIGHT_MODULE` setting (e.g. does not add new discovery
  heuristics) — only unifies the two existing resolution paths so they agree.
