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
node "$tmp/plugin/scripts/generate-codex-agents.mjs" >/dev/null 2>&1 || red "generator failed to run (fail-closed)"

drift=$(diff -rq "$tmp/.codex/agents" "$ROOT/.codex/agents" 2>&1)
if [ -n "$drift" ]; then
  echo "--- drift detail ---" >&2
  echo "$drift" >&2
  red ".codex/agents/*.toml is stale vs plugin/agents/*.md. Regenerate: node plugin/scripts/generate-codex-agents.mjs (CLAUDE.md §Plugin maintenance step 2)"
fi

exit 0
