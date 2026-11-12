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

# ── BL-0202: git invocations, normalized, and whole-tree writes in a SHARED repository ──────────────
# Every git check below used to match the literal `git <verb>` text, so a global option in between
# (`git -C "$TOP" reset --hard …`, `git --literal-pathspecs clean -fdx`) slipped past all of them. Each
# git invocation is re-emitted as a normalized `git <verb> <args>` line (global options dropped) and the
# checks read the original command PLUS those lines.
#
# Then the BL-0202 rule itself (defense in depth under the build engine's own scoped commands): a
# repository that HOSTS a nested Pandacorp project (Mission Control inside the factory) is shared — the
# owner's parallel sessions keep uncommitted work all over it. A whole-tree git write there overwrites
# that work: `git reset --hard` (always whole-repository, whatever the cwd), and `git checkout`/`git
# restore`/`git clean` with no pathspec or a whole-tree one (`.`, `*`) run at the repository ROOT, or with
# a top-anchored pathspec (`:/`, `:(top)`) from anywhere. Run inside the project directory, `.` means
# the project, so that form stays allowed; an explicit path is always allowed.
_hosts_nested_project() { # $1 = repository toplevel → 0 if some <top>/<dir>/.pandacorp/status.yaml exists
  local f
  for f in "$1"/*/.pandacorp/status.yaml; do [ -f "$f" ] && return 0; done
  return 1
}
_unquote() { local t="$1"; t="${t%\"}"; t="${t#\"}"; t="${t%\'}"; t="${t#\'}"; printf '%s' "$t"; }
git_norm=""
while IFS= read -r seg; do
  read -ra toks <<< "$seg"
  n=${#toks[@]}; gi=-1
  # Only a git invocation in COMMAND position (after env assignments / a shell keyword or wrapper) — never
  # the word "git" inside prose (a commit message body line, an echo'd sentence).
  for ((k = 0; k < n; k++)); do
    tk="${toks[$k]#[({]}"
    case "$tk" in
      git|*/git) gi=$k; break ;;
      then|do|else|'!'|time|command|exec|xargs|sudo|nohup|env|'') continue ;;
      [A-Za-z_]*=*) continue ;;
      *) break ;;
    esac
  done
  [ "$gi" -ge 0 ] || continue
  i=$((gi + 1)); cdir=""; cunknown=0
  while [ "$i" -lt "$n" ]; do
    case "${toks[$i]}" in
      -C) cdir=$(_unquote "${toks[$((i + 1))]:-}"); i=$((i + 2)) ;;
      -c|--git-dir|--work-tree|--namespace) i=$((i + 2)) ;;
      --git-dir=*|--work-tree=*|--namespace=*|--literal-pathspecs|--glob-pathspecs|--noglob-pathspecs|--icase-pathspecs|--no-pager|--no-optional-locks|--no-replace-objects|--bare|-p|-P|--paginate) i=$((i + 1)) ;;
      *) break ;;
    esac
  done
  [ "$i" -lt "$n" ] || continue
  verb="${toks[$i]}"; args=("${toks[@]:$((i + 1))}")
  git_norm="$git_norm"$'\n'"git $verb ${args[*]}"
  case "$cdir" in *'$'*|*'`'*) cunknown=1 ;; esac

  kind=""; top_magic=0
  case "$verb" in
    reset)
      for a in "${args[@]}"; do [ "$a" = "--hard" ] && kind="reset"; done ;;
    checkout|restore|clean)
      specs=(); after_dd=0; skip_next=0; dry=0
      for a in "${args[@]}"; do
        a=$(_unquote "$a")
        if [ "$skip_next" = 1 ]; then skip_next=0; continue; fi
        if [ "$after_dd" = 1 ]; then specs+=("$a"); continue; fi
        case "$a" in
          --) after_dd=1 ;;
          -n|--dry-run) dry=1 ;;
          -e|--exclude|-s|--source|--pathspec-from-file|-b|-B|--orphan) skip_next=1 ;;
          --*) ;;
          -*n*) [ "$verb" = "clean" ] && dry=1 ;;   # combined short flags, e.g. clean -nd
          -*) ;;
          *) specs+=("$a") ;;
        esac
      done
      [ "$dry" = 1 ] && continue
      whole=0
      [ "$verb" = "clean" ] && [ "${#specs[@]}" -eq 0 ] && whole=1
      for a in "${specs[@]}"; do
        case "$a" in
          :/*|':(top)'*) whole=1; top_magic=1 ;;
          .|./|'*') whole=1 ;;
        esac
      done
      [ "$whole" = 1 ] && kind="whole" ;;
  esac
  [ -n "$kind" ] || continue

  if [ "$cunknown" = 1 ]; then effdir=""
  elif [ -n "$cdir" ]; then case "$cdir" in /*) effdir="$cdir" ;; *) effdir="$cwd/$cdir" ;; esac
  else effdir="$cwd"; fi
  top=$(git -C "${effdir:-$cwd}" rev-parse --show-toplevel 2>/dev/null) || continue
  _hosts_nested_project "$top" || continue
  nested=$(for f in "$top"/*/.pandacorp/status.yaml; do [ -f "$f" ] && basename "$(dirname "$(dirname "$f")")"; done | tr '\n' ' ')
  if [ "$kind" = "reset" ]; then
    block "git reset --hard rewinds the WHOLE repository, and this one hosts a nested Pandacorp project (${nested% }): it would discard other sessions' commits and uncommitted work outside your project. Restore only your project's files with an explicit pathspec (git checkout <sha> -- <project>/<path>), or ask the owner (BL-0202)"
  fi
  at_root=0
  if [ "$top_magic" = 1 ] || [ -z "$effdir" ]; then at_root=1
  elif [ -d "$effdir" ] && [ "$(cd "$effdir" && pwd -P)" = "$(cd "$top" && pwd -P)" ]; then at_root=1; fi
  if [ "$at_root" = 1 ]; then
    block "whole-tree 'git $verb' at the root of a repository that hosts a nested Pandacorp project (${nested% }): it would overwrite other sessions' uncommitted work outside your project. Name explicit paths under your project (git $verb … -- <project>/<path>), or ask the owner (BL-0202)"
  fi
done < <(printf '%s\n' "$cmd" | awk '{ gsub(/&&|\|\||[;|&]/, "\n"); print }')
git_cmd="$cmd$git_norm"

# (The broad recursive-delete rule sits below, after the helpers the narrow allow exception needs.)

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

# ── HOOK-RM: a NARROW allow exception to the recursive-delete rules (fail-closed) ───────────────────────
# Policy (owner 2026-11-12): agents may delete the specific things they created (scratch/research dirs,
# worktrees, build output) without asking the owner to run commands. DESIGN: the delete rules below keep
# their historical blocking behaviour on the RAW command text, and every other gate in this file still reads
# the raw text too. Only two shapes are lifted out of the delete rules, each parsed STRICTLY — anything that
# does not parse falls back to the old (blocking) behaviour:
#   1. the whole command is `cat > FILE <<'WORD'` + body + the terminator line, nothing after it: the body is
#      data (quoted delimiter), so words like "rm -rf" in it are not a command (rm_view = the first line only);
#   2. the whole command is simple `rm` invocations, optionally after `cd /abs/path` and `VAR=/abs/path`,
#      separated by `&&`, `;` or newlines, whose every operand is a LITERAL path (no `$` except a same-command
#      VAR prefix, no backtick, glob, ~, .., redirect, pipe, brace, backslash, comment or subshell) that resolves
#      to an allowed place and is not protected state. A clean parse whose operand is too broad is BLOCKED here.
# Allowed place: inside a temp root, a regenerable dir by name (node_modules .next dist build tmp .turbo
# coverage .cache target out), a linked worktree root, or any other path with >= 4 components (>= 2 below $HOME).
_norm_path() { local IFS=/ c out=""; set -f; for c in $1; do case "$c" in ""|.) ;; ..) out="${out%/*}" ;; *) out="$out/$c" ;; esac; done; set +f; printf '%s' "${out:-/}"; }
_phys_path() { # resolve symlinks through the deepest EXISTING ancestor (macOS /tmp, /var are links into /private)
  local d="$1" rest="" r
  while [ "$d" != "/" ] && [ ! -d "$d" ]; do rest="/${d##*/}$rest"; d="${d%/*}"; [ -n "$d" ] || d="/"; done
  r=$(cd "$d" 2>/dev/null && pwd -P) || r="$d"
  if [ "$r" = "/" ]; then printf '%s' "${rest:-/}"; else printf '%s' "$r$rest"; fi
}
HOME_REAL=$(cd "$HOME" 2>/dev/null && pwd -P || printf '%s' "$HOME")
TMPDIR_REAL=""; [ -n "${TMPDIR:-}" ] && TMPDIR_REAL=$(cd "$TMPDIR" 2>/dev/null && pwd -P)
rm_reason=""
_path_verdict() { # $1 = normalised physical absolute path → sets rm_reason when too broad to delete
  local p="$1" root slashes rel
  rm_reason=""
  [ "$p" != "/" ] || { rm_reason="the filesystem root"; return; }
  for root in /tmp /private/tmp /var/tmp /private/var/tmp "$TMPDIR_REAL"; do
    [ -n "$root" ] || continue
    [ "$p" != "$root" ] || { rm_reason="a temp root itself ($root): name the specific subdirectory"; return; }
    case "$p" in "$root"/*) return ;; esac
  done
  case "$p" in
    /var/folders/*/T|/private/var/folders/*/T) rm_reason="a temp root itself ($p)"; return ;;
    /var/folders/*/T/*|/private/var/folders/*/T/*) return ;;
    /System|/System/*|/usr|/usr/*|/bin|/bin/*|/sbin|/sbin/*|/etc|/etc/*|/private|/private/*|/var|/var/*|/Library|/Library/*|/Applications|/Applications/*|/opt|/opt/*|/Volumes|/Volumes/*|/dev|/dev/*|/cores|/cores/*)
      rm_reason="a system path ($p)"; return ;;
  esac
  slashes="${p//[^\/]/}"
  case "${p##*/}" in node_modules|.next|dist|build|tmp|.turbo|coverage|.cache|target|out) [ "${#slashes}" -ge 2 ] && return ;; esac
  [ "$p" != "$HOME_REAL" ] || { rm_reason="your home directory"; return; }
  case "$p" in
    "$HOME_REAL"/*)
      rel="${p#"$HOME_REAL"}"; slashes="${rel//[^\/]/}"
      [ "${#slashes}" -ge 2 ] || rm_reason="a top-level folder of your home ($p): name a deeper path" ;;
    *) [ "${#slashes}" -ge 4 ] || rm_reason="too shallow a path ($p): name a deeper path" ;;
  esac
}

# Shape 1: `cat > FILE <<'WORD'` … WORD, and nothing else. Sets rm_view to the first line.
rm_view="$cmd"; rm_exempt=0
_rm_heredoc_view() {
  local first rest re="^cat[[:space:]]+>>?[[:space:]]*[A-Za-z0-9._/~@+=,:-]+[[:space:]]+(<<-?)[[:space:]]*(['\"])([A-Za-z_][A-Za-z0-9_]*)(['\"])[[:space:]]*\$"
  local op word line found=0
  first="${cmd%%$'\n'*}"; [ "$first" != "$cmd" ] || return 1
  rest="${cmd#*$'\n'}"
  [[ $first =~ $re ]] || return 1
  op="${BASH_REMATCH[1]}"; word="${BASH_REMATCH[3]}"
  [ "${BASH_REMATCH[2]}" = "${BASH_REMATCH[4]}" ] || return 1
  while IFS= read -r line; do
    if [ "$found" = 1 ]; then
      case "$line" in *[![:space:]]*) return 1 ;; esac   # anything executable after the terminator: not this shape
      continue
    fi
    [ "$op" = "<<-" ] && line="${line#"${line%%[!$'\t']*}"}"
    [ "$line" = "$word" ] && found=1
  done <<< "$rest"
  [ "$found" = 1 ] || return 1
  rm_view="$first"
}

# Shape 2: only simple, literal rm invocations. Returns 0 = exempt, 1 = not recognised (old rules decide).
# A clean parse whose recursive-delete operand is broad or protected is blocked right here.
_rm_literal_ok() { case "$1" in ""|*[!A-Za-z0-9._/@+=,:-]*) return 1 ;; esac; return 0; }
_rm_unquote() { # strips ONE matching quote pair; fails on any other quote
  local t="$1"
  case "$t" in
    \"*\") t="${t#\"}"; t="${t%\"}" ;;
    \'*\') t="${t#\'}"; t="${t%\'}" ;;
  esac
  case "$t" in *\"*|*\'*) return 1 ;; esac
  printf '%s' "$t"
}
_rm_classify() {
  local text="$1" t seg a op abs name val dir rec noopt nrm=0 re='^\$([A-Za-z_][A-Za-z0-9_]*)(/.*)?$' vars="" line wtroot
  local -a segs toks ops
  case "$text" in
    *'`'*|*'$('*|*'<'*|*'>'*|*'|'*|*'('*|*')'*|*'{'*|*'}'*|*'\'*|*'#'*|*'!'*|*'*'*|*'?'*|*'['*|*'~'*) return 1 ;;
  esac
  t="${text//&&/;}"
  case "$t" in *'&'*) return 1 ;; esac
  t="${t//$'\n'/;}"
  dir=""; case "$cwd" in /*) dir=$(_norm_path "$cwd") ;; *) return 1 ;; esac
  IFS=';' read -ra segs <<< "$t"
  for seg in "${segs[@]}"; do
    seg="${seg#"${seg%%[![:space:]]*}"}"; seg="${seg%"${seg##*[![:space:]]}"}"
    [ -n "$seg" ] || continue
    read -ra toks <<< "$seg"
    case "${toks[0]}" in
      cd)
        [ "${#toks[@]}" -eq 2 ] || return 1
        a=$(_rm_unquote "${toks[1]}") || return 1
        _rm_literal_ok "$a" || return 1
        case "$a" in /*) ;; *) return 1 ;; esac
        case "/$a/" in */../*) return 1 ;; esac
        dir=$(_norm_path "$a") ;;
      [A-Za-z_]*=*)
        [ "${#toks[@]}" -eq 1 ] || return 1
        name="${toks[0]%%=*}"; val="${toks[0]#*=}"
        case "$name" in *[!A-Za-z0-9_]*) return 1 ;; esac
        val=$(_rm_unquote "$val") || return 1
        _rm_literal_ok "$val" || return 1
        case "$val" in /*) ;; *) return 1 ;; esac
        case "/$val/" in */../*) return 1 ;; esac
        vars="${vars}${name}=$(_norm_path "$val")"$'\n' ;;
      rm)
        nrm=$((nrm + 1)); rec=0; noopt=0; ops=()
        for a in "${toks[@]:1}"; do
          if [ "$noopt" = 0 ]; then
            case "$a" in
              --) noopt=1; continue ;;
              --recursive) rec=1; continue ;;
              --force|--verbose|--dir|--interactive) continue ;;
              --*) return 1 ;;
              -*) case "$a" in -[A-Za-z]*) ;; *) return 1 ;; esac
                  case "$a" in *[!A-Za-z-]*) return 1 ;; esac
                  case "$a" in *[rR]*) rec=1 ;; esac
                  continue ;;
            esac
          fi
          op=$(_rm_unquote "$a") || return 1
          if [[ $op =~ $re ]]; then
            name="${BASH_REMATCH[1]}"; val=""
            while IFS= read -r line; do [ "${line%%=*}" = "$name" ] && val="${line#*=}"; done <<< "$vars"
            [ -n "$val" ] || return 1
            op="$val${BASH_REMATCH[2]}"
          fi
          _rm_literal_ok "$op" || return 1
          case "/$op/" in */../*) return 1 ;; esac
          case "${op%/}" in .|*/.) return 1 ;; esac
          ops+=("$op")
        done
        [ "$rec" = 1 ] || continue
        for op in "${ops[@]}"; do
          case "$op" in /*) abs="$op" ;; *) abs="$dir/$op" ;; esac
          abs=$(_norm_path "$abs")
          wtroot=0; [ -f "$abs/.git" ] && wtroot=1
          abs=$(_phys_path "$abs")
          _path_verdict "$abs"
          [ -z "$rm_reason" ] || block "broad recursive delete: '$op' is $rm_reason. Delete the specific, named directory instead (an explicit deep path, or a relative name after cd into a non-root dir); scratch/temp dirs, git worktrees, node_modules, .next, dist and build are always allowed"
          if [ "$wtroot" = 1 ]; then
            # A LINKED worktree root only holds checked-out copies (its .git is a file): deleting it is routine
            # cleanup; textual state paths (.pandacorp/, factory/memory ...) are still refused below.
            case "$abs" in *"/.pandacorp"|*"/.pandacorp/"*|*/factory/ideas|*/factory/ideas/*|*/factory/memory|*/factory/memory/*) wtroot=0 ;; esac
          fi
          if [ "$wtroot" = 0 ] && _protected_under "$abs"; then
            block "recursive delete reaching a protected Pandacorp state path (.pandacorp/, factory/{ideas,memory,profile,portfolio} — directly or inside '$op') — this layer has no git history; archive/move instead, or ask the owner (BL-0035)"
          fi
          if _is_protected_deploy_path "$abs"; then
            block "recursive delete reaching a live/locked deployment worktree ('$op') — a raw rm bypasses git's own lock check entirely; local-deployments/ hosts launchd-served always-on copies (DR-089), use 'git worktree remove' or ask the owner (BL-0151)"
          fi
        done ;;
      *) return 1 ;;
    esac
  done
  [ "$nrm" -ge 1 ]
}
if _rm_heredoc_view; then :; elif _rm_classify "$cmd"; then rm_exempt=1; fi

# Broad recursive delete of a filesystem-root-ish target (/, ~, ..), ANY flag order/casing.
# BSD/macOS `rm` treats -R as the canonical recursive flag, so the match must be case-insensitive
# on the flag (WS-A F1 — `rm -Rf /` used to sail past the lowercase-only literal).
if [ "$rm_exempt" != 1 ] \
   && echo "$rm_view" | grep -Eq "(^|[[:space:];&|(\"'])rm[[:space:]]" \
   && echo "$rm_view" | grep -Eq '(^|[[:space:]])-[a-zA-Z]*[rR]|--recursive' \
   && echo "$rm_view" | grep -Eq "[[:space:]\"'(](/|~|\\.\\.|\\\$HOME|\\\$\\{HOME\\})[\"')]*([[:space:];&|]|\$)"; then
  block "broad recursive delete (rm -r of /, ~ or ..)"
fi

# rm with a recursive flag anywhere (before OR after the paths): inspect every path operand.
if [ "$rm_exempt" != 1 ] && echo "$rm_view" | grep -Eq '(^|[[:space:];&|])rm[[:space:]]' && echo "$rm_view" | grep -Eq '(^|[[:space:]])-[a-zA-Z]*[rR]|--recursive'; then
  # Extract the rm invocation's operands (up to a separator), drop flags, test each path.
  rm_args=$(printf '%s' "$rm_view" | sed -E 's/.*(^|[;&|])[[:space:]]*rm[[:space:]]+//; s/[;&|].*$//')
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
if echo "$rm_view" | grep -Eq '(^|[[:space:];&|])find[[:space:]]' && echo "$rm_view" | grep -Eq '\-delete|-(exec|execdir|ok|okdir)[[:space:]]+([^[:space:]]*/)?(rm|unlink|rmdir)([[:space:]]|$)'; then
  find_args=$(printf '%s' "$rm_view" | sed -E 's/.*(^|[;&|])[[:space:]]*find[[:space:]]+//; s/[;&|].*$//')
  for tok in $find_args; do
    case "$tok" in -*) break ;; esac   # first flag ends the path list
    ftok="${tok//\"/}"; ftok="${ftok//\'/}"
    # A shallow start path (/, /Users, /Users/x, ~, ~/Documents, $HOME, ..) makes -delete a mass delete.
    if printf '%s\n' "$ftok" | grep -Eq '^(/[^/]+){0,2}/?$|^~(/[^/]*)?/?$|^\$\{?HOME\}?(/[^/]*)?/?$|^\.\.(/\.\.)*/?$'; then
      block "find -delete/-exec rm on a broad start path ('$tok'): name a specific, deeper directory"
    fi
    if _protected_under "$tok"; then
      block "find -delete/-exec rm on a protected Pandacorp state path ('$tok') — this layer has no git history; archive/move instead, or ask the owner (BL-0035)"
    fi
  done
fi
# git clean with an ignored-files flag, either case: -x (ignored + untracked) OR -X (ignored ONLY,
# which targets PRECISELY the gitignored .pandacorp layer). Case-insensitive per WS-A F2.
if echo "$git_cmd" | grep -Eq '(^|[[:space:];&|])git[[:space:]]+clean[[:space:]][^;&|]*-[a-zA-Z]*[xX]'; then
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
echo "$git_cmd" | grep -Eq '(^|[[:space:];&|])git[[:space:]]+stash[[:space:]]+(drop|clear)' && block "git stash drop/clear is unrecoverable — confirm with the owner before discarding a stash"

echo "$git_cmd" | grep -Eq 'git push.*(--force|-f)([^-]|$)' && block "force push (constitution §11)"
echo "$git_cmd" | grep -Eq 'git (branch|push).*(-D|--delete).*(main|master)' && block "deleting main branch"
echo "$cmd" | grep -Eq '(^|[[:space:];&|])gh repo delete' && block "repo deletion requires the owner (DR-007)"

# Hard reset: allow ONLY the engine's sanctioned recovery form — an explicit hex SHA target
# (`git reset --hard <sha>`, the DR-065/DR-067 restore-to-last_green_sha path, which the engine
# precedes with a merge-base ancestry check). Everything else (bare, HEAD~N, a branch/remote ref)
# stays blocked: those are the destructive human-mistake forms. (audit-20 owner decision 1 — the old
# blanket block made the engine's own overnight recovery un-executable.)
if echo "$git_cmd" | grep -Eq 'git reset --hard'; then
  echo "$git_cmd" | grep -Eq 'git reset --hard[[:space:]]+[0-9a-f]{7,40}([[:space:]]|$)' \
    || block "hard reset discards work — only 'git reset --hard <explicit-sha>' (the last_green_sha recovery, DR-067) is allowed; anything else: justify and ask"
fi

# ── BL-0223: host-wide kills of dev/prod servers ─────────────────────────────────────────────────────
# Incident (proposal 41, bench FM-10): an FRD-gate reviewer stopped its ad-hoc `pnpm start` with a host-wide
# `pkill -f "next start"`; pkill matches the command line of EVERY process on the machine, so an unrelated
# `next start` (the benchmark oracle, a parallel session's preview, Mission Control itself) died with it.
# The same blast radius comes from `killall`, from `lsof -ti :<port> | xargs kill` on a port the agent did not
# bind, and from any pid list built by pattern (pgrep/ps|grep|awk) and fed to kill. A kill is allowed only when
# scoped to a PID or process group the agent started itself: `kill <PID>`, `kill -- -<PGID>`, `pkill -P <PID>`
# (children of its own PID) — which `.pandacorp/serve-once.sh` does by construction. Heuristic, command-position
# only (never prose in a commit message or an echo'd sentence); the lines are split on separators, pipes kept.
SERVER_KILL_TARGETS='(^|[^a-z0-9])(next|node|nodejs|vite|playwright|pnpm|npm|npx|tsx)([^a-z0-9]|$)'
SERVER_KILL_HINT="start the server with 'bash .pandacorp/serve-once.sh -- <cmd>' (ephemeral port, own process group, killed exactly on exit) or record its PID (\$!) and stop only that: kill <PID> / kill -- -<PGID> / pkill -P <PID>"
srv_disc=0
while IFS= read -r seg; do
  srv_pipe=0
  case "$seg" in '@@PIPE@@'*) srv_pipe=1; seg="${seg#@@PIPE@@}" ;; esac
  [ "$srv_pipe" = 1 ] || srv_disc=0
  read -ra toks <<< "$seg"
  n=${#toks[@]}; srv_cmd=""; srv_ci=-1
  for ((k = 0; k < n; k++)); do
    tk="${toks[$k]#[({]}"
    case "$tk" in
      then|do|else|'!'|time|command|exec|sudo|nohup|env|'') continue ;;
      -*) continue ;;
      [A-Za-z_]*=*) continue ;;
      *) srv_cmd="${tk##*/}"; srv_ci=$k; break ;;
    esac
  done
  [ "$srv_ci" -ge 0 ] || continue
  srv_args=("${toks[@]:$((srv_ci + 1))}")
  srv_own_children=0
  for a in "${srv_args[@]}"; do case "$a" in -P|--parent|-P[0-9\$]*) srv_own_children=1 ;; esac; done
  case "$srv_cmd" in
    pkill|killall)
      [ "$srv_own_children" = 1 ] && continue
      pat=""
      for a in "${srv_args[@]}"; do case "$a" in -*) ;; *) pat="$pat $a" ;; esac; done
      pat=$(printf '%s' "$pat" | tr '[:upper:]' '[:lower:]')
      if printf '%s' "$pat" | grep -Eq "$SERVER_KILL_TARGETS"; then
        block "'$srv_cmd$pat' is a HOST-WIDE kill by pattern: it terminates every matching server on the machine (the owner's other projects, parallel sessions, a benchmark oracle, Mission Control), not just yours — $SERVER_KILL_HINT (BL-0223)"
      fi ;;
    kill)
      if [ "$srv_own_children" = 0 ] && printf '%s' "$seg" | grep -Eq '(\$\(|`)[[:space:]]*(lsof|pgrep|pidof)([[:space:]]|$)'; then
        block "kill of a pid list found by port/pattern (lsof/pgrep) can hit servers you did not start — $SERVER_KILL_HINT (BL-0223)"
      fi ;;
    xargs)
      kill_arg=0
      for a in "${srv_args[@]}"; do [ "$a" = "kill" ] && kill_arg=1; done
      if [ "$kill_arg" = 1 ] && [ "$srv_disc" = 1 ]; then
        block "'| xargs kill' on a pid list found by port/pattern (lsof/pgrep/ps|grep) can hit servers you did not start — $SERVER_KILL_HINT (BL-0223)"
      fi ;;
    fuser)
      for a in "${srv_args[@]}"; do
        case "$a" in -k*|-[a-zA-Z]*k*) block "fuser -k kills whatever holds the port, including servers you did not start — $SERVER_KILL_HINT (BL-0223)" ;; esac
      done ;;
    lsof|pgrep|pidof|ps|grep|awk|netstat|ss)
      [ "$srv_own_children" = 1 ] || srv_disc=1 ;;
  esac
done < <(printf '%s\n' "$cmd" | awk '{ gsub(/&&|\|\||[;&]/, "\n"); gsub(/\|/, "\n@@PIPE@@"); print }')

# Production deploys are behind the DR-004 HUMAN GATE — mechanically, not just in prose (audit-20 P1-5;
# infra.md says human gates ship as hard rules, this is that rule). The agent presents the summary and
# the OWNER approves; only after explicit approval in the conversation does the deploy run (re-running
# the exact command after the owner's OK is the approved path — the block message says so).
echo "$cmd" | grep -Eq '(^|[[:space:];&|])vercel( .*)? (--prod|deploy .*--prod)' && block "production deploy = human gate (DR-004): present staging + costs, get the owner's explicit OK first"

# DR-138 / INFRA-7: Vercel deploys come ONLY from the GitHub integration (a push to `main` = production,
# a push to any other branch = preview). A CLI upload (`vercel`, `vercel deploy`, `vercel redeploy`,
# with or without --prod) is never the path, owner OK or not — setup subcommands (link, env, git
# connect, project, domains, logs, rollback) and --version/--help stay allowed.
while IFS= read -r seg; do
  set -f; set -- $seg; set +f
  # the command word only (after VAR=val prefixes and a package-runner launcher), never an argument
  while [ $# -gt 0 ]; do
    case "$1" in *=*|npx|bunx|yarn|pnpm|dlx|exec) shift ;; *) break ;; esac
  done
  [ "${1:-}" = "vercel" ] || continue
  shift
  sub=""
  for t in "$@"; do
    case "$t" in -v|--version|-h|--help) sub="info"; break ;; -*) ;; *) sub="$t"; break ;; esac
  done
  case "$sub" in
    ""|deploy|redeploy) block "manual Vercel deploy is forbidden (DR-138): deploys run only through the GitHub integration — push to a non-main branch for a preview; production is a merge/push to main, and only on the owner's explicit order once launched" ;;
  esac
done < <(printf '%s\n' "$cmd" | awk '{ gsub(/&&|\|\||[;|&]/, "\n"); print }')

# DR-138 / INFRA-8: once a project is LAUNCHED externally (status.yaml `phase: release` and a
# deploy_target other than `internal`; a missing deploy_target counts as external, fail-safe), GitHub
# `main` IS production — Vercel ships every push to it. Publishing to main therefore needs the owner's
# explicit order in chat; the agent then re-runs the push prefixed with PANDACORP_OWNER_RELEASE_OK=1.
# Pre-launch projects, internal tools and the factory are unaffected.
launched_status=""
for d in "$scope_root" "$cwd"; do [ -f "$d/.pandacorp/status.yaml" ] && { launched_status="$d/.pandacorp/status.yaml"; break; }; done
if [ -n "$launched_status" ] \
   && grep -Eq '^phase:[[:space:]]*release([[:space:]]|#|$)' "$launched_status" \
   && ! grep -Eq '^deploy_target:[[:space:]]*internal([[:space:]]|#|$)' "$launched_status" \
   && ! printf '%s' "$cmd" | grep -q 'PANDACORP_OWNER_RELEASE_OK=1'; then
  cur_branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  while IFS= read -r seg; do
    set -f; set -- $seg; set +f
    while [ $# -gt 1 ] && ! { [ "$1" = "git" ] && [ "$2" = "push" ]; }; do shift; done
    [ $# -gt 1 ] && [ "$1" = "git" ] && [ "$2" = "push" ] || continue
    shift 2
    remote=""; refs=""; all=0
    for t in "$@"; do
      case "$t" in
        --all|--mirror) all=1 ;;
        -*) ;;
        *) if [ -z "$remote" ]; then remote="$t"; else refs="$refs $t"; fi ;;
      esac
    done
    to_main=$all
    if [ -z "${refs// /}" ]; then
      [ "$cur_branch" = "main" ] && to_main=1
    else
      for r in $refs; do
        r="${r#+}"; dst="${r##*:}"
        [ "$r" = "HEAD" ] && [ "$cur_branch" = "main" ] && dst="main"
        case "$dst" in main|refs/heads/main) to_main=1 ;; esac
      done
    fi
    [ "$to_main" = 1 ] && block "this project is LAUNCHED: GitHub main is production and Vercel deploys every push to it (DR-138). Push your branch for a preview instead; publish to main only after the owner's explicit order in chat, then re-run prefixed with PANDACORP_OWNER_RELEASE_OK=1"
  done < <(printf '%s\n' "$cmd" | awk '{ gsub(/&&|\|\||[;|&]/, "\n"); print }')
fi

echo "$cmd" | grep -Eq '(^|[[:space:];&|])(flyctl|fly) deploy' && block "production deploy = human gate (DR-004): get the owner's explicit OK first"
echo "$cmd" | grep -Eq '(^|[[:space:];&|])railway (up|deploy)' && block "production deploy = human gate (DR-004): get the owner's explicit OK first"
echo "$cmd" | grep -Eq '(^|[[:space:];&|])wrangler (deploy|publish)' && block "production deploy = human gate (DR-004): get the owner's explicit OK first"

exit 0
