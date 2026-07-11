#!/usr/bin/env bash
# Pandacorp /implement PREFLIGHT (E2 — DR-045 / DR-100 / DR-102 / DR-050 §11).
# Deterministic, READ-ONLY: it asserts the launch conditions and PRINTS PASS/FAIL lines;
# it NEVER mutates the project (not even a stale lock — it prints the reset, launch-implement.sh
# takes the lock). Mirrors the prose preflight in plugin/skills/implement/SKILL.md so the launch
# SOP has a mechanism, not a claim (audit-20 P1-1).
#
# Usage:  preflight-implement.sh <project-dir>
# Exit:   0 iff EVERY check PASS; non-zero otherwise (count of failures).
#
# FAIL-CLOSED on missing jq (same posture as block-dangerous.sh — a gate that can't parse its
# inputs must not look armed while disarmed).
set -uo pipefail

command -v jq >/dev/null 2>&1 || { echo "FAIL  jq is missing — the preflight cannot run fail-closed. Install jq before /implement."; exit 3; }

PROJ="${1:-.}"
PROJ="${PROJ%/}"
CONTINUE_RUNTIME=""
CONTINUE_RUN_ID=""
TARGET_RUNTIME=""
RUN_MODE="auto"
shift || true
while [ "$#" -gt 0 ]; do
  case "$1" in
    --continue-runtime) [ "$#" -ge 2 ] || { echo "FAIL  --continue-runtime requires a value"; exit 3; }; CONTINUE_RUNTIME="$2"; shift 2 ;;
    --continue-run-id) [ "$#" -ge 2 ] || { echo "FAIL  --continue-run-id requires a value"; exit 3; }; CONTINUE_RUN_ID="$2"; shift 2 ;;
    --target-runtime) [ "$#" -ge 2 ] || { echo "FAIL  --target-runtime requires a value"; exit 3; }; TARGET_RUNTIME="$2"; shift 2 ;;
    --run-mode) [ "$#" -ge 2 ] || { echo "FAIL  --run-mode requires a value"; exit 3; }; RUN_MODE="$2"; shift 2 ;;
    *) echo "FAIL  unknown preflight argument: $1"; exit 3 ;;
  esac
done
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
OVERLAY_FILE="$SCRIPT_DIR/../templates/OVERLAY_VERSION"

FAILS=0
pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; FAILS=$((FAILS + 1)); }
warn() { printf 'WARN  %s\n' "$1"; }

# --- tiny YAML scalar reader (status.yaml is a flat, known key: value shape) ------------------
# Anchors at line start (so `running:` never matches `run_started_at:` and comment lines starting
# with `#` are ignored), takes the first hit, strips an inline `# comment`, and unquotes.
yaml_val() { # $1 file  $2 key
  grep -E "^${2}:" "$1" 2>/dev/null | head -1 \
    | sed -E "s/^${2}:[[:space:]]*//; s/[[:space:]]*#.*$//; s/[[:space:]]*$//; s/^\"//; s/\"$//; s/^'//; s/'$//"
}

# --- liveness (the max-of-two-clocks + TTL rule) lives in ONE shared helper (C2+S7) -----------
# check-build-liveness.sh owns the "is a build alive?" decision so this preflight and
# /pandacorp:upgrade's active-build guard can never diverge. iso_to_epoch + the TTL math moved
# there verbatim; §6 below now just reads its verdict and prints the same PASS/FAIL lines.
LIVENESS_HELPER="$SCRIPT_DIR/check-build-liveness.sh"

# --- doc frontmatter helpers ------------------------------------------------------------------
fm_has_active() { head -n 25 "$1" 2>/dev/null | grep -Eq '^status:[[:space:]]*ACTIVE'; }
fm_is_verified() { head -n 25 "$1" 2>/dev/null | grep -Eq '^implementation_status:[[:space:]]*VERIFIED'; }

echo "== Pandacorp /implement preflight — $PROJ =="

# 1) status.yaml exists (the Pandacorp-project marker) -----------------------------------------
STATUS="$PROJ/.pandacorp/status.yaml"
if [ ! -f "$STATUS" ]; then
  fail "no .pandacorp/status.yaml — not a factory project (run /pandacorp:adopt or /pandacorp:spec first)."
  echo "== $FAILS failing check(s) =="
  exit "$FAILS"
fi
pass "marker present (.pandacorp/status.yaml)"
if [ -n "$TARGET_RUNTIME" ]; then
  RESOLVE_MODE="$RUN_MODE"; [ -n "$CONTINUE_RUN_ID" ] && RESOLVE_MODE="$CONTINUE_RUN_ID"
  RUN_RESOLUTION=$(node "$SCRIPT_DIR/resolve-build-run-id.mjs" --project "$PROJ" --runtime "$TARGET_RUNTIME" --mode "$RESOLVE_MODE" --new-id preflight-new 2>/dev/null) \
    || { fail "logical build-run resolution failed closed"; echo "== $FAILS failing check(s) =="; exit "$FAILS"; }
  RUN_REASON=$(printf '%s' "$RUN_RESOLUTION" | jq -r '.reason // "invalid"')
  pass "logical build-run intent resolved ($RUN_REASON; owner ID input not required)"
fi

# 2) overlay_version not behind the plugin's OVERLAY_VERSION (DR-048) --------------------------
if [ -f "$OVERLAY_FILE" ]; then
  WANT=$(head -1 "$OVERLAY_FILE" | tr -d '[:space:]')
  HAVE=$(yaml_val "$STATUS" overlay_version)
  if [ -z "$HAVE" ]; then
    fail "overlay_version missing from status.yaml — run /pandacorp:upgrade."
  elif [ "$HAVE" = "$WANT" ]; then
    pass "overlay_version up to date ($HAVE)"
  else
    OLDER=$(printf '%s\n%s\n' "$HAVE" "$WANT" | sort -V | head -1)
    if [ "$OLDER" = "$HAVE" ]; then
      fail "overlay_version $HAVE is BEHIND the plugin's $WANT — run /pandacorp:upgrade first (DR-048)."
    else
      warn "overlay_version $HAVE is AHEAD of the plugin's $WANT (project newer than this checkout) — proceeding."
    fi
  fi
else
  warn "OVERLAY_VERSION template not found at $OVERLAY_FILE — skipping the version check."
fi

# 3) readiness stamps on every ACTIVE per-FRD blueprint that would be BUILT (DR-100/DR-102) -----
# Scope: blueprints with `status: ACTIVE` AND not already `implementation_status: VERIFIED`. A
# VERIFIED blueprint has already cleared the whole build+gate — re-asserting its readiness stamp
# is pointless and would hard-fail a fully-shipped project (mission-control keeps ACTIVE+VERIFIED
# blueprints). The gates' evidence matters for what the build will actually process.
missing_stamps=""
active_to_build=0
while IFS= read -r bp; do
  [ -n "$bp" ] || continue
  fm_has_active "$bp" || continue
  fm_is_verified "$bp" && continue
  active_to_build=$((active_to_build + 1))
  head_bp=$(head -n 30 "$bp" 2>/dev/null)
  ok=1
  echo "$head_bp" | grep -Eq '^readiness_gate:[[:space:]]*passed'   || ok=0
  echo "$head_bp" | grep -Eq '^grounding_gate:'                      || ok=0
  echo "$head_bp" | grep -Eq '^consistency_gate:'                    || ok=0
  [ "$ok" = "1" ] || missing_stamps="$missing_stamps  $bp"$'\n'
done < <(find "$PROJ/docs/frds" -name blueprint.md 2>/dev/null)
if [ -n "$missing_stamps" ]; then
  fail "ACTIVE, not-yet-VERIFIED blueprint(s) missing readiness/grounding/consistency stamps — never gated; route back to /pandacorp:architecture:"$'\n'"$missing_stamps"
elif [ "$active_to_build" -gt 0 ]; then
  pass "readiness/grounding/consistency stamps present on all $active_to_build ACTIVE blueprint(s) to build"
else
  pass "no ACTIVE, not-yet-VERIFIED blueprint to build (nothing pending, or all VERIFIED)"
fi

# 4) no [NEEDS CLARIFICATION] surviving into an ACTIVE doc (DR-100 — same rule verify.sh reds on) --
flagged=""
while IFS= read -r f; do
  [ -n "$f" ] || continue
  fm_has_active "$f" && flagged="$flagged  $f"$'\n'
done < <(grep -rIl 'NEEDS CLARIFICATION' "$PROJ/docs" 2>/dev/null || true)
if [ -n "$flagged" ]; then
  fail "unresolved [NEEDS CLARIFICATION] in ACTIVE doc(s) (resolve → AC / business rule / [ASSUMPTION], or escalate):"$'\n'"$flagged"
else
  pass "no [NEEDS CLARIFICATION] marker in any ACTIVE doc"
fi

# 5) WOs to build are ACTIVE — a DRAFT work order is un-gated, don't build it (DR-100) ----------
# Only flag a DRAFT WO that is NOT VERIFIED (a would-be-built, un-gated node). A DRAFT WO left
# VERIFIED after the fact is a stable foundation, not a problem.
draft_wos=""
while IFS= read -r wo; do
  [ -n "$wo" ] || continue
  head_wo=$(head -n 20 "$wo" 2>/dev/null)
  echo "$head_wo" | grep -Eqi '^status:[[:space:]]*DRAFT' || continue
  echo "$head_wo" | grep -Eq  '^implementation_status:[[:space:]]*VERIFIED' && continue
  draft_wos="$draft_wos  $wo"$'\n'
done < <(find "$PROJ/docs/frds" -path '*/work-orders/*.md' 2>/dev/null)
if [ -n "$draft_wos" ]; then
  fail "un-gated DRAFT work order(s) that are not VERIFIED would be built — promote to status: ACTIVE via /pandacorp:architecture first:"$'\n'"$draft_wos"
else
  pass "no un-gated (DRAFT + not-VERIFIED) work order in the build set"
fi

# 6) concurrent-run guard (DR-050 §11) — one build per project ---------------------------------
# A certified neutral lease takes precedence over the legacy status heartbeat. Until the Claude
# launcher is migrated, absence of this directory falls through to the exact legacy behavior.
LEASE_CLI="$SCRIPT_DIR/pandacorp-build-state.mjs"
CONTINUE_STALE_LEASE=0
if [ -d "$PROJ/.pandacorp/run/build.lease" ]; then
  LEASE_STATUS=$(node "$LEASE_CLI" status --project "$PROJ" 2>/dev/null || true)
  LEASE_FRESH=$(printf '%s' "$LEASE_STATUS" | jq -r 'if (.fresh | type) == "boolean" then .fresh else true end' 2>/dev/null || echo true)
  LEASE_RUNTIME=$(printf '%s' "$LEASE_STATUS" | jq -r '.lease.runtime // "unknown"' 2>/dev/null || echo unknown)
  LEASE_RUN=$(printf '%s' "$LEASE_STATUS" | jq -r '.lease.run_id // "unknown"' 2>/dev/null || echo unknown)
  if [ "$LEASE_FRESH" = "true" ]; then
    fail "another build owns the atomic lease (runtime=$LEASE_RUNTIME run=$LEASE_RUN) — ABORT."
  elif [ -n "$CONTINUE_RUNTIME" ] && [ -n "$CONTINUE_RUN_ID" ] && [ "$LEASE_RUNTIME" = "$CONTINUE_RUNTIME" ] && [ "$LEASE_RUN" = "$CONTINUE_RUN_ID" ]; then
    pass "stale atomic lease belongs to the explicitly resumed run (runtime=$LEASE_RUNTIME run=$LEASE_RUN) — fenced reclaim permitted."
    CONTINUE_STALE_LEASE=1
  else
    fail "STALE ATOMIC LEASE (runtime=$LEASE_RUNTIME run=$LEASE_RUN) — reclaim explicitly with pandacorp-build-state.mjs; never clear it by editing status.yaml."
  fi
  if [ "$CONTINUE_STALE_LEASE" != "1" ]; then
    echo "== $FAILS failing check(s) =="
    exit "$FAILS"
  fi
fi

# Liveness (running:true AND EITHER supervisor_heartbeat OR last_event_at < 10 min => LIVE; STALE
# only when BOTH are older; fail-closed to RUNNING if the file can't be read) is decided by the
# SHARED helper so this guard and /pandacorp:upgrade's can never drift (C2+S7). We just print the
# same PASS/FAIL lines off its verdict.
if [ "$CONTINUE_STALE_LEASE" = "1" ]; then
  LIVENESS="CONTINUE_STALE_LEASE"
else
  LIVENESS=$("$LIVENESS_HELPER" "$STATUS" 2>/dev/null || true)
fi
case "$LIVENESS" in
  CONTINUE_STALE_LEASE)
    pass "legacy running/heartbeat state is superseded by the matching stale fenced lease during explicit continuation"
    ;;
  NOT_RUNNING)
    RUNNING=$(yaml_val "$STATUS" running)
    pass "no active build (running: ${RUNNING:-absent})"
    ;;
  RUNNING)
    RSA=$(yaml_val "$STATUS" run_started_at)
    fail "another build is ACTIVE (running: true, heartbeat/last_event fresh < 10 min; started $RSA) — ABORT, do not launch a second build."
    ;;
  STALE)
    HB=$(yaml_val "$STATUS" supervisor_heartbeat)
    LE=$(yaml_val "$STATUS" last_event_at)
    fail "STALE LOCK (auto-clearable): running: true but BOTH supervisor_heartbeat ($HB) and last_event_at ($LE) are >= 10 min old — the supervisor died."
    echo "      launch-implement.sh takes a fresh lock automatically. To reset by hand (does NOT auto-reset here):"
    echo "        sed -i '' 's/^running:.*/running: false/' \"$STATUS\"   # (GNU sed: sed -i 's/^running:.*/running: false/')"
    echo "        sed -i '' 's/^supervisor_heartbeat:.*/supervisor_heartbeat: \"\"/' \"$STATUS\""
    echo "        rm -f \"$PROJ/.pandacorp/run/build.lock\""
    ;;
  *)
    # Helper returned nothing/unknown (should not happen; §1 already asserted the file exists) —
    # fail closed exactly like a live build rather than silently passing.
    fail "liveness helper returned an unrecognized verdict ('$LIVENESS') — treating as ACTIVE (fail-closed). Do not launch."
    ;;
esac

echo "== $FAILS failing check(s) =="
exit "$FAILS"
