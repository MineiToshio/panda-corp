#!/bin/bash
# Self-test / canary matrix for block-dangerous.sh (constitution §24: a gate must be
# periodically proven to still go RED on deliberately dangerous input — and GREEN on
# sanctioned forms). Covers the Fable-audit 2026-07-04 hardening: parent-directory
# deletes, trailing-flag rm, find -delete, subdirectory scope walk-up, jq fail-closed.
# Run from the factory repo root: bash plugin/scripts/test-block-dangerous.sh
#
# NOTE: never inline these strings in a live Bash tool call — the installed hook
# pattern-matches the whole command and blocks the carrier (see memory inbox gotcha
# 2026-07-04). This file is executed as a script, so the hook only sees its filename.

set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
GATE="$HERE/plugin/scripts/block-dangerous.sh"
pass=0; fail=0

run_gate() { # $1 = cwd, $2 = command → echoes exit code
  printf '{"cwd":"%s","tool_input":{"command":%s}}' "$1" "$(printf '%s' "$2" | jq -Rs .)" \
    | bash "$GATE" >/dev/null 2>&1
  echo $?
}

check() { # $1 label, $2 expected rc, $3 cwd, $4 cmd
  rc=$(run_gate "$3" "$4")
  if [ "$rc" = "$2" ]; then echo "  ✓ $1"; pass=$((pass+1)); else echo "  ✗ $1 (expected $2, got $rc)"; fail=$((fail+1)); fi
}

# Fixture: a fake Pandacorp repo with a project dir containing .pandacorp (so parent-delete
# tests don't depend on this repo's layout) — and a nested subdir for scope walk-up.
fx=$(mktemp -d)
( cd "$fx" && git init -q )
mkdir -p "$fx/myapp/.pandacorp/inbox" "$fx/factory/ideas" "$fx/factory/memory" "$fx/src/deep"
echo "# Pandacorp" > "$fx/CLAUDE.md"

echo "== MUST BLOCK (expect 2) =="
check "vercel --prod"                      2 "$fx" "vercel --prod"
check "flyctl deploy"                      2 "$fx" "flyctl deploy"
check "railway up"                         2 "$fx" "railway up"
check "wrangler deploy"                    2 "$fx" "wrangler deploy"
check "bare git reset --hard"              2 "$fx" "git reset --hard"
check "git reset --hard HEAD~1"            2 "$fx" "git reset --hard HEAD~1"
check "git reset --hard origin/main"       2 "$fx" "git reset --hard origin/main"
check "rm -rf .pandacorp"                  2 "$fx" "rm -rf .pandacorp"
check "rm -rf factory/memory"              2 "$fx" "rm -rf factory/memory"
check "rm -r on project inbox"             2 "$fx" "rm -r myapp/.pandacorp/inbox"
check "PARENT delete: rm -rf myapp"        2 "$fx" "rm -rf myapp"
check "trailing-flag: rm path -r"          2 "$fx" "rm .pandacorp/inbox -r"
check "trailing-flag: rm myapp -rf"        2 "$fx" "rm myapp -rf"
check "find .pandacorp -delete"            2 "$fx" "find .pandacorp -delete"
check "find myapp/.pandacorp -delete"      2 "$fx" "find myapp/.pandacorp -delete"
check "absolute-path parent delete"        2 "$fx" "rm -rf $fx/myapp"
check "git clean -fdx"                     2 "$fx" "git clean -fdx"
check "git clean -xfd"                     2 "$fx" "git clean -xfd"
echo "== WS-A F1: capital -R (BSD/macOS recursive flag) =="
check "rm -Rf broad root"                  2 "$fx" "rm -Rf /"
check "rm -Rf broad home"                  2 "$fx" "rm -Rf ~"
check "rm -Rf broad parent"                2 "$fx" "rm -Rf .."
check "rm -Rf protected project"           2 "$fx" "rm -Rf myapp/.pandacorp"
check "rm -fR protected (flag order)"      2 "$fx" "rm -fR factory/memory"
echo "== WS-A F2: capital -X (git clean ignored-only) =="
check "git clean -fdX"                     2 "$fx" "git clean -fdX"
check "git clean -X"                       2 "$fx" "git clean -X"
check "git clean -dX --force"              2 "$fx" "git clean -dX --force"
echo "== WS-A F3: redirect-truncation of protected state =="
check "truncate decisions.md"              2 "$fx" "cat /dev/null > myapp/.pandacorp/inbox/decisions.md"
check "colon-truncate memory inbox"        2 "$fx" ": > factory/memory/_inbox.md"
echo "== WS-A F6: git stash drop/clear =="
check "git stash drop"                     2 "$fx" "git stash drop"
check "git stash clear"                    2 "$fx" "git stash clear"
check "force push"                         2 "$fx" "git push --force origin main"
check "push -f"                            2 "$fx" "git push -f"
check "gh repo delete"                     2 "$fx" "gh repo delete foo"
check "delete main branch"                 2 "$fx" "git branch -D main"
echo "== SCOPE WALK-UP (expect 2 from a repo SUBDIR) =="
check "dangerous cmd from repo subdir"     2 "$fx/src/deep" "git push --force origin main"

echo "== MUST ALLOW (expect 0) =="
check "reset --hard to explicit sha"       0 "$fx" "git reset --hard 515c5ff"
check "reset --hard long sha"              0 "$fx" "git reset --hard 515c5ff1234abcd"
check "vercel preview"                     0 "$fx" "vercel"
check "vercel deploy (non-prod)"           0 "$fx" "vercel deploy"
check "git clean -fd (keeps ignored)"      0 "$fx" "git clean -fd"
check "rm -rf node_modules"                0 "$fx" "rm -rf node_modules"
check "rm -rf dist"                        0 "$fx" "rm -rf dist"
check "rm single file"                     0 "$fx" "rm foo.txt"
check "find without -delete"               0 "$fx" "find . -name x.tmp"
check "find -delete outside protected"     0 "$fx" "find src -name x.tmp -delete"
check "normal push"                        0 "$fx" "git push origin main"
check "delete feature branch"              0 "$fx" "git branch -D feature-x"
check "rm -Rf node_modules (capital ok)"   0 "$fx" "rm -Rf node_modules"
check "rm -rf /tmp/scratch (subpath)"      0 "$fx" "rm -rf /tmp/scratch"
check "APPEND >> to state is safe"         0 "$fx" "echo hi >> myapp/.pandacorp/inbox/decisions.md"
check "redirect to a normal build file"    0 "$fx" "node gen.js > src/out.txt"
check "git stash push"                     0 "$fx" "git stash push -m wip"
check "git stash pop"                      0 "$fx" "git stash pop"
echo "== OUT OF SCOPE (expect 0 in a non-Pandacorp dir) =="
plain=$(mktemp -d)
check "non-Pandacorp dir allows"           0 "$plain" "git push --force"
rm -rf "$plain" "$fx"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
