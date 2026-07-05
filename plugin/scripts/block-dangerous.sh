#!/bin/bash
# Pandacorp PreToolUse gate: blocks dangerous bash commands in Pandacorp projects.
# Exit 2 = block (stderr shown to the model). Exit 0 = allow.

# FAIL-CLOSED on our own plumbing (Fable-audit 2026-07-04 #9): a gate that silently allows
# everything when jq is missing is worse than no gate — it looks armed while disarmed.
command -v jq >/dev/null 2>&1 || { echo "BLOCKED: Pandacorp safety gate cannot parse its input (jq missing) — fix the environment before running Bash" >&2; exit 2; }

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // "."')
cmd=$(echo "$input" | jq -r '.tool_input.command // ""')

# Scope: act in Pandacorp folders — a project (.pandacorp/status.yaml, incl. adopted ones) OR the
# factory (Pandacorp in CLAUDE.md). Resolve from the REPO ROOT, not just the hook cwd: a session
# parked in a subdirectory (mission-control/src/…) is still inside a Pandacorp repo and must not
# disarm the gate (Fable-audit 2026-07-04 #9).
scope_root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || echo "$cwd")
in_scope=0
for d in "$cwd" "$scope_root"; do
  [ -f "$d/.pandacorp/status.yaml" ] && in_scope=1
  grep -qs "Pandacorp" "$d/CLAUDE.md" 2>/dev/null && in_scope=1
done
[ "$in_scope" = "1" ] || exit 0

block() {
  echo "BLOCKED by Pandacorp policy: $1" >&2
  exit 2
}

# Broad recursive delete of a filesystem-root-ish target (/, ~, ..), ANY flag order/casing.
# BSD/macOS `rm` treats -R as the canonical recursive flag, so the match must be case-insensitive
# on the flag (WS-A F1 — `rm -Rf /` used to sail past the lowercase-only literal).
if echo "$cmd" | grep -Eq '(^|[[:space:];&|])rm[[:space:]]' \
   && echo "$cmd" | grep -Eq '(^|[[:space:]])-[a-zA-Z]*[rR]|--recursive' \
   && echo "$cmd" | grep -Eq '[[:space:]](/|~|\.\.)([[:space:]]|$)'; then
  block "broad recursive delete (rm -r of /, ~ or ..)"
fi

# Protected state paths (BL-0035, incident 2026-07-04: mission-control/.pandacorp wiped, the
# gitignored inbox lost for good — no git history by design). A recursive delete or an
# ignored-files clean aimed at the owner/state layer is NEVER routine: these paths are
# append-only/managed (archive to done/, never rm). If genuinely needed, the OWNER runs it.
#
# Hardened per Fable-audit 2026-07-04 #1 — the original pattern missed the incident's own vectors:
#   (a) flag order: GNU `rm path -r` (trailing flags) as well as `rm -r path`;
#   (b) PARENT-DIRECTORY deletes: `rm -rf mission-control` contains .pandacorp without naming it —
#       so any `rm -r` whose path operand resolves (relative to cwd) to a dir that CONTAINS a
#       protected path is blocked too;
#   (c) non-rm deleters: `find <protected> -delete`.
_protected_under() { # $1 = a path operand; returns 0 if it IS/CONTAINS/IS-INSIDE a protected path
  local p="$1" abs
  case "$p" in -*) return 1 ;; ""|"/"|"~") return 0 ;; esac   # bare /, ~ handled by the broad rule above
  case "$p" in /*) abs="$p" ;; "~/"*) abs="$HOME/${p#\~/}" ;; *) abs="$cwd/$p" ;; esac
  abs="${abs%/}"
  # Direct mention or inside a protected subtree
  case "$abs" in
    *"/.pandacorp"|*"/.pandacorp/"*) return 0 ;;
    */factory/ideas|*/factory/ideas/*|*/factory/memory|*/factory/memory/*) return 0 ;;
    */factory/profile.md|*/factory/portfolio.md) return 0 ;;
  esac
  # Parent-directory delete: the target exists and CONTAINS a protected dir/file
  if [ -d "$abs" ]; then
    [ -e "$abs/.pandacorp" ] && return 0
    find "$abs" -maxdepth 3 -name ".pandacorp" -print -quit 2>/dev/null | grep -q . && return 0
    case "$abs" in *"/factory") return 0 ;; esac
    [ -d "$abs/factory/ideas" ] || [ -d "$abs/factory/memory" ] && return 0
  fi
  return 1
}

# rm with a recursive flag anywhere (before OR after the paths): inspect every path operand.
if echo "$cmd" | grep -Eq '(^|[[:space:];&|])rm[[:space:]]' && echo "$cmd" | grep -Eq '(^|[[:space:]])-[a-zA-Z]*[rR]|--recursive'; then
  # Extract the rm invocation's operands (up to a separator), drop flags, test each path.
  rm_args=$(printf '%s' "$cmd" | sed -E 's/.*(^|[;&|])[[:space:]]*rm[[:space:]]+//; s/[;&|].*$//')
  for tok in $rm_args; do
    tok="${tok%\"}"; tok="${tok#\"}"; tok="${tok%\'}"; tok="${tok#\'}"
    if _protected_under "$tok"; then
      block "recursive delete reaching a protected Pandacorp state path (.pandacorp/, factory/{ideas,memory,profile,portfolio} — directly or inside '$tok') — this layer has no git history; archive/move instead, or ask the owner (BL-0035)"
    fi
  done
fi
# find … -delete / -exec rm aimed at a protected path
if echo "$cmd" | grep -Eq '(^|[[:space:];&|])find[[:space:]]' && echo "$cmd" | grep -Eq '\-delete|\-exec[[:space:]]+rm'; then
  find_args=$(printf '%s' "$cmd" | sed -E 's/.*(^|[;&|])[[:space:]]*find[[:space:]]+//; s/[;&|].*$//')
  for tok in $find_args; do
    case "$tok" in -*) break ;; esac   # first flag ends the path list
    if _protected_under "$tok"; then
      block "find -delete/-exec rm on a protected Pandacorp state path ('$tok') — this layer has no git history; archive/move instead, or ask the owner (BL-0035)"
    fi
  done
fi
# git clean with an ignored-files flag, either case: -x (ignored + untracked) OR -X (ignored ONLY,
# which targets PRECISELY the gitignored .pandacorp layer). Case-insensitive per WS-A F2.
if echo "$cmd" | grep -Eq '(^|[[:space:];&|])git[[:space:]]+clean[[:space:]][^;&|]*-[a-zA-Z]*[xX]'; then
  block "git clean -x/-X removes gitignored files — the .pandacorp state layer (inbox/comms) would be lost with no git history; use plain 'git clean -fd' (keeps ignored) or ask the owner (BL-0035)"
fi

# Redirect-truncation of a protected state file (`: > f`, `cat /dev/null > f`, `cmd > f`): a single
# `>` (not `>>`) truncates an append-only, historyless owner-state file to zero — the same BL-0035
# loss class as a delete (WS-A F3). Test each single-`>` redirect target against the protected set.
redirs=$(printf '%s' "$cmd" | grep -oE '[^>]>[[:space:]]*[^[:space:]<>|;&]+' | sed -E 's/^[^>]>[[:space:]]*//')
for tok in $redirs; do
  tok="${tok%\"}"; tok="${tok#\"}"; tok="${tok%\'}"; tok="${tok#\'}"
  if _protected_under "$tok"; then
    block "redirect '> $tok' truncates a protected Pandacorp state path to zero — this append-only layer has no git history; never reset it in place, archive/move instead or ask the owner (BL-0035)"
  fi
done

# git stash drop/clear is unrecoverable (dropped stashes have no reflog entry).
echo "$cmd" | grep -Eq '(^|[[:space:];&|])git[[:space:]]+stash[[:space:]]+(drop|clear)' && block "git stash drop/clear is unrecoverable — confirm with the owner before discarding a stash"

echo "$cmd" | grep -Eq 'git push.*(--force|-f)([^-]|$)' && block "force push (constitution §11)"
echo "$cmd" | grep -Eq 'git (branch|push).*(-D|--delete).*(main|master)' && block "deleting main branch"
echo "$cmd" | grep -Eq '(^|[[:space:];&|])gh repo delete' && block "repo deletion requires the owner (DR-007)"

# Hard reset: allow ONLY the engine's sanctioned recovery form — an explicit hex SHA target
# (`git reset --hard <sha>`, the DR-065/DR-067 restore-to-last_green_sha path, which the engine
# precedes with a merge-base ancestry check). Everything else (bare, HEAD~N, a branch/remote ref)
# stays blocked: those are the destructive human-mistake forms. (audit-20 owner decision 1 — the old
# blanket block made the engine's own overnight recovery un-executable.)
if echo "$cmd" | grep -Eq 'git reset --hard'; then
  echo "$cmd" | grep -Eq 'git reset --hard[[:space:]]+[0-9a-f]{7,40}([[:space:]]|$)' \
    || block "hard reset discards work — only 'git reset --hard <explicit-sha>' (the last_green_sha recovery, DR-067) is allowed; anything else: justify and ask"
fi

# Production deploys are behind the DR-004 HUMAN GATE — mechanically, not just in prose (audit-20 P1-5;
# infra.md says human gates ship as hard rules, this is that rule). The agent presents the summary and
# the OWNER approves; only after explicit approval in the conversation does the deploy run (re-running
# the exact command after the owner's OK is the approved path — the block message says so).
echo "$cmd" | grep -Eq '(^|[[:space:];&|])vercel( .*)? (--prod|deploy .*--prod)' && block "production deploy = human gate (DR-004): present staging + costs, get the owner's explicit OK first"
echo "$cmd" | grep -Eq '(^|[[:space:];&|])(flyctl|fly) deploy' && block "production deploy = human gate (DR-004): get the owner's explicit OK first"
echo "$cmd" | grep -Eq '(^|[[:space:];&|])railway (up|deploy)' && block "production deploy = human gate (DR-004): get the owner's explicit OK first"
echo "$cmd" | grep -Eq '(^|[[:space:];&|])wrangler (deploy|publish)' && block "production deploy = human gate (DR-004): get the owner's explicit OK first"

exit 0
