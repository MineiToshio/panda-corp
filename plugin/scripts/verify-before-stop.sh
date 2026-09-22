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

if ! command -v jq >/dev/null 2>&1; then
  echo "Pandacorp Stop gate cannot parse its payload because jq is missing — failing closed." >&2
  exit 2
fi

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // "."')
hook_runtime=$(echo "$input" | jq -r '.pandacorp_runtime // "claude"')
case "$hook_runtime" in claude|codex) : ;; *) echo "Pandacorp Stop gate received an invalid runtime adapter — failing closed." >&2; exit 2 ;; esac

# Avoid infinite loops: if a previous Stop hook already fired in this turn, let it stop.
stop_active=$(echo "$input" | jq -r '.stop_hook_active // false')
[ "$stop_active" = "true" ] && exit 0

# Scope: only Pandacorp projects with a verify script — its presence in .pandacorp/ IS the marker
verify="$cwd/.pandacorp/verify.sh"
[ -f "$verify" ] || exit 0

# R2/R3 ownership rule: a lease suppresses this Stop gate only for the SAME certified runtime.
# Codex is deliberately NOT a verification owner: R3 arms its hooks, but build writes are
# read/review-only for every non-Claude runtime, frozen by DR-120 (2026-09-02) with no promotion
# path open until its reopen trigger fires. Therefore a Codex hook always runs verify.sh;
# a crashed/foreign Codex lease can never silence verification. Claude keeps the known-good skip.
lease="$cwd/.pandacorp/run/build.lease/lease.json"
lease_live=0
if [ -f "$lease" ]; then
  lease_runtime=$(jq -er '.runtime | select(. == "claude" or . == "codex")' "$lease" 2>/dev/null) || {
    echo "Pandacorp Stop gate cannot validate the build lease — failing closed." >&2
    exit 2
  }
  lease_renewed=$(jq -er '.renewed_at | strings' "$lease" 2>/dev/null) || exit 2
  lease_ttl=$(jq -er '.ttl_seconds | numbers | select(. >= 3)' "$lease" 2>/dev/null) || exit 2
  _pc_lease_ts=$(printf '%s' "$lease_renewed" | sed -E 's/\.[0-9]+//; s/Z$//')
  _pc_lease_epoch=$(date -u -d "${_pc_lease_ts}Z" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%S" "$_pc_lease_ts" +%s 2>/dev/null || echo "")
  [ -n "$_pc_lease_epoch" ] || { echo "Pandacorp Stop gate cannot parse lease freshness — failing closed." >&2; exit 2; }
  [ $(( $(date -u +%s) - _pc_lease_epoch )) -lt "$lease_ttl" ] && lease_live=1
  if [ "$lease_live" = "1" ] && [ "$hook_runtime" = "claude" ] && [ "$lease_runtime" = "claude" ]; then
    exit 0
  fi
fi

# Legacy phase-aware skip (DR-063): applies ONLY to the known-good Claude path while R2 is projected.
# A Codex payload never trusts a legacy build.lock/heartbeat because those signals carry no owner
# token and could otherwise suppress its Stop gate.
# The supervisor (the agent running /pandacorp:implement) touches .pandacorp/run/build.lock at
# launch and on every ~2-min heartbeat; `find -mmin -10` treats a lock untouched for ≥10 min as
# stale (supervisor died) and ignores it, so the gate auto-re-engages — same TTL as the
# concurrent-run guard (DR-050 §11). The folder .pandacorp/run/ is gitignored runtime state.
lock="$cwd/.pandacorp/run/build.lock"
if [ "$hook_runtime" = "claude" ] && [ ! -f "$lease" ] && [ -f "$lock" ] && [ -n "$(find "$lock" -mmin -10 2>/dev/null)" ]; then
  exit 0   # active build → delegate the gate to the engine (per-FRD + close-out)
fi

# Producer liveness also counts (DR-066): a build is active when status.yaml's `last_event_at` OR
# `supervisor_heartbeat` is < 10 min old — the engine advances last_event_at at each safe point and
# the supervisor writes the heartbeat, so either being fresh means a build owns enforcement right now.
# This backstops a lock the supervisor forgot to touch while a long, quiet agent is still working. Same
# 10-min TTL as the lock + the concurrent-run guard; when both go stale the gate auto-re-engages.
status_yaml="$cwd/.pandacorp/status.yaml"
if [ "$hook_runtime" = "claude" ] && [ ! -f "$lease" ] && [ -f "$status_yaml" ]; then
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

# FAST-PATH (BL-0044): skip the whole-program verify.sh gate when nothing could have changed
# since the last GREEN run recorded for this EXACT commit. Three conditions, ALL must hold, or
# the gate runs exactly as before — any doubt falls through to the real gate (fail-closed):
#   (a) the working tree is clean (`git status --porcelain` empty — git already excludes
#       gitignored paths by default, so gitignored runtime state never blocks the fast-path)
#   (b) HEAD matches the sha of the last GREEN run recorded in last-green.json, written ONLY by
#       THIS hook below when verify.sh exits 0 (no other writer) — a new commit moves HEAD and
#       invalidates the fast-path by construction
#   (c) this session's own .touched marker (DR-099) is absent or empty — a session that wrote
#       nothing has nothing new for the gate to catch, even if some OTHER session committed.
#       D8: a MISSING/empty session_id is NOT an empty-touched session — it means the hook cannot
#       even NAME this session's marker, so it cannot know it wrote nothing. Fail-closed: no sid ⇒
#       no fast-path, ever (falls through to the real gate below).
sid=$(echo "$input" | jq -r '.session_id // ""')
touched="$cwd/.pandacorp/run/sessions/$sid.touched"
last_green="$cwd/.pandacorp/run/last-green.json"
fastpath=0
if [ -z "$(git -C "$cwd" status --porcelain 2>/dev/null)" ] && { [ -n "$sid" ] && [ ! -s "$touched" ]; }; then
  head_sha=$(git -C "$cwd" rev-parse HEAD 2>/dev/null)
  if [ -n "$head_sha" ] && [ -f "$last_green" ]; then
    green_sha=$(jq -er '.sha | select(type == "string" and length > 0)' "$last_green" 2>/dev/null)
    [ -n "$green_sha" ] && [ "$green_sha" = "$head_sha" ] && fastpath=1
  fi
fi
if [ "$fastpath" = "1" ]; then
  echo "verify-before-stop: fast-path (clean tree, HEAD==last green ${head_sha})" >&2
  exit 0
fi

# --- RIGOR-SCOPED GATE (F2, memo docs/proposals/37 §A.1) ----------------------------------------
# The rigor of THIS session's own diff decides how much of verify.sh runs before a verdict — it
# NEVER decides whether a red blocks (memo §A.0 principle 3: a red always blocks, in every level).
# Only in scope when this session actually has uncommitted work of its own: a non-empty .touched
# marker (DR-099) AND a dirty tree. A clean tree or an empty marker has no diff of THIS session to
# size a gate to (it may be another session's WIP, or nothing was written) — falls straight through
# to today's unconditional full gate. The rigor lives in this caller, never inside verify.sh
# (memo §A.0 principle 1) — a bare `bash verify.sh` with no flags stays the maximum gate.
HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
gate_args=()
gate_scope="full"
gate_rigor="n/a"
gate_reasons="n/a"
dirty_now=$(git -C "$cwd" status --porcelain 2>/dev/null)
if [ -n "$dirty_now" ] && [ -n "$sid" ] && [ -s "$touched" ]; then
  # Bound the classifier with a real timeout binary only — an unbounded subprocess is exactly the
  # kind of doubt this design resolves toward MORE rigor, never less (fail-closed).
  timeout_bin=""
  command -v timeout >/dev/null 2>&1 && timeout_bin="timeout"
  [ -z "$timeout_bin" ] && command -v gtimeout >/dev/null 2>&1 && timeout_bin="gtimeout"
  if [ -n "$timeout_bin" ]; then
    classify_json=$("$timeout_bin" 20s bash "$HERE/classify-change.sh" --repo "$cwd" --worktree 2>/dev/null)
    classify_rc=$?
  else
    classify_json=""
    classify_rc=127
  fi
  gate_rigor=$(printf '%s' "$classify_json" | jq -er '.rigor | select(. == "micro" or . == "normal" or . == "critical")' 2>/dev/null)
  if [ "$classify_rc" -ne 0 ] || [ -z "$gate_rigor" ]; then
    gate_rigor="critical"
    gate_scope="full"
    gate_reasons="classifier-failed-closed"
    echo "verify-before-stop: classify-change.sh produced no usable verdict (exit ${classify_rc}, timeout_bin=${timeout_bin:-none}) — failing closed to the full gate" >&2
  else
    gate_reasons=$(printf '%s' "$classify_json" | jq -r '[.reasons[]?.signal] | join(",")' 2>/dev/null)
    [ -n "$gate_reasons" ] || gate_reasons="none"
    if [ "$gate_rigor" = "critical" ]; then
      gate_scope="full"
    else
      # normal AND micro: per memo §A.1, micro has no independently-certifiable narrower scope
      # today (--only/--files stamp scope:"partial", which can never certify or advance
      # last-green.json) — so micro is treated exactly like normal until that exists. Anchor to
      # --since <last_green_sha> only when that sha is a reachable ancestor of HEAD; otherwise the
      # anchor itself is doubtful, so fall back to full.
      if [ -f "$last_green" ]; then
        anchor_sha=$(jq -er '.sha | select(type == "string" and length > 0)' "$last_green" 2>/dev/null)
        if [ -n "$anchor_sha" ] && git -C "$cwd" merge-base --is-ancestor "$anchor_sha" HEAD 2>/dev/null; then
          gate_args=(--since "$anchor_sha")
          gate_scope="since"
        fi
      fi
    fi
  fi
  # Escape hatch: PANDACORP_STOP_GATE=full always forces the full gate, whatever the classifier
  # said — the logged rigor/reasons above still reflect what would otherwise have been chosen.
  # There is deliberately no "off" value.
  if [ "${PANDACORP_STOP_GATE:-}" = "full" ]; then
    gate_args=()
    gate_scope="full"
  fi
fi
echo "verify-before-stop: rigor=${gate_rigor} scope=${gate_scope} (reasons: ${gate_reasons})" >&2

# Portable millisecond clock (mirrors .pandacorp/verify.sh's own now_ms: GNU `date +%s%N` first,
# python3/perl fallback, whole-second last resort) so the StopGate event below carries a real
# duration even on a BSD `date` that doesn't expand %N.
now_ms() {
  local raw
  raw=$(date +%s%N 2>/dev/null || true)
  case "$raw" in ''|*[!0-9]*) raw="" ;; esac
  if [ -n "$raw" ] && [ "${#raw}" -ge 19 ]; then
    echo $(( raw / 1000000 )); return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import time; print(int(time.time() * 1000))'; return
  fi
  if command -v perl >/dev/null 2>&1; then
    perl -MTime::HiRes=time -e 'printf("%d\n", time() * 1000)'; return
  fi
  echo $(( $(date +%s) * 1000 ))
}

gate_t0=$(now_ms)
out=$(bash "$verify" "${gate_args[@]}" 2>&1)
verify_rc=$?
gate_t1=$(now_ms)
gate_duration_ms=$(( gate_t1 - gate_t0 ))
gate_green="true"; [ "$verify_rc" -eq 0 ] || gate_green="false"

# StopGate telemetry (fire-and-forget — La Fragua reads it, but a write failure here must never
# affect the verdict below). Same minimal NDJSON shape as emit-event.sh, plus the rigor fields
# emit-event.sh's fixed one-event-name contract has no room for. PANDACORP_EVENTS_LOG lets a test
# point this at a scratch file instead of the real shared stream (quality-and-testing.md: no test
# writes shared mutable state); unset in every real invocation, so production is unaffected.
{
  gate_project=$(basename "$cwd")
  events_log="${PANDACORP_EVENTS_LOG:-$HOME/.claude/dashboard-events.ndjson}"
  jq -cn \
    --arg ev "StopGate" --arg at "$(date -u +%FT%TZ 2>/dev/null || echo unknown)" \
    --arg proj "$gate_project" --arg rigor "$gate_rigor" --arg scope "$gate_scope" \
    --argjson green "$gate_green" --argjson duration_ms "$gate_duration_ms" \
    '{event:$ev, at:$at, project:$proj, rigor:$rigor, scope:$scope, green:$green, duration_ms:$duration_ms}' \
    >> "$events_log" 2>/dev/null
} || true

if [ "$verify_rc" -ne 0 ]; then
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

# GREEN: record the commit this run verified so a later Stop on an unchanged, clean tree can
# fast-path above (BL-0044). Best-effort — a write failure here never blocks the (already-passed)
# Stop; it just means the next Stop re-runs the gate instead of fast-pathing.
# F2: ONLY a FULL-scope green may advance this anchor. A `--since` green only proves the CHANGED
# slice is clean, not the whole tree — writing it here would let a later `--since` run anchor off
# a commit that was never itself fully verified, silently eroding what "last green" means (memo
# §A.1: micro/normal reuse the SAME anchor a full run produced, they never mint a new one).
if [ "$gate_scope" = "full" ]; then
  green_sha_now=$(git -C "$cwd" rev-parse HEAD 2>/dev/null)
  if [ -n "$green_sha_now" ]; then
    mkdir -p "$cwd/.pandacorp/run" 2>/dev/null
    tmp_lg=$(mktemp "$cwd/.pandacorp/run/.last-green.XXXXXX" 2>/dev/null) && {
      printf '{"sha":"%s","at":"%s"}\n' "$green_sha_now" "$(date -u +%FT%TZ 2>/dev/null || echo unknown)" > "$tmp_lg" \
        && mv "$tmp_lg" "$last_green"
    }
  fi
fi

exit 0
