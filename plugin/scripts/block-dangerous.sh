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

# Local-deployment / locked-worktree protection (BL-0151, incident 2026-09-22: a worktree-cleanup
# pass ran `git worktree remove` on the live deploy worktree launchd was actively serving from,
# taking Mission Control down with a ghost cwd). Two independent signals, either one protects:
#   (a) the target is under the canonical local-deployments root (DR-089,
#       `/Users/Shared/local-deployments/**`) — this alone would have caught the ORIGINAL incident,
#       since the worktree was not yet locked when it was removed;
#   (b) `git worktree list --porcelain` reports the target as `locked` — generalizes the same
#       protection to any other worktree an operator has deliberately pinned, not just the deploy
#       root, without hardcoding a second project's path (BL-0151's own "Out of scope").
_is_protected_deploy_path() { # $1 = a path operand; returns 0 if it targets a live/locked deploy worktree
  local p="$1" abs real
  case "$p" in -*) return 1 ;; ""|"/"|"~") return 1 ;; esac
  case "$p" in /*) abs="$p" ;; "~/"*) abs="$HOME/${p#\~/}" ;; *) abs="$cwd/$p" ;; esac
  abs="${abs%/}"
  case "$abs" in
    /Users/Shared/local-deployments|/Users/Shared/local-deployments/*) return 0 ;;
  esac
  # `git worktree list --porcelain` reports the PHYSICAL (symlink-resolved) path — macOS's own
  # /tmp and /var are themselves symlinks into /private, so a raw string match on $abs alone
  # false-negatives for any worktree under one of those. Resolve $abs the same way (only if it
  # still exists; an already-removed target has nothing left to protect via the lock check, but
  # the local-deployments prefix rule above still catches it either way).
  real="$abs"
  [ -d "$abs" ] && real=$(cd "$abs" 2>/dev/null && pwd -P)
  git -C "$cwd" worktree list --porcelain 2>/dev/null | awk -v t="$abs" -v r="$real" '
    /^worktree / { wt=$2 } /^locked/ { if (wt == t || wt == r) found=1 } END { exit(found ? 0 : 1) }'
}

# git worktree remove (incl. --force, which is the ONLY thing that bypasses a git-level lock) on a
# protected deploy path — the gate step `_is_protected_deploy_path` cannot rely on git's own lock
# refusal alone, since --force exists precisely to override it.
if echo "$cmd" | grep -Eq '(^|[[:space:];&|])git[[:space:]]+worktree[[:space:]]+remove([[:space:]]|$)'; then
  wt_args=$(printf '%s' "$cmd" | sed -E 's/.*(^|[;&|])[[:space:]]*git[[:space:]]+worktree[[:space:]]+remove[[:space:]]*//; s/[;&|].*$//')
  for tok in $wt_args; do
    case "$tok" in -*) continue ;; esac
    tok="${tok%\"}"; tok="${tok#\"}"; tok="${tok%\'}"; tok="${tok#\'}"
    if _is_protected_deploy_path "$tok"; then
      block "git worktree remove targets a live/locked deployment worktree ('$tok') — local-deployments/ hosts launchd-served always-on copies (DR-089) and a lock alone doesn't stop --force; if this worktree is genuinely done, ask the owner first (BL-0151)"
    fi
  done
fi

# rm with a recursive flag anywhere (before OR after the paths): inspect every path operand.
if echo "$cmd" | grep -Eq '(^|[[:space:];&|])rm[[:space:]]' && echo "$cmd" | grep -Eq '(^|[[:space:]])-[a-zA-Z]*[rR]|--recursive'; then
  # Extract the rm invocation's operands (up to a separator), drop flags, test each path.
  rm_args=$(printf '%s' "$cmd" | sed -E 's/.*(^|[;&|])[[:space:]]*rm[[:space:]]+//; s/[;&|].*$//')
  for tok in $rm_args; do
    tok="${tok%\"}"; tok="${tok#\"}"; tok="${tok%\'}"; tok="${tok#\'}"
    if _protected_under "$tok"; then
      block "recursive delete reaching a protected Pandacorp state path (.pandacorp/, factory/{ideas,memory,profile,portfolio} — directly or inside '$tok') — this layer has no git history; archive/move instead, or ask the owner (BL-0035)"
    fi
    if _is_protected_deploy_path "$tok"; then
      block "recursive delete reaching a live/locked deployment worktree ('$tok') — a raw rm bypasses git's own lock check entirely; local-deployments/ hosts launchd-served always-on copies (DR-089), use 'git worktree remove' or ask the owner (BL-0151)"
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
#
# BL-0120: strip quoted regions FIRST — a `>` inside a single/double-quoted string (e.g. a commit
# trailer `"...<noreply@host.com>"`) is text, not a shell redirect operator, and must never feed the
# extraction below. Naive quote-stripping (this is a heuristic gate, not a shell parser) is enough:
# it eliminates the false-positive class without touching the real-redirect detection.
unquoted_cmd=$(printf '%s' "$cmd" | sed -E "s/\"[^\"]*\"//g; s/'[^']*'//g")
redirs=$(printf '%s' "$unquoted_cmd" | grep -oE '[^>]>[[:space:]]*[^[:space:]<>|;&]+' | sed -E 's/^[^>]>[[:space:]]*//')
for tok in $redirs; do
  tok="${tok%\"}"; tok="${tok#\"}"; tok="${tok%\'}"; tok="${tok#\'}"
  # An empty token is an extraction artifact (e.g. a trailing quote left over), never a real redirect
  # target — do NOT let it fall into _protected_under's "" case, which returns true (BL-0120).
  [ -n "$tok" ] || continue
  # BL-0167: a bare "." or ".." is never a genuine single-file truncation target (the shell refuses to
  # open a directory for writing) — the only way the extractor captures one is as an artifact of
  # adjacent NON-redirect text that happens to contain "> .."/"> ." (a git-range placeholder written
  # as "<base>..<head>", an ellipsis, …). This bit real: `unquoted_cmd`'s quote-stripping above is
  # line-based (`sed -E "s/\"[^\"]*\"//g"` matches a pair on ONE line), so a multi-line
  # `-m "$(cat <<'EOF' … EOF)"` heredoc commit body — the very form this repo's own git workflow
  # uses — never gets its middle lines stripped: whatever text sits on those lines feeds the
  # extraction verbatim. Left unfiltered, the captured ".." resolves via _protected_under's
  # directory-contains-.pandacorp fallback for almost any Pandacorp cwd, false-positiving the whole
  # command. Skipping it costs nothing: `cmd > .` / `cmd > ..` was never a meaningful protection —
  # the shell errors on it at runtime regardless.
  case "$tok" in .|..) continue ;; esac
  # BL-0158: a `>` only TRUNCATES a file that already has content — creating a BRAND-NEW file (e.g. a
  # new card under .pandacorp/inbox/changes/, the change-queue mechanism's own routine write target)
  # is not a truncation and must not be blocked just because the path resembles a protected one.
  # Resolve the operand the same way _protected_under does and skip when nothing exists there yet;
  # truncating an EXISTING protected file (a card overwritten in place, a done/ archive entry,
  # decisions.md, …) is still blocked below — this only widens what counts as "not a truncation".
  case "$tok" in
    /*) abs_tok="$tok" ;;
    "~/"*) abs_tok="$HOME/${tok#\~/}" ;;
    *) abs_tok="$cwd/$tok" ;;
  esac
  [ -e "${abs_tok%/}" ] || continue
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
