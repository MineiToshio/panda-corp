#!/bin/bash
# Pandacorp derived-artifact drift gate (DR-113 §Maintenance; wires the check
# rule-registry.md named as a "wiring candidate" — audit-20 P1-16's mechanical slice).
#
# The portability layer has exactly two derived copies (agent-portability.md §Maintenance):
#   1. plugin/.codex-plugin/plugin.json — must carry the SAME version as .claude-plugin
#   2. .codex/agents/*.toml — generated from plugin/agents/*.md by generate-codex-agents.mjs
# Plus one link: .agents/skills -> plugin/skills (the open-standard discovery path).
# Any of them drifting silently breaks the non-Claude runtimes (DR-113) with no gate noticing.
#
# Scope: the FACTORY repo only (factory/constitution.md + plugin manifest present); exits 0
# anywhere else. Exit 2 = drift (stderr says exactly what to run). FAIL-CLOSED: missing
# tooling (node/jq) or an unreadable manifest is a RED, never a silent pass.
#
# Invocation: as a Stop hook (reads {cwd} from stdin JSON), or manually:
#   bash plugin/scripts/check-derived-drift.sh [repo-root]

set -u

if [ $# -ge 1 ]; then
  ROOT="$1"
elif [ ! -t 0 ]; then
  input=$(cat)
  # Stop-loop protection (same contract as verify-before-stop.sh)
  stop_active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null || echo false)
  [ "$stop_active" = "true" ] && exit 0
  ROOT=$(printf '%s' "$input" | jq -r '.cwd // "."' 2>/dev/null || echo ".")
else
  ROOT="$PWD"
fi

# Resolve from the git toplevel so a Stop from a session parked in a repo SUBDIR (plugin/,
# mission-control/) does not DISARM the gate — real drift would close the session silently.
# This is the identical cwd-vs-toplevel fix block-dangerous.sh got this sprint, propagated to the
# sibling gate (WS-A F12). Fall back to ROOT when it is not a git repo.
ROOT=$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || echo "$ROOT")

CLAUDE_MANIFEST="$ROOT/plugin/.claude-plugin/plugin.json"
CODEX_MANIFEST="$ROOT/plugin/.codex-plugin/plugin.json"

# Scope: only the factory repo (the only place the derived layer lives)
[ -f "$ROOT/factory/constitution.md" ] || exit 0
[ -f "$CLAUDE_MANIFEST" ] || exit 0

red() {
  echo "Pandacorp derived-drift gate FAILED: $1" >&2
  echo "The portability layer (DR-113) has ONE source of truth per piece; a stale derived copy silently breaks non-Claude runtimes." >&2
  exit 2
}

command -v jq >/dev/null 2>&1 || red "jq not available — cannot verify manifest sync (fail-closed)"
command -v node >/dev/null 2>&1 || red "node not available — cannot verify .codex/agents drift (fail-closed)"

# --- Check 0: canonical runtime sources + complete manifest projections -----------------------
node "$ROOT/plugin/scripts/check-runtime-sources.mjs" "$ROOT" \
  || red "runtime source graph, tier mapping, or full manifest projection is invalid. Regenerate manifests with: node plugin/scripts/generate-plugin-manifests.mjs"

# --- Check 1: manifest versions in sync (CLAUDE.md §Plugin maintenance step 1) ---
v_claude=$(jq -r '.version // empty' "$CLAUDE_MANIFEST" 2>/dev/null)
v_codex=$(jq -r '.version // empty' "$CODEX_MANIFEST" 2>/dev/null)
[ -n "$v_claude" ] || red "cannot read version from $CLAUDE_MANIFEST"
[ -n "$v_codex" ] || red "cannot read version from $CODEX_MANIFEST (the Codex mirror must exist and carry the same version)"
[ "$v_claude" = "$v_codex" ] || red "manifest versions diverged — .claude-plugin=$v_claude vs .codex-plugin=$v_codex. Set BOTH to the same version (CLAUDE.md §Plugin maintenance step 1)."

# --- Check 2: .agents/skills symlink integrity (proposal 25 D2) ---
link="$ROOT/.agents/skills"
if [ ! -e "$link" ]; then
  red ".agents/skills is missing or dangling — non-Claude runtimes discover the 25 skills through it. Restore: ln -s ../plugin/skills $link"
fi
resolved=$(cd "$link" 2>/dev/null && pwd -P)
expected=$(cd "$ROOT/plugin/skills" 2>/dev/null && pwd -P)
[ -n "$resolved" ] && [ "$resolved" = "$expected" ] || red ".agents/skills does not resolve to plugin/skills (resolves to: ${resolved:-nothing})"

# --- Check 3: generated .codex/agents/*.toml drift vs plugin/agents/*.md ---
# The generator resolves REPO_ROOT from its own path, so regenerate inside a temp
# skeleton and diff against the committed output. Deterministic by construction.
tmp=$(mktemp -d) || red "mktemp failed"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/plugin/scripts" "$tmp/plugin/agents"
cp "$ROOT/plugin/scripts/generate-codex-agents.mjs" "$tmp/plugin/scripts/" || red "generator script missing"
cp "$ROOT"/plugin/agents/*.md "$tmp/plugin/agents/" || red "no agent sources found"
mkdir -p "$tmp/plugin/runtime"
cp "$ROOT"/plugin/runtime/*.json "$tmp/plugin/runtime/" || red "runtime canonical sources missing"
node "$tmp/plugin/scripts/generate-codex-agents.mjs" >/dev/null 2>&1 || red "generator failed to run (fail-closed)"

drift=$(diff -rq "$tmp/.codex/agents" "$ROOT/.codex/agents" 2>&1)
if [ -n "$drift" ]; then
  echo "--- drift detail ---" >&2
  echo "$drift" >&2
  red ".codex/agents/*.toml is stale vs plugin/agents/*.md. Regenerate: node plugin/scripts/generate-codex-agents.mjs (CLAUDE.md §Plugin maintenance step 2)"
fi

# --- Check 4: exact 25-skill capability projection --------------------------------------------
cp "$ROOT/plugin/scripts/generate-skill-capabilities.mjs" "$tmp/plugin/scripts/" || red "skill capability generator missing"
cp -R "$ROOT/plugin/skills" "$tmp/plugin/skills" || red "skill sources missing"
node "$tmp/plugin/scripts/generate-skill-capabilities.mjs" >/dev/null 2>&1 || red "skill capability generator failed"
cmp -s "$tmp/plugin/runtime/skill-capabilities.json" "$ROOT/plugin/runtime/skill-capabilities.json" \
  || red "skill-capabilities.json is stale; run node plugin/scripts/generate-skill-capabilities.mjs"
node "$ROOT/plugin/scripts/check-skill-capabilities.mjs" "$ROOT" >/dev/null 2>&1 \
  || red "skill capability coverage/evidence is invalid"

# --- Check 5: generated fenced rollup prompt + writer boundary --------------------------------
mkdir -p "$tmp/plugin/templates/shared/.claude/engines" "$tmp/plugin/runtime/prompts"
cp "$ROOT/plugin/scripts/generate-build-prompt-fragments.mjs" "$tmp/plugin/scripts/"
cp "$ROOT/plugin/runtime/prompts/sync-rollups.md" "$tmp/plugin/runtime/prompts/"
cp "$ROOT/plugin/templates/shared/.claude/engines/pandacorp-build.js" "$tmp/plugin/templates/shared/.claude/engines/"
node "$tmp/plugin/scripts/generate-build-prompt-fragments.mjs" >/dev/null 2>&1 || red "build prompt generator failed"
cmp -s "$tmp/plugin/templates/shared/.claude/engines/pandacorp-build.js" "$ROOT/plugin/templates/shared/.claude/engines/pandacorp-build.js" \
  || red "generated build prompt fragment is stale"
node "$ROOT/plugin/scripts/check-rollup-writer-boundary.mjs" "$ROOT" >/dev/null 2>&1 \
  || red "rollup writer boundary is invalid or retired prose returned"

# --- Check 6: generated Codex enforcement registration/config/rules ---------------------------
mkdir -p "$tmp/plugin/runtime" "$tmp/plugin/scripts"
cp "$ROOT/plugin/runtime/enforcement-policy.json" "$tmp/plugin/runtime/" || red "Codex enforcement policy missing"
cp "$ROOT/plugin/scripts/generate-codex-enforcement.mjs" "$tmp/plugin/scripts/" || red "Codex enforcement generator missing"
node "$tmp/plugin/scripts/generate-codex-enforcement.mjs" >/dev/null 2>&1 || red "Codex enforcement generator failed"
for generated in \
  .codex/config.toml \
  .codex/rules/pandacorp.rules \
  plugin/hooks/codex-hooks.json \
  plugin/templates/shared/.codex/config.toml \
  plugin/templates/shared/.codex/rules/pandacorp.rules; do
  cmp -s "$tmp/$generated" "$ROOT/$generated" \
    || red "$generated is stale; run node plugin/scripts/generate-codex-enforcement.mjs"
done

# --- Check 7: runtime-neutral event vocabulary projection --------------------------------------
mkdir -p "$tmp/mission-control/src/lib/events"
cp "$ROOT/plugin/runtime/event-vocabulary.json" "$tmp/plugin/runtime/" || red "event vocabulary source missing"
cp "$ROOT/plugin/scripts/generate-event-vocabulary.mjs" "$tmp/plugin/scripts/" || red "event vocabulary generator missing"
node "$tmp/plugin/scripts/generate-event-vocabulary.mjs" >/dev/null 2>&1 || red "event vocabulary generator failed"
cmp -s "$tmp/mission-control/src/lib/events/event-vocabulary.json" "$ROOT/mission-control/src/lib/events/event-vocabulary.json" \
  || red "Mission Control event vocabulary is stale; run node plugin/scripts/generate-event-vocabulary.mjs"

exit 0
