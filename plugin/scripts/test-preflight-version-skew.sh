#!/bin/bash
# Self-test for preflight-implement.sh's session-vs-installed plugin version-skew warning (BL-0152,
# the preventive half of BL-0141: a session's plugin updates only at restart, so it can launch a
# NEWER installed engine that requires an agentType its own runtime never heard of, e.g.
# 'pandacorp:mech', WP-03). Exercises the REAL preflight-implement.sh against a synthetic fake
# "session's own plugin copy" (runtime/plugin-metadata.json + agents/*.md next to the script,
# mirroring how ${CLAUDE_PLUGIN_ROOT}/scripts/preflight-implement.sh actually resolves) and a
# synthetic $HOME/.claude/plugins/installed_plugins.json, so the real global installed_plugins.json
# is never read or written (hermetic — quality-and-testing.md).
#
# Both checks are ADVISORY ONLY (BL-0152 "Out of scope": never blocks the launch) — every scenario
# below still expects "== 0 failing check(s) ==" and exit 0, proving the warning never turns RED.
#
# Run from the repo root: bash plugin/scripts/test-preflight-version-skew.sh
set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
PREFLIGHT_SRC="$HERE/plugin/scripts/preflight-implement.sh"
LIVENESS_SRC="$HERE/plugin/scripts/check-build-liveness.sh"
ENGINE_SRC="$HERE/plugin/templates/shared/.claude/engines/pandacorp-build.js"
pass=0; fail=0

ok() { if [ "$1" = "1" ]; then echo "  ✓ $2"; pass=$((pass+1)); else echo "  ✗ $2"; fail=$((fail+1)); fi; }

TMPROOT=$(mktemp -d)
TMPROOT=$(cd "$TMPROOT" && pwd -P)
trap 'rm -rf "$TMPROOT"' EXIT

# ── fake "session's own plugin copy" — scripts/ + runtime/ + agents/, exactly what a real cache ──
# copy (~/.claude/plugins/cache/panda-corp/pandacorp/<ver>/) looks like from preflight's own PoV.
FAKE_PLUGIN="$TMPROOT/fake-plugin"
mkdir -p "$FAKE_PLUGIN/scripts" "$FAKE_PLUGIN/runtime" "$FAKE_PLUGIN/agents"
cp "$PREFLIGHT_SRC" "$FAKE_PLUGIN/scripts/preflight-implement.sh"
cp "$LIVENESS_SRC" "$FAKE_PLUGIN/scripts/check-build-liveness.sh"
chmod +x "$FAKE_PLUGIN/scripts/preflight-implement.sh" "$FAKE_PLUGIN/scripts/check-build-liveness.sh"

write_session_metadata() { # $1 version
  printf '{"name":"pandacorp","version":"%s"}\n' "$1" > "$FAKE_PLUGIN/runtime/plugin-metadata.json"
}
write_full_agents() { # the complete real roster, including mech (no skew)
  for slug in analytics architect backend-dev copywriter designer devops drift-finder frontend-dev implementer \
              librarian mech product-manager researcher reviewer security-auditor test-writer; do
    printf '# %s\n' "$slug" > "$FAKE_PLUGIN/agents/$slug.md"
  done
}
write_agents_missing_mech() { # the pre-WP-03 roster — exactly the BL-0141 incident's session shape
  for slug in analytics architect backend-dev copywriter designer devops drift-finder frontend-dev implementer \
              librarian product-manager researcher reviewer security-auditor test-writer; do
    printf '# %s\n' "$slug" > "$FAKE_PLUGIN/agents/$slug.md"
  done
  rm -f "$FAKE_PLUGIN/agents/mech.md"
}
write_agents_missing_reviewer() { # an ORACLE type absent (DR-015 — no fallback judge) — must go RED
  for slug in analytics architect backend-dev copywriter designer devops drift-finder frontend-dev implementer \
              librarian mech product-manager researcher security-auditor test-writer; do
    printf '# %s\n' "$slug" > "$FAKE_PLUGIN/agents/$slug.md"
  done
  rm -f "$FAKE_PLUGIN/agents/reviewer.md"
}

# ── fake $HOME/.claude/plugins/installed_plugins.json — never the real one ─────────────────────
FAKE_HOME="$TMPROOT/fake-home"
write_installed_plugins() { # $1 version
  mkdir -p "$FAKE_HOME/.claude/plugins"
  cat > "$FAKE_HOME/.claude/plugins/installed_plugins.json" <<EOF
{"version":2,"plugins":{"pandacorp@panda-corp":[{"scope":"user","version":"$1","installPath":"/x"}]}}
EOF
}

# ── fake project — status.yaml (running: false, no overlay check noise) + the real engine copy ──
PROJECT="$TMPROOT/project"
setup_project() {
  rm -rf "$PROJECT"
  mkdir -p "$PROJECT/.pandacorp" "$PROJECT/.claude/engines" "$PROJECT/docs/frds"
  cat > "$PROJECT/.pandacorp/status.yaml" <<'EOF'
phase: implementation
running: false
EOF
  cp "$ENGINE_SRC" "$PROJECT/.claude/engines/pandacorp-build.js"
}
setup_project

run_preflight() { # invokes the REAL script under the fake session plugin copy + fake HOME
  HOME="$FAKE_HOME" bash "$FAKE_PLUGIN/scripts/preflight-implement.sh" "$PROJECT" 2>&1
}

# ═══════════════════════════════════════════════════════════════════════════════════════════════
# (1) SKEW — session older than installed -> WARN "reinicia la sesión", never blocks.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
write_session_metadata "9.102.3"
write_agents_missing_mech        # the real BL-0141 incident's session shape (pre-WP-03)
write_installed_plugins "9.104.5"
OUT1=$(run_preflight); RC1=$?
ok "$([ "$RC1" = 0 ] && echo 1 || echo 0)" "(1) skewed session still exits 0 (advisory only)"
ok "$(echo "$OUT1" | grep -q "== 0 failing check(s) ==" && echo 1 || echo 0)" "(1) skewed session reports 0 failing checks"
ok "$(echo "$OUT1" | grep -q "WARN.*reinicia la sesión" && echo 1 || echo 0)" "(1) version-skew WARN fires with the 'reinicia la sesión' message"
ok "$(echo "$OUT1" | grep -q "9.102.3" && echo "$OUT1" | grep -q "9.104.5" && echo 1 || echo 0)" "(1) WARN names both versions (session 9.102.3, installed 9.104.5)"
ok "$(echo "$OUT1" | grep -q "WARN.*pandacorp:mech" && echo 1 || echo 0)" "(1) missing-agentType WARN also fires, naming pandacorp:mech"

# ═══════════════════════════════════════════════════════════════════════════════════════════════
# (2) MATCH — session version == installed version -> PASS, no skew WARN.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
write_session_metadata "9.104.5"
write_full_agents
write_installed_plugins "9.104.5"
OUT2=$(run_preflight); RC2=$?
ok "$([ "$RC2" = 0 ] && echo 1 || echo 0)" "(2) matched versions exits 0"
ok "$(echo "$OUT2" | grep -q "PASS  session plugin version matches installed (9.104.5)" && echo 1 || echo 0)" "(2) matched-version PASS line present"
ok "$([ "$(echo "$OUT2" | grep -c 'reinicia la sesión')" = "0" ] && echo 1 || echo 0)" "(2) no version-skew WARN on a match"
ok "$([ "$(echo "$OUT2" | grep -c 'agentType(s) que esta sesión no tiene')" = "0" ] && echo 1 || echo 0)" "(2) no missing-agentType WARN when every agent is present"
ok "$(echo "$OUT2" | grep -q "PASS  every engine agentType" && echo 1 || echo 0)" "(2) engine-agentType-coverage PASS line present"

# ═══════════════════════════════════════════════════════════════════════════════════════════════
# (3) SESSION AHEAD of installed (factory development: main newer than the last `claude plugin
#     update` sync) -> silent PASS, never a false-positive WARN.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
write_session_metadata "9.105.0"
write_full_agents
write_installed_plugins "9.104.5"
OUT3=$(run_preflight); RC3=$?
ok "$([ "$RC3" = 0 ] && echo 1 || echo 0)" "(3) session-ahead-of-installed exits 0"
ok "$(echo "$OUT3" | grep -q "PASS.*ahead of the installed manifest" && echo 1 || echo 0)" "(3) session-ahead PASS line present"
ok "$([ "$(echo "$OUT3" | grep -c 'reinicia la sesión')" = "0" ] && echo 1 || echo 0)" "(3) no false-positive WARN when the session is ahead"

# ═══════════════════════════════════════════════════════════════════════════════════════════════
# (4) NO MARKETPLACE INSTALL — installed_plugins.json absent (factory-dev checkout, no `claude
#     plugin install`) -> the version-skew check degrades to total silence, not a WARN.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
write_session_metadata "9.104.5"
write_full_agents
rm -f "$FAKE_HOME/.claude/plugins/installed_plugins.json"
OUT4=$(run_preflight); RC4=$?
ok "$([ "$RC4" = 0 ] && echo 1 || echo 0)" "(4) missing installed_plugins.json still exits 0"
ok "$([ "$(echo "$OUT4" | grep -ci 'session plugin')" = "0" ] && echo 1 || echo 0)" "(4) no session/installed version line at all when the installed manifest is absent (silent degrade)"
ok "$(echo "$OUT4" | grep -q "PASS  every engine agentType" && echo 1 || echo 0)" "(4) the independent agentType-coverage check still runs"

# ═══════════════════════════════════════════════════════════════════════════════════════════════
# (5) MISSING ORACLE AGENT (reviewer) -> RED, not advisory. DR-015: an oracle type with no fallback
#     must stop the launch instead of letting the engine silently substitute a non-judge at gate
#     time. A non-oracle gap (mech, tested in (1)) must stay WARN-only — proven by re-asserting the
#     same (1) assertions here are untouched by this scenario's own no-mech-missing setup.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
write_session_metadata "9.104.5"
write_agents_missing_reviewer
write_installed_plugins "9.104.5"
OUT5=$(run_preflight); RC5=$?
ok "$([ "$RC5" != 0 ] && echo 1 || echo 0)" "(5) missing ORACLE agentType (reviewer) makes preflight exit non-zero"
ok "$([ "$(echo "$OUT5" | grep -oE '== [0-9]+ failing check' | grep -oE '[0-9]+')" -ge 1 ] 2>/dev/null && echo 1 || echo 0)" "(5) failing-check count is >= 1"
ok "$(echo "$OUT5" | grep -q "FAIL.*ORÁCULO sin fallback" && echo 1 || echo 0)" "(5) FAIL line names the missing-oracle reason (DR-015)"
ok "$(echo "$OUT5" | grep -q "FAIL.*pandacorp:reviewer" && echo 1 || echo 0)" "(5) FAIL line names pandacorp:reviewer"
ok "$([ "$(echo "$OUT5" | grep -c 'agentType(s) que esta sesión no tiene instalados')" = "0" ] && echo 1 || echo 0)" "(5) no separate advisory WARN duplicate for the same missing oracle type"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
