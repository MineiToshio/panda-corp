#!/bin/bash
# Pandacorp PreToolUse (Write|Edit) NON-BLOCKING reminder: the write-gate (DR-044).
# In a Pandacorp product project, changes to product/canonical files should flow through
# a /pandacorp:* skill, not ad-hoc free-chat edits. This hook NEVER blocks (always exits 0);
# it only nudges the model when it edits a product file outside a skill.
#
# Suppressed when: not a Pandacorp product project; a skill is driving the change
# (.pandacorp/skill-active present); or the file is exempt (gitignored Spanish comms layer,
# machinery, dependencies, lockfiles, env, dotfiles).

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // "."')
file=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // ""')

allow() { exit 0; }

# Scope: only Pandacorp PRODUCT projects (docs/status.yaml + Pandacorp marker in CLAUDE.md)
[ -f "$cwd/docs/status.yaml" ] || allow
grep -qs "Pandacorp" "$cwd/CLAUDE.md" || allow

# A skill is actively driving the change → no nudge (skills may touch this marker)
[ -f "$cwd/.pandacorp/skill-active" ] && allow

# Nothing to judge
[ -n "$file" ] || allow

# Exempt paths: gitignored Spanish comms layer, machinery, deps, build output, configs
case "$file" in
  */docs/summary.md|*/docs/decisions.md|*/docs/iteration.md|*/docs/progress.md|*/docs/activity.md) allow ;;
  */.pandacorp/*|*/.git/*|*/node_modules/*|*/.next/*|*/dist/*|*/build/*|*/.venv/*) allow ;;
  *.lock|*/package-lock.json|*/pnpm-lock.yaml|*/yarn.lock|*/.env*|*/.gitignore) allow ;;
esac

# Non-blocking nudge to the model (does NOT block the edit; exit 0)
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"Write-gate reminder (DR-044): you are editing a product file directly. If this change touches app behavior, a canonical doc (PRD/FRD/blueprint/ADR/DESIGN) or state, route it through the right /pandacorp:* skill (iterate / bug / decide / new-version) instead of an ad-hoc edit, so the two-layer docs, status.yaml, work-orders, TDD and review stay in sync. Exempt and fine to do directly: typos, comments, local config, throwaway experiments."}}
JSON
exit 0
