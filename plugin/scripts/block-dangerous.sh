#!/bin/bash
# Pandacorp PreToolUse gate: blocks dangerous bash commands in Pandacorp projects.
# Exit 2 = block (stderr shown to the model). Exit 0 = allow.

# FAIL-CLOSED on our own plumbing (Fable-audit 2026-07-04 #9): a gate that silently allows
# everything when jq is missing is worse than no gate — it looks armed while disarmed.
command -v jq >/dev/null 2>&1 || { echo "BLOCKED: Pandacorp safety gate cannot parse its input (jq missing) — fix the environment before running Bash" >&2; exit 2; }

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // "."')

# ── Executable-part extraction (HOOK-RM) ─────────────────────────────────────────────────────────────
# Every rule below reads what the shell would EXECUTE, never prose: heredoc bodies (`cat > f <<'EOF' … EOF`,
# `git commit -m "$(cat <<'EOF' … EOF)"`) and the insides of quoted strings are text, not commands. A heredoc
# fed to a SHELL (`bash <<EOF`, `… | sh`) is the one exception: that body IS code, so it is kept.
_strip_heredocs() {
  awk '
    BEGIN { tag = ""; keep = 0 }
    {
      if (tag != "") {
        line = $0; sub(/^[ \t]+/, "", line)
        if (line == tag) tag = ""
        else if (keep) print
        next
      }
      print
      if (match($0, /<<-?[ \t]*\\?["\047]?[A-Za-z_][A-Za-z0-9_]*["\047]?/)) {
        t = substr($0, RSTART, RLENGTH); gsub(/^<<-?[ \t]*/, "", t); gsub(/["\047\\]/, "", t); tag = t
        keep = ($0 ~ /(^|[ \t;&|(])(ba|z|da|k)?sh([ \t]|$)|(^|[ \t;&|])(eval|source)[ \t]/)
      }
    }'
}

# Splits a command line into simple commands (one per output line) on ; & | && || and newlines, but ONLY
# outside quotes — `git commit -m "fix; rm -rf x"` is one command, not two.
_exec_segments() {
  awk 'BEGIN { RS = "\001"; sq = "\047"; dq = "\042" }
  {
    s = $0; n = length(s); q = ""; out = ""
    for (i = 1; i <= n; i++) {
      c = substr(s, i, 1); nx = substr(s, i + 1, 1)
      if (q != "") {
        if (c == q) q = ""
        else if (q == dq && c == "\\") { out = out c nx; i++; continue }
        if (c == "\n") c = " "
        out = out c; continue
      }
      if (c == "\\") { if (nx == "\n") out = out " "; else out = out c nx; i++; continue }
      if (c == sq || c == dq) { q = c; out = out c; continue }
      if (c == "\n" || c == ";") { print out; out = ""; continue }
      if (c == "&" || c == "|") {
        pv = substr(s, i - 1, 1)
        if (c == "&" && (nx == ">" || pv == ">")) { out = out c; continue }
        if (nx == c) i++
        print out; out = ""; continue
      }
      out = out c
    }
    print out
  }'
}

cmd=$(echo "$input" | jq -r '.tool_input.command // ""' | _strip_heredocs)

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
done < <(printf '%s\n' "$cmd" | _exec_segments)
git_cmd="$cmd$git_norm"

# (Broad recursive deletes are handled by the executable-part scan below, next to the protected-state rules.)

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
  case "$p" in /*) abs="$p" ;; "~/"*) abs="$HOME/${p#\~/}" ;; *) abs="${base_dir:-$cwd}/$p" ;; esac
  abs="${abs%/}"
  # Direct mention or inside a protected subtree
  case "$abs" in
    *"/.pandacorp"|*"/.pandacorp/"*) return 0 ;;
    */factory/ideas|*/factory/ideas/*|*/factory/memory|*/factory/memory/*) return 0 ;;
    */factory/profile.md|*/factory/portfolio.md) return 0 ;;
  esac
  # A LINKED git worktree root (its .git is a FILE) only holds checked-out copies — the gitignored state
  # layer lives in the main checkout — so deleting the worktree itself is routine cleanup (HOOK-RM).
  [ -f "$abs/.git" ] && return 1
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

# ── Recursive deletes: `rm -r…` and `find … -delete` (HOOK-RM; supersedes the old text-grep rules) ──────
# Policy (owner 2026-11-12): agents must be free to delete the specific things they created — scratchpad
# and research folders, git worktrees, build output — without asking the owner to run anything, while a
# delete that is BROAD stays blocked. Each `rm` in COMMAND position is analysed on its own, with the
# working directory tracked through `cd`, and every operand is resolved to an absolute physical path:
#   ALLOWED  anything strictly inside a temp root (/tmp, /private/tmp, /var/tmp, /var/folders/*/T, $TMPDIR),
#            a regenerable dir by name (node_modules .next dist build tmp .turbo coverage .cache target out),
#            any other DEEP named path (>= 4 components, or >= 2 below $HOME): a worktree, a research dir,
#            a relative named subdirectory after `cd` into a non-root dir (`cd "$S" && rm -rf exp1 exp2`),
#            `"$VAR/named/sub"` where nothing proves VAR set (an empty VAR leaves one literal top-level
#            name, never a glob nor the root), and variables assigned in the same command line.
#   BLOCKED  /, $HOME or ~ itself, `.` / `..` as the target, a temp root itself, a system path (/usr /etc
#            /Library /private /var …), a shallow path (/Users/x, ~/Documents, /Users/Shared/Proyectos),
#            globs whose parent is shallow (`/tmp/*`, `~/*`, a bare `*` in $HOME), a bare or trailing-slash
#            unresolved variable (`rm -rf "$X"`, `"$X/"`, `"$X/*"`: an empty value reaches /, the cwd or a
#            glob), `$(…)` operands other than mktemp, then the protected state layer and deploy
#            worktrees (BL-0035, BL-0151).
_is_sys_top() { case "$1" in Users|etc|usr|bin|sbin|var|Library|System|Applications|opt|home|private|Volumes|tmp|dev|root|cores|mnt|srv|nix) return 0 ;; esac; return 1; }

# Lexical normalisation of an absolute path ("/" for the root).
_norm_path() { local IFS=/ c out=""; set -f; for c in $1; do case "$c" in ""|.) ;; ..) out="${out%/*}" ;; *) out="$out/$c" ;; esac; done; set +f; printf '%s' "${out:-/}"; }

# Resolve symlinks through the deepest EXISTING ancestor (macOS: /tmp and /var are symlinks into /private).
_phys_path() {
  local d="$1" rest="" r
  while [ "$d" != "/" ] && [ ! -d "$d" ]; do rest="/${d##*/}$rest"; d="${d%/*}"; [ -n "$d" ] || d="/"; done
  r=$(cd "$d" 2>/dev/null && pwd -P) || r="$d"
  if [ "$r" = "/" ]; then printf '%s' "${rest:-/}"; else printf '%s' "$r$rest"; fi
}

HOME_REAL=$(cd "$HOME" 2>/dev/null && pwd -P || printf '%s' "$HOME")
TMPDIR_REAL=""; [ -n "${TMPDIR:-}" ] && TMPDIR_REAL=$(cd "$TMPDIR" 2>/dev/null && pwd -P)
base_dir=""; case "$cwd" in /*) base_dir=$(_norm_path "$cwd") ;; esac
rm_vars="HOME=$HOME"$'\n'; [ -n "${TMPDIR:-}" ] && rm_vars="${rm_vars}TMPDIR=${TMPDIR%/}"$'\n'
rm_reason=""; rm_path=""

_var_get() { # $1 = name → value on stdout; status 1 if unknown
  local line val="" found=1
  while IFS= read -r line; do
    [ "${line%%=*}" = "$1" ] || continue
    val="${line#*=}"; found=0
  done <<< "$rm_vars"
  [ "$found" = 0 ] && [ "$val" != "@@UNKNOWN" ] || return 1
  printf '%s' "$val"
}

# Substitute known variables anywhere in $1; an unknown one becomes the marker @U@. Echoes the result.
_expand_vars() {
  local t="$1" re='^(.*)\$(\{?)([A-Za-z_][A-Za-z0-9_]*)(\}?)(.*)$' pre name br cl rest val
  while [[ $t =~ $re ]]; do
    pre="${BASH_REMATCH[1]}"; br="${BASH_REMATCH[2]}"; name="${BASH_REMATCH[3]}"; cl="${BASH_REMATCH[4]}"; rest="${BASH_REMATCH[5]}"
    if [ "$br" = "{" ] && [ -z "$cl" ]; then t="${pre}@U@"; continue; fi   # ${X:-…}, ${X%…}: not modelled
    if val=$(_var_get "$name"); then t="$pre$val$rest"; else t="$pre@U@$rest"; fi
  done
  printf '%s' "$t"
}

_record_assign() { # $1 = NAME=value token
  local name="${1%%=*}" v="${1#*=}"
  v="${v//\"/}"; v="${v//\'/}"
  case "$v" in
    '$(mktemp'*|'`mktemp'*) v="/private/tmp/@mktemp" ;;
    '~') v="$HOME" ;;
    '~/'*) v="$HOME/${v#\~/}" ;;
    *) v=$(_expand_vars "$v")
       case "$v" in *'@U@'*|*'$'*|*'`'*) v="@@UNKNOWN" ;; /*) ;; *) if [ -n "$base_dir" ]; then v="$base_dir/$v"; else v="@@UNKNOWN"; fi ;; esac ;;
  esac
  rm_vars="${rm_vars}${name}=${v}"$'\n'
}

_set_cwd() { # $1 = the cd target
  local t="$1"
  t="${t//\"/}"; t="${t//\'/}"
  case "$t" in ""|"~") base_dir="$HOME"; return ;; "~/"*) t="$HOME/${t#\~/}" ;; "-") base_dir=""; return ;; esac
  t=$(_expand_vars "$t")
  case "$t" in
    *'@U@'*|*'$'*|*'`'*) base_dir="" ;;
    /*) base_dir=$(_norm_path "$t") ;;
    *) if [ -n "$base_dir" ]; then base_dir=$(_norm_path "$base_dir/$t"); else base_dir=""; fi ;;
  esac
}

# Verdict on a normalised physical absolute path: sets rm_reason when it is too broad to delete.
_path_verdict() { # $1 = path, $2 = 1 when a temp root itself is acceptable (glob container of a prefixed glob)
  local p="$1" allow_root="${2:-0}" root slashes rel
  [ "$p" != "/" ] || { rm_reason="the filesystem root"; return; }
  for root in /tmp /private/tmp /var/tmp /private/var/tmp "$TMPDIR_REAL"; do
    [ -n "$root" ] || continue
    if [ "$p" = "$root" ]; then [ "$allow_root" = 1 ] || rm_reason="a temp root itself ($root): name the specific subdirectory"; return; fi
    case "$p" in "$root"/*) return ;; esac
  done
  case "$p" in
    /var/folders/*/T|/private/var/folders/*/T) [ "$allow_root" = 1 ] || rm_reason="a temp root itself ($p)"; return ;;
    /var/folders/*/T/*|/private/var/folders/*/T/*) return ;;
    /System|/System/*|/usr|/usr/*|/bin|/bin/*|/sbin|/sbin/*|/etc|/etc/*|/private|/private/*|/var|/var/*|/Library|/Library/*|/Applications|/Applications/*|/opt|/opt/*|/Volumes|/Volumes/*|/dev|/dev/*|/cores|/cores/*)
      rm_reason="a system path ($p)"; return ;;
  esac
  slashes="${p//[^\/]/}"
  case "${p##*/}" in node_modules|.next|dist|build|tmp|.turbo|coverage|.cache|target|out) [ "${#slashes}" -ge 2 ] && return ;; esac
  if [ "$p" = "$HOME_REAL" ]; then rm_reason="your home directory"; return; fi
  case "$p" in
    "$HOME_REAL"/*)
      rel="${p#"$HOME_REAL"}"; slashes="${rel//[^\/]/}"
      [ "${#slashes}" -ge 2 ] || rm_reason="a top-level folder of your home ($p): name a deeper path" ;;
    *) [ "${#slashes}" -ge 4 ] || rm_reason="too shallow a path ($p): name a deeper path" ;;
  esac
}

# Resolves ONE rm operand. Sets rm_reason (non-empty = too broad) and rm_path (best-known lexical absolute
# path, for the protected-state checks). Operands arrive with quotes still on.
_rm_operand_reason() {
  local t="$1" unk=0 last first gdir container pre rest allow_root=0 abs
  rm_reason=""; rm_path=""
  t="${t//\"/}"; t="${t//\'/}"
  while :; do case "$t" in *')'|*'}') t="${t%?}" ;; *) break ;; esac; done
  [ -n "$t" ] || return 0
  case "$t" in
    '$('*|'`'*)
      case "$t" in '$(mktemp'*|'`mktemp'*) rm_path="/private/tmp/@mktemp"; return 0 ;; esac
      rm_reason="a command substitution (the target cannot be known): assign it with mktemp or spell the path out"; return 0 ;;
    "~") t="$HOME" ;;
    "~/"*) t="$HOME/${t#\~/}" ;;
    "~"*) rm_reason="a ~user path"; return 0 ;;
  esac
  t=$(_expand_vars "$t")
  case "$t" in
    '@U@'*) unk=1; t="${t#@U@}" ;;
  esac
  case "$t" in *'@U@'*) t="${t%%@U@*}" ;; esac          # a variable mid-path: assume it is empty (worst case)
  case "$t" in *'$'*|*'`'*) t="${t%%[\$\`]*}" ;; esac    # positional/special parameters: same
  if [ "$unk" = 1 ]; then
    case "$t" in
      /?*) ;;
      *) rm_reason="an unresolved variable with nothing after it (an empty value would delete the root, the cwd or a glob): set it in the same command or spell the path out"; return 0 ;;
    esac
    first="${t#/}"; first="${first%%/*}"
    case "$first" in
      ""|.|..|*[\*\?\[]*) rm_reason="an unresolved variable followed by a glob or dot component"; return 0 ;;
    esac
    if _is_sys_top "$first"; then rm_reason="an unresolved variable followed by a system folder name ($first)"; return 0; fi
    case "$t" in */..|*/../*) rm_reason="a path that climbs with .. below an unresolved variable"; return 0 ;; esac
    rm_path="$t"; return 0
  fi
  while :; do case "$t" in ./*) t="${t#./}" ;; *) break ;; esac; done
  [ -n "$t" ] || { rm_reason="the working directory itself"; return 0; }
  last="${t%/}"; last="${last##*/}"
  case "$last" in .|..) rm_reason="'.' or '..' (the directory itself or its parent)"; return 0 ;; esac
  case "$t" in
    /*) abs="$t" ;;
    *) if [ -n "$base_dir" ]; then abs="$base_dir/$t"
       else
         first="${t%%/*}"
         case "$first" in ""|.|..|*[\*\?\[]*) rm_reason="a glob or dot path relative to an unknown directory"; return 0 ;; esac
         case "$t" in *..*) rm_reason="a .. path relative to an unknown directory"; return 0 ;; esac
         rm_path="/@unknown-dir/$t"; return 0
       fi ;;
  esac
  abs=$(_norm_path "$abs"); rm_path="$abs"
  case "$abs" in
    *[\*\?\[]*)
      gdir="${abs%%[\*\?\[]*}"; container="${gdir%/*}"; pre="${gdir##*/}"; rest="${abs#"$gdir"}"
      [ -n "$container" ] || container="/"
      # `/tmp/claude-*`: a glob only in the LAST component with a >=3-char literal prefix may sit directly in a temp root.
      case "$rest" in */*) ;; *) [ "${#pre}" -ge 3 ] && allow_root=1 ;; esac
      abs=$(_norm_path "$container") ;;
  esac
  abs=$(_phys_path "$abs")
  _path_verdict "$abs" "$allow_root"
}

_check_rm_operand() { # $1 = operand
  local op="$1"
  [ -n "$op" ] || return 0
  _rm_operand_reason "$op"
  [ -n "$rm_reason" ] || [ -n "$rm_path" ] || return 0
  if [ -n "$rm_reason" ]; then
    block "broad recursive delete: '$op' is $rm_reason. Delete the specific, named directory instead (an explicit deep path, a relative name after cd into a non-root dir); scratch/temp dirs, git worktrees, node_modules, .next, dist and build are always allowed"
  fi
  # A glob operand: the protected-state check must see what it ACTUALLY matches (`rm -rf *` at a repo root
  # removes every project folder, and those contain .pandacorp).
  case "$rm_path" in
    *[\*\?\[]*)
      local m n=0
      set +f
      for m in $rm_path; do
        [ -e "$m" ] || continue
        n=$((n + 1)); [ "$n" -le 200 ] || break
        if _protected_under "$m"; then
          block "recursive delete of '$op' matches a protected Pandacorp state path ('$m') — this layer has no git history; archive/move instead, or ask the owner (BL-0035)"
        fi
      done ;;
  esac
  if _protected_under "$rm_path"; then
    block "recursive delete reaching a protected Pandacorp state path (.pandacorp/, factory/{ideas,memory,profile,portfolio} — directly or inside '$op') — this layer has no git history; archive/move instead, or ask the owner (BL-0035)"
  fi
  if _is_protected_deploy_path "$rm_path"; then
    block "recursive delete reaching a live/locked deployment worktree ('$op') — a raw rm bypasses git's own lock check entirely; local-deployments/ hosts launchd-served always-on copies (DR-089), use 'git worktree remove' or ask the owner (BL-0151)"
  fi
}

_scan_exec() { # $1 = command text, $2 = nesting depth (bash -c / eval re-enter once per level, max 3)
  local seg k n ci tk cmdw a prev_redir noopt rec has_del idx inner saved_dir saved_vars
  local -a toks args ops paths
  while IFS= read -r seg; do
    [ -n "${seg//[[:space:]]/}" ] || continue
    read -ra toks <<< "$seg"
    n=${#toks[@]}; ci=-1
    for ((k = 0; k < n; k++)); do
      tk="${toks[$k]#[({]}"
      case "$tk" in
        then|do|else|'!'|time|command|exec|sudo|nohup|env|'') continue ;;
        [A-Za-z_]*=*) _record_assign "$tk"; continue ;;
        -*) continue ;;
        for) break ;;
        *) ci=$k; break ;;
      esac
    done
    if [ "$k" -lt "$n" ] && [ "${toks[$k]}" = "for" ] && [ "${toks[$((k + 2))]:-}" = "in" ]; then
      # `for NAME in items`: model NAME as a named literal unless an item looks dangerous.
      a="loopitem"; idx=$((k + 3))
      while [ "$idx" -lt "$n" ]; do
        tk="${toks[$idx]//\"/}"; tk="${tk//\'/}"
        case "$tk" in /*|'~'*|.|..|*[\*\?\[]*|*'$'*) a="$tk"; break ;; esac
        idx=$((idx + 1))
      done
      case "$a" in *'$'*) a="@@UNKNOWN" ;; esac
      rm_vars="${rm_vars}${toks[$((k + 1))]}=${a}"$'\n'
      continue
    fi
    [ "$ci" -ge 0 ] || continue
    cmdw="${toks[$ci]//\"/}"; cmdw="${cmdw//\'/}"; cmdw="${cmdw#\\}"; cmdw="${cmdw##*/}"
    args=("${toks[@]:$((ci + 1))}")
    case "$cmdw" in
      cd|pushd)
        for a in "${args[@]}"; do case "$a" in -*) ;; *) _set_cwd "$a"; break ;; esac; done ;;
      rm)
        rec=0; noopt=0; prev_redir=0; ops=()
        for a in "${args[@]}"; do
          if [ "$prev_redir" = 1 ]; then prev_redir=0; continue; fi
          case "$a" in
            [0-9]'>'|[0-9]'>>'|'>'|'>>'|'&>'|'<') prev_redir=1; continue ;;
            [0-9]'>'*|'>'*|'&>'*|'<'*) continue ;;
          esac
          if [ "$noopt" = 0 ]; then
            case "$a" in
              --) noopt=1; continue ;;
              --recursive) rec=1; continue ;;
              --*) continue ;;
              -*[rR]*) rec=1; continue ;;
              -*) continue ;;
            esac
          fi
          ops+=("$a")
        done
        [ "$rec" = 1 ] || continue
        for a in "${ops[@]}"; do _check_rm_operand "$a"; done ;;
      find)
        has_del=0; paths=(); noopt=0; idx=0
        for a in "${args[@]}"; do
          case "$a" in
            -delete) has_del=1 ;;
            -exec|-execdir) [ "${args[$((idx + 1))]:-}" = "rm" ] && has_del=1 ;;
          esac
          case "$a" in -*|'('|'!') noopt=1 ;; esac
          [ "$noopt" = 0 ] && paths+=("$a")
          idx=$((idx + 1))
        done
        [ "$has_del" = 1 ] || continue
        for a in "${paths[@]}"; do
          _rm_operand_reason "$a"
          if [ "$rm_path" = "/" ] || [ "$rm_path" = "$HOME" ] || [ "$rm_path" = "$HOME_REAL" ]; then
            block "broad recursive delete: find -delete on '$a' (the root or your home)"
          fi
          if _protected_under "$rm_path"; then
            block "find -delete/-exec rm on a protected Pandacorp state path ('$a') — this layer has no git history; archive/move instead, or ask the owner (BL-0035)"
          fi
        done ;;
      bash|sh|zsh|dash|ksh|eval)
        [ "${2:-0}" -lt 3 ] || continue
        inner=""
        if [ "$cmdw" = "eval" ]; then inner="${args[*]}"
        else
          idx=0
          for a in "${args[@]}"; do
            idx=$((idx + 1))
            case "$a" in -c|-lc|-ec|-cl) inner="${args[*]:$idx}"; break ;; esac
          done
        fi
        [ -n "$inner" ] || continue
        case "$inner" in \"*\") inner="${inner#\"}"; inner="${inner%\"}" ;; \'*\') inner="${inner#\'}"; inner="${inner%\'}" ;; esac
        saved_dir="$base_dir"; saved_vars="$rm_vars"
        _scan_exec "$inner" $(( ${2:-0} + 1 ))
        base_dir="$saved_dir"; rm_vars="$saved_vars" ;;
    esac
  done < <(printf '%s\n' "$1" | _exec_segments)
}
_scan_exec "$cmd" 0

# git clean with an ignored-files flag, either case: -x (ignored + untracked) OR -X (ignored ONLY,
# which targets PRECISELY the gitignored .pandacorp layer). Case-insensitive per WS-A F2.
if printf '%s\n' "$git_norm" | grep -Eq '^git clean[[:space:]]([^;&|]*[[:space:]])?-[a-zA-Z]*[xX]'; then
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
