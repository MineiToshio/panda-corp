# Factory backlog Workflow

The remaining Claude Code Workflow is `pandacorp-backlog`, stored at
`.claude/engines/pandacorp-backlog.js`. It operates on factory tooling, not product
projects. Its owning skill, `/pandacorp:implement-backlog`, launches it when called
without an item id. Product builds use the shared CLI described in
[runtime-executors.md](runtime-executors.md).

## Execution

The backlog Workflow scans open items, implements them in isolated worktrees
with tier-sized agents, then merges strictly one at a time with validation
between merges and reports the outcome. Follow the owning skill for the exact
invocation, model sizing, verification and landing rules.

The script lives under `.claude/engines/` so it is internal machinery rather
than an automatically exposed slash command under `.claude/workflows/`. Launch
by `scriptPath` through the owning skill. The script normalizes JSON-string
`args` before reading fields and rejects malformed JSON instead of silently
using defaults.

## Offline verification

```bash
node plugin/scripts/test-pandacorp-backlog.mjs
```

The harness injects Workflow globals and scripted agent responses; it does not
contact providers. Its green result proves fixture behavior, not unattended
provider availability. Codex may perform native attended backlog work under
DR-133; it does not emulate this Claude-local Workflow.
