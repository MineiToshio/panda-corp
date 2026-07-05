#!/bin/bash
# Self-test for check-derived-drift.sh — proves the gate goes GREEN on a clean tree
# and RED on each drift class it claims to catch (constitution §24: a check that
# cannot fail proves nothing). Run from the factory repo root:
#   bash plugin/scripts/test-check-derived-drift.sh

set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
GATE="$HERE/plugin/scripts/check-derived-drift.sh"
pass=0; fail=0

check() { # $1 label, $2 expected rc, $3 root
  bash "$GATE" "$3" >/dev/null 2>&1
  rc=$?
  if [ "$rc" = "$2" ]; then
    echo "  ✓ $1"; pass=$((pass+1))
  else
    echo "  ✗ $1 (expected rc=$2, got rc=$rc)"; fail=$((fail+1))
  fi
}

make_fixture() { # builds a minimal factory-shaped tree from the real repo
  local d
  d=$(mktemp -d)
  mkdir -p "$d/factory" "$d/plugin/scripts" "$d/plugin/agents" \
           "$d/plugin/.claude-plugin" "$d/plugin/.codex-plugin" "$d/.agents"
  touch "$d/factory/constitution.md"
  cp "$HERE/plugin/scripts/generate-codex-agents.mjs" "$d/plugin/scripts/"
  cp "$HERE"/plugin/agents/*.md "$d/plugin/agents/"
  cp "$HERE/plugin/.claude-plugin/plugin.json" "$d/plugin/.claude-plugin/"
  cp "$HERE/plugin/.codex-plugin/plugin.json" "$d/plugin/.codex-plugin/"
  cp -R "$HERE/plugin/skills" "$d/plugin/skills"
  ln -s ../plugin/skills "$d/.agents/skills"
  # generate a fresh, in-sync .codex/agents
  ( cd "$d" && node plugin/scripts/generate-codex-agents.mjs >/dev/null 2>&1 )
  echo "$d"
}

echo "== check-derived-drift.sh self-test =="

# 0. Out of scope: a non-factory dir → GREEN (no-op)
plain=$(mktemp -d)
check "non-factory dir is out of scope (rc=0)" 0 "$plain"
rm -rf "$plain"

# 1. Clean fixture → GREEN
fx=$(make_fixture)
check "clean tree passes" 0 "$fx"

# 2. Manifest version divergence → RED
jq '.version = "0.0.1-drift"' "$fx/plugin/.codex-plugin/plugin.json" > "$fx/tmp.json" \
  && mv "$fx/tmp.json" "$fx/plugin/.codex-plugin/plugin.json"
check "diverged manifest versions go RED" 2 "$fx"
cp "$HERE/plugin/.codex-plugin/plugin.json" "$fx/plugin/.codex-plugin/"

# 3. Edited agent source without regen → RED
printf '\nCanary drift line — do not commit.\n' >> "$fx/plugin/agents/implementer.md"
check "stale .codex/agents after agent edit goes RED" 2 "$fx"
cp "$HERE/plugin/agents/implementer.md" "$fx/plugin/agents/"

# 4. Tampered generated TOML → RED
printf '\n# tampered\n' >> "$fx/.codex/agents/reviewer.toml"
check "hand-edited generated TOML goes RED" 2 "$fx"
( cd "$fx" && node plugin/scripts/generate-codex-agents.mjs >/dev/null 2>&1 )

# 5. Broken .agents/skills symlink → RED
rm "$fx/.agents/skills"; ln -s ../nowhere "$fx/.agents/skills"
check "dangling .agents/skills symlink goes RED" 2 "$fx"

# 6. Recovered fixture → GREEN again
rm "$fx/.agents/skills"; ln -s ../plugin/skills "$fx/.agents/skills"
check "recovered tree passes again" 0 "$fx"

rm -rf "$fx"
echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
