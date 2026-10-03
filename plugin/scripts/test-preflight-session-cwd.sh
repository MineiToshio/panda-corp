#!/bin/bash
# Self-test for preflight-implement.sh's session-cwd advisory (BL-0220). Claude Code injects the
# CLAUDE.md / AGENTS.md chain of the LAUNCHING session's cwd into every Workflow subagent, whatever
# cwd the engine later cds them to (verified: 160/160 engine agents of the 2026-10-01 bench received
# Mission Control's chain while building pandacorp-bench-form/bench-implement). So a launch from a
# cwd outside the project must WARN (advisory only: it never turns the preflight RED).
#
# Hermetic: a synthetic project and cwds under mktemp; the real installed_plugins.json is never read.
# Run from the repo root: bash plugin/scripts/test-preflight-session-cwd.sh
set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
PREFLIGHT="$HERE/plugin/scripts/preflight-implement.sh"
pass=0; fail=0
ok() { if [ "$1" = "1" ]; then echo "  ✓ $2"; pass=$((pass+1)); else echo "  ✗ $2"; fail=$((fail+1)); fi; }

TMPROOT=$(mktemp -d)
TMPROOT=$(cd "$TMPROOT" && pwd -P)
trap 'rm -rf "$TMPROOT"' EXIT

FAKE_HOME="$TMPROOT/home"; mkdir -p "$FAKE_HOME"
PROJECT="$TMPROOT/sibling/project"
mkdir -p "$PROJECT/.pandacorp" "$PROJECT/docs/frds" "$PROJECT/src/deep" "$TMPROOT/elsewhere" "$TMPROOT/sibling/other"
OVERLAY=$(head -1 "$HERE/plugin/templates/OVERLAY_VERSION" | tr -d '[:space:]')
printf 'phase: implementation\nrunning: false\noverlay_version: %s\n' "$OVERLAY" > "$PROJECT/.pandacorp/status.yaml"

run_from() { # $1 cwd  $2 project argument
  (cd "$1" && HOME="$FAKE_HOME" bash "$PREFLIGHT" "$2" 2>&1)
}

# (1) launched from an unrelated cwd -> WARN naming both paths, still exit 0.
OUT1=$(run_from "$TMPROOT/elsewhere" "$PROJECT"); RC1=$?
ok "$([ "$RC1" = 0 ] && echo 1 || echo 0)" "(1) outside cwd still exits 0 (advisory only)"
ok "$(echo "$OUT1" | grep -q "== 0 failing check(s) ==" && echo 1 || echo 0)" "(1) outside cwd reports 0 failing checks"
ok "$(echo "$OUT1" | grep -q "WARN.*CLAUDE.md" && echo 1 || echo 0)" "(1) WARN names the injected CLAUDE.md chain"
ok "$(echo "$OUT1" | grep "WARN.*CLAUDE.md" | grep -q "$TMPROOT/elsewhere" && echo 1 || echo 0)" "(1) WARN names the session cwd"
ok "$(echo "$OUT1" | grep "WARN.*CLAUDE.md" | grep -q "$PROJECT" && echo 1 || echo 0)" "(1) WARN names the project"

# (2) a PARENT cwd (the nested-project case: factory root launching mission-control) -> still WARN,
#     the parent's chain is what gets injected, never the project's own.
OUT2=$(run_from "$TMPROOT/sibling" "$PROJECT")
ok "$(echo "$OUT2" | grep -q "WARN.*CLAUDE.md" && echo 1 || echo 0)" "(2) a parent cwd of the project WARNs"

# (3) a sibling project's cwd -> WARN.
OUT3=$(run_from "$TMPROOT/sibling/other" "$PROJECT")
ok "$(echo "$OUT3" | grep -q "WARN.*CLAUDE.md" && echo 1 || echo 0)" "(3) a sibling cwd WARNs"

# (4) cwd == project (relative '.') -> PASS, no WARN.
OUT4=$(run_from "$PROJECT" "."); RC4=$?
ok "$([ "$RC4" = 0 ] && echo 1 || echo 0)" "(4) cwd == project exits 0"
ok "$(echo "$OUT4" | grep -q "PASS  session cwd is inside the project" && echo 1 || echo 0)" "(4) PASS line present"
ok "$([ "$(echo "$OUT4" | grep -c 'WARN.*CLAUDE.md')" = "0" ] && echo 1 || echo 0)" "(4) no WARN when launched from the project"

# (5) cwd == a subdirectory of the project -> PASS (the walk-up finds the project's own chain).
OUT5=$(run_from "$PROJECT/src/deep" "$PROJECT")
ok "$(echo "$OUT5" | grep -q "PASS  session cwd is inside the project" && echo 1 || echo 0)" "(5) a subdirectory cwd PASSes"
ok "$([ "$(echo "$OUT5" | grep -c 'WARN.*CLAUDE.md')" = "0" ] && echo 1 || echo 0)" "(5) no WARN from a subdirectory"

# (6) a symlinked project path resolves to the same real dir -> PASS.
ln -s "$PROJECT" "$TMPROOT/link"
OUT6=$(run_from "$PROJECT" "$TMPROOT/link")
ok "$(echo "$OUT6" | grep -q "PASS  session cwd is inside the project" && echo 1 || echo 0)" "(6) a symlinked project path compares by real path"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
