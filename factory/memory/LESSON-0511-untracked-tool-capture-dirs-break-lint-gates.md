---
id: LESSON-0511
type: gotcha
domain: factory-engineering
tags: [biome, verify.sh, gitignore, playwright-mcp, tool-artifacts, false-red]
context: a verify.sh/lint gate that scans the whole tree goes red because of output written by an agent's OWN tooling (e.g. a browser-automation MCP's capture directory) that is untracked but not gitignored
trigger: use this when verify.sh/Biome goes red citing files inside a directory you didn't intend to touch this session, before suspecting a real code regression — check whether it's an un-gitignored tool-output directory
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-21/22 (agent-inferred) — .playwright-mcp/*.json (the Playwright MCP browser-automation tool's own capture output) was untracked but not listed in .gitignore, so Biome linted it and failed the stop gate in a session that had touched nothing else"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0274]
---

**Situation:** a stop-gate/`verify.sh` run went red over JSON files inside `.playwright-mcp/` — output
from the Playwright MCP browser-automation tool, not test-runner artifacts, never committed, and not
excluded by the project's `.gitignore` (which only lists the test/build tooling the stack template
anticipated: `playwright-report/`, `test-results/`, etc.).

**Lesson:** a project's `.gitignore` is curated against the stack template's own known tooling at the time
it was written — it has no reason to already know about every tool an AGENT might run locally (an MCP
server, a one-off script) that writes its own capture/output directory into the repo tree. A whole-tree
lint gate (Biome or equivalent) has no built-in "this is just a tool's scratch output" exemption; it
treats any untracked file in scope as lintable content by default.

**Apply next time:** when a lint/verify gate reds on files inside an unfamiliar directory you didn't
author, check first whether it's an untracked TOOL-output directory rather than real code — don't start
"fixing lint errors" inside generated JSON. Add the directory to `.gitignore` (and the linter's own ignore
config if separate) rather than touching its contents. Treat any new local-tooling capture directory you
introduce as needing an explicit `.gitignore` entry at the point you start using that tool, not after the
first false red.
