#!/usr/bin/env bash
# Pandacorp BUILD LIVENESS — the ONE place the "is a build alive?" rule lives (C2+S7).
# Both /pandacorp:implement's concurrent-run guard (preflight-implement.sh §6) and
# /pandacorp:upgrade's active-build guard read liveness through THIS helper, so they can
# never diverge (the bug this fixes: upgrade used to check only supervisor_heartbeat, so a
# live build with a dead supervisor but a fresh last_event_at read "not running" and the
# upgrade regenerated the engine mid-build).
#
# The rule (DR-050 §11 + DR-066 — cross the PRODUCER's own clock, not only the watcher's):
#   * fresh lease (its own ttl_seconds), or malformed existing lease -> RUNNING (exit 1)
#   * running != true (or absent)                         -> NOT_RUNNING  (exit 0, safe to proceed)
#   * running == true AND (supervisor_heartbeat OR last_event_at) < TTL old -> RUNNING (exit 1, abort)
#   * running == true AND BOTH >= TTL old (or both unparsable/absent)       -> STALE   (exit 2, lock auto-clearable)
#
# FAIL-CLOSED (same posture as block-dangerous.sh / preflight's jq guard): if the status file
# cannot be read, or `running` carries an unrecognized token, the verdict is RUNNING/abort —
# a guard that can't parse its input must never look disarmed by reporting "not running".
#
# Usage:  check-build-liveness.sh <status.yaml>
# Prints: RUNNING | STALE | NOT_RUNNING   (one word on stdout)
# Exit:   0 = NOT_RUNNING · 1 = RUNNING · 2 = STALE
set -uo pipefail

TTL="${BUILD_LIVENESS_TTL:-600}"   # 10-min heartbeat/lock TTL (DR-050 §11 stale threshold)

# --- tiny YAML scalar reader (status.yaml is a flat, known key: value shape) -------------------
# Anchors at line start (so `running:` never matches `run_started_at:`), takes the first hit,
# strips an inline `# comment`, and unquotes. IDENTICAL to preflight-implement.sh's reader.
_liv_yaml_val() { # $1 file  $2 key
  grep -E "^${2}:" "$1" 2>/dev/null | head -1 \
    | sed -E "s/^${2}:[[:space:]]*//; s/[[:space:]]*#.*$//; s/[[:space:]]*$//; s/^\"//; s/\"$//; s/^'//; s/'$//"
}

# --- ISO-8601 -> epoch seconds (UTC), tolerant of fractional seconds + BSD/GNU date ------------
# IDENTICAL to preflight-implement.sh's converter. Echoes epoch or empty on unparsable input.
_liv_iso_to_epoch() { # $1 iso timestamp; echoes epoch or empty
  local ts="${1:-}"
  [ -n "$ts" ] || { echo ""; return; }
  ts="$(printf '%s' "$ts" | sed -E 's/\.[0-9]+//; s/Z$//')"   # drop fractional secs + trailing Z
  date -u -d "${ts}Z" +%s 2>/dev/null \
    || date -u -j -f "%Y-%m-%dT%H:%M:%S" "$ts" +%s 2>/dev/null \
    || echo ""
}

# --- the shared decision. Echoes the verdict, returns the matching exit code. ------------------
build_liveness() { # $1 status file
  local status="${1:-}"
  # The fenced lease remains authoritative while worker ownership inspection pauses
  # status projection. An existing but unreadable/malformed lease blocks mutation too.
  local lease_dir lease_result
  lease_dir="$(dirname "$status")/run/build.lease"
  if [ -e "$lease_dir" ] || [ -L "$lease_dir" ]; then
    if node - "$lease_dir/lease.json" <<'NODE'
const fs = require("node:fs");
try {
  const lease = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const stamp = typeof lease.renewed_at === "string" ? Date.parse(lease.renewed_at) : NaN;
  if (!Number.isFinite(stamp) || !Number.isFinite(lease.ttl_seconds) || lease.ttl_seconds <= 0) process.exit(2);
  process.exit(Date.now() - stamp < lease.ttl_seconds * 1000 ? 1 : 0);
} catch { process.exit(2); }
NODE
    then lease_result=0; else lease_result=$?; fi
    if [ "$lease_result" -ne 0 ]; then
      [ "$lease_result" -eq 1 ] || echo "build-liveness: unreadable or malformed lease; refusing mutation" >&2
      echo RUNNING; return 1
    fi
  fi

  # fail-closed: no readable status file => cannot prove "not running" => abort.
  [ -n "$status" ] && [ -r "$status" ] || { echo RUNNING; return 1; }

  local running
  running="$(_liv_yaml_val "$status" running)"
  if [ "$running" = "false" ] || [ -z "$running" ]; then
    echo NOT_RUNNING; return 0
  elif [ "$running" != "true" ]; then
    # `running` present but an UNRECOGNIZED token (corrupted file) => fail-closed abort.
    echo RUNNING; return 1
  fi

  # running == true: cross supervisor_heartbeat WITH last_event_at (DR-066). LIVE if EITHER
  # is < TTL old; STALE only when BOTH are older (or both unparsable/absent).
  local hb le now hb_e le_e fresh
  hb="$(_liv_yaml_val "$status" supervisor_heartbeat)"
  le="$(_liv_yaml_val "$status" last_event_at)"
  now="$(date -u +%s)"
  hb_e="$(_liv_iso_to_epoch "$hb")"
  le_e="$(_liv_iso_to_epoch "$le")"
  fresh=0
  [ -n "$hb_e" ] && [ $((now - hb_e)) -lt "$TTL" ] && fresh=1
  [ -n "$le_e" ] && [ $((now - le_e)) -lt "$TTL" ] && fresh=1
  if [ "$fresh" = "1" ]; then echo RUNNING; return 1; else echo STALE; return 2; fi
}

# When executed directly (not sourced), act as the CLI.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  build_liveness "${1:-}"
  exit $?
fi
