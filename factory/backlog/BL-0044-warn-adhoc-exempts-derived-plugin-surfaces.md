---
id: BL-0044
type: bug
area: hooks
title: "warn-adhoc-write.sh exempts plugin/agents + manifest edits from the isolation nudge, yet their uncommitted edits red the drift gate"
status: open
severity: p2
opened: 2026-07-05
closed:
source: "Fable hardening sprint II WS-A adversarial guard-bypass hunt (docs/proposals/28), finding F10"
closes:
links: [BL-0033, DR-096, DR-113]
---

## Problem
The isolation nudge (`plugin/scripts/warn-adhoc-write.sh`) was scoped by BL-0033 to skip
factory-only prose. But the catch-all skip case (`*/plugin/*|…|*.md`) also exempts two surfaces
that are DERIVED/GATED, not inert prose:

- `plugin/agents/*.md` — the Codex TOML mirrors regenerate from these; an uncommitted agent-def edit
  in the shared main checkout reds another session's Stop drift gate (`check-derived-drift.sh`).
- `plugin/.claude-plugin/plugin.json` (+ `.codex-plugin/plugin.json`) — the manifest versions the
  drift gate checks for sync.

So exactly the cross-session-red risk BL-0033's nudge exists to prevent is silently exempted for
these two. Evidence (WS-A F10 executed matrix): editing `plugin/agents/reviewer.md` or the manifest
in the shared checkout produced NO nudge.

## Root cause
The `*/plugin/*` and `*.md` skip patterns are evaluated before any carve-out for the derived
surfaces, so they swallow `plugin/agents/*.md` and the manifests.

## Fix plan
Add a keep-nudge case BEFORE the `*/plugin/*` skip in the `skip_isolation` `case` (line ~73):
`*/plugin/agents/*|*/plugin/.claude-plugin/*|*/plugin/.codex-plugin/*) : ;;` — so these three keep
the isolation nudge while genuine factory prose (`factory/**`, `docs/**`, other `plugin/**/*.md`)
stays exempt.

## Tests (prove the fix — TDD, RED → GREEN)
Extend `plugin/scripts/test-warn-adhoc-write.sh`: `plugin/agents/reviewer.md` → nudge;
`plugin/.claude-plugin/plugin.json` → nudge; control `factory/standards/quality.md` → still NO
nudge; control `plugin/skills/foo/SKILL.md` → still NO nudge.

## Done when
The three derived surfaces nudge, the prose controls stay silent, canaries prove both, plugin
version bumped.

## Out of scope
Whether `plugin/agents` prose "should" always nudge in principle — this item fixes only the
derived-layer red risk BL-0033 already accepted as the nudge's purpose.
