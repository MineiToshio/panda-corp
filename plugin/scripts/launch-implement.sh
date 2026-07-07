#!/usr/bin/env bash
# Pandacorp /implement LAUNCH (E3 — DR-050 §Unattended operation / DR-063 / BL-0022).
# Deterministic launch prep: takes the build lock in status.yaml + on disk, then ECHOES the exact
# Workflow() invocation the skill must run and the ARG-ECHO verification reminder. It does NOT call
# the Workflow tool itself (only Claude Code can) — it makes the launch mechanical instead of prose.
#
# Usage:  launch-implement.sh <project-dir> <mode> <maxAgents>
#   mode:      pro | balanced | powerful | deep   (default powerful)
#   maxAgents: integer hard cap on subagents this run (the real overnight guardrail)
#
# Idempotent: re-running only rewrites the same keys in place (never duplicates them) and re-touches
# the lock; safe to call on a resume.
set -uo pipefail

PROJ="${1:-.}"; PROJ="${PROJ%/}"
MODE="${2:-powerful}"
MAX_AGENTS="${3:-}"

STATUS="$PROJ/.pandacorp/status.yaml"
[ -f "$STATUS" ] || { echo "ERROR: no $STATUS — run the preflight first (not a factory project)." >&2; exit 1; }

# Resolve the project identity EXPLICITLY (BL-0022): absolute root + its basename. Launching from
# ANY cwd is then safe (the engine cds every subagent to projectDir and stamps events with `project`).
PROJECT_DIR=$(cd "$PROJ" && pwd -P)
PROJECT=$(basename "$PROJECT_DIR")
NOW=$(date -u +%FT%TZ)

# --- set/replace a flat top-level YAML key in place (never truncates the protected file) --------
set_key() { # $1 file  $2 key  $3 value(literal, already-quoted if needed)
  local file="$1" key="$2" val="$3" tmp
  tmp=$(mktemp "${TMPDIR:-/tmp}/pcstatus.XXXXXX") || return 1
  if grep -qE "^${key}:" "$file"; then
    awk -v k="$key" -v v="$val" '
      $0 ~ ("^" k ":") && !seen { print k ": " v; seen=1; next }
      { print }
    ' "$file" > "$tmp" && mv "$tmp" "$file"
  else
    cp "$file" "$tmp" && printf '%s: %s\n' "$key" "$val" >> "$tmp" && mv "$tmp" "$file"
  fi
}

# 1) Take the lock (DR-050 §Unattended operation step 1 + DR-063).
set_key "$STATUS" phase          "implementation"
set_key "$STATUS" running        "true"
set_key "$STATUS" run_started_at "\"$NOW\""
set_key "$STATUS" supervisor_heartbeat "\"\""   # clear any stale heartbeat → fresh baseline for the guard
mkdir -p "$PROJECT_DIR/.pandacorp/run"
touch "$PROJECT_DIR/.pandacorp/run/build.lock"

echo "== launch prepared for $PROJECT =="
echo "status.yaml: phase=implementation running=true run_started_at=$NOW supervisor_heartbeat cleared"
echo "build lock:  $PROJECT_DIR/.pandacorp/run/build.lock (touched)"
echo

# 2) The EXACT Workflow() invocation to run now (scriptPath form, args as a REAL JSON object).
MA_FIELD=""
[ -n "$MAX_AGENTS" ] && MA_FIELD=", maxAgents: $MAX_AGENTS"
echo "Run this Workflow() call (args MUST be a JSON object, never a string):"
echo
echo "  Workflow({ scriptPath: '$PROJECT_DIR/.claude/engines/pandacorp-build.js',"
echo "             args: { mode: '$MODE'$MA_FIELD, projectDir: '$PROJECT_DIR', project: '$PROJECT' } })"
echo

# 3) ARG-ECHO VERIFICATION (DR-072 R2) — the launch is not done until you confirm the args landed.
echo "ARG-ECHO VERIFICATION (mandatory): the engine's FIRST log line must read  · maxAgents ${MAX_AGENTS:-OFF} ·"
echo "  If it reads 'maxAgents OFF' when you passed one, or 'args arrived as a <type>, NOT an object',"
echo "  the args were DROPPED (Workflow serialization bug) and the run is UNBOUNDED → TaskStop it"
echo "  immediately and relaunch (re-pass args; hardcode the scope into args if needed)."
[ -z "$MAX_AGENTS" ] && echo "  WARNING: no maxAgents given — an OVERNIGHT run MUST pass one (the real guardrail)."
exit 0
