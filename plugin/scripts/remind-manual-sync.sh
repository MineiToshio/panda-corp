#!/bin/bash
# Pandacorp PreToolUse (Write|Edit) NON-BLOCKING reminder: Manual sync (DR-046).
#
# Mission Control's Manual (mission-control/content/manual/) is the navigable face of
# the factory's know-how and MUST stay in sync with it. When a conversation edits the
# factory's OPERABLE SURFACE — a skill, an agent, a standard, the decision registry or
# the constitution — the Manual must reflect it in the SAME change. The Reference
# catalogs (skills/agents/rules/standards) auto-derive from these files; the
# hand-authored narrative (Tutorial/Guides/Concepts) does NOT — this hook nudges the
# model to update the affected narrative page.
#
# This NEVER blocks (always exit 0); it only injects context. The hard-blocking Stop
# variant is added once Mission Control's own build finishes (owner decision 2026-06-20).
#
# Scope: fires ONLY inside the factory repo (marker: factory/constitution.md +
# mission-control/content/manual/ at the git root), and only for operable-surface paths.
# Independent of cwd and of any active skill — so it also fires during /memory and /learn.

input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // ""')

allow() { exit 0; }
[ -n "$file" ] || allow

# Only operable-surface files trigger the reminder; each maps to its likely narrative page(s).
case "$file" in
  */plugin/skills/*|*/plugin/agents/*)
    area="a skill or agent (a flow / the team)"
    page="content/manual/concepts/{el-pipeline,el-equipo,el-plugin}.md + the matching content/manual/guides/ page" ;;
  */factory/standards/*)
    area="an engineering standard"
    page="content/manual/concepts/{estandares-y-reglas,stacks-golden-paths}.md" ;;
  */factory/decisions/registry.yaml)
    area="a decision rule"
    page="content/manual/concepts/estandares-y-reglas.md (the DR catalog auto-derives; update the narrative only if a flow/gate changed)" ;;
  */factory/constitution.md)
    area="the constitution"
    page="content/manual/concepts/{que-es-pandacorp,arquitectura-del-sistema}.md" ;;
  *)
    allow ;;
esac

# Confirm we are inside the factory repo (never a product project): the git root must
# hold both factory/constitution.md and the Manual content tree.
dir=$(dirname "$file")
root=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || allow
[ -f "$root/factory/constitution.md" ] && [ -d "$root/mission-control/content/manual" ] || allow

cat <<JSON
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"Manual-sync reminder (DR-046): you are changing Pandacorp's operable surface ($area). Mission Control's Manual is the navigable face of the factory and must stay in sync. The Reference catalogs (skills/agents/rules/standards) AUTO-DERIVE from these source files — do NOT hand-copy them. But if this change alters a FLOW, GATE or CONCEPT, update the matching hand-authored narrative page in the SAME change: $page. Then record it in the area decision-log. Skip only if this edit is purely internal (a typo, wording, a refactor with no behavior/flow change)."}}
JSON
exit 0
