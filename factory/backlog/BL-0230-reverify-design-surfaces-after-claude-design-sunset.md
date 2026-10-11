---
id: BL-0230
type: change
area: plugin-skill
title: "After 2026-12-14, re-verify DesignSync, /design-sync and /design against the post-sunset reality and retire or re-point the LEGACY canvas procedure"
status: open
severity: p2
opened: 2026-10-11
closed:
source: "docs/proposals/42-absorb-claude-design-to-artifacts.md, Plan step 7"
closes:
links: [BL-0229, BL-0117, DR-058, DR-109]
---

## Problem
BL-0229 marked `plugin/skills/design/references/canvas-procedure.md` and `factory/standards/design.md`
§1c as LEGACY, valid only until standalone Claude Design closes on **2026-12-14**. As of 2026-10-10 the
`DesignSync` tool still targets standalone design-system projects, and `/design-login` and `/design-sync`
are still listed in the Claude Code commands reference. Nobody knows yet whether Anthropic re-points them
at Design System *artifacts* after the sunset or retires them. If nobody re-checks, the factory keeps
LEGACY text pointing at a dead surface (the same no-re-check-trigger failure that produced BL-0229).

## Fix plan
Do not start before 2026-12-15.
1. Read the live tool descriptions in a Claude Code session: `DesignSync` (ToolSearch `select:DesignSync`),
   the `Artifact` tool's types (`action: list, scope: types`), and the commands reference
   (https://code.claude.com/docs/en/commands) for `/design`, `/design-sync` and `/design-login`.
2. If standalone is gone and DesignSync is retired or re-pointed: delete or shrink
   `canvas-procedure.md`, remove the LEGACY routing row in `plugin/skills/design/SKILL.md` Step 0 and the
   §1c canvas mechanics, and update the `DesignSync` rows in `AGENTS.md`, `factory/standards/agent-portability.md`
   and `plugin/runtime/skill-capabilities.json`.
3. If proposal 42 step 5 (validation on a real UI project) has passed by then, write the DR that replaces
   DR-058/DR-109 in the same change. Otherwise leave them superseded-pending.
4. Bump the plugin (PATCH or MINOR), regenerate the manifests, and add the decision-log entries.

## Tests (prove the fix — TDD, RED → GREEN)
Documented manual check: the tool-description excerpts and the commands-reference lines are quoted with
their date in the decision-log entry. `grep -rn "claude.ai/design" plugin/ factory/standards/` then returns
only historical or archive references.

## Done when
The live facts are re-verified and recorded, no plugin or standard routes to a dead surface, the version is
bumped, and the decision log is updated.
