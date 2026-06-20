#!/bin/bash
# Pandacorp Stop gate: prevents declaring "done" with a broken project.
# Runs the project's own .pandacorp/verify.sh if it exists (created by /pandacorp:blueprint).
# Exit 2 = keep working (stderr shown to the model). Exit 0 = allow stop.
#
# PHASE-AWARE (DR-063): the strict whole-project suite must NOT run as the gate of EVERY Stop
# while an incremental build is ACTIVE — mid-build the tree is legitimately red between safe
# points (a WO in flight, untracked files yet to pass their self-test), so a strict gate would
# block every turn (in the building session AND in any other session parked at this cwd in a
# shared repo). During an active build the engine OWNS enforcement — per-FRD (`verify.sh --since`)
# and the full suite at close-out — so the Stop gate steps aside. It re-engages the moment the
# build ends (lock gone or stale).

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // "."')

# Avoid infinite loops: if a previous Stop hook already fired in this turn, let it stop.
stop_active=$(echo "$input" | jq -r '.stop_hook_active // false')
[ "$stop_active" = "true" ] && exit 0

# Scope: only Pandacorp projects with a verify script — its presence in .pandacorp/ IS the marker
verify="$cwd/.pandacorp/verify.sh"
[ -f "$verify" ] || exit 0

# Phase-aware skip (DR-063): a FRESH build lock means a build is running right now → no-op.
# The supervisor (the agent running /pandacorp:implement) touches .pandacorp/run/build.lock at
# launch and on every ~2-min heartbeat; `find -mmin -10` treats a lock untouched for ≥10 min as
# stale (supervisor died) and ignores it, so the gate auto-re-engages — same TTL as the
# concurrent-run guard (DR-050 §9). The folder .pandacorp/run/ is gitignored runtime state.
lock="$cwd/.pandacorp/run/build.lock"
if [ -f "$lock" ] && [ -n "$(find "$lock" -mmin -10 2>/dev/null)" ]; then
  exit 0   # active build → delegate the gate to the engine (per-FRD + close-out)
fi

out=$(bash "$verify" 2>&1)
if [ $? -ne 0 ]; then
  echo "Pandacorp verify gate FAILED — you can't finish with a broken project." >&2
  echo "Rule that failed: .pandacorp/verify.sh (tests + typecheck + lint must pass)." >&2
  echo "Fix the root cause; do NOT tweak the test to pass or declare it 'done'." >&2
  echo "--- verify.sh output (last 30 lines) ---" >&2
  echo "$out" | tail -30 >&2
  exit 2
fi

exit 0
