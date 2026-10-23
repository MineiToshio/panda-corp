---
id: BL-0278
type: bug
area: templates
title: "The shared .gitignore template has no entry for .playwright-mcp/, so Biome lints the Playwright MCP tool's own untracked capture output and false-reds verify.sh"
status: open
severity: p2
opened: 2026-10-23
closed:
source: "LESSON-0511 (funko-tracker .pandacorp/run/lessons.md 2026-10-21/22, agent-inferred)"
closes:
links: [LESSON-0511]
---

## Problem
`plugin/templates/shared/.gitignore` lists known test/build tooling output (`playwright-report/`,
`test-results/`, `coverage/`, etc.) but has no entry for `.playwright-mcp/` — the capture-output directory
the Playwright MCP browser-automation tool (used by Claude in Chrome / Claude Code sessions) writes into a
project's working tree when invoked. On funko-tracker, `.playwright-mcp/*.json` was untracked but not
gitignored; Biome's whole-tree lint scanned it and failed the stop gate in a session that had not touched
any project code. The symptom reads exactly like a real lint regression, costing a diagnosis detour before
the cause (an un-gitignored tool-artifact directory, not a code defect) was identified.

## Root cause
The shared `.gitignore` template was curated against the stack's own known test/build tooling at authoring
time. It predates (or never anticipated) agent-side tools like the Playwright MCP server that write their
own capture directories into whichever project directory they're invoked from — there is no mechanism that
keeps the template's ignore list current with newly adopted agent tooling.

## Fix plan
1. Add `.playwright-mcp/` to the "Test & tooling caches" section of `plugin/templates/shared/.gitignore`.
2. Audit for other known agent-tool capture directories with the same exposure (e.g. any other MCP server
   that writes local output) and add them in the same pass if found.
3. Bump `OVERLAY_VERSION` per the template-change convention so existing projects can pick up the fix via
   `/pandacorp:upgrade`.

## Tests (prove the fix — TDD, RED → GREEN)
Add/extend `plugin/scripts/test-worktree-bootstrap.sh` (or the template-generation test suite) with a
canary asserting `.playwright-mcp/` appears in the generated `.gitignore` for a freshly scaffolded project;
RED before the fix (absent), GREEN after.

## Done when
- [ ] `.playwright-mcp/` present in `plugin/templates/shared/.gitignore`.
- [ ] `OVERLAY_VERSION` bumped and the canary test passes.
- [ ] An existing project running `/pandacorp:upgrade` picks up the new ignore entry.

## Out of scope
Auditing every possible future agent-tool capture directory exhaustively; this item only closes the
`.playwright-mcp/` gap and any other currently-known instance found during the audit step.
