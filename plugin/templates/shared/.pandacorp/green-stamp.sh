#!/usr/bin/env bash
# Certified-tree stamp (DR-146) — the ONE writer and the ONE reader of "this exact tree already
# passed the FULL gate". Run from the project directory (where .pandacorp/verify.sh lives).
#
#   green-stamp.sh start          prints the current tree iff it is clean (verify.sh, at its start).
#   green-stamp.sh record <tree>  called ONLY by verify.sh, after a FULL (unscoped) run exits 0,
#                                 with the tree it saw clean at its start. Writes nothing unless the
#                                 tree is still that tree and still clean now.
#   green-stamp.sh check          exit 0 only when the current tree is provably the certified one;
#                                 exit 1 (reason on stderr) on ANY doubt.
#   green-stamp.sh invalidate     drop the stamp (verify.sh calls it on every red exit).
#
# "Clean" = `git status --porcelain` empty (tracked AND untracked non-ignored files) AND no
# skip-worktree/assume-unchanged index entries (both hide local edits from status — e.g. a
# worktree-bootstrap port override — so a tree carrying them never certifies and never matches).
# The stamp binds: the tree hash, the sha256 of .pandacorp/verify.sh (a gate edit invalidates it,
# even for an untracked/ignored verify.sh) and its age (12 h max, so a toolchain/env drift cannot
# ride a stamp forever). It lives in gitignored runtime state; a missing, corrupt or foreign-format
# stamp is simply "not certified" — the caller then runs the full gate.
set -u

STAMP=".pandacorp/run/green-stamp"
MAX_AGE_S=43200
VERSION=1

doubt() { echo "green-stamp: $1" >&2; exit 1; }

verify_sha256() {
  [ -f .pandacorp/verify.sh ] || return 1
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 .pandacorp/verify.sh | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum .pandacorp/verify.sh | awk '{print $1}'
  else
    return 1
  fi
}

current_tree() { git rev-parse --verify -q 'HEAD^{tree}' 2>/dev/null; }

# Prints nothing and returns 0 only when the working tree is clean in the strict sense above.
tree_is_clean() {
  local status hidden
  status=$(git status --porcelain --untracked-files=normal 2>/dev/null) || return 1
  [ -z "$status" ] || return 1
  hidden=$(git ls-files -v 2>/dev/null | grep -E '^(S|[a-z]) ' | head -1) || true
  [ -z "$hidden" ]
}

stamp_field() { grep -E "^$1=" "$STAMP" 2>/dev/null | head -1 | cut -d= -f2-; }

case "${1:-}" in
  start)
    # verify.sh asks this BEFORE its first gate: the tree it is about to judge, or nothing.
    tree_is_clean || doubt "working tree not clean — this run cannot certify a tree"
    current_tree || doubt "not a git checkout"
    ;;
  record)
    tree="${2:-}"
    [ -n "$tree" ] || doubt "record needs the tree verify.sh saw at its start"
    now_tree=$(current_tree) || doubt "not a git checkout"
    [ "$now_tree" = "$tree" ] || doubt "tree changed during the run — nothing certified"
    tree_is_clean || doubt "working tree not clean — nothing certified"
    vsum=$(verify_sha256) || doubt "cannot hash .pandacorp/verify.sh — nothing certified"
    mkdir -p "$(dirname "$STAMP")" || doubt "cannot create $(dirname "$STAMP")"
    tmp=$(mktemp "$STAMP.XXXXXX") || doubt "cannot write $STAMP"
    printf 'version=%s\ntree=%s\nverify_sha256=%s\nat_epoch=%s\n' "$VERSION" "$tree" "$vsum" "$(date +%s)" > "$tmp" \
      && mv "$tmp" "$STAMP" || { rm -f "$tmp"; doubt "cannot write $STAMP"; }
    echo "green-stamp: certified tree $tree (full verify.sh green on a clean tree)"
    ;;
  check)
    [ -f "$STAMP" ] || doubt "no certified-tree stamp"
    [ "$(stamp_field version)" = "$VERSION" ] || doubt "stamp format unknown or corrupt"
    s_tree=$(stamp_field tree); s_vsum=$(stamp_field verify_sha256); s_at=$(stamp_field at_epoch)
    case "$s_tree" in ''|*[!0-9a-f]*) doubt "stamp tree missing or corrupt" ;; esac
    case "$s_vsum" in ''|*[!0-9a-f]*) doubt "stamp verify.sh hash missing or corrupt" ;; esac
    case "$s_at" in ''|*[!0-9]*) doubt "stamp time missing or corrupt" ;; esac
    now_tree=$(current_tree) || doubt "not a git checkout"
    [ "$now_tree" = "$s_tree" ] || doubt "tree $now_tree is not the certified tree $s_tree"
    tree_is_clean || doubt "working tree not clean"
    vsum=$(verify_sha256) || doubt "cannot hash .pandacorp/verify.sh"
    [ "$vsum" = "$s_vsum" ] || doubt ".pandacorp/verify.sh changed since the certifying run"
    age=$(( $(date +%s) - s_at ))
    [ "$age" -ge 0 ] && [ "$age" -le "$MAX_AGE_S" ] || doubt "stamp is ${age}s old (max ${MAX_AGE_S}s)"
    echo "certified tree $s_tree, ${age}s old"
    ;;
  invalidate)
    rm -f "$STAMP"
    ;;
  *)
    echo "usage: green-stamp.sh start | record <tree> | check | invalidate" >&2
    exit 2
    ;;
esac
