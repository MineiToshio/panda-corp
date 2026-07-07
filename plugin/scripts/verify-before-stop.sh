#!/bin/bash
# Pandacorp Stop gate: prevents declaring "done" with a broken project.
# Runs the project's own .pandacorp/verify.sh if it exists (created by /pandacorp:architecture).
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
# concurrent-run guard (DR-050 §11). The folder .pandacorp/run/ is gitignored runtime state.
lock="$cwd/.pandacorp/run/build.lock"
if [ -f "$lock" ] && [ -n "$(find "$lock" -mmin -10 2>/dev/null)" ]; then
  exit 0   # active build → delegate the gate to the engine (per-FRD + close-out)
fi

# Producer liveness also counts (DR-066): a build is active when status.yaml's `last_event_at` OR
# `supervisor_heartbeat` is < 10 min old — the engine advances last_event_at at each safe point and
# the supervisor writes the heartbeat, so either being fresh means a build owns enforcement right now.
# This backstops a lock the supervisor forgot to touch while a long, quiet agent is still working. Same
# 10-min TTL as the lock + the concurrent-run guard; when both go stale the gate auto-re-engages.
status_yaml="$cwd/.pandacorp/status.yaml"
if [ -f "$status_yaml" ]; then
  _pc_epoch() { # iso -> epoch seconds (BSD/GNU tolerant, fractional secs stripped)
    local ts; ts="$(printf '%s' "${1:-}" | sed -E 's/\.[0-9]+//; s/Z$//')"
    [ -n "$ts" ] || { echo ""; return; }
    date -u -d "${ts}Z" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%S" "$ts" +%s 2>/dev/null || echo ""
  }
  _pc_yaml() { grep -E "^$1:" "$status_yaml" 2>/dev/null | head -1 \
    | sed -E "s/^$1:[[:space:]]*//; s/[[:space:]]*#.*$//; s/[[:space:]]*$//; s/^\"//; s/\"$//; s/^'//; s/'$//"; }
  _pc_now=$(date -u +%s)
  for _pc_k in last_event_at supervisor_heartbeat; do
    _pc_e=$(_pc_epoch "$(_pc_yaml "$_pc_k")")
    if [ -n "$_pc_e" ] && [ $((_pc_now - _pc_e)) -lt 600 ]; then
      exit 0   # producer live → active build → delegate the gate to the engine
    fi
  done
fi

out=$(bash "$verify" 2>&1)
if [ $? -ne 0 ]; then
  # The gate is RED. Attribute BEFORE nagging (DR-099): in a SHARED checkout the whole-program gate
  # also fails on ANOTHER session's in-flight WIP. If NONE of the files THIS session edited are
  # implicated — neither dirty (uncommitted) nor blamed by the output — it is a FOREIGN red → allow
  # the stop SILENTLY and do NOT narrate it (cross-session status is PULL, in Mission Control, never
  # noise pushed into a conversation). FAIL-CLOSED: if any touched file is implicated, OR we can't
  # attribute (no per-session edit record), BLOCK. Never silence a red that might be yours.
  sid=$(echo "$input" | jq -r '.session_id // ""')
  touched="$cwd/.pandacorp/run/sessions/$sid.touched"
  dirty_raw=$(git -C "$cwd" status --porcelain 2>/dev/null)
  repo_root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)
  prefix=$(git -C "$cwd" rev-parse --show-prefix 2>/dev/null)   # cwd relative to repo root, e.g. "mission-control/"
  foreign=0
  # Attribute by NORMALIZED repo-relative paths, not basenames (DR-099 hardening): two files sharing
  # a basename in different folders must not cross-attribute (the old basename match could silence an
  # owned failure or block on a foreign one). git porcelain is already repo-root-relative; `.touched`
  # paths are absolute; verify.sh output is cwd-relative (the tools run from the project dir) — so all
  # three are reduced to the repo-root frame before intersecting. Fail-closed: with no git root we
  # cannot attribute → leave foreign=0 (block, show the red), never a silent allow.
  if [ -n "$sid" ] && [ -s "$touched" ] && [ -n "$repo_root" ]; then
    mine=$(sed "s#^${repo_root}/##" "$touched" | sort -u)                                       # repo-relative files I edited
    dirty=$(printf '%s\n' "$dirty_raw" | sed 's/^...//; s/.* -> //' | sort -u)                   # repo-relative dirty paths
    # File-like tokens from the gate output: absolute → strip repo root; relative → also emit the
    # cwd-prefixed form (src/x.ts → mission-control/src/x.ts) so it matches `mine`/`dirty`. Emitting
    # the extra repo-relative candidate only biases toward BLOCK (safe), never toward silencing own red.
    failing=$(printf '%s\n' "$out" \
      | grep -oE '(/?[A-Za-z0-9_.@-]+/)*[A-Za-z0-9_.@-]+\.(ts|tsx|js|jsx|mjs|cjs|css|scss|md|json|ya?ml|png)' \
      | while IFS= read -r p; do
          if [ "${p#/}" != "$p" ]; then
            printf '%s\n' "${p#$repo_root/}"          # absolute → strip repo root
          else
            printf '%s\n' "$p" "${prefix}${p}"        # relative → keep + cwd-prefixed candidate
          fi
        done | sort -u)
    mine_dirty=$(comm -12 <(printf '%s\n' "$mine") <(printf '%s\n' "$dirty"))
    mine_failing=$(comm -12 <(printf '%s\n' "$mine") <(printf '%s\n' "$failing"))
    if [ -z "$mine_dirty" ] && [ -z "$mine_failing" ] && { [ -n "$dirty_raw" ] || [ -n "$failing" ]; }; then
      foreign=1   # none of MY edits are implicated, and there IS foreign evidence to blame → foreign red
    fi
  fi
  if [ "$foreign" = "1" ]; then
    # Foreign red: allow the stop with NO stderr (silence — the owner is never nagged about it). Log it
    # for PULL visibility only (Mission Control / pending-work surface cross-session state, not the chat).
    mkdir -p "$cwd/.pandacorp/run" 2>/dev/null
    printf '%s\tforeign-red: allowed stop — gate red only in files this session did not touch (session %s)\n' \
      "$(date -u +%FT%TZ 2>/dev/null || echo now)" "$sid" >> "$cwd/.pandacorp/run/foreign-red.log" 2>/dev/null
    exit 0
  fi
  echo "Pandacorp verify gate FAILED — you can't finish with a broken project." >&2
  echo "Rule that failed: .pandacorp/verify.sh (tests + typecheck + lint must pass)." >&2
  echo "Fix the root cause; do NOT tweak the test to pass or declare it 'done'." >&2
  # This red is attributable to THIS session (a touched file is dirty or blamed) OR could not be
  # attributed (no per-session record) — so it is shown. Still NEVER edit another session's files or
  # run --update-snapshots to force green (DR-093 no-sweep); fix only what YOU changed (DR-096/099).
  dirty_show=$(printf '%s\n' "$dirty_raw" | head -20)
  if [ -n "$dirty_show" ]; then
    echo "--- uncommitted files in the tree (some may be another session's WIP — verify ownership, DR-096) ---" >&2
    echo "$dirty_show" >&2
    echo "A failure isolated to files you did NOT touch is foreign — report it, don't fix it." >&2
  fi
  echo "--- verify.sh output (last 30 lines) ---" >&2
  echo "$out" | tail -30 >&2
  exit 2
fi

exit 0
