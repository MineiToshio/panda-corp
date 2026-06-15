#!/usr/bin/env bash
# SessionStart hook — decision-log discipline reminder ("document everything").
# Injects, at the start of each session, the rule to record decisions per area as context.
# The canonical rule lives in CLAUDE.md (the decision-log section); this just keeps it top-of-mind.
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"📓 Decision log active — document everything. On any relevant decision (something the owner decides, a change of direction, a new convention, something non-obvious we did and why), record it in the area's decision log BEFORE closing the turn — date, what, why: Mission Control→mission-control/docs/decision-log.md, plugin→plugin/docs/decision-log.md, ideas→factory/ideas/decision-log.md, factory→factory/decision-log.md. Index: DECISION-LOG.md. Decision log = history (what/why); factory/decisions/registry.yaml = policy (rules with defaults). Don't record trivial changes already obvious from the commit."}}
JSON
