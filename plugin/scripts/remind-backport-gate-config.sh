#!/bin/bash
# Pandacorp PreToolUse (Write|Edit) NON-BLOCKING reminder: back-port canonical gate config (DR-076).
#
# The canonical gate files are conformance-checked (DR-059): the plugin TEMPLATE
# (plugin/templates/stack-<chosen>/) is the single source of truth, and /pandacorp:upgrade
# OVERWRITES a project's copy from it on any drift. So fixing one IN-PLACE in a project is a trap:
# the fix is silently REVERTED on the next upgrade, AND the template stays stale for every other
# project (exactly how MC's knip@6 fix got lost while the template kept the v6-rejected `_pandacorp`
# key, until the re-anchor caught it — DR-076). This hook fires when a canonical gate file is edited
# INSIDE a project (never when editing the template itself) and nudges to back-port instead.
#
# NEVER blocks (always exit 0) — it only injects context. Same proven pattern as remind-manual-sync.sh.

input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // ""')

allow() { exit 0; }
[ -n "$file" ] || allow

# Editing the TEMPLATE source is the CORRECT place — never nudge there.
case "$file" in */plugin/templates/*) allow ;; esac

# Only the conformance-checked canonical gate files trigger the reminder. (NOT the per-project seeds
# routes.ts / _target.ts / shell.ts — those are legitimately edited in-project.)
case "$file" in
  */biome.json|*/knip.json|*/playwright.config.ts) ;;
  */.pandacorp/verify.sh) ;;
  */e2e/smoke.spec.ts|*/e2e/visual.spec.ts|*/e2e/responsive.spec.ts|*/e2e/shell.spec.ts|*/e2e/_responsive-helper.ts) ;;
  *) allow ;;
esac

# Confirm the file is inside a Pandacorp PROJECT (a dir with .pandacorp/status.yaml at/above it).
dir=$(dirname "$file")
proj=""
for cand in "$dir" "$dir/.." "$dir/../.."; do
  if [ -f "$cand/.pandacorp/status.yaml" ]; then proj=$cand; break; fi
done
[ -n "$proj" ] || allow

cat <<JSON
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"Back-port reminder (DR-076): you are editing a CONFORMANCE-CHECKED canonical gate file ($(basename "$file")). The plugin template (plugin/templates/stack-<chosen>/) is the SINGLE source of truth — /pandacorp:upgrade OVERWRITES this project's copy from it, so an in-place fix here is silently REVERTED on the next upgrade and the template stays stale for every other project. Instead: (a) if this is a GENUINE fix, make it in the plugin template and propagate via /pandacorp:upgrade (back-port in the SAME change); or (b) if it is a project-specific exception, put it in a SEPARATE never-overwritten file, not the canonical one. Only proceed with the in-place edit if you are deliberately staging a throwaway test you will revert."}}
JSON
exit 0
