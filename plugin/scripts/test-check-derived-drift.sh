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

check_stop() { # $1 label, $2 expected rc, $3 root, $4 session_id -- simulates the REAL Stop-hook
  # invocation contract (stdin JSON with cwd + session_id), used by the BL-0082 attribution tests.
  local output rc payload
  payload=$(printf '{"cwd":%s,"session_id":%s}' "$(jq -Rs . <<< "$3")" "$(jq -Rs . <<< "$4")")
  output=$(printf '%s' "$payload" | bash "$GATE" 2>&1)
  rc=$?
  if [ "$rc" = "$2" ]; then
    echo "  ✓ $1"; pass=$((pass+1))
  else
    echo "  ✗ $1 (expected rc=$2, got rc=$rc): $output"; fail=$((fail+1))
  fi
}

run_with_node_marker() { # $1 root, $2 session_id, $3 marker file -> sets $output and $rc; any
  # `node` the gate shells out to (Check 0-7) is intercepted by a fake PATH entry that appends to
  # the marker before delegating to the REAL node, so a real heavy run still completes correctly
  # while leaving unambiguous evidence it ran (BL-0044: proves the fast-path actually skips work,
  # not just that it returns rc=0 — a check that cannot fail proves nothing, constitution §24).
  local real_node fakebin payload
  real_node=$(command -v node)
  fakebin=$(mktemp -d)
  cat > "$fakebin/node" <<EOF
#!/bin/bash
echo invoked >> "$3"
exec "$real_node" "\$@"
EOF
  chmod +x "$fakebin/node"
  payload=$(printf '{"cwd":%s,"session_id":%s}' "$(jq -Rs . <<< "$1")" "$(jq -Rs . <<< "$2")")
  output=$(printf '%s' "$payload" | PATH="$fakebin:$PATH" bash "$GATE" 2>&1)
  rc=$?
  rm -rf "$fakebin"
}

check_stop_nodeinvoked() { # $1 label, $2 expected rc, $3 root, $4 session_id, $5 expect_node_invoked(0/1)
  local marker invoked ok
  marker=$(mktemp -u)
  run_with_node_marker "$3" "$4" "$marker"
  invoked=0
  [ -s "$marker" ] && invoked=1
  ok=1
  [ "$rc" = "$2" ] || ok=0
  [ "$invoked" = "$5" ] || ok=0
  if [ "$ok" = "1" ]; then
    echo "  ✓ $1"; pass=$((pass+1))
  else
    echo "  ✗ $1 (expected rc=$2 node_invoked=$5, got rc=$rc node_invoked=$invoked): $output"; fail=$((fail+1))
  fi
  rm -f "$marker"
}

make_fixture() { # builds a minimal factory-shaped tree from the real repo
  local d
  d=$(mktemp -d)
  mkdir -p "$d/factory/standards" "$d/plugin/scripts" "$d/plugin/agents" \
           "$d/plugin/.claude-plugin" "$d/plugin/.codex-plugin" "$d/plugin/runtime" "$d/.agents/plugins" "$d/plugins" \
           "$d/mission-control/src/lib/events"
  touch "$d/factory/constitution.md"
  cp "$HERE/plugin/scripts/generate-codex-agents.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/check-runtime-sources.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/generate-skill-capabilities.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/check-skill-capabilities.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/generate-build-prompt-fragments.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/generate-engine.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/check-rollup-writer-boundary.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/generate-codex-enforcement.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/generate-event-vocabulary.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/test-runtime-switch.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/resolve-build-run-id.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/launch-codex-implement.sh" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/collect-codex-unattended-evidence.mjs" "$d/plugin/scripts/"
  cp "$HERE/plugin/scripts/test-r10-certification-permit.mjs" "$d/plugin/scripts/"
  cp "$HERE"/plugin/runtime/*.json "$d/plugin/runtime/"
  cp "$HERE/plugin/runtime/build-state.mjs" "$d/plugin/runtime/"
  cp "$HERE/plugin/runtime/event-transport.mjs" "$d/plugin/runtime/"
  mkdir -p "$d/plugin/runtime/codex"
  cp "$HERE/plugin/runtime/codex/"{attended-permit.mjs,certification-permit.mjs,executor.mjs,failure-diagnostics.mjs,schema-contract.mjs,supervisor.mjs,change-result.schema.json,result.schema.json,review-result.schema.json} "$d/plugin/runtime/codex/"
  cp "$HERE/plugin/runtime/codex/"{R10-CERTIFICATION.md,R11-CERTIFICATION.md} "$d/plugin/runtime/codex/"
  cp "$HERE/factory/standards/agent-portability.md" "$d/factory/standards/"
  mkdir -p "$d/plugin/runtime/prompts" "$d/plugin/runtime/engine" "$d/plugin/templates/shared/.claude/engines"
  cp "$HERE/plugin/runtime/prompts/sync-rollups.md" "$d/plugin/runtime/prompts/"
  cp "$HERE/plugin/runtime/engine/pandacorp-build.src.js" "$d/plugin/runtime/engine/"
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

# 4j. BL-0204: a hand-edited deployable engine artifact (not regenerated from its source) → RED
printf '\n// hand edit\n' >> "$fx/plugin/templates/shared/.claude/engines/pandacorp-build.js"
check "hand-edited engine artifact goes RED" 2 "$fx"
cp "$HERE/plugin/templates/shared/.claude/engines/pandacorp-build.js" "$fx/plugin/templates/shared/.claude/engines/"

# 4k. BL-0204: an engine SOURCE edit without regenerating the artifact → RED
printf '\nconst __driftCanary = 1\n' >> "$fx/plugin/runtime/engine/pandacorp-build.src.js"
check "engine source edited without regenerating the artifact goes RED" 2 "$fx"
cp "$HERE/plugin/runtime/engine/pandacorp-build.src.js" "$fx/plugin/runtime/engine/"
check "restored engine source + artifact pass again" 0 "$fx"

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

# 8. BL-0121: a linked `git worktree` never inherits gitignored per-machine state
# (factory/gamification-ledger.json, DR-033) — its absence there must PASS, while a main
# checkout missing it must still RED (real precious-state loss, not worktree noise).
wx=$(make_fixture)
( cd "$wx" \
    && git init -q \
    && printf 'factory/gamification-ledger.json\n' > .gitignore \
    && git add .gitignore \
    && git -c user.email=test@pandacorp.local -c user.name="Pandacorp Test" add -A \
    && git -c user.email=test@pandacorp.local -c user.name="Pandacorp Test" commit -q -m "fixture baseline" )
wt=$(mktemp -d) && rm -rf "$wt"
( cd "$wx" && git worktree add -q "$wt" -b bl-0121-test-worktree >/dev/null 2>&1 )
check "linked worktree without ledger PASSES (was wrongly RED)" 0 "$wt"
cp "$wx/factory/gamification-ledger.json" "$wt/factory/gamification-ledger.json"
check "linked worktree WITH ledger present still passes" 0 "$wt"
rm "$wt/factory/gamification-ledger.json"
check "linked worktree without ledger still passes after removal" 0 "$wt"
( cd "$wx" && git worktree remove -f "$wt" >/dev/null 2>&1 )
rm -rf "$wt"
rm "$wx/factory/gamification-ledger.json"
check "main checkout without ledger still REDs (unchanged, real signal)" 2 "$wx"
rm -rf "$wx"

# 9. BL-0082: session-attribution guard on a dirty plugin-metadata.json (parallel-session
# in-flight edit, DR-099 spirit). Needs a real git repo (main checkout) so the gate's own
# `git status --porcelain` can see the uncommitted source edit.
gy=$(make_fixture)
( cd "$gy" && git init -q \
    && git -c user.email=test@pandacorp.local -c user.name="Pandacorp Test" add -A \
    && git -c user.email=test@pandacorp.local -c user.name="Pandacorp Test" commit -q -m "fixture baseline" )
# The gate resolves ROOT via `git rev-parse --show-toplevel`, which realpath's away any symlink
# in the fixture's mktemp path (e.g. macOS /var -> /private/var). Touched-file entries must be
# written against that SAME resolved root, exactly like the real producer (warn-adhoc-write.sh)
# does, or the attribution match below would spuriously miss on a symlinked tmpdir.
gy_root=$(git -C "$gy" rev-parse --show-toplevel)

# Simulate another session's in-flight, uncommitted edit to the manifest SOURCE (not yet
# regenerated) -- this is exactly the 2026-07-15 PROMPT-8-vs-9.97.0 scenario from the BL.
jq '.version = "0.0.1-inflight"' "$gy/plugin/runtime/plugin-metadata.json" > "$gy/tmp.json" \
  && mv "$gy/tmp.json" "$gy/plugin/runtime/plugin-metadata.json"

# Control (pre-existing behavior, unchanged): manual/positional invocation carries no session
# context to attribute against, so it keeps blocking on the real drift exactly as before.
check "BL-0082 manual invocation (no session context) still blocks on real drift" 2 "$gy"

# This session (sid-innocent) never touched plugin-metadata.json or the manifests -> the dirty
# source belongs to a PARALLEL session -> FOREIGN drift -> WARN, Stop is NOT blocked.
mkdir -p "$gy/.pandacorp/run/sessions"
: > "$gy/.pandacorp/run/sessions/sid-innocent.touched"
check_stop "BL-0082 foreign in-flight edit WARNS, does not block Stop" 0 "$gy" "sid-innocent"

version_after=$(jq -r '.version' "$gy/plugin/runtime/plugin-metadata.json")
if [ "$version_after" = "0.0.1-inflight" ]; then
  echo "  ✓ BL-0082 WARN path left the foreign in-flight source edit untouched (no auto-regenerate)"; pass=$((pass+1))
else
  echo "  ✗ BL-0082 WARN path modified the foreign session's source edit"; fail=$((fail+1))
fi

# Control: THIS session's OWN touched set DOES include plugin-metadata.json -> the drift is
# attributable to this session -> still REDs/blocks exactly as today.
printf '%s/plugin/runtime/plugin-metadata.json\n' "$gy_root" > "$gy/.pandacorp/run/sessions/sid-owner.touched"
check_stop "BL-0082 own-session edit set still blocks (unchanged)" 2 "$gy" "sid-owner"

rm -rf "$gy"

# 10. BL-0044: fast-path skips the heavy generator re-runs (Check 0-7, which shell out to node)
# when this session's own touched set carries nothing under plugin/ or factory/, the tree has
# nothing dirty under plugin/, and HEAD matches the recorded derived-drift-last-ok.json sha.
gz=$(make_fixture)
( cd "$gz" && git init -q \
    && git -c user.email=test@pandacorp.local -c user.name="Pandacorp Test" add -A \
    && git -c user.email=test@pandacorp.local -c user.name="Pandacorp Test" commit -q -m "fixture baseline" )
gz_root=$(git -C "$gz" rev-parse --show-toplevel)
mkdir -p "$gz/.pandacorp/run/sessions" "$gz/mission-control/src"
: > "$gz/mission-control/src/x.ts"

# Baseline: a manual/positional invocation (no session context) always runs the full check —
# same fail-closed stance as BL-0082 above — and on success it now ALSO records
# derived-drift-last-ok.json at this exact HEAD, which the fast-path below needs.
check "BL-0044 baseline clean run (manual invocation, always full)" 0 "$gz"
if [ -f "$gz/.pandacorp/run/derived-drift-last-ok.json" ] \
   && [ "$(jq -r .sha "$gz/.pandacorp/run/derived-drift-last-ok.json")" = "$(git -C "$gz" rev-parse HEAD)" ]; then
  echo "  ✓ BL-0044 baseline run wrote derived-drift-last-ok.json at HEAD"; pass=$((pass+1))
else
  echo "  ✗ BL-0044 baseline run did not record derived-drift-last-ok.json correctly"; fail=$((fail+1))
fi

# A Mission Control session that only touched mission-control/src/x.ts (nothing under plugin/ or
# factory/), on an otherwise clean tree at the recorded ok sha -> fast-path, node never runs.
printf '%s/mission-control/src/x.ts\n' "$gz_root" > "$gz/.pandacorp/run/sessions/sid-mc.touched"
check_stop_nodeinvoked "BL-0044 MC-only touched session -> fast-path, no node runs" 0 "$gz" "sid-mc" 0

# A session that touched plugin/agents/x.md -> disqualified by (a), full check runs (node invoked).
printf '%s/plugin/agents/x.md\n' "$gz_root" > "$gz/.pandacorp/run/sessions/sid-plugin.touched"
check_stop_nodeinvoked "BL-0044 plugin/ touched session -> full check runs, node invoked" 0 "$gz" "sid-plugin" 1

rm -rf "$gz"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
