#!/bin/bash
# Pandacorp pending-work check (DR-096) — "did I leave a worktree un-merged?"
#
# The invariant: merge-queue.sh removes the worktree AND its branch only on a SUCCESSFUL merge, so
# anything that survives = work NOT yet in main. This surfaces it so a forgotten parallel session can't
# silently strand its progress. Two signals, unioned:
#   1. surviving worktrees (other than the main checkout) — pending even if their work is UNCOMMITTED;
#   2. unmerged branches whose worktree is already gone — `git branch --no-merged` (the branch outlives
#      the worktree, which Claude Code may sweep).
#
# Modes:  (default) human table + counts · --json (Mission Control aggregates across projects) ·
#         --notify (desktop notification + exit 1 IF anything is STALE).
# Status: in-progress (uncommitted or recent) · ready (committed, clean, idle, not merged) · stale (idle > STALE_HOURS).
set -euo pipefail

MODE="${1:-human}"
STALE_HOURS="${PANDACORP_STALE_HOURS:-3}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "pending-work: not a git repo" >&2; exit 0; }
cd "$ROOT"
DEFAULT_BRANCH="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || echo main)"
MAIN_WT="$(git worktree list --porcelain | awk -v b="refs/heads/$DEFAULT_BRANCH" '/^worktree /{w=$2} /^branch /{if($2==b) print w}' | head -1)"
NOW=$(date +%s)

mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo "$NOW"; }
ROWS=""   # newline-joined "branch|worktree|ahead|ageH|status" (string, not array — bash 3.2 safe)
LEFTOVERS=""  # merged+clean worktrees a session kept for cwd safety — removable, never pending
TOTAL=0; STALE=0

emit() {  # branch worktree ahead lastTs
  local br="$1" wt="$2" ahead="$3" ts="$4" dirty="$5"
  local age_h=$(( (NOW - ts) / 3600 )) st
  if [ "$age_h" -ge "$STALE_HOURS" ]; then st="stale"; STALE=$((STALE+1))
  elif [ "$dirty" = "1" ] || [ "$wt" != "-" ]; then st="in-progress"
  else st="ready"; fi
  ROWS="${ROWS}${br}|${wt}|${ahead}|${age_h}h|${st}"$'\n'
  TOTAL=$((TOTAL+1))
}

SEEN=" "
# 1) surviving worktrees (skip the main checkout + detached HEAD worktrees)
while IFS= read -r line; do
  case "$line" in worktree\ *) wt="${line#worktree }";; branch\ *) br="${line#branch refs/heads/}";;
    "") if [ -n "${wt:-}" ] && [ "$wt" != "$MAIN_WT" ] && [ -n "${br:-}" ]; then
          ahead=$(git rev-list --count "$DEFAULT_BRANCH..$br" 2>/dev/null || echo 0)
          dirty=$([ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ] && echo 1 || echo 0)
          if [ "$ahead" = "0" ] && [ "$dirty" = "0" ]; then
            # Fully merged + clean: a session shell merge-queue deliberately KEPT (deleting the
            # dir under a live session dangles its cwd). Nothing pending — every commit is in
            # main. Listed apart as removable, never counted as pending work.
            LEFTOVERS="${LEFTOVERS}${br}|${wt}"$'\n'
          else
            last=$(git log -1 --format=%ct "$br" 2>/dev/null || echo "$NOW"); dm=$(mtime "$wt")
            [ "$dm" -gt "$last" ] && last="$dm"
            emit "$br" "$wt" "$ahead" "$last" "$dirty"
          fi
          SEEN="${SEEN}${br} "
        fi; wt=""; br="";;
  esac
done < <(git worktree list --porcelain; echo)

# 2) unmerged branches whose worktree is already gone
while IFS= read -r br; do
  br="$(echo "$br" | sed 's/^[*+ ] *//')"
  [ -z "$br" ] || [ "$br" = "$DEFAULT_BRANCH" ] && continue
  case "$SEEN" in *" $br "*) continue;; esac
  ahead=$(git rev-list --count "$DEFAULT_BRANCH..$br" 2>/dev/null || echo 0)
  last=$(git log -1 --format=%ct "$br" 2>/dev/null || echo "$NOW")
  emit "$br" "-" "$ahead" "$last" "0"
done < <(git branch --no-merged "$DEFAULT_BRANCH" 2>/dev/null || true)

print_rows() { [ -n "$ROWS" ] && printf '%s' "$ROWS" | sed '/^$/d'; }

case "$MODE" in
  --json)
    # Emit valid JSON even for unusual branch/worktree names (spaces, quotes, backslashes). Prefer jq
    # (the factory's hooks already require it) for correct escaping; fall back to a manual emitter that
    # still escapes the JSON-breaking characters (backslash + double-quote) so the output never corrupts.
    if command -v jq >/dev/null 2>&1; then
      items="[]"
      if [ -n "$ROWS" ]; then
        items=$(print_rows | while IFS='|' read -r br wt ahead age st; do
          [ -z "$br" ] && continue
          jq -nc --arg branch "$br" --arg worktree "$wt" --arg ahead "$ahead" --arg age "$age" --arg status "$st" \
            '{branch:$branch,worktree:$worktree,ahead:$ahead,age:$age,status:$status}'
        done | jq -sc '.')
      fi
      jq -nc --arg default "$DEFAULT_BRANCH" --argjson total "$TOTAL" --argjson stale "$STALE" --argjson items "$items" \
        '{default:$default,total:$total,stale:$stale,items:$items}'
    else
      esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
      printf '{"default":"%s","total":%d,"stale":%d,"items":[' "$(esc "$DEFAULT_BRANCH")" "$TOTAL" "$STALE"
      first=1
      while IFS='|' read -r br wt ahead age st; do
        [ -z "$br" ] && continue
        [ $first -eq 1 ] || printf ','; first=0
        printf '{"branch":"%s","worktree":"%s","ahead":"%s","age":"%s","status":"%s"}' \
          "$(esc "$br")" "$(esc "$wt")" "$(esc "$ahead")" "$(esc "$age")" "$(esc "$st")"
      done <<< "$(print_rows)"
      printf ']}\n'
    fi ;;
  --notify)
    if [ "$STALE" -gt 0 ]; then
      msg="$STALE worktree(s) sin mergear llevan >${STALE_HOURS}h. Revísalos antes de perderlos."
      command -v osascript >/dev/null 2>&1 && osascript -e "display notification \"$msg\" with title \"Pandacorp: trabajo sin mergear\"" 2>/dev/null || true
      echo "$msg" >&2; exit 1
    fi ;;
  *)
    if [ "$TOTAL" -eq 0 ]; then
      echo "✓ Sin trabajo pendiente: todo está en $DEFAULT_BRANCH."
      if [ -n "$LEFTOVERS" ]; then
        echo "  ♻ Worktrees ya mergeados (seguro de borrar desde fuera):"
        printf '%s' "$LEFTOVERS" | sed '/^$/d' | while IFS='|' read -r br wt; do
          echo "    git worktree remove --force $wt && git branch -D $br"
        done
      fi
      exit 0
    fi
    echo "⎇ $TOTAL rama(s)/worktree(s) SIN MERGEAR a $DEFAULT_BRANCH ($STALE estancada/s >${STALE_HOURS}h):"; echo
    printf '  %-34s %-7s %-6s %-13s %s\n' "RAMA" "COMMITS" "EDAD" "ESTADO" "WORKTREE"
    while IFS='|' read -r br wt ahead age st; do
      [ -z "$br" ] && continue
      case "$st" in stale) i="🔴";; in-progress) i="🟡";; *) i="🟢";; esac
      printf '  %-34s %-7s %-6s %s %-10s %s\n' "$br" "+$ahead" "$age" "$i" "$st" "$wt"
    done <<< "$(print_rows)"
    echo; echo "  🔴 estancado  🟡 en curso  🟢 listo (sin mergear). Mergea: cd <worktree> && bash .pandacorp/merge-queue.sh"
    if [ -n "$LEFTOVERS" ]; then
      echo; echo "  ♻ Worktrees ya MERGEADOS (cascarón de sesión, seguro de borrar desde fuera):"
      printf '%s' "$LEFTOVERS" | sed '/^$/d' | while IFS='|' read -r br wt; do
        echo "    git worktree remove --force $wt && git branch -D $br"
      done
    fi ;;
esac
