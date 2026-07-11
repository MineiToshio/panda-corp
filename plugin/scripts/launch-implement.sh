#!/usr/bin/env bash
# Pandacorp /implement LAUNCH (E3 — DR-050 §Unattended operation / DR-063 / BL-0022).
# Deterministic launch prep: takes the build lock in status.yaml + on disk, then ECHOES the exact
# Workflow() invocation the skill must run and the ARG-ECHO verification reminder. It does NOT call
# the Workflow tool itself (only Claude Code can) — it makes the launch mechanical instead of prose.
#
# Usage:  launch-implement.sh <project-dir> [mode] [maxAgents] [auto|new|continue-run-id]
#           [--frds <comma-separated-frds> | --change <change>]
#           [--max-frds <positive-int>] [--max-spend <positive-int>]
#   mode:      pro | balanced | powerful | deep   (default powerful)
#   maxAgents: integer hard cap on subagents this run (the real overnight guardrail)
#
# The preflight guarantees no owner exists. This launcher atomically acquires the neutral lease;
# re-running while it is held fails closed instead of manufacturing a second owner.
set -uo pipefail

PROJ="${1:-.}"; PROJ="${PROJ%/}"; [ "$#" -gt 0 ] && shift
MODE="powerful"; MAX_AGENTS=""; RUN_MODE="auto"
FRDS=""; CHANGE=""; MAX_FRDS=""; MAX_SPEND=""

# Preserve the historical four positional arguments, then parse additive named scope/options.
if [ "$#" -gt 0 ] && [[ "$1" != --* ]]; then MODE="$1"; shift; fi
if [ "$#" -gt 0 ] && [[ "$1" != --* ]]; then MAX_AGENTS="$1"; shift; fi
if [ "$#" -gt 0 ] && [[ "$1" != --* ]]; then RUN_MODE="$1"; shift; fi
while [ "$#" -gt 0 ]; do
  case "$1" in
    --frds) [ "$#" -ge 2 ] || { echo "ERROR: --frds requires a value." >&2; exit 3; }; FRDS="${FRDS}${FRDS:+,}$2"; shift 2 ;;
    --change) [ "$#" -ge 2 ] || { echo "ERROR: --change requires a value." >&2; exit 3; }; CHANGE="$2"; shift 2 ;;
    --max-frds) [ "$#" -ge 2 ] || { echo "ERROR: --max-frds requires a value." >&2; exit 3; }; MAX_FRDS="$2"; shift 2 ;;
    --max-spend) [ "$#" -ge 2 ] || { echo "ERROR: --max-spend requires a value." >&2; exit 3; }; MAX_SPEND="$2"; shift 2 ;;
    *) echo "ERROR: unknown launcher argument: $1" >&2; exit 3 ;;
  esac
done

case "$MODE" in pro|balanced|powerful|deep) ;; *) echo "ERROR: invalid mode: $MODE" >&2; exit 3 ;; esac
for pair in "maxAgents:$MAX_AGENTS" "maxFrds:$MAX_FRDS" "maxSpend:$MAX_SPEND"; do
  value=${pair#*:}; [ -z "$value" ] && continue
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || { echo "ERROR: ${pair%%:*} must be a positive integer." >&2; exit 3; }
done
[ -z "$FRDS" ] || [ -z "$CHANGE" ] || { echo "ERROR: --frds and --change are mutually exclusive." >&2; exit 3; }
if [ -n "$FRDS" ]; then
  IFS=',' read -r -a FRD_ITEMS <<< "$FRDS"
  for item in "${FRD_ITEMS[@]}"; do
    [ -n "$item" ] && [[ "$item" =~ ^[A-Za-z0-9._/-]+$ ]] && [[ "$item" != /* ]] && [[ "/$item/" != *"/../"* ]] \
      || { echo "ERROR: invalid --frds item: $item" >&2; exit 3; }
  done
fi
if [ -n "$CHANGE" ]; then
  [[ "$CHANGE" =~ ^[A-Za-z0-9._/-]+$ ]] && [[ "$CHANGE" != /* ]] && [[ "/$CHANGE/" != *"/../"* ]] \
    || { echo "ERROR: invalid --change value." >&2; exit 3; }
fi

STATUS="$PROJ/.pandacorp/status.yaml"
[ -f "$STATUS" ] || { echo "ERROR: no $STATUS — run the preflight first (not a factory project)." >&2; exit 1; }

# Resolve the project identity EXPLICITLY (BL-0022): absolute root + its basename. Launching from
# ANY cwd is then safe (the engine cds every subagent to projectDir and stamps events with `project`).
PROJECT_DIR=$(cd "$PROJ" && pwd -P)
PROJECT=$(basename "$PROJECT_DIR")
NEW_RUN_ID="run_$(date -u +%Y%m%dT%H%M%SZ)_$$"
RESOLUTION=$(node "$(cd "$(dirname "$0")" && pwd)/resolve-build-run-id.mjs" --project "$PROJECT_DIR" --runtime claude --mode "$RUN_MODE" --new-id "$NEW_RUN_ID") || exit $?
RUN_ID=$(node -e 'const v=JSON.parse(process.argv[1]);if(!v.run_id)process.exit(3);process.stdout.write(v.run_id)' "$RESOLUTION") || exit $?
LEASE_CLI=$(cd "$(dirname "$0")" && pwd)/pandacorp-build-state.mjs

# 1) Take the atomic neutral lease BEFORE any phase write. A contended launch must leave canonical
# project state untouched. The lease CLI owns all compatibility projections.
mkdir -p "$PROJECT_DIR/.pandacorp/run"
LEASE=$(node "$LEASE_CLI" acquire --project "$PROJECT_DIR" --runtime claude --run-id "$RUN_ID" --ttl 600) \
  || { echo "ERROR: atomic build lease acquisition failed." >&2; exit 2; }
LEASE_TOKEN=$(printf '%s' "$LEASE" | jq -r '.token // empty')
LEASE_EPOCH=$(printf '%s' "$LEASE" | jq -r '.epoch // empty')
[ -n "$LEASE_TOKEN" ] && [ -n "$LEASE_EPOCH" ] || { echo "ERROR: lease receipt malformed." >&2; exit 2; }

# Only the fenced owner may advance architecture -> implementation. If this projection fails,
# release immediately so a launch error cannot strand ownership. The test switch only forces this
# safe abort path and never grants a capability.
if [ "${PANDACORP_TEST_FAIL_PHASE_WRITE:-0}" = "1" ] || \
   ! node "$LEASE_CLI" set-phase --project "$PROJECT_DIR" --token "$LEASE_TOKEN" --epoch "$LEASE_EPOCH" --phase implementation >/dev/null; then
  echo "ERROR: fenced phase transition failed; releasing the newly acquired lease." >&2
  if ! node "$LEASE_CLI" release --project "$PROJECT_DIR" --token "$LEASE_TOKEN" --epoch "$LEASE_EPOCH" >/dev/null; then
    echo "ERROR: lease cleanup also failed; STOP and inspect the lease before retrying." >&2
  fi
  exit 2
fi
touch "$PROJECT_DIR/.pandacorp/run/build.lock"

echo "== launch prepared for $PROJECT =="
echo "status.yaml: phase=implementation running=true runtime=claude epoch=$LEASE_EPOCH"
echo "logical run: $RUN_ID ($(node -e 'process.stdout.write(JSON.parse(process.argv[1]).reason)' "$RESOLUTION"))"
echo "build lock:  $PROJECT_DIR/.pandacorp/run/build.lock (touched)"
echo

# 2) The EXACT Workflow() invocation to run now. JSON is valid JavaScript object syntax;
# serializing BOTH scriptPath and args prevents a project/scope value from becoming Workflow source.
# Any post-acquire preparation failure must release the lease; never strand ownership on formatting.
WORKFLOW_JSON=""
ARGS_BUILD_RC=0
if [ "${PANDACORP_TEST_FAIL_ARGS_JSON:-0}" = "1" ]; then
  ARGS_BUILD_RC=1
else
  WORKFLOW_JSON=$(node - "$PROJECT_DIR/.claude/engines/pandacorp-build.js" "$MODE" "$MAX_AGENTS" "$PROJECT_DIR" "$PROJECT" "$LEASE_TOKEN" "$LEASE_EPOCH" "$FRDS" "$CHANGE" "$MAX_FRDS" "$MAX_SPEND" <<'NODE'
const [scriptPath, mode, maxAgents, projectDir, project, leaseToken, leaseEpoch, frds, change, maxFrds, maxSpend] = process.argv.slice(2);
const args = { mode };
if (maxAgents) args.maxAgents = Number(maxAgents);
args.projectDir = projectDir;
args.project = project;
args.leaseToken = leaseToken;
args.leaseEpoch = Number(leaseEpoch);
if (frds) args.frds = frds.split(",");
if (change) args.change = change;
if (maxFrds) args.maxFrds = Number(maxFrds);
if (maxSpend) args.maxSpend = Number(maxSpend);
process.stdout.write(JSON.stringify({ scriptPath, args }));
NODE
) || ARGS_BUILD_RC=$?
fi
if [ "$ARGS_BUILD_RC" -ne 0 ] || [ -z "$WORKFLOW_JSON" ]; then
  echo "ERROR: failed to construct Workflow invocation; releasing the acquired lease." >&2
  rm -f "$PROJECT_DIR/.pandacorp/run/build.lock"
  if ! node "$LEASE_CLI" release --project "$PROJECT_DIR" --token "$LEASE_TOKEN" --epoch "$LEASE_EPOCH" >/dev/null; then
    echo "ERROR: lease cleanup also failed; STOP and inspect the lease before retrying." >&2
  fi
  exit 3
fi
echo "Run this Workflow() call (args MUST be a JSON object, never a string):"
echo
echo "  Workflow($WORKFLOW_JSON)"
echo

# 3) ARG-ECHO VERIFICATION (DR-072 R2) — the launch is not done until you confirm the args landed.
echo "ARG-ECHO VERIFICATION (mandatory): the engine's FIRST log line must read  · maxAgents ${MAX_AGENTS:-OFF} ·"
echo "  If it reads 'maxAgents OFF' when you passed one, or 'args arrived as a <type>, NOT an object',"
echo "  the args were DROPPED (Workflow serialization bug) and the run is UNBOUNDED → TaskStop it"
echo "  immediately and relaunch (re-pass args; hardcode the scope into args if needed)."
[ -z "$MAX_AGENTS" ] && echo "  WARNING: no maxAgents given — an OVERNIGHT run MUST pass one (the real guardrail)."
exit 0
