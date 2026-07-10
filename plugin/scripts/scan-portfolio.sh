#!/bin/bash
# Pandacorp portfolio scanner: read-only cross-check of factory/portfolio.md rows against each
# project's own .pandacorp/status.yaml. Prints one line per project row:
#   <path> · phase=<phase> · <summary> · overlay=<project> vs <factory current> · drift=<flag>
# Read-only by design: NEVER writes factory/portfolio.md (gitignored owner data) or any project
# file. Degrades honestly (never crashes, never deletes):
#   - missing factory/portfolio.md          -> clear message, exit 1
#   - a row whose project path/.pandacorp/status.yaml is missing/unreadable -> reported BROKEN,
#     the scan continues with the remaining rows
# Usage: scan-portfolio.sh [/path/to/factory]
# Defaults to the factory root = the repo this is run from (the cwd is the factory).

FACTORY="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
PORTFOLIO="$FACTORY/factory/portfolio.md"
OVERLAY_FILE="$FACTORY/plugin/templates/OVERLAY_VERSION"

if [ ! -f "$PORTFOLIO" ]; then
  echo "No portfolio at $PORTFOLIO — nothing to scan (bootstrap it via /pandacorp:onboarding step 5, or copy factory/portfolio.example.md)."
  exit 1
fi

CURRENT_OVERLAY="unknown"
if [ -f "$OVERLAY_FILE" ]; then
  CURRENT_OVERLAY=$(tr -d '[:space:]' < "$OVERLAY_FILE")
fi
[ -z "$CURRENT_OVERLAY" ] && CURRENT_OVERLAY="unknown"

# get_field <file> <yaml-key> — first match, comment/quote/whitespace stripped. Degrades to
# empty (never errors) when the key is absent — a missing field is reported as UNKNOWN, not fatal.
get_field() {
  awk -v k="^${2}:" '
    $0 ~ k {
      line = $0
      sub(k, "", line)
      sub(/#.*/, "", line)
      gsub(/^[ \t"]+|[ \t"]+$/, "", line)
      print line
      exit
    }
  ' "$1" 2>/dev/null
}

rows=0
broken=0

while IFS='|' read -r _ name path _repo _rest; do
  name=$(echo "$name" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  [ -z "$name" ] && continue
  case "$name" in
    Proyecto|-*) continue ;;
  esac

  rows=$((rows + 1))
  raw_path=$(echo "$path" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  proj_path=$(echo "$raw_path" | sed -n 's/.*`\([^`]*\)`.*/\1/p')

  if [ -z "$proj_path" ]; then
    echo "BROKEN · $name · no path parsed from portfolio row (Ruta='$raw_path')"
    broken=$((broken + 1))
    continue
  fi

  resolved="$FACTORY/$proj_path"
  if [ ! -d "$resolved" ]; then
    echo "BROKEN · $name · $proj_path · project path not found"
    broken=$((broken + 1))
    continue
  fi

  status_file="$resolved/.pandacorp/status.yaml"
  if [ ! -f "$status_file" ]; then
    echo "BROKEN · $name · $proj_path · .pandacorp/status.yaml missing"
    broken=$((broken + 1))
    continue
  fi

  phase=$(get_field "$status_file" "phase")
  overlay=$(get_field "$status_file" "overlay_version")
  wo_total=$(get_field "$status_file" "work_orders_total")
  wo_done=$(get_field "$status_file" "work_orders_done")
  running=$(get_field "$status_file" "running")

  [ -z "$phase" ] && phase="UNKNOWN"
  [ -z "$running" ] && running="unknown"

  summary="WOs ${wo_done:-?}/${wo_total:-?} · running=${running}"

  if [ "$CURRENT_OVERLAY" = "unknown" ]; then
    drift="unknown (factory OVERLAY_VERSION unreadable)"
  elif [ -z "$overlay" ]; then
    drift="unknown (project overlay_version not set)"
    overlay="UNKNOWN"
  elif [ "$overlay" = "$CURRENT_OVERLAY" ]; then
    drift="none"
  else
    drift="DRIFT"
  fi

  echo "$proj_path · phase=$phase · $summary · overlay=$overlay vs $CURRENT_OVERLAY · drift=$drift"
done < "$PORTFOLIO"

echo "---"
echo "Scanned $rows project row(s), $broken broken."
[ "$rows" -eq 0 ] && exit 1
exit 0
