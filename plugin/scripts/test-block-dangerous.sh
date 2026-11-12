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
check "vercel link (setup)"                0 "$fx" "vercel link --yes"
check "vercel env ls (setup)"              0 "$fx" "vercel env ls production"
check "vercel git connect (setup)"         0 "$fx" "vercel git connect"
check "vercel --version"                   0 "$fx" "npx vercel --version"
check "grep for the word vercel"           0 "$fx" "grep -rn vercel docs"
check "git clean -fd (keeps ignored)"      0 "$fx" "git clean -fd"
check "rm -rf node_modules"                0 "$fx" "rm -rf node_modules"
check "rm -rf dist"                        0 "$fx" "rm -rf dist"
check "rm single file"                     0 "$fx" "rm foo.txt"
check "find without -delete"               0 "$fx" "find . -name x.tmp"
check "normal push"                        0 "$fx" "git push origin main"
check "delete feature branch"              0 "$fx" "git branch -D feature-x"
check "rm -Rf node_modules (capital ok)"   0 "$fx" "rm -Rf node_modules"
check "rm -rf /tmp/claude-*/x/y/z (via /tmp)" 0 "$fx" "rm -rf /tmp/claude-501/hookfinal-x/y/z"
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
check "allow: lookalike dir name is not the real deploy root"  0 "$fx" "git worktree remove /Users/Shared/local-deployments-archive/foo"

git -C "$fx" worktree remove -f -f "$lockedwt" >/dev/null 2>&1
rm -rf "$(dirname "$lockedwt")" "$(dirname "$unlockedwt")"

echo "== BL-0202: whole-tree git writes in a repository that HOSTS a nested Pandacorp project =="
# Fixture: a factory-shaped repo (CLAUDE.md says Pandacorp) hosting a nested project with its own
# .pandacorp/status.yaml — Mission Control inside the factory. Other sessions' WIP lives under plugin/.
nfx=$(mktemp -d)
( cd "$nfx" && git init -q )
mkdir -p "$nfx/mission-control/.pandacorp" "$nfx/mission-control/src" "$nfx/plugin"
echo "# Pandacorp" > "$nfx/CLAUDE.md"
echo "phase: implementation" > "$nfx/mission-control/.pandacorp/status.yaml"
check "block: git checkout -- . at the factory root"              2 "$nfx" "git checkout -- ."
check "block: git checkout <sha> -- . at the factory root"        2 "$nfx" "git checkout 515c5ff -- ."
check "block: git checkout . at the factory root"                 2 "$nfx" "git checkout ."
check "block: git restore . at the factory root"                  2 "$nfx" "git restore ."
check "block: git clean -fd (no pathspec) at the factory root"    2 "$nfx" "git clean -fd"
check "block: git clean -fd -- . at the factory root"             2 "$nfx" "git clean -fd -- ."
check "block: git -C <root> clean -fd from the project dir"       2 "$nfx/mission-control" "git -C $nfx clean -fd"
check "block: git -C \"\$TOP\" checkout -- . (unresolvable -C)"   2 "$nfx/mission-control" 'git -C "$TOP" checkout -- .'
check "block: top-anchored :/ pathspec from the project dir"      2 "$nfx/mission-control" "git checkout -- :/"
check "block: top-anchored :(top) clean from the project dir"     2 "$nfx/mission-control" "git clean -fd -- ':(top)'"
check "block: reset --hard <sha> (whole repo) at the root"        2 "$nfx" "git reset --hard 515c5ff"
check "block: reset --hard <sha> even from the project dir"       2 "$nfx/mission-control" "git reset --hard 515c5ff"
check "block: chained after cd"                                   2 "$nfx" "cd $nfx && git checkout -- ."
check "block: --literal-pathspecs before the verb"                2 "$nfx" "git --literal-pathspecs clean -fd"
check "allow: git checkout -- . INSIDE the project dir"           0 "$nfx/mission-control" "git checkout -- ."
check "allow: git clean -fd INSIDE the project dir"               0 "$nfx/mission-control" "git clean -fd"
check "allow: git -C mission-control clean -fd from the root"     0 "$nfx" "git -C mission-control clean -fd"
check "allow: explicit project path at the root"                  0 "$nfx" "git checkout 515c5ff -- mission-control/src/y.ts"
check "allow: explicit clean path at the root"                    0 "$nfx" "git clean -fd -- mission-control/src/app/preview-wo1/"
check "allow: dry-run clean at the root"                          0 "$nfx" "git clean -nd"
check "allow: switching branches at the root"                     0 "$nfx" "git checkout main"
check "allow: creating a branch at the root"                      0 "$nfx" "git checkout -b bl-0202-x"
check "allow: git status at the root"                             0 "$nfx" "git status --porcelain"
# The build engine's own guarded forms (BL-0202 RESTORE/CLEAN commands) must pass: explicit "$@" pathspec.
check "allow: engine's guarded RESTORE command"                   0 "$nfx/mission-control" 'TOP="$(git -C . rev-parse --show-toplevel)" && set -- '"'"'mission-control/src/y.ts'"'"' && git -C "$TOP" --literal-pathspecs checkout 515c5ff -- "$@"'
check "allow: engine's guarded CLEAN command"                     0 "$nfx/mission-control" 'TOP="$(git -C . rev-parse --show-toplevel)" && set -- '"'"'mission-control/src/tmp/'"'"' && git -C "$TOP" --literal-pathspecs clean -fd -- "$@"'
rm -rf "$nfx"

echo "== BL-0202: git global options no longer slip past the existing checks (flat repo) =="
check "block: git -C x reset --hard HEAD~1"                       2 "$fx" "git -C sub reset --hard HEAD~1"
check "block: git -C x stash drop"                                2 "$fx" "git -C sub stash drop"
check "block: git --literal-pathspecs clean -fdx"                 2 "$fx" "git --literal-pathspecs clean -fdx"
check "block: git -C x push --force"                              2 "$fx" "git -C sub push --force origin main"
check "allow: git -C x reset --hard <explicit-sha> (flat repo)"   0 "$fx" "git -C sub reset --hard 515c5ff"
check "allow: flat repo git clean -fd still allowed"              0 "$fx" "git -C sub clean -fd"

echo "== BL-0223: host-wide kills of dev/prod servers (pkill/killall by pattern, port kills) =="
# FM-10: a gate reviewer's host-wide pkill by pattern killed an unrelated Next.js oracle server.
# Kills must be scoped to the PID/process group the agent started itself (.pandacorp/serve-once.sh).
check "block: pkill -f \"next start\""                            2 "$fx" 'pkill -f "next start"'
check "block: pkill -f next-server"                               2 "$fx" "pkill -f next-server"
check "block: pkill -9 -f next"                                   2 "$fx" "pkill -9 -f next"
check "block: pkill node"                                         2 "$fx" "pkill node"
check "block: pkill -f vite"                                      2 "$fx" "pkill -f vite"
check "block: pkill -f playwright"                                2 "$fx" "pkill -f playwright"
check "block: pkill -f 'pnpm start'"                              2 "$fx" "pkill -f 'pnpm start'"
check "block: killall node"                                       2 "$fx" "killall node"
check "block: killall -9 next-server"                             2 "$fx" "killall -9 next-server"
check "block: chained after curl"                                 2 "$fx" 'curl -s localhost:3000 && pkill -f "next start" ; true'
check "block: sudo pkill -f next"                                 2 "$fx" "sudo pkill -f next"
check "block: lsof port | xargs kill"                             2 "$fx" "lsof -ti :3000 | xargs kill"
check "block: lsof port | xargs kill -9"                          2 "$fx" "lsof -ti:3000 | xargs kill -9"
check "block: kill command-substitution of lsof"                  2 "$fx" 'kill $(lsof -ti :3000)'
check "block: kill -9 command-substitution of lsof -t -i"         2 "$fx" 'kill -9 $(lsof -t -i:3000)'
check "block: kill backtick lsof"                                 2 "$fx" 'kill `lsof -ti :3000`'
check "block: kill command-substitution of pgrep -f"              2 "$fx" 'kill $(pgrep -f next)'
check "block: pgrep | xargs kill"                                 2 "$fx" "pgrep -f next-server | xargs kill"
check "block: ps|grep|awk|xargs kill"                             2 "$fx" "ps aux | grep next | awk '{print \$2}' | xargs kill"
check "block: fuser -k port"                                      2 "$fx" "fuser -k 3000/tcp"
check "allow: kill \$PID"                                         0 "$fx" 'kill $PID'
check "allow: kill -TERM \$PID"                                   0 "$fx" 'kill -TERM $SERVER_PID'
check "allow: kill the own process group"                         0 "$fx" 'kill -- -$PGID'
check "allow: kill -TERM -PGID"                                   0 "$fx" 'kill -TERM -- -$PGID'
check "allow: pkill -P \$PID (own children)"                      0 "$fx" 'pkill -P $PID'
check "allow: pkill -TERM -P \$PID"                               0 "$fx" 'pkill -TERM -P $PID'
check "allow: kill of pgrep -P \$PID"                             0 "$fx" 'kill $(pgrep -P $PID)'
check "allow: pkill -f of an unrelated tool"                      0 "$fx" 'pkill -f myhelper-daemon'
check "allow: lsof only inspects"                                 0 "$fx" "lsof -ti :3000"
check "allow: pgrep only inspects"                                0 "$fx" "pgrep -f next"
check "allow: xargs kill fed by an own pid file"                  0 "$fx" 'cat server.pid | xargs kill'
check "allow: prose mentioning the ban in a commit message"       0 "$fx" 'git commit -m "docs: never run pkill -f next"'
check "allow: serve-once helper"                                  0 "$fx" "bash .pandacorp/serve-once.sh -- pnpm start"

echo "== DR-138: Vercel deploys only through GitHub (manual CLI deploys always blocked) =="
check "block: bare vercel (CLI upload)"            2 "$fx" "vercel"
check "block: vercel deploy"                       2 "$fx" "vercel deploy"
check "block: npx vercel deploy --prebuilt"        2 "$fx" "npx vercel deploy --prebuilt"
check "block: vercel redeploy"                     2 "$fx" "vercel redeploy https://x.vercel.app"
check "block: vercel --yes (flags only)"           2 "$fx" "pnpm dlx vercel --yes"

echo "== DR-138: launched project -- GitHub main is production, publishing needs the owner's order =="
lx=$(mktemp -d)
( cd "$lx" && git init -q -b main && git commit -q --allow-empty -m init && git branch feature-x )
mkdir -p "$lx/.pandacorp"
printf 'project: demo\nphase: release\ndeploy_target: external  # live\n' > "$lx/.pandacorp/status.yaml"
check "block: push origin main (launched)"         2 "$lx" "git push origin main"
check "block: bare push while on main (launched)"  2 "$lx" "git push"
check "block: push -u origin on main (launched)"   2 "$lx" "git push -u origin"
check "block: push feature-x:main (launched)"      2 "$lx" "git push origin feature-x:main"
check "block: push --all (launched)"               2 "$lx" "git push --all origin"
check "allow: push feature branch (preview)"       0 "$lx" "git push -u origin feature-x"
check "allow: push with the owner's release token" 0 "$lx" "PANDACORP_OWNER_RELEASE_OK=1 git push origin main"
printf 'project: demo\nphase: release\n' > "$lx/.pandacorp/status.yaml"
check "block: missing deploy_target = external"    2 "$lx" "git push origin main"
printf 'project: demo\nphase: release\ndeploy_target: internal\n' > "$lx/.pandacorp/status.yaml"
check "allow: internal tool pushes main"           0 "$lx" "git push origin main"
printf 'project: demo\nphase: implementation\n' > "$lx/.pandacorp/status.yaml"
check "allow: pre-launch project pushes main"      0 "$lx" "git push origin main"
rm -rf "$lx"

echo "== HOOK-FINAL: recursive deletes pass ONLY the strict whitelist ([cd ABS &&] rm FLAGS OPERANDS [&& rm ...]) into allowed places =="
SCR=/private/tmp/claude-501/hookrm-test/deep/scratchpad
rm -rf /private/tmp/claude-501/hookrm-test
mkdir -p "$SCR/exp1" "$SCR/exp2" "$SCR/proj"
ln -s "$HOME" "$SCR/homelink"
ln -s "$HOME" "$SCR/proj/node_modules"
ln -s "$fx/myapp" "$SCR/applink"
# Must allow: the owner's routine cleanups.
check "allow: two absolute scratchpad paths"                        0 "$fx" "rm -rf $SCR/exp1 $SCR/exp2"
check "allow: cd <abs scratchpad> && rm -rf exp1 exp2"              0 "$fx" "cd $SCR && rm -rf exp1 exp2"
check "allow: all-&& chain of rm after cd"                          0 "$fx" "cd $SCR && rm -rf exp1 && rm -rf exp2"
check "allow: quoted literal operands"                              0 "$fx" "rm -rf \"$SCR/exp1\" \"$SCR/exp2\""
check "allow: quoted cd target"                                     0 "$fx" "cd \"$SCR\" && rm -Rf exp1"
check "allow: ./ prefix"                                            0 "$fx" "cd $SCR && rm -rf ./exp1"
check "allow: separate -r -f flags"                                 0 "$fx" "rm -r -f $SCR/exp1"
check "allow: deep node_modules (absolute, not existing)"           0 "$fx" "rm -rf /Users/x/proj/node_modules"
check "allow: deep .next (absolute, not existing)"                  0 "$fx" "rm -rf /Users/x/proj/.next"
check "allow: regenerable dirs after cd"                            0 "$fx" "cd /Users/x/proj && rm -rf node_modules .next"
check "allow: regenerable dirs relative to the session cwd"         0 "$fx" "rm -rf node_modules .next dist build"
check "allow: non-recursive rm of a quoted variable stays as before" 0 "$fx" 'rm -f "$TMPF"'
if [ -n "${TMPDIR:-}" ] && [ -d "$TMPDIR" ]; then
  TR=$(cd "$TMPDIR" && pwd -P)
  check "allow: a subdirectory of \$TMPDIR"                         0 "$fx" "rm -rf $TR/hookfinal-sub"
  check "block: \$TMPDIR itself"                                    2 "$fx" "rm -rf $TR"
fi
heredoc_note="cat > ~/.claude/projects/x/memory/note.md <<'EOF'
Lesson: never run rm -rf on factory/memory or .pandacorp.
rm -rf /
rm -rf ~
EOF"
check "allow: cat > file <<'EOF' whose body only mentions rm -rf + memory" 0 "$fx" "$heredoc_note"
check "allow: same with <<-\"EOF\" and trailing blank lines"       0 "$fx" "cat >> notes.md <<-\"EOF\"
	rm -rf ~
	EOF

"
# Linked worktree roots OUTSIDE every temp root (so only the worktree rule can allow them).
WTB=/private/tmp/hookfinal-wt-$$
mkdir -p "$WTB/plain"
git -C "$fx" worktree add -q --detach "$WTB/linked-wt" HEAD
git -C "$fx" worktree add -q --detach "$WTB/locked-wt" HEAD
git -C "$fx" worktree lock "$WTB/locked-wt" >/dev/null 2>&1
mkdir -p "$WTB/linked-wt/myapp/.pandacorp"
git init -q "$WTB/mainrepo"
check "allow: a linked worktree root outside temp roots"           0 "$fx" "rm -rf $WTB/linked-wt"
check "allow: cd <parent> && rm -rf <linked worktree>"              0 "$fx" "cd $WTB && rm -rf linked-wt"
check "allow: /tmp spelling of the linked worktree root"            0 "$fx" "rm -rf /tmp/hookfinal-wt-$$/linked-wt"
check "block: a plain dir next to it (not an allowed place)"        2 "$fx" "rm -rf $WTB/plain"
check "block: a MAIN worktree outside temp roots"                   2 "$fx" "rm -rf $WTB/mainrepo"
check "block: a LOCKED linked worktree"                             2 "$fx" "rm -rf $WTB/locked-wt"
check "block: .pandacorp inside the linked worktree"                2 "$fx" "rm -rf $WTB/linked-wt/myapp/.pandacorp"
check "block: a subdirectory of the linked worktree"                2 "$fx" "rm -rf $WTB/linked-wt/myapp"
check "block: the parent of the linked worktree"                    2 "$fx" "rm -rf $WTB"
git -C "$fx" worktree unlock "$WTB/locked-wt" >/dev/null 2>&1
git -C "$fx" worktree remove -f -f "$WTB/linked-wt" >/dev/null 2>&1
git -C "$fx" worktree remove -f -f "$WTB/locked-wt" >/dev/null 2>&1
rm -rf "$WTB"
wt3=$(mktemp -d)/linked-wt
git -C "$fx" worktree add -q --detach "$wt3" HEAD
mkdir -p "$wt3/myapp/.pandacorp"
check "allow: rm -rf a linked worktree root (checked-out .pandacorp inside)" 0 "$fx" "rm -rf $wt3"
check "allow: cd /abs && rm -rf <worktree root>"                    0 "$fx" "cd /tmp && rm -rf $wt3"
check "block: W=/abs && rm -rf \"\$W\" (no variables)"              2 "$fx" "W=$wt3 && rm -rf \"\$W\""
check "block: a ; chain after cd"                                   2 "$fx" "cd /tmp; rm -rf $wt3"
check "block: rm -rf the .pandacorp INSIDE that worktree"           2 "$fx" "rm -rf $wt3/myapp/.pandacorp"
check "block: rm -rf the main checkout (a real .git directory)"     2 "$fx" "rm -rf $fx"
git -C "$fx" worktree remove -f -f "$wt3" >/dev/null 2>&1; rm -rf "$(dirname "$wt3")"
# Places outside the allowed set, and symlinks into them.
check "block: deep path that is not an allowed place"               2 "$fx" "rm -rf /Users/Shared/Proyectos/some-engine-wt"
check "block: deep project source dir"                              2 "$fx" "rm -rf /Users/x/proj/src"
check "block: plain /tmp subdir (only /tmp/claude-*/ is scratch)"   2 "$fx" "rm -rf /tmp/scratch"
check "block: node_modules too shallow"                             2 "$fx" "rm -rf /Users/node_modules"
check "block: /private/tmp/claude-501 itself"                       2 "$fx" "rm -rf /private/tmp/claude-501"
check "block: /private/var/folders/<a> (temp parent)"               2 "$fx" "rm -rf /private/var/folders/mq"
check "block: symlink to home inside the scratchpad"                2 "$fx" "rm -rf $SCR/homelink/"
check "block: node_modules that is a symlink to home"               2 "$fx" "rm -rf $SCR/proj/node_modules"
check "block: symlink to a protected project"                       2 "$fx" "rm -rf $SCR/applink/"
check "block: cd into a symlink to home"                            2 "$fx" "cd $SCR/homelink && rm -rf Documents"
check "block: protected state in a literal rm after cd"             2 "$fx" "cd $fx && rm -rf myapp/.pandacorp/inbox"
check "block: cd / then a top-level name"                           2 "$fx" "cd / && rm -rf Users"
# Grammar: anything but the exact form is refused.
check "block: -- before the operands"                               2 "$fx" "rm -rf -- $SCR/exp1"
check "block: long flags"                                           2 "$fx" "rm --recursive --force $SCR/exp1"
check "block: trailing flag"                                        2 "$fx" "rm $SCR/exp1 -rf"
check "block: single-quoted operand"                                2 "$fx" "rm -rf '$SCR/exp1'"
check "block: tab separator"                                        2 "$fx" "rm -rf	$SCR/exp1"
check "block: multi-line cd then two rm"                            2 "$fx" "cd $SCR
rm -rf exp1
rm -rf exp2"
check "block: trailing &&"                                          2 "$fx" "rm -rf $SCR/exp1 &&"
check "block: two cd"                                               2 "$fx" "cd $SCR && cd /tmp && rm -rf x"
check "block: relative cd"                                          2 "$fx" "cd src && rm -rf deep"
check "block: S=/abs; rm -rf \"\$S/exp1\""                          2 "$fx" "S=$SCR; rm -rf \"\$S/exp1\" \"\$S/exp2\""
check "block: rm -rf \"\$S/exp1\" (S from the shell)"               2 "$fx" 'rm -rf "$S/exp1" "$S/exp2"'
check "block: cd \"\$S\" && rm -rf exp1"                            2 "$fx" 'cd "$S" && rm -rf exp1 exp2'
check "block: unicode lookalike in the operand"                     2 "$fx" "rm -rf $SCR/ｅxp1"
check "block: find -delete outside protected"                       2 "$fx" "find src -name x.tmp -delete"
check "block: find a deep scratch dir by name -delete"              2 "$fx" "find $SCR -name '*.tmp' -delete"
check "block: find -exec rm"                                        2 "$fx" "find $SCR -name x -exec rm {} +"
check "block: rsync --delete"                                       2 "$fx" "rsync -a --delete $SCR/exp1/ $SCR/exp2/"
check "block: unlink loop"                                          2 "$fx" "for f in a b; do unlink \$f; done"
check "block: rm in a loop"                                         2 "$fx" "for f in a b; do rm \$f; done"
check "block: rm whose first argument is a variable"                2 "$fx" 'rm $FLAGS /Users/sergio'
check "block: IFS assignment"                                       2 "$fx" "IFS=/ && rm -rf $SCR/exp1"
check "block: X=<scratch> && rm -rf \"\$X/exp1\""                   2 "$fx" "X=$SCR && rm -rf \"\$X/exp1\""
# Every earlier review probe stays blocked.
check "block: rm -rf /"                                             2 "$fx" "rm -rf /"
check "block: rm -fr /"                                             2 "$fx" "rm -fr /"
check "block: rm -rf -- /"                                          2 "$fx" "rm -rf -- /"
check "block: rm -r -f ~"                                           2 "$fx" "rm -r -f ~"
check "block: rm -rf .."                                            2 "$fx" "rm -rf .."
check "block: rm -rf /tmp (temp root itself)"                       2 "$fx" "rm -rf /tmp"
check "block: rm -rf /private/tmp"                                  2 "$fx" "rm -rf /private/tmp"
check "block: rm -rf /Users"                                        2 "$fx" "rm -rf /Users"
check "block: rm -rf /Users/Shared/Proyectos"                       2 "$fx" "rm -rf /Users/Shared/Proyectos"
check "block: rm -rf /usr/local/lib (system path)"                  2 "$fx" "rm -rf /usr/local/lib"
check "block: rm -rf * wipes protected project folders"             2 "$fx" "rm -rf *"
check "block: rm -rf \$HOME"                                        2 "$fx" 'rm -rf $HOME ; echo x'
check "B1 block: <<< then git push -f"                              2 "$fx" "tr a b <<< done
git push -f"
check "B1 block: <<< then vercel --prod"                            2 "$fx" "tr a b <<< done
vercel --prod"
check "B1 block: cat <<< x then force push"                         2 "$fx" "cat <<< \"x\"
git push --force origin main
x"
check "B1 block: quoted <<EOF in a message then reset --hard"       2 "$fx" "git commit -m \"doc <<EOF usage\"
git reset --hard HEAD~3"
check "B1 block: cat <<< x then rm -rf ~"                           2 "$fx" "cat <<< \"x\"
rm -rf ~
x"
check "B1 block: quoted <<EOF in a message then rm -rf ~"           2 "$fx" "git commit -m \"explain <<EOF heredocs\"
rm -rf ~"
check "B1 block: cat > f <<'EOF' with a command AFTER the terminator" 2 "$fx" "cat > f.txt <<'EOF'
text
EOF
rm -rf ~"
check "B1 block: unquoted delimiter (expansions run) is not the safe shape" 2 "$fx" "cat > f.txt <<EOF
rm -rf ~
EOF"
check "B1 block: heredoc fed to bash"                               2 "$fx" "bash <<'EOF'
rm -rf ~
EOF"
check "B1 block: force push inside a cat heredoc body is still raw-matched" 2 "$fx" "cat > f.txt <<'EOF'
git push --force origin main
EOF"
check "B2 block: apostrophe comment then rm -rf ~"                  2 "$fx" "# clean up (don't keep it)
rm -rf ~"
check "B2 block: apostrophe comment then rm -rf protected"          2 "$fx" "# remove the agent's scratch
rm -rf myapp/.pandacorp"
check "B2 block: ANSI-C quote then rm -rf ~"                        2 "$fx" "echo \$'it\\'s'; rm -rf ~"
nfx2=$(mktemp -d)
( cd "$nfx2" && git init -q )
mkdir -p "$nfx2/mission-control/.pandacorp" "$nfx2/plugin"
echo "# Pandacorp" > "$nfx2/CLAUDE.md"
echo "phase: implementation" > "$nfx2/mission-control/.pandacorp/status.yaml"
check "B2 block: apostrophe comment then git checkout . (BL-0202)"  2 "$nfx2" "# don't touch others
git checkout ."
check "B2 block: apostrophe comment then git clean -fd (BL-0202)"   2 "$nfx2" "# don't
git clean -fd"
rm -rf "$nfx2"
check "B3 block: if rm -rf ~"                                       2 "$fx" "if rm -rf ~; then echo ok; fi"
check "B3 block: if rm -rf protected"                               2 "$fx" "if rm -rf myapp/.pandacorp; then :; fi"
check "B3 block: while rm -rf ~"                                    2 "$fx" "while rm -rf ~; do :; done"
check "B3 block: nice rm -rf ~"                                     2 "$fx" "nice rm -rf ~"
check "B3 block: nice -n 5 rm -rf factory"                          2 "$fx" "nice -n 5 rm -rf factory"
check "B3 block: timeout 60 rm -rf ~"                               2 "$fx" "timeout 60 rm -rf ~"
check "B3 block: timeout 5 rm -rf myapp"                            2 "$fx" "timeout 5 rm -rf myapp"
check "B3 block: sudo -u root rm -rf ~"                             2 "$fx" "sudo -u root rm -rf ~"
check "B3 block: exec -a x rm -rf ~"                                2 "$fx" "exec -a x rm -rf ~"
check "B3 block: (cd ~ && rm -rf Documents)"                        2 "$fx" "(cd ~ && rm -rf Documents)"
check "B3 block: (cd / && rm -rf Users)"                            2 "$fx" "(cd / && rm -rf Users)"
check "B3 block: sh -c wrapper"                                     2 "$fx" "sh -c 'rm -rf ~'"
check "B3 block: eval wrapper"                                      2 "$fx" "eval 'rm -rf ~'"
check "B3 block: a wrapper in front of an otherwise-simple rm"      2 "$fx" "sudo rm -rf $SCR/exp1"
check "B4 block: echo ~ | xargs rm -rf"                             2 "$fx" "echo ~ | xargs rm -rf"
check "B4 block: echo myapp | xargs rm -rf"                         2 "$fx" "echo myapp | xargs rm -rf"
check "B4 block: find . -name x | xargs rm -rf"                     2 "$fx" "find . -name x | xargs rm -rf"
check "B4 block: xargs rm without -r"                               2 "$fx" "ls | xargs rm"
check "B5 block: find /Users -delete"                               2 "$fx" "find /Users -delete"
check "B5 block: find ~/Documents -delete"                          2 "$fx" "find ~/Documents -delete"
check "B5 block: find /Users -exec rm -rf {} +"                     2 "$fx" "find /Users -exec rm -rf {} +"
check "B5 block: find ~ -exec /bin/rm -rf {} +"                     2 "$fx" "find ~ -exec /bin/rm -rf {} +"
check "B5 block: find myapp -exec /bin/rm -rf {} +"                 2 "$fx" "find myapp -exec /bin/rm -rf {} +"
check "B5 block: find \$HOME -delete"                               2 "$fx" 'find "$HOME" -delete'
check "H1 block: cd <gone>; rm -rf factory"                         2 "$fx" "cd /tmp/gone-xyz; rm -rf factory"
check "H1 block: cd <gone> newline rm -rf myapp"                    2 "$fx" "cd /tmp/gone-xyz
rm -rf myapp"
check "H1 block: cd <gone> && rm -rf a; rm -rf factory"             2 "$fx" "cd /tmp/gone-xyz && rm -rf a; rm -rf factory"
check "N3 block: rm -rf ~/"                                         2 "$fx" "rm -rf ~/"
check "N3 block: rm -rf \"\${HOME}/\""                              2 "$fx" 'rm -rf "${HOME}/"'
check "N3 block: rm -rf \$HOME/"                                    2 "$fx" 'rm -rf $HOME/'
check "N3 block: /bin/rm -rf ~"                                     2 "$fx" "/bin/rm -rf ~"
check "N3 block: \\rm -rf ~"                                        2 "$fx" '\rm -rf ~'
check "N3 block: r\\m -rf ~"                                        2 "$fx" 'r\m -rf ~'
check "N3 block: r''m -rf ~"                                        2 "$fx" "r''m -rf ~"
check "N3 block: command rm -rf ~"                                  2 "$fx" "command rm -rf ~"
check "N2 block: rm -rf myapp/.PANDACORP"                           2 "$fx" "rm -rf myapp/.PANDACORP"
check "N2 block: rm -rf FACTORY/IDEAS"                              2 "$fx" "rm -rf FACTORY/IDEAS"
check "N2 block: rm -rf Factory/Memory"                             2 "$fx" "rm -rf Factory/Memory"
check "N2 block: rm -rf factory/MEMORY (literal rm path)"           2 "$fx" "cd $fx && rm -rf factory/MEMORY"
check "N2 block: rm -rf .Pandacorp/inbox"                           2 "$fx" "rm -rf .Pandacorp/inbox"
check "R1 block: X=/ && rm -rf \"\$X\""                             2 "$fx" 'X=/ && rm -rf "$X"'
check "R1 block: X=/Users && rm -rf \"\$X\""                        2 "$fx" 'X=/Users && rm -rf "$X"'
check "R1 block: X=/tmp && rm -rf \"\$X\""                          2 "$fx" 'X=/tmp && rm -rf "$X"'
check "R1 block: X=/usr/local && rm -rf \"\$X/lib\""                2 "$fx" 'X=/usr/local && rm -rf "$X/lib"'
check "R1 block: X=$fx && rm -rf \"\$X/myapp\" (protected parent)"  2 "$fx" "X=$fx && rm -rf \"\$X/myapp\""
check "DD block: cd /a/b/c && rm -rf ../../.."                      2 "$fx" "cd /a/b/c && rm -rf ../../.."
check "DD block: rm -rf ../../../.."                                2 "$fx" "rm -rf ../../../.."
check "DD block: rm -rf ../../../../../"                            2 "$fx" "rm -rf ../../../../../"
check "DD block: X=/a/b/c/d && rm -rf \"\$X/../..\""                2 "$fx" 'X=/a/b/c/d && rm -rf "$X/../.."'
check "DD block: .. inside an otherwise deep literal"               2 "$fx" "rm -rf $SCR/exp1/../../.."
check "DD block: .. in the cd target"                               2 "$fx" "cd $SCR/../.. && rm -rf x"
check "CD block: cd /x || rm -rf y"                                 2 "$fx" "cd /x || rm -rf y"
check "CD block: cd $SCR || rm -rf exp1"                            2 "$fx" "cd $SCR || rm -rf exp1"
check "CD block: bare cd && rm -rf y"                               2 "$fx" "cd && rm -rf y"
check "CD block: bare cd newline rm -rf y"                          2 "$fx" "cd
rm -rf y"
# DR-HOOK4: control bytes, ; chains, special variables, zsh =word, cd + glob.
US=$'\037'; SOH=$'\001'
check "K1 block: 0x1F bytes posing as && (factory)"                 2 "$fx" "rm -rf /tmp/a/b${US}cd /tmp/x${US}rm -rf factory"
check "K1 block: 0x1F bytes posing as && (nested project)"          2 "$fx" "rm -rf /tmp/a/b${US}cd /tmp/x${US}rm -rf myapp"
check "K1 block: any control byte in an otherwise allowed form"     2 "$fx" "rm -rf $SCR/exp1${SOH}"
check "K1 block: carriage return"                                   2 "$fx" "rm -rf $SCR/exp1"$'\r'
check "K2 block: X=/; rm -rf \$X"                                   2 "$fx" 'X=/; rm -rf $X'
check "K2 block: X=/Users/sergio; rm -rf \"\$X\""                  2 "$fx" 'X=/Users/sergio; rm -rf "$X"'
check "K2 block: X=/Users; rm -rf \$X/sergio/"                      2 "$fx" 'X=/Users; rm -rf $X/sergio/'
check "K2 block: cd /Users; rm -rf sergio"                          2 "$fx" "cd /Users; rm -rf sergio"
check "K2 block: cd /Users/sergio; rm -rf Documents"                2 "$fx" "cd /Users/sergio; rm -rf Documents"
check "N5 block: _=/tmp/a/b && rm -rf \"\$_/Users/sergio\""         2 "$fx" '_=/tmp/a/b && rm -rf "$_/Users/sergio"'
check "N6 block: zsh =word (rm -rf =node)"                          2 "$fx" "rm -rf =node"
check "N6 block: =word after cd"                                    2 "$fx" "cd $SCR && rm -rf =node"
check "N7 block: cd /tmp && rm -rf *"                               2 "$fx" "cd /tmp && rm -rf *"
check "N7 block: X=/tmp/a && rm -rf \"\${X%/a}\""                   2 "$fx" 'X=/tmp/a && rm -rf "${X%/a}"'
check "HOOK4 block: cd /tmp && rm -rf /"                            2 "$fx" "cd /tmp && rm -rf /"
check "HOOK4 block: cd /tmp && rm -rf ~"                            2 "$fx" "cd /tmp && rm -rf ~"
check "HOOK4 block: cd /tmp && rm -rf ."                            2 "$fx" "cd /tmp && rm -rf ."
check "HOOK4 block: cd /tmp && rm -rf -- -rf /"                     2 "$fx" "cd /tmp && rm -rf -- -rf /"
check "HOOK4 block: cd /tmp/a && cd /Users && rm -rf sergio"        2 "$fx" "cd /tmp/a && cd /Users && rm -rf sergio"
check "HOOK4 block: cd $fx/myapp && rm -rf .pandacorp"              2 "$fx" "cd $fx/myapp && rm -rf .pandacorp"
check "HOOK4 block: cd $fx && rm -rf myapp"                         2 "$fx" "cd $fx && rm -rf myapp"
check "HOOK4 block: cd /tmp/a && rm -rf x & rm -rf ~"               2 "$fx" "cd /tmp/a && rm -rf x & rm -rf ~"
check "HOOK4 block: cd /tmp/a && rm -rf \$(echo /)"                 2 "$fx" 'cd /tmp/a && rm -rf $(echo /)'
check "HOOK4 block: cd /tmp/a && echo hi && rm -rf factory"         2 "$fx" "cd /tmp/a && echo hi && rm -rf factory"
check "HOOK4 block: cd ... && newline rm"                           2 "$fx" "cd /tmp/a &&
rm -rf factory"
# Holes the pre-rewrite hook left open: all closed by the whitelist.
check "OLD block: backtick body"                                    2 "$fx" 'echo `rm -rf ~`'
check "OLD block: command substitution body"                        2 "$fx" 'echo $(rm -rf ~)'
check "OLD block: brace expansion"                                  2 "$fx" "rm -rf {~,/tmp/x}"
check "OLD block: export X=/; rm -rf \"\$X\""                       2 "$fx" 'export X=/; rm -rf "$X"'
check "OLD block: \$PWD operand"                                    2 "$fx" 'rm -rf "$PWD/Documents"'
check "OLD block: (rm -rf factory/ideas)"                           2 "$fx" "(rm -rf factory/ideas)"
check "OLD block: rsync --delete into home"                         2 "$fx" "rsync -a --delete /tmp/empty/ ~/"
check "OLD block: srm -rf ~"                                        2 "$fx" "srm -rf ~"
check "OLD block: rm -rf ~root"                                     2 "$fx" "rm -rf ~root"
check "OLD block: rm -rf ~/."                                       2 "$fx" "rm -rf ~/."
check "OLD block: rm -rf \$HOME/.*"                                 2 "$fx" 'rm -rf $HOME/.*'
check "OLD block: /Users/sergio/../.."                              2 "$fx" "rm -rf /Users/sergio/../.."
check "OLD block: node_modules/../../.."                            2 "$fx" "rm -rf node_modules/../../.."
check "OLD block: X=\$(dirname \"\$HOME\"); rm -rf \"\$X/sergio\""  2 "$fx" 'X=$(dirname "$HOME"); rm -rf "$X/sergio"'
check "OLD block: IFS=/; X=...; rm -rf \$X"                         2 "$fx" 'IFS=/; X=/tmp/q/myapp; rm -rf $X'
check "OLD block: symlink planted in the same command"              2 "$fx" "ln -s ~ /tmp/h && rm -rf /tmp/h/"
check "OLD block: bash -euc payload"                                2 "$fx" 'bash -euc "rm -rf ~"'
check "OLD block: payload piped into sh"                            2 "$fx" "echo 'rm -rf ~' | sh"
check "OLD block: \${RM:-rm} -rf"                                   2 "$fx" '${RM:-rm} -rf ~'
check "OLD block: depth-4 sibling repo that is not a worktree"      2 "$fx" "rm -rf /Users/Shared/Proyectos/some-repo"
# Flags or the command word built from expansions (deliberate obfuscation; the old hook allowed these).
check "OBF block: rm -\$'r'f ~"                                     2 "$fx" "rm -\$'r'f ~"
check "OBF block: rm -\$'\\x72'f ~"                                 2 "$fx" "rm -\$'\\x72'f ~"
check "OBF block: \$'\\x72\\x6d' -rf ~"                             2 "$fx" "\$'\\x72\\x6d' -rf ~"
check "OBF block: X=rm; \$X -rf ~"                                  2 "$fx" 'X=rm; $X -rf ~'
check "OBF block: sudo \"\$RM\" -rf ~"                              2 "$fx" 'sudo "$RM" -rf ~'
check "OBF block: rm -f \$'-r' ~"                                   2 "$fx" "rm -f \$'-r' ~"
check "OBF block: {rm,-rf,~}"                                       2 "$fx" "{rm,-rf,~}"
# Not deletes: no false positive.
check "allow: docker run --rm"                                      0 "$fx" "docker run --rm -v x:/y img"
check "allow: cp -r with a variable"                                0 "$fx" 'cp -r "$SRC" dst'
check "allow: grep -rn with a variable"                             0 "$fx" 'grep -rn "$pat" src'
check "allow: ls -R"                                                0 "$fx" "ls -R src"
check "allow: git rm of one file"                                   0 "$fx" "git rm src/a.ts"
check "allow: git rm -r docs/old"                                   0 "$fx" "git rm -r docs/old"
check "allow: git -C /abs/repo rm -r --cached x"                    0 "$fx" "git -C /abs/repo rm -r --cached x"
check "allow: git -C \"\$TOP\" rm -r x (plain variable path)"        0 "$fx" 'git -C "$TOP" rm -r x'
check "block: git rm -r x && rm -rf ~"                              2 "$fx" "git rm -r x && rm -rf ~"
check "block: git rm -r x; rm -rf $SCR/exp1 (whitelist still judges)" 2 "$fx" "git rm -r x; rm -rf $SCR/exp1"
check "block: rm hidden in a git -C substitution"                   2 "$fx" 'git -C "$(rm${IFS}-rf${IFS}~)" rm -r x'
check "block: rm -rf after git -C <path> rm"                        2 "$fx" "git -C /abs/repo rm -r x && rm -rf /Users/x/proj/src"
# DR-HOOK5 C1: backslash-newline is deleted by the shell even mid-word, so it must not hide a word from the detector.
check "C1 block: r\\<NL>m -rf ~"                                     2 "$fx" $'r\\\nm -rf ~'
check "C1 block: rm -\\<NL>rf ~"                                     2 "$fx" $'rm -\\\nrf ~'
check "C1 block: rm -\\<NL>r -f /Users/sergio"                       2 "$fx" $'rm -\\\nr -f /Users/sergio'
check "C1 block: fi\\<NL>nd ~ -delete"                               2 "$fx" $'fi\\\nnd ~ -delete'
check "C1 block: find ~ -del\\<NL>ete"                               2 "$fx" $'find ~ -del\\\nete'
check "C1 block: find -exec r\\<NL>m -rf"                            2 "$fx" $'find /Users/sergio -exec r\\\nm -rf {} +'
check "C1 block: rsy\\<NL>nc --delete"                               2 "$fx" $'rsy\\\nnc -a --delete /tmp/e/ ~/'
check "C1 block: continuation inside an otherwise allowed form"      2 "$fx" $'rm -rf \\\n'"$SCR/exp1"
# DR-HOOK5 C2: a FORCED git rm deletes files with uncommitted changes (BL-0202 class): not exempt.
check "C2 block: git rm -rf ."                                       2 "$fx" "git rm -rf ."
check "C2 block: git rm -rf myapp"                                   2 "$fx" "git rm -rf myapp"
check "C2 block: git -C ~ rm -rf ."                                  2 "$fx" "git -C ~ rm -rf ."
check "C2 block: git rm -r -f :/"                                    2 "$fx" "git rm -r -f :/"
check "C2 block: git rm -r --force x"                                2 "$fx" "git rm -r --force x"
check "C2 block: git rm \"-rf\" . (quoted flag)"                     2 "$fx" 'git rm "-rf" .'
check "C2 block: git rm -r \$F x (flag may come from a variable)"    2 "$fx" 'git rm -r $F x'
check "C2 block: git -C \"\$TOP\" rm -rf x"                          2 "$fx" 'git -C "$TOP" rm -rf x'
check "C2 allow: git rm -r --cached .next"                           0 "$fx" "git rm -r --cached .next"
check "C2 allow: git rm -r src/old"                                  0 "$fx" "git rm -r src/old"
check "C2 allow: git rm -rf --cached x (index only)"                 0 "$fx" "git rm -rf --cached x"
check "C2 allow: two unforced git rm -r"                             0 "$fx" "git rm -r a && git rm -r --cached b"
# DR-HOOK5 C3: a NUL byte is dropped by bash's $(...) but truncates the argument in zsh: blocked outright.
check_json() { # $1 label, $2 expected rc, $3 cwd, $4 command already JSON-escaped (e.g. containing \u0000)
  rc=$(printf '{"cwd":"%s","tool_input":{"command":"%s"}}' "$3" "$4" | bash "$GATE" >/dev/null 2>&1; echo $?)
  if [ "$rc" = "$2" ]; then echo "  ✓ $1"; pass=$((pass+1)); else echo "  ✗ $1 (expected $2, got $rc)"; fail=$((fail+1)); fi
}
check_json "C3 block: NUL before /Documents/node_modules"            2 "$fx" 'rm -rf /Users/sergio\u0000/Documents/node_modules'
check_json "C3 block: NUL in a deep build path"                      2 "$fx" 'rm -rf /Users/sergio\u0000/Documents/x/build'
check_json "C3 block: NUL after an allowed scratch path"             2 "$fx" "rm -rf $SCR/exp1\\u0000"
check_json "C3 block: NUL even in a harmless command"                2 "$fx" 'echo a\u0000b'
check_json "C3 control: the same JSON path without NUL allows"       0 "$fx" "rm -rf $SCR/exp1"
# DR-HOOK5 non-blocking: generic build-output names only next to a package.json; scratch at least 3 levels below claude-*.
P=/private/tmp/hookfinal-proj-$$
mkdir -p "$P/app/dist" "$P/app/build" "$P/noapp/build" "$P/noapp/out"
echo '{}' > "$P/app/package.json"
check "allow: build output next to a package.json"                   0 "$fx" "rm -rf $P/app/dist $P/app/build $P/app/coverage $P/app/.turbo $P/app/out"
check "allow: test/vite/cache output next to a package.json"         0 "$fx" "cd $P/app && rm -rf test-results playwright-report .vite .cache"
check "block: build with no package.json beside it"                  2 "$fx" "rm -rf $P/noapp/build"
check "block: out with no package.json beside it"                    2 "$fx" "cd $P/noapp && rm -rf out"
check "block: ~/Documents/build-like folder (no package.json)"       2 "$fx" "rm -rf /Users/x/Documents/build"
check "block: dist under a missing project"                          2 "$fx" "rm -rf /Users/x/proj/dist"
check "allow: node_modules needs no package.json"                    0 "$fx" "rm -rf $P/noapp/node_modules"
rm -rf "$P"
check "block: /tmp/claude-501/<project> (every session's scratchpads)" 2 "$fx" "rm -rf /tmp/claude-501/hookfinal-slug"
check "block: two levels below claude-*"                             2 "$fx" "rm -rf /private/tmp/claude-501/hookfinal-slug/session"
check "allow: three levels below claude-*"                           0 "$fx" "rm -rf /private/tmp/claude-501/hookfinal-slug/session/scratchpad"
hint=$(printf '{"cwd":"%s","tool_input":{"command":"rm -rf src/old && pnpm build"}}' "$fx" | bash "$GATE" 2>&1 >/dev/null)
case "$hint" in *"git rm -r"*"SEPARATE"*|*"SEPARATE"*"git rm -r"*) echo "  ✓ block message suggests git rm -r and a separate follow-up"; pass=$((pass+1)) ;;
  *) echo "  ✗ block message lacks the git rm -r / separate-command hint: $hint"; fail=$((fail+1)) ;; esac
rm -rf /private/tmp/claude-501/hookrm-test

echo "== OUT OF SCOPE (expect 0 in a non-Pandacorp dir) =="
plain=$(mktemp -d)
check "non-Pandacorp dir allows"           0 "$plain" "git push --force"
rm -rf "$plain" "$fx"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
