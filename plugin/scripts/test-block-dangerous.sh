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
mkdir -p "$fx/myapp/.pandacorp/inbox/changes" "$fx/factory/ideas" "$fx/factory/memory" "$fx/src/deep"
echo "# Pandacorp" > "$fx/CLAUDE.md"
# Real Pandacorp projects gitignore the whole .pandacorp/ state layer (BL-0035: it has no git
# history by design) — mirror that here so the BL-0151 section's `git add -A && git commit` below
# never tracks the fixture files added next; otherwise a worktree checkout of THIS repo would
# legitimately contain a nested .pandacorp, which is a real positive for the parent-directory rule,
# not the false one this file's later BL-0151 "ordinary worktree" cases mean to exercise.
printf '.pandacorp/\nfactory/memory/\nfactory/ideas/\n' > "$fx/.gitignore"
# Pre-existing protected files (BL-0158): the WS-A F3 "must block" cases below assert a genuine
# TRUNCATION of a file that already has content — without these, the fixture never distinguished
# "truncate" from "create", which is exactly how BL-0158's false positive slipped past this suite.
echo "existing decision" > "$fx/myapp/.pandacorp/inbox/decisions.md"
echo "existing inbox entry" > "$fx/factory/memory/_inbox.md"
echo "existing card" > "$fx/myapp/.pandacorp/inbox/changes/existing-card.md"

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
echo "== BL-0120: quoted '>' / non-protected redirect targets must not false-positive =="
check "redirect to /dev/null"              0 "$fx" 'bash plugin/scripts/validate-backlog.sh >/dev/null 2>&1; echo "done"'
check "quoted email trailer in commit msg" 0 "$fx" 'git commit -m "Fix thing" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"'
check "still blocks real truncation"       2 "$fx" 'echo "data" > factory/memory/_inbox.md'

echo "== BL-0158: a redirect that CREATES a brand-new file is not a truncation =="
check "create NEW card in inbox/changes"          0 "$fx" "cat /dev/null > myapp/.pandacorp/inbox/changes/new-bug.md"
check "create NEW file elsewhere under .pandacorp" 0 "$fx" "echo notes > myapp/.pandacorp/inbox/new-notes.md"
newcard_heredoc_cmd="cat > myapp/.pandacorp/inbox/changes/informe-bug.md <<'EOF'
---
type: bug
---
EOF"
check "create NEW card via heredoc (repro shape)" 0 "$fx" "$newcard_heredoc_cmd"
check "truncate EXISTING inbox/changes card"      2 "$fx" "cat /dev/null > myapp/.pandacorp/inbox/changes/existing-card.md"
# NOTE: the native `Write` tool creating a new file is untested here by design — block-dangerous.sh
# is wired ONLY to the Bash PreToolUse matcher (plugin/hooks/hooks.json), so a Write tool call never
# reaches this script at all; there is no command string to construct a fixture from.

echo "== BL-0167: a git-range placeholder in a commit message must not read as a redirect =="
check "plain sha..sha range (no '>' at all)"       0 "$fx" 'git commit -m "fix a1b2c3..d4e5f6 range"'
check "angle-bracket range on one line"            0 "$fx" 'git commit -m "fix spanning <a1b2c3d>..<d4e5f6a> range"'
rangeheredoc_cmd='git commit -m "$(cat <<'"'"'EOF'"'"'
fix(hooks): merge <3b820278>..<7446d4cd> range fix
EOF
)"'
check "angle-bracket range inside heredoc -m (repro)" 0 "$fx" "$rangeheredoc_cmd"
check "unrelated relative redirect is unaffected"  0 "$fx" "cat x > ../foo"
check "bare '..' redirect target is inert, not blocked" 0 "$fx" "cat /dev/null > .."

echo "== BL-0151: live/locked deployment worktree protection =="
# Fixture: a commit (worktree add needs a HEAD) plus two extra worktrees of the SAME throwaway
# repo — one `git worktree lock`ed (simulates the live deploy) and one left unlocked (an ordinary
# DR-096 disposable worktree). Never touches the real /Users/Shared/local-deployments/panda-corp.
( cd "$fx" && git add -A && git commit -q -m init )
lockedwt=$(mktemp -d)/deploy-wt
unlockedwt=$(mktemp -d)/scratch-wt
git -C "$fx" worktree add -q --detach "$lockedwt" HEAD
git -C "$fx" worktree add -q --detach "$unlockedwt" HEAD
git -C "$fx" worktree lock "$lockedwt" --reason "test fixture: simulated live deploy" >/dev/null

check "block: worktree remove on a LOCKED worktree"            2 "$fx" "git worktree remove $lockedwt"
check "block: worktree remove -f -f (double force) on LOCKED"  2 "$fx" "git worktree remove -f -f $lockedwt"
check "block: rm -rf on a LOCKED worktree (bypasses git)"      2 "$fx" "rm -rf $lockedwt"
check "block: worktree remove under local-deployments/"        2 "$fx" "git worktree remove /Users/Shared/local-deployments/panda-corp"
check "block: worktree remove -f -f under local-deployments/"  2 "$fx" "git worktree remove -f -f /Users/Shared/local-deployments/some-project"
check "block: rm -rf under local-deployments/"                 2 "$fx" "rm -rf /Users/Shared/local-deployments/panda-corp"
check "allow: worktree remove on an UNLOCKED non-deploy path"  0 "$fx" "git worktree remove $unlockedwt"
check "allow: rm -rf on an UNLOCKED non-deploy worktree"       0 "$fx" "rm -rf $unlockedwt"
check "allow: lookalike dir name is not the real deploy root"  0 "$fx" "rm -rf /Users/Shared/local-deployments-archive/foo"

git -C "$fx" worktree remove -f -f "$lockedwt" >/dev/null 2>&1
rm -rf "$(dirname "$lockedwt")" "$(dirname "$unlockedwt")"

echo "== OUT OF SCOPE (expect 0 in a non-Pandacorp dir) =="
plain=$(mktemp -d)
check "non-Pandacorp dir allows"           0 "$plain" "git push --force"
rm -rf "$plain" "$fx"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
