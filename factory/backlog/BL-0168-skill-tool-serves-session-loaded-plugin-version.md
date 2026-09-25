---
id: BL-0168
type: change
area: plugin-skill
title: "the Skill tool serves the plugin version THIS SESSION loaded at start, not the currently-installed one — an already-open session silently executes stale skill/reference text after `claude plugin update`"
status: open
severity: p2
opened: 2026-09-24
closed:
source: "canary 1 (change-now-dryrun-report.md) and canary 2 (change-now-canary-2-report.md §4.4) of /pandacorp:change --now on Mission Control, 2026-09-23 — both observed a running session serving an older plugin version than `installed_plugins.json` reported"
closes:
links: [BL-0152, BL-0163, BL-0166]
---

## Class

**Harness constraint, not a bug in this repo's code.** The mechanism is Claude Code's own plugin
loading: the `Skill` tool resolves `${CLAUDE_PLUGIN_ROOT}` (and therefore every `SKILL.md`/
`references/*.md` it serves) to the literal cache path (`~/.claude/plugins/cache/panda-corp/
pandacorp/<version>/…`) that THIS session read at its own startup — `claude plugin update` refreshes
the cache and `installed_plugins.json` immediately, but an already-open session keeps serving the
version it started with until it is restarted. This item exists to document the constraint, name its
evidence, and land the cheap half of its mitigation — not to "fix" the harness.

## Problem

Two independent canary runs of `/pandacorp:change --now` hit this directly:

- **Canario 2** (`change-now-canary-2-report.md` §4.4): the operator ran `/pandacorp:change --now`
  through the `Skill` tool right after `claude plugin update` had bumped the installed plugin to
  9.106.0 (confirmed: `installed_plugins.json` → `lastUpdated: 2026-09-23T02:05:08.800Z`,
  `version: "9.106.0"`). The `Skill` tool nonetheless served **9.105.0** text — confirmed by the
  operator diffing the served text line-by-line against the 9.106.0 checkout and finding BL-0162's
  fix (the `--card` worktree-vs-`$PROJECT_ROOT` split, §5 of `now-mode.md`) **absent** from what was
  served. The operator had already read the 9.106.0 files directly beforehand and executed that
  contract by hand instead of the stale served text — so this run wasn't corrupted, but a less
  careful operator trusting the `Skill` tool's own output would have executed BL-0162's un-fixed
  behavior without knowing it.
- **Canario 1** (`change-now-dryrun-report.md`, same session lineage) observed the same pattern one
  version earlier in the same day.

## Evidence gathered (this item)

- `~/.claude/plugins/installed_plugins.json` (read live, 2026-09-24): `pandacorp@panda-corp` →
  `version: "9.107.0"`, `installPath: ".../pandacorp/9.107.0"`, `lastUpdated:
  2026-09-23T15:16:12.693Z`, `gitCommitSha: c0a9b157...` — i.e. the currently-installed version is
  unambiguous and machine-readable from this one file at any time.
- `plugin/scripts/preflight-implement.sh` §2b (BL-0152) already diagnoses the EXACT same mechanism
  for the `/pandacorp:implement` launch path, and its own comment states the mechanism precisely:
  *"Claude Code substitutes [`${CLAUDE_PLUGIN_ROOT}`] to the literal cache path of the plugin copy
  THIS session loaded at its own start... `CLAUDE_PLUGIN_ROOT` itself is NOT read as an ambient env
  var: verified empty in a live `bash` tool call in this same session."* It reads
  `plugin/runtime/plugin-metadata.json` next to itself (the session-resident version) and compares it
  against `installed_plugins.json` (the truly-installed version), WARNing (never blocking) when the
  session is behind. This is the confirming precedent that the constraint is real, already diagnosed
  once, and already has a working detection pattern to imitate.
- No equivalent check exists for the `Skill` tool invocation path itself (`/pandacorp:change`,
  `/pandacorp:sync`, or any other skill invoked directly, not via `implement`'s own preflight
  script) — a session can go stale on ANY skill, not only the build launch.

## Mitigation

**(a) Already covered for the build-launch path.** `preflight-implement.sh` §2b (BL-0152) WARNs the
owner when the session's own plugin/runtime/plugin-metadata.json is behind
`installed_plugins.json`, before `/pandacorp:implement` launches. No further work needed there.

**(b) New, for skills that delegate to subagents or read their own references at length — done as
part of this item.** Since a skill script cannot re-resolve `${CLAUDE_PLUGIN_ROOT}` to a NEWER path
after it has already been served (the substitution happens once, before any of the skill's own text
runs), the cheapest mitigation available to a PROSE contract is to tell the operating agent to check
for the skew itself, at the very top of the skill, before trusting anything `${CLAUDE_PLUGIN_ROOT}`
resolves to. Landed as a one-paragraph addition to the two files most exposed to this (long,
reference-heavy, delegate-to-subagent skills): `plugin/skills/change/SKILL.md`'s Preflight note and
`plugin/skills/change/references/now-mode.md`'s opening. Both now instruct: compare
`${CLAUDE_PLUGIN_ROOT}`'s own version (`plugin-metadata.json` next to it) against
`~/.claude/plugins/installed_plugins.json`'s `pandacorp@panda-corp` entry; if the session is behind,
read the INSTALLED cache path's copy of the same file directly instead of trusting the served text,
and tell the owner the session is stale (a restart is the durable fix). This mirrors exactly what
both canary operators already did by hand.

**Why this item stays `open`, not `done`.** The root cause (session-resident `${CLAUDE_PLUGIN_ROOT}`
substitution) is Claude Code's own harness behavior, outside this repo's ability to fix — there is no
`closes:` target that makes the constraint go away, only prose that mitigates its blast radius on the
two files touched here. Closing this as `done` would misrepresent a documented, permanent constraint
as a resolved bug. Extending the same paragraph to every other reference-heavy skill (`sync`,
`architecture`, `implement`'s own non-preflight prose, etc.) is deliberately left for a follow-up,
not bundled here to keep this item's diff reviewable.

## Out of scope
- Making the `Skill` tool itself resolve the installed version live (a Claude Code harness change,
  not something this repo controls).
- Extending the mitigation paragraph to skills beyond `change`/`now-mode.md` (a mechanical follow-up
  once the wording here is validated in practice).
- Automatically restarting or invalidating a stale session (no such control exists from inside a
  skill).
