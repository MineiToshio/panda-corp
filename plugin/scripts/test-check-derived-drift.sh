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
  local output
  output=$(bash "$GATE" "$3" 2>&1)
  rc=$?
  if [ "$rc" = "$2" ]; then
    echo "  ✓ $1"; pass=$((pass+1))
  else
    echo "  ✗ $1 (expected rc=$2, got rc=$rc): $output"; fail=$((fail+1))
  fi
}

make_fixture() { # builds a minimal factory-shaped tree from the real repo
  local d
  d=$(mktemp -d)
  mkdir -p "$d/factory" "$d/plugin/scripts" "$d/plugin/agents" \
           "$d/plugin/.claude-plugin" "$d/plugin/.codex-plugin" "$d/plugin/runtime" "$d/.agents/plugins" "$d/plugins" \
           "$d/mission-control/src/lib/events"
  touch "$d/factory/constitution.md"
  cp "$HERE/plugin/scripts/generate-codex-agents.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/check-runtime-sources.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/generate-skill-capabilities.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/check-skill-capabilities.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/generate-build-prompt-fragments.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/check-rollup-writer-boundary.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/generate-codex-enforcement.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/generate-event-vocabulary.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/test-runtime-switch.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/resolve-build-run-id.mjs" "$d/plugin/scripts/"
  cp "$HERE"/plugin/runtime/*.json "$d/plugin/runtime/"
  cp "$HERE/plugin/runtime/build-state.mjs" "$d/plugin/runtime/"
  cp "$HERE/plugin/runtime/event-transport.mjs" "$d/plugin/runtime/"
  mkdir -p "$d/plugin/runtime/codex"
  cp "$HERE/plugin/runtime/codex/"{executor.mjs,supervisor.mjs,result.schema.json} "$d/plugin/runtime/codex/"
  cp "$HERE/plugin/runtime/codex/R11-CERTIFICATION.md" "$d/plugin/runtime/codex/"
  mkdir -p "$d/plugin/runtime/prompts" "$d/plugin/templates/shared/.claude/engines"
  cp "$HERE/plugin/runtime/prompts/sync-rollups.md" "$d/plugin/runtime/prompts/"
  cp "$HERE/plugin/templates/shared/.claude/engines/pandacorp-build.js" "$d/plugin/templates/shared/.claude/engines/"
  cp "$HERE"/plugin/agents/*.md "$d/plugin/agents/"
  cp "$HERE/plugin/.claude-plugin/plugin.json" "$d/plugin/.claude-plugin/"
  cp "$HERE/plugin/.codex-plugin/plugin.json" "$d/plugin/.codex-plugin/"
  cp "$HERE/.agents/plugins/marketplace.json" "$d/.agents/plugins/"
  ln -s ../plugin "$d/plugins/pandacorp"
  cp "$HERE/mission-control/src/lib/events/event-vocabulary.json" "$d/mission-control/src/lib/events/"
  # The source-graph gate checks declared source/output existence only. Use synthetic fixture
  # sentinels here: never copy the owner's gitignored durable ledger into a test tree.
  mkdir -p "$d/mission-control/src/lib/gamification"
  : > "$d/mission-control/src/lib/gamification/ledger.ts"
  printf '{}\n' > "$d/factory/gamification-ledger.json"
  cp -R "$HERE/plugin/skills" "$d/plugin/skills"
  ln -s ../plugin/skills "$d/.agents/skills"
  # generate a fresh, in-sync .codex/agents
  ( cd "$d" && node plugin/scripts/generate-codex-agents.mjs >/dev/null 2>&1 )
  ( cd "$d" && node plugin/scripts/generate-codex-enforcement.mjs >/dev/null 2>&1 )
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

# 4e. A second declared producer in the source graph → RED
jq '.facts.plugin_identity.outputs += [".codex/agents/reviewer.toml"]' "$fx/plugin/runtime/source-graph.json" > "$fx/tmp.json" \
  && mv "$fx/tmp.json" "$fx/plugin/runtime/source-graph.json"
check "second source-graph writer goes RED" 2 "$fx"
cp "$HERE/plugin/runtime/source-graph.json" "$fx/plugin/runtime/source-graph.json"

# 3. Edited agent source without regen → RED
printf '\nCanary drift line — do not commit.\n' >> "$fx/plugin/agents/implementer.md"
check "stale .codex/agents after agent edit goes RED" 2 "$fx"
cp "$HERE/plugin/agents/implementer.md" "$fx/plugin/agents/"

# 4. Tampered generated TOML → RED
printf '\n# tampered\n' >> "$fx/.codex/agents/reviewer.toml"
check "hand-edited generated TOML goes RED" 2 "$fx"
( cd "$fx" && node plugin/scripts/generate-codex-agents.mjs >/dev/null 2>&1 )

# 4b. Missing generated TOML → RED
rm "$fx/.codex/agents/reviewer.toml"
check "missing generated TOML goes RED" 2 "$fx"
( cd "$fx" && node plugin/scripts/generate-codex-agents.mjs >/dev/null 2>&1 )

# 4c. Orphan generated TOML → RED
printf 'name = "orphan"\n' > "$fx/.codex/agents/orphan.toml"
check "orphan generated TOML goes RED" 2 "$fx"
( cd "$fx" && node plugin/scripts/generate-codex-agents.mjs >/dev/null 2>&1 )

# 4d. A non-version manifest field drifting from canonical metadata → RED
jq '.description = "drift"' "$fx/plugin/.codex-plugin/plugin.json" > "$fx/tmp.json" \
  && mv "$fx/tmp.json" "$fx/plugin/.codex-plugin/plugin.json"
check "full manifest field drift goes RED" 2 "$fx"
cp "$HERE/plugin/.codex-plugin/plugin.json" "$fx/plugin/.codex-plugin/"

# 4f. Even an exact canonical projection cannot put unsupported hook ownership in plugin.json.
jq '.runtime_extensions.codex.hooks = "./hooks/codex-hooks.json"' "$fx/plugin/runtime/plugin-metadata.json" > "$fx/tmp.json" \
  && mv "$fx/tmp.json" "$fx/plugin/runtime/plugin-metadata.json"
jq '.hooks = "./hooks/codex-hooks.json"' "$fx/plugin/.codex-plugin/plugin.json" > "$fx/tmp.json" \
  && mv "$fx/tmp.json" "$fx/plugin/.codex-plugin/plugin.json"
check "Codex manifest hook ownership goes RED" 2 "$fx"
cp "$HERE/plugin/runtime/plugin-metadata.json" "$fx/plugin/runtime/"
cp "$HERE/plugin/.codex-plugin/plugin.json" "$fx/plugin/.codex-plugin/"

# 4g. Codex presentation metadata is required even when source and projection agree.
jq 'del(.runtime_extensions.codex.interface)' "$fx/plugin/runtime/plugin-metadata.json" > "$fx/tmp.json" \
  && mv "$fx/tmp.json" "$fx/plugin/runtime/plugin-metadata.json"
jq 'del(.interface)' "$fx/plugin/.codex-plugin/plugin.json" > "$fx/tmp.json" \
  && mv "$fx/tmp.json" "$fx/plugin/.codex-plugin/plugin.json"
check "Codex manifest without required interface goes RED" 2 "$fx"
cp "$HERE/plugin/runtime/plugin-metadata.json" "$fx/plugin/runtime/"
cp "$HERE/plugin/.codex-plugin/plugin.json" "$fx/plugin/.codex-plugin/"

# 4h. A catalog entry that no longer resolves through the declared local bridge is RED.
jq '.plugins[0].source.path = "./plugins/copied-pandacorp"' "$fx/.agents/plugins/marketplace.json" > "$fx/tmp.json" \
  && mv "$fx/tmp.json" "$fx/.agents/plugins/marketplace.json"
check "repo-local marketplace drift goes RED" 2 "$fx"
cp "$HERE/.agents/plugins/marketplace.json" "$fx/.agents/plugins/"

# 4i. The marketplace bridge must remain a repo-root-relative symlink to the canonical plugin tree.
rm "$fx/plugins/pandacorp"; ln -s ../plugin-copy "$fx/plugins/pandacorp"
check "repo-local marketplace bridge drift goes RED" 2 "$fx"
rm "$fx/plugins/pandacorp"; ln -s ../plugin "$fx/plugins/pandacorp"

# 5. Broken .agents/skills symlink → RED
rm "$fx/.agents/skills"; ln -s ../nowhere "$fx/.agents/skills"
check "dangling .agents/skills symlink goes RED" 2 "$fx"

# 6. Recovered fixture → GREEN again
rm "$fx/.agents/skills"; ln -s ../plugin/skills "$fx/.agents/skills"
check "recovered tree passes again" 0 "$fx"
rm -rf "$fx"

# 7. WS-A F12: from a repo SUBDIR the gate must still ARM (git-toplevel resolution).
# The fixture must be a real git repo so `rev-parse --show-toplevel` resolves the root.
gx=$(make_fixture)
( cd "$gx" && git init -q )
mkdir -p "$gx/plugin/deep"
jq '.version = "0.0.1-drift"' "$gx/plugin/.codex-plugin/plugin.json" > "$gx/tmp.json" \
  && mv "$gx/tmp.json" "$gx/plugin/.codex-plugin/plugin.json"
check "F12 drift caught from repo ROOT"            2 "$gx"
check "F12 drift caught from plugin/ subdir"       2 "$gx/plugin"
check "F12 drift caught from a deep subdir"        2 "$gx/plugin/deep"
rm -rf "$gx"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
