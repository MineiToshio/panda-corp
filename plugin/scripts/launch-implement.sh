#!/usr/bin/env bash
# Pandacorp /implement LAUNCH (E3 — DR-050 §Unattended operation / DR-063 / BL-0022).
# Deterministic launch prep: takes the build lock in status.yaml + on disk, then ECHOES the exact
# Workflow() invocation the skill must run and the ARG-ECHO verification reminder. It does NOT call
# the Workflow tool itself (only Claude Code can) — it makes the launch mechanical instead of prose.
#
# Usage:  launch-implement.sh <project-dir> [mode] [maxAgents] [auto|new|continue-run-id]
#           [--frds <comma-separated-frds> | --change <change>]
#           [--max-frds <positive-int>] [--max-spend <positive-int>] [--ttl <positive-int-seconds>]
#           [--parallel-gates | --no-parallel-gates] [--gate-slots <1-8>] [--gate-evidence explore|digested]
#           [--gate-context-scope] [--drift-finder on|off] [--gate-inventory-cache]
#           [--lane fast|classic] [--review-budget now|defer]
#   mode:      pro | balanced | powerful | deep   (default powerful)
#   maxAgents: integer hard cap on subagents this run (the real overnight guardrail), or the literal `auto`
#              (OPT-IN: the engine sizes a cap from its own post-plan projection; an explicit integer is never
#              overridden, and `auto` is NOT a budget the owner chose — the overnight warning below still fires)
#   --ttl:     atomic lease TTL in seconds (default 3600 — BL-0153: a build phase dominated by
#              back-to-back gate/repair attempts with no intervening safe-point can go silently
#              unrenewed well past the historical 600s default; raise further for a targeted
#              single-FRD/change run expected to spend most of its time inside one long gate).
#   --parallel-gates / --no-parallel-gates: engine args.parallelGates. **Default ON since v9.116.0** (D1/BL-0186;
#              canary F1/F2 verdict — the gates are no longer the cost/time bottleneck): up to --gate-slots FRD
#              gates review at once, each in its own gate worktree, landing on main one at a time. Size the
#              pool to the machine (default 2 = the 16 GB machine the red-team measured). Pass bare
#              `--parallel-gates` to make the (now-default) choice explicit in a launch's own argv, or
#              `--no-parallel-gates` to opt back into the single-gate-worktree legacy topology. The two are
#              mutually exclusive. --gate-slots needs no flag alongside it now that parallel gates default on;
#              it errors only when paired with --no-parallel-gates.
#   --gate-evidence: engine args.gateEvidence (WP-06/BL-0187): `explore` (the engine default) or `digested` (a MECH
#              collector pre-gathers the gate's evidence in the pinned gate worktree). Omitted → the key is not set.
#   --gate-context-scope: OPT-IN → engine args.gateContextScope:true (BL-0188, engine default off): every FRD gate
#              reads frd.md + this cycle's WOs in full and everything else header-only/by section/as pointers.
#   --drift-finder on|off: engine args.driftFinder true|false (BL-0203). Omitted → the key is not set and the engine
#              default applies (on under --gate-evidence digested, off under explore).
#   --gate-inventory-cache: OPT-IN → engine args.gateInventoryCache:true (BL-0189, engine default off): a repeat
#              gate of an FRD whose frd.md/blueprint.md body is unchanged reuses the cached contract inventory.
#   --lane fast|classic: engine args.lane (proposal 39, DR-124; OPT-IN this release, the engine default is classic).
#              `fast`: no plan agent, one builder per FRD committing each WO through the scripted commit-wo, a scripted
#              verify on the clean landed tree (USABLE per non-floor FRD), the unchanged opus gates in the parallel slots
#              while the next FRD builds, and the infra halt/resume (stopReason paused-infra). Omitted → no key.
#   --review-budget now|defer: engine args.reviewBudget, fast lane only (requires --lane fast). `defer` stops at
#              all-USABLE and launches no FRD gate: the unreviewed FRDs stay review debt (derived, never stored) for a
#              later run. Omitted → no key (the engine default `now` continues to VERIFIED).
#
# The preflight guarantees no owner exists. This launcher atomically acquires the neutral lease;
# re-running while it is held fails closed instead of manufacturing a second owner.
set -uo pipefail

PROJ="${1:-.}"; PROJ="${PROJ%/}"; [ "$#" -gt 0 ] && shift
MODE="powerful"; MAX_AGENTS=""; RUN_MODE="auto"
FRDS=""; CHANGE=""; MAX_FRDS=""; MAX_SPEND=""; TTL="3600"; PARALLEL_GATES=""; GATE_SLOTS=""; GATE_EVIDENCE=""
GATE_CONTEXT_SCOPE=""; DRIFT_FINDER=""; GATE_INVENTORY_CACHE=""; LANE=""; REVIEW_BUDGET=""

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
    --ttl) [ "$#" -ge 2 ] || { echo "ERROR: --ttl requires a value." >&2; exit 3; }; TTL="$2"; shift 2 ;;
    --parallel-gates) [ -z "$PARALLEL_GATES" ] || [ "$PARALLEL_GATES" = "1" ] || { echo "ERROR: --parallel-gates and --no-parallel-gates are mutually exclusive." >&2; exit 3; }; PARALLEL_GATES="1"; shift ;;
    --no-parallel-gates) [ -z "$PARALLEL_GATES" ] || [ "$PARALLEL_GATES" = "0" ] || { echo "ERROR: --parallel-gates and --no-parallel-gates are mutually exclusive." >&2; exit 3; }; PARALLEL_GATES="0"; shift ;;
    --gate-slots) [ "$#" -ge 2 ] || { echo "ERROR: --gate-slots requires a value." >&2; exit 3; }; GATE_SLOTS="$2"; shift 2 ;;
    --gate-evidence) [ "$#" -ge 2 ] || { echo "ERROR: --gate-evidence requires a value." >&2; exit 3; }; GATE_EVIDENCE="$2"; shift 2 ;;
    --gate-context-scope) GATE_CONTEXT_SCOPE="1"; shift ;;
    --drift-finder) [ "$#" -ge 2 ] || { echo "ERROR: --drift-finder requires a value (on|off)." >&2; exit 3; }; DRIFT_FINDER="$2"; shift 2 ;;
    --gate-inventory-cache) GATE_INVENTORY_CACHE="1"; shift ;;
    --lane) [ "$#" -ge 2 ] || { echo "ERROR: --lane requires a value (fast|classic)." >&2; exit 3; }
      [ -z "$LANE" ] || { echo "ERROR: --lane given twice." >&2; exit 3; }; LANE="$2"; shift 2 ;;
    --review-budget) [ "$#" -ge 2 ] || { echo "ERROR: --review-budget requires a value (now|defer)." >&2; exit 3; }
      [ -z "$REVIEW_BUDGET" ] || { echo "ERROR: --review-budget given twice." >&2; exit 3; }; REVIEW_BUDGET="$2"; shift 2 ;;
    *) echo "ERROR: unknown launcher argument: $1" >&2; exit 3 ;;
  esac
done

case "$MODE" in pro|balanced|powerful|deep) ;; *) echo "ERROR: invalid mode: $MODE" >&2; exit 3 ;; esac
for pair in "maxAgents:$MAX_AGENTS" "maxFrds:$MAX_FRDS" "maxSpend:$MAX_SPEND" "ttl:$TTL"; do
  value=${pair#*:}; [ -z "$value" ] && continue
  [ "$pair" = "maxAgents:auto" ] && continue
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || { echo "ERROR: ${pair%%:*} must be a positive integer." >&2; exit 3; }
done
[ -z "$FRDS" ] || [ -z "$CHANGE" ] || { echo "ERROR: --frds and --change are mutually exclusive." >&2; exit 3; }
if [ -n "$GATE_SLOTS" ]; then
  [ "$PARALLEL_GATES" != "0" ] || { echo "ERROR: --gate-slots contradicts --no-parallel-gates." >&2; exit 3; }
  [[ "$GATE_SLOTS" =~ ^[1-8]$ ]] || { echo "ERROR: --gate-slots must be an integer 1-8." >&2; exit 3; }
fi
case "$GATE_EVIDENCE" in ""|explore|digested) ;; *) echo "ERROR: --gate-evidence must be explore or digested." >&2; exit 3 ;; esac
case "$DRIFT_FINDER" in ""|on|off) ;; *) echo "ERROR: --drift-finder must be on or off." >&2; exit 3 ;; esac
case "$LANE" in ""|fast|classic) ;; *) echo "ERROR: --lane must be fast or classic." >&2; exit 3 ;; esac
case "$REVIEW_BUDGET" in ""|now|defer) ;; *) echo "ERROR: --review-budget must be now or defer." >&2; exit 3 ;; esac
# reviewBudget is read by the fast lane only: on any other lane the engine would silently ignore it.
[ -z "$REVIEW_BUDGET" ] || [ "$LANE" = "fast" ] || { echo "ERROR: --review-budget requires --lane fast." >&2; exit 3; }
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

# Dynamic Workflow subagents do not inherit CLAUDE_PLUGIN_ROOT reliably. Resolve the governed state
# writer here, while the installed plugin root is still known, and pass its canonical capability path
# explicitly. This validation happens before lease acquisition so a broken installation is a no-op.
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
STATE_CLI=$(node - "$SCRIPT_DIR/pandacorp-build-state.mjs" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const candidate = process.argv[2];
try {
  const resolved = fs.realpathSync(candidate);
  if (!path.isAbsolute(resolved) || !fs.statSync(resolved).isFile()) process.exit(3);
  process.stdout.write(resolved);
} catch { process.exit(3); }
NODE
) || { echo "ERROR: installed build-state CLI is missing or not a regular file." >&2; exit 3; }
[ -n "$STATE_CLI" ] || { echo "ERROR: installed build-state CLI resolved to an empty path." >&2; exit 3; }

# Resolve the project identity EXPLICITLY (BL-0022): absolute root + its basename. Launching from
# ANY cwd is then safe (the engine cds every subagent to projectDir and stamps events with `project`).
PROJECT_DIR=$(cd "$PROJ" && pwd -P)
PROJECT=$(basename "$PROJECT_DIR")
NEW_RUN_ID="run_$(date -u +%Y%m%dT%H%M%SZ)_$$"
RESOLUTION=$(node "$SCRIPT_DIR/resolve-build-run-id.mjs" --project "$PROJECT_DIR" --runtime claude --mode "$RUN_MODE" --new-id "$NEW_RUN_ID") || exit $?
RUN_ID=$(node -e 'const v=JSON.parse(process.argv[1]);if(!v.run_id)process.exit(3);process.stdout.write(v.run_id)' "$RESOLUTION") || exit $?
LEASE_CLI="$STATE_CLI"

# 1) Take the atomic neutral lease BEFORE any phase write. A contended launch must leave canonical
# project state untouched. The lease CLI owns all compatibility projections.
mkdir -p "$PROJECT_DIR/.pandacorp/run"
if [ "${PANDACORP_TEST_FAIL_PHASE_WRITE:-0}" = "1" ]; then
  echo "ERROR: simulated fenced projection failure before lease acquisition." >&2
  exit 2
fi
LEASE=$(node "$LEASE_CLI" acquire --project "$PROJECT_DIR" --runtime claude --run-id "$RUN_ID" --ttl "$TTL") \
  || { echo "ERROR: atomic build lease acquisition failed." >&2; exit 2; }
LEASE_TOKEN=$(printf '%s' "$LEASE" | jq -r '.token // empty')
LEASE_EPOCH=$(printf '%s' "$LEASE" | jq -r '.epoch // empty')
[ -n "$LEASE_TOKEN" ] && [ -n "$LEASE_EPOCH" ] || { echo "ERROR: lease receipt malformed." >&2; exit 2; }

# Only the fenced owner may advance architecture -> implementation. If this projection fails,
# release immediately so a launch error cannot strand ownership. The test switch only forces this
# safe abort path and never grants a capability.
if ! node "$LEASE_CLI" set-phase --project "$PROJECT_DIR" --token "$LEASE_TOKEN" --epoch "$LEASE_EPOCH" --phase implementation >/dev/null; then
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
  WORKFLOW_JSON=$(node - "$PROJECT_DIR/.claude/engines/pandacorp-build.js" "$MODE" "$MAX_AGENTS" "$PROJECT_DIR" "$PROJECT" "$LEASE_TOKEN" "$LEASE_EPOCH" "$FRDS" "$CHANGE" "$MAX_FRDS" "$MAX_SPEND" "$STATE_CLI" "$PARALLEL_GATES" "$GATE_SLOTS" "$GATE_EVIDENCE" "$GATE_CONTEXT_SCOPE" "$DRIFT_FINDER" "$GATE_INVENTORY_CACHE" "$LANE" "$REVIEW_BUDGET" <<'NODE'
const [scriptPath, mode, maxAgents, projectDir, project, leaseToken, leaseEpoch, frds, change, maxFrds, maxSpend, stateCli, parallelGates, gateSlots, gateEvidence, gateContextScope, driftFinder, gateInventoryCache, lane, reviewBudget] = process.argv.slice(2);
const args = { mode };
if (maxAgents === "auto") args.maxAgents = "auto";
else if (maxAgents) args.maxAgents = Number(maxAgents);
args.projectDir = projectDir;
args.project = project;
args.leaseToken = leaseToken;
args.leaseEpoch = Number(leaseEpoch);
args.stateCli = stateCli;
if (frds) args.frds = frds.split(",");
if (change) args.change = change;
if (maxFrds) args.maxFrds = Number(maxFrds);
if (maxSpend) args.maxSpend = Number(maxSpend);
if (parallelGates === "1") args.parallelGates = true;
else if (parallelGates === "0") args.parallelGates = false;
if (gateSlots) args.gateSlots = Number(gateSlots);
if (gateEvidence) args.gateEvidence = gateEvidence;
if (gateContextScope) args.gateContextScope = true;
if (driftFinder) args.driftFinder = driftFinder === "on";
if (gateInventoryCache) args.gateInventoryCache = true;
if (lane) args.lane = lane;
if (reviewBudget) args.reviewBudget = reviewBudget;
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
[ "$LANE" = "fast" ] && echo "  FAST LANE (DR-124): the engine must also log  lane fast · mechScript on · infraGuard on · reviewBudget ${REVIEW_BUDGET:-now}  — a missing line means classic ran."
[ -z "$MAX_AGENTS" ] && echo "  WARNING: no maxAgents given — an OVERNIGHT run MUST pass one (the real guardrail)."
[ "$MAX_AGENTS" = "auto" ] && echo "  WARNING: maxAgents=auto is a projection-sized convenience, NOT an owner-chosen budget — an OVERNIGHT run MUST still pass an explicit integer (the real guardrail)."
# `auto` has no integer to compare: every numeric floor check below is skipped for it (the engine logs its own projection).
NUMERIC_MAX_AGENTS="$MAX_AGENTS"; [ "$MAX_AGENTS" = "auto" ] && NUMERIC_MAX_AGENTS=""
# BL-0173 (canary-d, 2026-09-25): maxAgents is the run's TOTAL cost-weighted spend budget, never a
# concurrency/wave-width knob (see this file's own header + plugin/skills/implement/SKILL.md's DR-050
# table) — but the FIXED pre-wave overhead (baseline precheck + plan + the first wave's own safe-point +
# a UI build's foundation-gate, each judge-tier spawn opus-weighted x3) can by itself reach ~8-11 units
# BEFORE the first wave is ever picked, and a targeted `--change` run adds ~3 more (its own process-
# change spawn). With `powerful` mode's own wave width of 8, a maxAgents below that overhead collapses
# the FIRST wave to exactly 1 WO regardless of how many are really ready and disjoint — silently, unless
# the owner already knows to read the engine's own "reducida a 1 WO por presupuesto de agentes agotado"
# log line. Warn about it HERE, before the run even starts, for `powerful` mode specifically (its
# highest wave width makes the mismatch worst) when the given ceiling is below the floor.
if [ "$MODE" = "powerful" ] && [ -n "$NUMERIC_MAX_AGENTS" ] && [ "$NUMERIC_MAX_AGENTS" -lt 15 ]; then
  echo "  WARNING: maxAgents=$MAX_AGENTS is a TOTAL run budget, NOT concurrency — powerful mode's own fixed"
  echo "  pre-wave overhead (baseline+plan+safe-point+foundation-gate, opus-weighted) alone can reach ~8-11"
  echo "  units before the first wave is even picked (~11-14 if this is a --change run). With < 15, the"
  echo "  FIRST wave will likely collapse to exactly 1 WO no matter how many are really ready and disjoint"
  echo "  (BL-0173) — raise maxAgents, or expect and read the engine's own 'oleada reducida a 1 WO por"
  echo "  presupuesto de agentes agotado' log line rather than mis-reading it as a dependency stall."
fi
# Sizing floor (BENCH A-1, 2026-10-01 - supersedes the old "15 x the FRDs" rule of thumb, which priced the gate
# links only and omitted the fixed pre-wave overhead, per-WO plumbing and opus weight: A-1, ONE FRD / 3 WOs / one
# reopen, needed ~48 cost units and a maxAgents of 15 stopped it at `agents` before any gate). The engine's own weights
# (opus = 3, every MECH step = 1) give, per run:
#   fixed overhead ~8 (baseline precheck + plan + the first wave's safe-point + a UI build's foundation-gate)
#   + per WO to build (3 MECH steps: dispatch share, commit, self-test relay) + the builder's weight (sonnet 1, opus 3)
#   + ~20 per FRD gate/ladder (gate link ~6 + PASS landing ~2-3 + a reopen's patch ladder ~7-9 at the canaries' ~50 %
#     first-gate reopen rate + the tail share).
# The launcher cannot read the WO count, so its floor is the FRD part, 8 + 20 x the FRDs, and the owner adds ~4-6 per WO.
# BL-0207/BL-0214: the whole-FRD drift finder (ONE sonnet unit + ONE MECH snippet check per gate link, again on every
# re-gate) adds ~4 per FRD. The finder is ON with `--drift-finder on`, or under `--gate-evidence digested` unless
# `--drift-finder off` (the engine's own default: on under digested, off under the default explore).
# Advisory only: nothing here changes what the engine does, and an explicit integer is never overridden. To skip the
# arithmetic pass `auto` (opt-in): the engine projects the run after its plan and logs the units and an approximate USD.
# parallelGates defaults ON (v9.116.0), so this fires whenever PARALLEL_GATES is not explicitly "0".
if [ "$REVIEW_BUDGET" = "defer" ]; then
  echo "  NOTE: --review-budget defer launches no FRD gate: size maxAgents for the build half only (~4-6 per work order,"
  echo "  plus a few MECH steps per FRD). The deferred gates run in a later window (a run with the default review budget)."
elif [ "$PARALLEL_GATES" != "0" ]; then
  PER_FRD=20; FINDER_NOTE=""
  if [ "$DRIFT_FINDER" = "on" ] || { [ "$GATE_EVIDENCE" = "digested" ] && [ "$DRIFT_FINDER" != "off" ]; }; then
    PER_FRD=24; FINDER_NOTE=" + ~4 for the drift finder and its snippet check (BL-0207, BL-0214)"
  fi
  GATE_FRDS=""
  [ -n "$FRDS" ] && GATE_FRDS=$(printf '%s\n' "$FRDS" | tr ',' '\n' | grep -c .)
  if [ -n "$NUMERIC_MAX_AGENTS" ] && [ -n "$GATE_FRDS" ] && [ "$NUMERIC_MAX_AGENTS" -lt $((8 + PER_FRD * GATE_FRDS)) ]; then
    echo "  WARNING: parallel FRD gates (default on) with maxAgents=$MAX_AGENTS for $GATE_FRDS FRD(s): the recommended"
    echo "  floor is 8 + $PER_FRD x FRDs = $((8 + PER_FRD * GATE_FRDS)) cost-weighted units (fixed overhead ~8, gate + landing + one reopen ladder ~20 per FRD${FINDER_NOTE}),"
    echo "  PLUS ~4-6 per work order to build (3 MECH steps + the builder's weight, opus = 3). Measured: 1 FRD / 3 WOs / one reopen"
    echo "  needed ~48 units. Below it the run will likely stop at the agent ceiling before every FRD has gated - raise"
    echo "  maxAgents, gate fewer FRDs this run, pass --no-parallel-gates, or pass 'auto' and let the engine size it."
  elif [ -z "$GATE_FRDS" ] && [ "$MAX_AGENTS" != "auto" ]; then
    echo "  NOTE: parallel FRD gates (default on): size maxAgents to at least 8 + $PER_FRD x the FRDs this run will gate (fixed overhead ~8, gate +"
    echo "  landing + one reopen ladder ~20 per FRD${FINDER_NOTE}), PLUS ~4-6 per work order to build. Measured: 1 FRD / 3 WOs / one reopen"
    echo "  needed ~48 units. Or pass 'auto': the engine projects the run after its plan and logs the units."
  fi
fi
exit 0
