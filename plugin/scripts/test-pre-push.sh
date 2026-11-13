#!/bin/bash
# Suite for the git pre-push hook template and its installer (B10; design D29, PLAN 3.15, standard
# BUILD-13, CLI doc section 12). This guards a human gate: a push to the default branch of a LAUNCHED
# project (production, DR-138) must be rejected unless PANDACORP_OWNER_RELEASE_OK=1.
# Run from anywhere: bash plugin/scripts/test-pre-push.sh   (prints a RESULT line; non-zero on failure)
#
# ASSUMED INTERFACE (everything below comes from the contract docs; items marked (A) are assumptions
# the orchestrator must reconcile with the module):
#   - Installer: `node plugin/scripts/install-pre-push.mjs --project <dir> [--check]`.
#     Exit codes: 0 installed/current (install success), 1 missing or stale (--check), 2 not a git
#     repository, 3 core.hooksPath points inside the work tree (refused). Idempotent.
#   - Template at plugin/templates/shared/.pandacorp/hooks/pre-push (only its existence is asserted;
#     the template text is never read). The installed hook is a configured, executable, untracked copy in
#     `git rev-parse --git-path hooks`, carrying the line `# pandacorp-pre-push v2`.
#   - A foreign pre-push is renamed `pre-push.pandacorp-chained` (same directory) and is called by the
#     installed hook with git's own arguments and the stdin lines; its failure blocks the push.
#   - Hook logic: stdin lines `<local_ref> <local_sha> <remote_ref> <remote_sha>`; default branch =
#     `git symbolic-ref --short refs/remotes/<remote>/HEAD` minus the `<remote>/` prefix, else `main`;
#     launched = `phase: release` and NOT `deploy_target: internal` (regex of merge-queue.sh:249-250);
#     launched + any remote_ref == refs/heads/<default> (push or delete) + OWNER_RELEASE_OK != 1 ->
#     exit 1, reason on stderr; unreadable/missing status.yaml + push to the default branch -> exit 1;
#     everything else exit 0. Only the exact value `1` opens the gate. Tags and other branches pass.
#   (A) the stderr reason names the variable PANDACORP_OWNER_RELEASE_OK (so the owner knows the gate).
#   (A) the Spanish line of the reason is NOT asserted (no wording is specified).
#   (A) with PANDACORP_OWNER_RELEASE_OK=1 AND an unreadable status.yaml the outcome is not asserted
#       (the docs only fix the case without the variable).
#   (A) the installer is invoked with a cwd different from the project (it must use --project only);
#       a missing --project exits non-zero (the exact code is not asserted).
#   (A) `--project <linked worktree>` installs into the shared hooks directory of the repository.
set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
INSTALLER="$HERE/plugin/scripts/install-pre-push.mjs"
TEMPLATE="$HERE/plugin/templates/shared/.pandacorp/hooks/pre-push"
FIXMOD="$HERE/plugin/scripts/fixtures/build-v2/make-fixture.mjs"
MARKER='# pandacorp-pre-push v2'
ZERO=0000000000000000000000000000000000000000

pass=0; fail=0
ok()  { echo "  ok   $1"; pass=$((pass+1)); }
bad() { echo "  FAIL $1"; fail=$((fail+1)); }
# t <description> <command...>: passes when the command succeeds.
t() { local d=$1; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }
# tf <description> <command...>: passes when the command fails.
tf() { local d=$1; shift; if "$@" >/dev/null 2>&1; then bad "$d"; else ok "$d"; fi; }
# eq <description> <expected> <actual>
eq() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected '$2', got '$3')"; fi; }
section() { echo; echo "== $1 =="; }

TMP=$(mktemp -d "${TMPDIR:-/tmp}/test-pre-push.XXXXXX") || { echo "cannot create temp dir"; exit 1; }
TMP=$(cd "$TMP" && pwd -P)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/home"

# Isolation: no user git config, no inherited hook/git env, no inherited release flag.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_OBJECT_DIRECTORY PANDACORP_OWNER_RELEASE_OK
export HOME="$TMP/home" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_TERMINAL_PROMPT=0 LANG=C
export GIT_AUTHOR_NAME=Fixture GIT_AUTHOR_EMAIL=fixture@example.invalid GIT_COMMITTER_NAME=Fixture GIT_COMMITTER_EMAIL=fixture@example.invalid
export PANDACORP_NOTIFY=off

D=""; P=""; R=""   # current case dir, project, bare remote
PRC=0; POUT=""     # last push result
HRC=0; HERR=""     # last direct hook run
IRC=0; IOUT=""     # last installer run

# mkfx <json options>: creates a fixture in a fresh dir; sets D, P (project), R (bare remote or "").
mkfx() {
  D=$(mktemp -d "$TMP/c.XXXXXX")
  if ! node --input-type=module -e 'const m = await import(process.argv[2]); await m.createFixture(JSON.parse(process.argv[3]), { dir: process.argv[4] });' x "$FIXMOD" "$1" "$D" >"$D/fixture.log" 2>&1; then
    echo "  (fixture creation failed: $(tail -n 3 "$D/fixture.log" | tr '\n' ' '))"
  fi
  P="$D/project"; R=""; [ -d "$D/remote.git" ] && R="$D/remote.git"
}
# mkfx_unlaunched: basic fixture (phase implementation) plus a throwaway bare remote `origin` with main pushed.
mkfx_unlaunched() {
  mkfx '{"preset":"basic"}'
  R="$D/remote.git"
  git init -q --bare -b main "$R" && git -C "$P" remote add origin "$R" && git -C "$P" push -q origin main
}
# status_set <phase> <deploy_target|-> : rewrites the status file and commits it.
status_set() {
  local f="$P/.pandacorp/status.yaml"
  { echo "project: \"fixture\""; echo "phase: $1"; [ "$2" != "-" ] && echo "deploy_target: $2"; echo "version: v1"; } > "$f"
  git -C "$P" add -A && git -C "$P" commit -q -m "status $1 $2"
}
cmt() { ( cd "$1" && echo "$RANDOM$RANDOM$$" > "w_$RANDOM.txt" && git add -A && git commit -q -m "t" ); }
refs() { git --git-dir="$R" for-each-ref --format='%(refname) %(objectname)'; }
rref() { git --git-dir="$R" rev-parse --verify -q "$1" 2>/dev/null || echo none; }
hookdir() { ( cd "$1" && p=$(git rev-parse --git-path hooks) && case $p in /*) echo "$p";; *) echo "$1/$p";; esac ); }

# inst <project> [--check]: runs the installer from a neutral cwd; sets IRC / IOUT.
inst() { local proj=$1; shift; IOUT=$( cd "$TMP" && node "$INSTALLER" --project "$proj" "$@" 2>&1 ); IRC=$?; }
# gpush <project> <env assignment or ""> <git push args...>: real push, refuses any non-throwaway remote.
gpush() {
  local proj=$1 spec=$2; shift 2
  local url; url=$(git -C "$proj" remote get-url origin 2>/dev/null)
  case $url in
    "$TMP"/*) ;;
    *) POUT="REFUSING to push: origin is not a throwaway local remote ($url)"; PRC=99; echo "  !! $POUT"; return;;
  esac
  POUT=$( cd "$proj" && env -u PANDACORP_OWNER_RELEASE_OK $spec git push "$@" 2>&1 ); PRC=$?
}
# hookrun <project> <stdin text> <env assignment or "">: runs the installed hook directly; sets HRC / HERR (stderr).
hookrun() {
  local proj=$1 input=$2 spec=${3:-} h; h="$(hookdir "$proj")/pre-push"
  HERR=$( cd "$proj" && printf '%s' "$input" | env -u PANDACORP_OWNER_RELEASE_OK $spec "$h" origin "$R" 2>&1 >/dev/null ); HRC=$?
}
# line <local_ref> <remote_ref> [remote_sha]
line() { printf '%s %s %s %s\n' "$1" "$(git -C "$P" rev-parse HEAD)" "$2" "${3:-$ZERO}"; }
snap() { ( cd "$1" && git status --porcelain --ignored; git ls-files -s | cksum; cksum .gitignore; ls -A .pandacorp ) 2>&1; }
count_lines() { if [ -f "$1" ]; then wc -l < "$1" | tr -d ' '; else echo 0; fi; }

# ---------------------------------------------------------------------------------------------------
section "0. preconditions (module files exist)"
t "installer exists: plugin/scripts/install-pre-push.mjs" [ -f "$INSTALLER" ]
t "hook template exists: plugin/templates/shared/.pandacorp/hooks/pre-push" [ -f "$TEMPLATE" ]
t "fixture module exists" [ -f "$FIXMOD" ]
mkfx '{"preset":"launched"}'
t "launched fixture has a bare remote and a project" [ -d "$R" ] && [ -d "$P/.git" ]

# ---------------------------------------------------------------------------------------------------
section "1. installer: install, marker, untracked, idempotent"
mkfx '{"preset":"launched"}'
before=$(snap "$P")
inst "$P"; eq "install exits 0" 0 "$IRC"
[ "$IRC" -ne 0 ] && echo "      installer output: $(echo "$IOUT" | tail -n 3 | tr '\n' ' ')"
H="$(hookdir "$P")/pre-push"
t "hook written into git-path hooks" [ -f "$H" ]
t "hook is executable" [ -x "$H" ]
tf "hook is a copy, not a symlink" [ -L "$H" ]
t "hook carries the version marker" grep -qF "$MARKER" "$H"
t "hook is valid bash" bash -n "$H"
tf "no pre-push.pandacorp-chained when nothing foreign existed" [ -e "$(hookdir "$P")/pre-push.pandacorp-chained" ]
eq "installer wrote nothing tracked, untracked or ignored in the work tree" "$before" "$(snap "$P")"
tf "no tracked .pandacorp/hooks directory created" [ -e "$P/.pandacorp/hooks" ]
eq "git ls-files lists no hooks file" "" "$(git -C "$P" ls-files | grep -i 'hooks/' || true)"
inst "$P" --check; eq "--check after install exits 0 (installed, current)" 0 "$IRC"
sum1=$(cksum < "$H"); ls1=$(ls -A "$(hookdir "$P")")
inst "$P"; eq "second install exits 0" 0 "$IRC"
inst "$P"; eq "third install exits 0" 0 "$IRC"
eq "idempotent: hook bytes unchanged" "$sum1" "$(cksum < "$H")"
eq "idempotent: hooks directory listing unchanged (no chained/backup litter)" "$ls1" "$(ls -A "$(hookdir "$P")")"
eq "idempotent: still nothing written to the work tree" "$before" "$(snap "$P")"
inst "$P" --check; eq "--check after repeated installs exits 0" 0 "$IRC"
ls2=$(ls -A "$(hookdir "$P")"); inst "$P" --check
eq "--check writes nothing" "$ls2" "$(ls -A "$(hookdir "$P")")"

section "1b. installer: --check exit map and bad input"
mkfx '{"preset":"launched"}'
inst "$P" --check; eq "--check with no hook exits 1 (missing)" 1 "$IRC"
tf "--check did not install anything" [ -e "$(hookdir "$P")/pre-push" ]
printf '#!/bin/sh\nexit 0\n' > "$(hookdir "$P")/pre-push"; chmod +x "$(hookdir "$P")/pre-push"
inst "$P" --check; eq "--check with only a foreign hook exits 1 (missing)" 1 "$IRC"
eq "--check left the foreign hook alone" "#!/bin/sh" "$(head -n 1 "$(hookdir "$P")/pre-push")"
mkdir -p "$D/plain"
inst "$D/plain" --check; eq "--check in a non-repository exits 2" 2 "$IRC"
inst "$D/plain"; eq "install in a non-repository exits 2" 2 "$IRC"
tf "install in a non-repository creates no .git" [ -e "$D/plain/.git" ]
tf "install in a non-repository writes no file" [ -n "$(ls -A "$D/plain")" ]
IOUT=$( cd "$TMP" && node "$INSTALLER" 2>&1 ); IRC=$?
tf "missing --project exits non-zero" [ "$IRC" -eq 0 ]
mkfx '{"preset":"launched"}'
rm -rf "$P/.git/hooks"
inst "$P"; eq "install recreates a missing hooks directory (exit 0)" 0 "$IRC"
t "hook present after recreating the hooks directory" grep -qF "$MARKER" "$P/.git/hooks/pre-push"

section "1c. installer: stale version marker"
mkfx '{"preset":"launched"}'
inst "$P"; H="$(hookdir "$P")/pre-push"
sed 's/pandacorp-pre-push v2/pandacorp-pre-push v0/' "$H" > "$H.new" && mv "$H.new" "$H" && chmod +x "$H"
tf "stale hook no longer carries the current marker" grep -qF "$MARKER" "$H"
inst "$P" --check; eq "--check detects a stale marker (exit 1)" 1 "$IRC"
inst "$P"; eq "install over a stale hook exits 0" 0 "$IRC"
t "install refreshed the marker to v2" grep -qF "$MARKER" "$H"
tf "stale pandacorp hook was not preserved as a chained foreign hook" [ -e "$(hookdir "$P")/pre-push.pandacorp-chained" ]
inst "$P" --check; eq "--check after refresh exits 0" 0 "$IRC"
# a stale marker with a chained foreign hook keeps the foreign hook intact
mkfx '{"preset":"launched"}'
printf '#!/bin/sh\necho FOREIGN-ORIGINAL >/dev/null\nexit 0\n' > "$P/.git/hooks/pre-push"; chmod +x "$P/.git/hooks/pre-push"
cp "$P/.git/hooks/pre-push" "$D/foreign.orig"
inst "$P"; H="$P/.git/hooks/pre-push"
sed 's/pandacorp-pre-push v2/pandacorp-pre-push v0/' "$H" > "$H.new" && mv "$H.new" "$H" && chmod +x "$H"
inst "$P" --check; eq "stale marker with a chained foreign hook: --check exits 1" 1 "$IRC"
inst "$P"; eq "reinstall over stale + chained exits 0" 0 "$IRC"
t "chained foreign hook still byte-identical to the original" cmp -s "$D/foreign.orig" "$P/.git/hooks/pre-push.pandacorp-chained"
t "refreshed hook carries the marker" grep -qF "$MARKER" "$P/.git/hooks/pre-push"

# ---------------------------------------------------------------------------------------------------
section "2. launched project: default branch is gated"
mkfx '{"preset":"launched"}'; inst "$P"
cmt "$P"
m0=$(rref refs/heads/main)
gpush "$P" "" origin main
tf "push main without the flag is rejected" [ "$PRC" -eq 0 ]
eq "remote main unchanged after the rejected push" "$m0" "$(rref refs/heads/main)"
t "the reason names PANDACORP_OWNER_RELEASE_OK" grep -q PANDACORP_OWNER_RELEASE_OK <<<"$POUT"
for v in 0 true yes " " ""; do
  gpush "$P" "PANDACORP_OWNER_RELEASE_OK=$v" origin main
  tf "flag value '$v' does not open the gate" [ "$PRC" -eq 0 ]
done
eq "remote main still unchanged after wrong flag values" "$m0" "$(rref refs/heads/main)"
gpush "$P" "PANDACORP_OWNER_RELEASE_OK=1" origin main
eq "push main with PANDACORP_OWNER_RELEASE_OK=1 succeeds" 0 "$PRC"
eq "remote main advanced to the local tip" "$(git -C "$P" rev-parse main)" "$(rref refs/heads/main)"
cmt "$P"; git -C "$P" checkout -q -b feat; cmt "$P"
gpush "$P" "PANDACORP_OWNER_RELEASE_OK=1" origin HEAD:main
eq "HEAD:main with the flag succeeds" 0 "$PRC"

section "2b. launched: refspecs that update the default branch are rejected (remote untouched)"
mkfx '{"preset":"launched"}'; inst "$P"
cmt "$P"                                  # local main ahead of the remote
git -C "$P" checkout -q -b feat; cmt "$P"  # feat ahead of main
git -C "$P" tag v1; git -C "$P" tag v2; git -C "$P" tag v3
bl() {
  local label=$1; shift; local b; b=$(refs)
  gpush "$P" "" "$@"
  tf "rejected: $label" [ "$PRC" -eq 0 ]
  eq "remote untouched after: $label" "$b" "$(refs)"
  t "reason names the variable for: $label" grep -q PANDACORP_OWNER_RELEASE_OK <<<"$POUT"
}
bl "main" origin main
bl "main:main" origin main:main
bl "HEAD:main (checked-out feature branch)" origin HEAD:main
bl "feat:main" origin feat:main
bl "feat:refs/heads/main" origin feat:refs/heads/main
bl "HEAD:refs/heads/main" origin HEAD:refs/heads/main
bl "+feat:main (forced)" origin +feat:main
bl "+main (forced)" origin +main
bl "--force origin main" --force origin main
bl "--all (includes main)" --all origin
bl "--mirror" --mirror origin
bl "feat and main together" origin feat main
bl "feat:feat2 and main:main together" origin feat:feat2 main:main
bl "--atomic feat main" --atomic origin feat main
bl "delete via :main" origin :main
bl "delete via :refs/heads/main" origin :refs/heads/main
bl "delete via --delete main" origin --delete main
b=$(refs); POUT=$( cd "$P/src/alpha" && env -u PANDACORP_OWNER_RELEASE_OK git push origin main 2>&1 ); PRC=$?
tf "rejected: push main from a subdirectory of the work tree" [ "$PRC" -eq 0 ]
eq "remote untouched after the subdirectory push" "$b" "$(refs)"
git -C "$P" worktree add -q "$D/linked" -b feat-linked 2>/dev/null && cmt "$D/linked"
b=$(refs); POUT=$( cd "$D/linked" && env -u PANDACORP_OWNER_RELEASE_OK git push origin HEAD:main 2>&1 ); PRC=$?
tf "rejected: HEAD:main from a linked worktree (hook shared through the common dir)" [ "$PRC" -eq 0 ]
eq "remote untouched after the linked-worktree push" "$b" "$(refs)"
inst "$D/linked" --check; eq "--check through a linked worktree sees the shared hook (exit 0)" 0 "$IRC"

section "2c. launched: everything that does not touch the default branch is allowed"
al() {
  local label=$1; shift; local b; b=$(refs)
  gpush "$P" "" "$@"
  eq "allowed: $label (exit 0)" 0 "$PRC"
  tf "remote changed by: $label" [ "$(refs)" = "$b" ]
}
al "feat" origin feat
al "feat:feat2" origin feat:feat2
al "HEAD:refs/heads/mainline (name merely starts with main)" origin HEAD:refs/heads/mainline
al "feat:refs/heads/feature/main (branch path ending in main)" origin feat:refs/heads/feature/main
al "feat:main-old" origin feat:main-old
al "feat:refs/heads/release/main" origin feat:refs/heads/release/main
al "a single tag (v1)" origin v1
al "--tags (v2, v3)" --tags origin
al "tag mapped to another tag name" origin refs/tags/v1:refs/tags/v1b
eq "main on the remote was never touched in this block" "$(git -C "$P" rev-parse refs/remotes/origin/main)" "$(rref refs/heads/main)"
b=$(refs); gpush "$P" "" origin :feat2
eq "allowed: delete another branch (:feat2)" 0 "$PRC"; tf "feat2 is gone" [ "$(refs)" = "$b" ]
gpush "$P" "" origin --delete mainline
eq "allowed: --delete mainline" 0 "$PRC"
gpush "$P" "" origin :refs/tags/v1
eq "allowed: delete a tag" 0 "$PRC"
section "2d. launched: deleting the default branch with the flag passes the hook"
git --git-dir="$R" config receive.denyDeleteCurrent ignore
gpush "$P" "" origin :main
tf "delete main without the flag rejected" [ "$PRC" -eq 0 ]
t "remote main still exists" [ "$(rref refs/heads/main)" != none ]
gpush "$P" "PANDACORP_OWNER_RELEASE_OK=1" origin :main
eq "delete main with the flag succeeds (the flag is the owner's order)" 0 "$PRC"
eq "remote main deleted" none "$(rref refs/heads/main)"

section "2e. direct hook runs: stdin forms, mixed lines, empty input"
mkfx '{"preset":"launched"}'; inst "$P"
hookrun "$P" "$(line refs/heads/feat refs/heads/feat)" "";        eq "feature branch line passes" 0 "$HRC"
hookrun "$P" "$(line refs/heads/main refs/heads/main)" "";        eq "main line is rejected" 1 "$HRC"
hookrun "$P" "$(line refs/heads/main refs/heads/main)" "PANDACORP_OWNER_RELEASE_OK=1"; eq "main line with the flag passes" 0 "$HRC"
hookrun "$P" "$(line '(delete)' refs/heads/main "$(git -C "$P" rev-parse HEAD)")" ""; eq "delete line for main is rejected" 1 "$HRC"
hookrun "$P" "$(line '(delete)' refs/heads/main "$(git -C "$P" rev-parse HEAD)")" "PANDACORP_OWNER_RELEASE_OK=1"; eq "delete line for main with the flag passes" 0 "$HRC"
hookrun "$P" "$(line '(delete)' refs/heads/feat "$(git -C "$P" rev-parse HEAD)")" ""; eq "delete line for another branch passes" 0 "$HRC"
hookrun "$P" "$(line refs/tags/v1 refs/tags/v1)" "";               eq "tag line passes" 0 "$HRC"
hookrun "$P" "$(line refs/tags/main refs/tags/main)" "";           eq "a TAG named main is not the default branch (passes)" 0 "$HRC"
hookrun "$P" "$(line refs/heads/feat refs/heads/feat)"$'\n'"$(line refs/heads/main refs/heads/main)" ""; eq "feature line then main line: rejected" 1 "$HRC"
hookrun "$P" "$(line refs/heads/main refs/heads/main)"$'\n'"$(line refs/heads/feat refs/heads/feat)" ""; eq "main line then feature line: rejected" 1 "$HRC"
hookrun "$P" "$(line refs/heads/feat refs/heads/feat)"$'\n'"$(line refs/tags/v1 refs/tags/v1)" ""; eq "feature + tag lines pass" 0 "$HRC"
hookrun "$P" "" "";                                                  eq "empty stdin passes" 0 "$HRC"
hookrun "$P" "$(line refs/heads/main refs/heads/main)" "PANDACORP_OWNER_RELEASE_OK=1 PANDACORP_X=1"; eq "extra env does not matter, flag 1 passes" 0 "$HRC"
hookrun "$P" "$(line refs/heads/main refs/heads/main)" ""; t "stderr is non-empty on rejection" [ -n "$HERR" ]
t "stderr names the variable" grep -q PANDACORP_OWNER_RELEASE_OK <<<"$HERR"

section "2f. default branch resolved from refs/remotes/<remote>/HEAD"
mkfx '{"preset":"launched"}'
git --git-dir="$R" branch trunk main && git -C "$P" fetch -q origin && git -C "$P" remote set-head origin trunk >/dev/null 2>&1
git --git-dir="$R" branch release/prod main && git -C "$P" fetch -q origin
inst "$P"
eq "origin/HEAD resolves to trunk (fixture sanity)" "origin/trunk" "$(git -C "$P" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)"
hookrun "$P" "$(line refs/heads/trunk refs/heads/trunk)" "";     eq "trunk (the remote's default) is gated" 1 "$HRC"
hookrun "$P" "$(line refs/heads/trunk refs/heads/trunk)" "PANDACORP_OWNER_RELEASE_OK=1"; eq "trunk with the flag passes" 0 "$HRC"
hookrun "$P" "$(line refs/heads/main refs/heads/main)" "";       eq "main is NOT gated when the default is trunk" 0 "$HRC"
cmt "$P"; git -C "$P" checkout -q -b feat; cmt "$P"
b=$(refs); gpush "$P" "" origin feat:trunk
tf "real push feat:trunk rejected" [ "$PRC" -eq 0 ]; eq "remote untouched after the trunk push" "$b" "$(refs)"
gpush "$P" "" origin feat:main
eq "real push feat:main allowed (main is not the default here)" 0 "$PRC"
git -C "$P" symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/release/prod
hookrun "$P" "$(line refs/heads/release/prod refs/heads/release/prod)" ""; eq "default branch with a slash (release/prod) is gated" 1 "$HRC"
hookrun "$P" "$(line refs/heads/prod refs/heads/prod)" "";                 eq "a branch that is only the tail of the default name passes" 0 "$HRC"

# ---------------------------------------------------------------------------------------------------
section "3. unlaunched and internal projects: pushes are allowed"
mkfx_unlaunched; inst "$P"; eq "install in an unlaunched project exits 0" 0 "$IRC"
inst "$P" --check; eq "--check in an unlaunched project exits 0" 0 "$IRC"
cmt "$P"; gpush "$P" "" origin main
eq "unlaunched: push main allowed without the flag" 0 "$PRC"
eq "unlaunched: remote main advanced" "$(git -C "$P" rev-parse main)" "$(rref refs/heads/main)"
git -C "$P" checkout -q -b feat; cmt "$P"; gpush "$P" "" origin HEAD:main
eq "unlaunched: HEAD:main allowed" 0 "$PRC"
git -C "$P" checkout -q main && git -C "$P" merge -q --ff-only origin/main 2>/dev/null; git -C "$P" fetch -q origin; git -C "$P" merge -q --ff-only origin/main; cmt "$P"; git -C "$P" checkout -q feat; cmt "$P"
gpush "$P" "" --all origin; eq "unlaunched: --all allowed" 0 "$PRC"; [ "$PRC" -ne 0 ] && echo "      push output: $(echo "$POUT" | tail -n 3 | tr '\n' ' ')"
hookrun "$P" "$(line '(delete)' refs/heads/main "$(git -C "$P" rev-parse HEAD)")" ""; eq "unlaunched: delete of main passes the hook" 0 "$HRC"
git --git-dir="$R" config receive.denyDeleteCurrent ignore
gpush "$P" "" origin :main; eq "unlaunched: real delete of main allowed" 0 "$PRC"

mkfx_unlaunched; inst "$P"
status_set release internal
cmt "$P"; gpush "$P" "" origin main
eq "release + deploy_target internal: push main allowed" 0 "$PRC"
status_set release "internal  # owner-only"
hookrun "$P" "$(line refs/heads/main refs/heads/main)" ""; eq "deploy_target internal with a trailing comment: allowed" 0 "$HRC"
status_set release -
hookrun "$P" "$(line refs/heads/main refs/heads/main)" ""; eq "phase release without deploy_target: launched, rejected" 1 "$HRC"
status_set release external
hookrun "$P" "$(line refs/heads/main refs/heads/main)" ""; eq "phase release + external: rejected" 1 "$HRC"
status_set implementation external
hookrun "$P" "$(line refs/heads/main refs/heads/main)" ""; eq "phase implementation + external: allowed" 0 "$HRC"
status_set release external
cmt "$P"; gpush "$P" "" origin main
tf "launched via a real push: rejected" [ "$PRC" -eq 0 ]
gpush "$P" "PANDACORP_OWNER_RELEASE_OK=1" origin main
eq "launched via a real push with the flag: allowed" 0 "$PRC"

# ---------------------------------------------------------------------------------------------------
section "4. fail closed: the hook cannot determine the state"
mkfx '{"preset":"launched"}'; inst "$P"
cmt "$P"; git -C "$P" checkout -q -b feat; cmt "$P"; git -C "$P" checkout -q main
mv "$P/.pandacorp/status.yaml" "$D/status.hidden"
b=$(refs)
hookrun "$P" "$(line refs/heads/main refs/heads/main)" "";       eq "missing status.yaml + push to the default branch: exit 1" 1 "$HRC"
t "a reason is printed" [ -n "$HERR" ]
hookrun "$P" "$(line '(delete)' refs/heads/main "$(git -C "$P" rev-parse HEAD)")" ""; eq "missing status.yaml + delete of the default branch: exit 1" 1 "$HRC"
hookrun "$P" "$(line refs/heads/feat refs/heads/feat)" "";       eq "missing status.yaml + feature branch: exit 0" 0 "$HRC"
hookrun "$P" "$(line refs/tags/v1 refs/tags/v1)" "";             eq "missing status.yaml + tag: exit 0" 0 "$HRC"
gpush "$P" "" origin main
tf "missing status.yaml: a real push of main is rejected" [ "$PRC" -eq 0 ]
eq "remote untouched" "$b" "$(refs)"
mkdir "$P/.pandacorp/status.yaml"
hookrun "$P" "$(line refs/heads/main refs/heads/main)" "";       eq "status.yaml that is a directory (unreadable) + default branch: exit 1" 1 "$HRC"
rmdir "$P/.pandacorp/status.yaml"
cp "$D/status.hidden" "$P/.pandacorp/status.yaml"; chmod 000 "$P/.pandacorp/status.yaml"
if [ -r "$P/.pandacorp/status.yaml" ]; then
  echo "  skip chmod 000 case (file still readable, probably running as root)"
else
  hookrun "$P" "$(line refs/heads/main refs/heads/main)" "";     eq "status.yaml with mode 000 + default branch: exit 1" 1 "$HRC"
  hookrun "$P" "$(line refs/heads/feat refs/heads/feat)" "";     eq "status.yaml with mode 000 + feature branch: exit 0" 0 "$HRC"
fi
chmod 644 "$P/.pandacorp/status.yaml"
hookrun "$P" "$(line refs/heads/main refs/heads/main)" "";       eq "status.yaml restored: launched, default branch rejected normally" 1 "$HRC"
mkfx_unlaunched; inst "$P"; rm -f "$P/.pandacorp/status.yaml"
hookrun "$P" "$(line refs/heads/main refs/heads/main)" "";       eq "unlaunched project with status.yaml gone + default branch: exit 1 (cannot tell)" 1 "$HRC"
hookrun "$P" "$(line refs/heads/feat refs/heads/feat)" "";       eq "same project, feature branch: exit 0" 0 "$HRC"

# ---------------------------------------------------------------------------------------------------
section "5. a pre-existing pre-push hook is chained"
mkfx '{"preset":"launched"}'
FOREIGN='#!/bin/sh
{ echo "ARGS $*"; cat; } >> "'"$D"'/foreign.log"
exit 0
'
printf '%s' "$FOREIGN" > "$P/.git/hooks/pre-push"; chmod +x "$P/.git/hooks/pre-push"
cp "$P/.git/hooks/pre-push" "$D/foreign.orig"
inst "$P"; eq "install over a foreign hook exits 0" 0 "$IRC"
CH="$P/.git/hooks/pre-push.pandacorp-chained"
t "foreign hook preserved as pre-push.pandacorp-chained" [ -f "$CH" ]
t "chained hook is executable" [ -x "$CH" ]
t "chained hook is byte-identical to the original" cmp -s "$D/foreign.orig" "$CH"
t "installed pre-push is ours (marker)" grep -qF "$MARKER" "$P/.git/hooks/pre-push"
tf "installed pre-push does not carry the foreign body" grep -q 'foreign.log' "$P/.git/hooks/pre-push"
inst "$P" --check; eq "--check with a chained hook exits 0" 0 "$IRC"
cmt "$P"; git -C "$P" checkout -q -b feat; cmt "$P"
gpush "$P" "" origin feat
eq "feature push allowed through the chain" 0 "$PRC"
eq "foreign hook ran exactly once for the push" 1 "$(grep -c '^ARGS' "$D/foreign.log" 2>/dev/null || echo 0)"
t "foreign hook received git's args (remote name first)" grep -q '^ARGS origin ' "$D/foreign.log"
t "foreign hook received the stdin ref lines" grep -q 'refs/heads/feat' "$D/foreign.log"
n=$(grep -c '^ARGS' "$D/foreign.log")
gpush "$P" "" origin HEAD:main
tf "default-branch push still rejected with a foreign hook present" [ "$PRC" -eq 0 ]
eq "remote main unchanged" "$(git -C "$P" rev-parse refs/remotes/origin/main)" "$(rref refs/heads/main)"
gpush "$P" "PANDACORP_OWNER_RELEASE_OK=1" origin HEAD:main
eq "default-branch push with the flag allowed through the chain" 0 "$PRC"
t "foreign hook ran again for the allowed push" [ "$(grep -c '^ARGS' "$D/foreign.log")" -gt "$n" ]
inst "$P"; inst "$P"
t "after re-installs the chained hook is still the original foreign hook" cmp -s "$D/foreign.orig" "$CH"
tf "re-install did not chain our own hook into itself" grep -qF "$MARKER" "$CH"
n=$(grep -c '^ARGS' "$D/foreign.log"); cmt "$P"; gpush "$P" "" origin feat
eq "after re-installs the foreign hook still runs exactly once per push" "$((n+1))" "$(grep -c '^ARGS' "$D/foreign.log")"

mkfx '{"preset":"launched"}'
printf '#!/bin/sh\necho FOREIGN-REJECT >&2\nexit 7\n' > "$P/.git/hooks/pre-push"; chmod +x "$P/.git/hooks/pre-push"
inst "$P"; cmt "$P"; git -C "$P" checkout -q -b feat; cmt "$P"; b=$(refs)
gpush "$P" "" origin feat
tf "a failing foreign hook blocks a push the gate would allow" [ "$PRC" -eq 0 ]
t "the foreign hook's message is visible" grep -q FOREIGN-REJECT <<<"$POUT"
eq "remote untouched when the foreign hook fails" "$b" "$(refs)"
gpush "$P" "PANDACORP_OWNER_RELEASE_OK=1" origin HEAD:main
tf "a failing foreign hook still blocks even with the flag set" [ "$PRC" -eq 0 ]
eq "remote untouched (flag set, foreign hook failing)" "$b" "$(refs)"
mkfx_unlaunched
printf '#!/bin/sh\necho FOREIGN-REJECT >&2\nexit 7\n' > "$P/.git/hooks/pre-push"; chmod +x "$P/.git/hooks/pre-push"
inst "$P"; cmt "$P"; b=$(refs); gpush "$P" "" origin main
tf "unlaunched project: failing foreign hook still blocks" [ "$PRC" -eq 0 ]
eq "remote untouched (unlaunched, foreign failing)" "$b" "$(refs)"

# ---------------------------------------------------------------------------------------------------
section "6. core.hooksPath"
mkfx '{"preset":"launched"}'
CUSTOM="$D/customhooks"; mkdir -p "$CUSTOM"
printf '#!/bin/sh\necho CUSTOM-FOREIGN >> "%s/custom.log"\nexit 0\n' "$D" > "$CUSTOM/pre-push"; chmod +x "$CUSTOM/pre-push"
cp "$CUSTOM/pre-push" "$D/custom.orig"
git -C "$P" config core.hooksPath "$CUSTOM"
eq "hooksPath fixture sanity (git-path hooks)" "$CUSTOM" "$(hookdir "$P")"
before=$(snap "$P")
inst "$P"; eq "install with an external core.hooksPath exits 0" 0 "$IRC"
t "hook installed in the configured hooksPath" grep -qF "$MARKER" "$CUSTOM/pre-push"
tf "nothing written to .git/hooks/pre-push" [ -e "$P/.git/hooks/pre-push" ]
t "foreign hook in the hooksPath chained there" cmp -s "$D/custom.orig" "$CUSTOM/pre-push.pandacorp-chained"
eq "work tree untouched" "$before" "$(snap "$P")"
inst "$P" --check; eq "--check honors the hooksPath (exit 0)" 0 "$IRC"
cmt "$P"; gpush "$P" "" origin main
tf "hook in the custom hooksPath is the one that gates main" [ "$PRC" -eq 0 ]
gpush "$P" "PANDACORP_OWNER_RELEASE_OK=1" origin main
eq "with the flag it passes through the chain" 0 "$PRC"
t "custom foreign hook ran" [ -s "$D/custom.log" ]
git -C "$P" config core.hooksPath "$D/emptyhooks"
inst "$P" --check; eq "--check in a hooksPath without the hook exits 1" 1 "$IRC"

section "6b. tracked core.hooksPath is refused"
mkfx '{"preset":"launched","trackedHooksPath":true}'
eq "fixture sanity: hooksPath is .githooks" ".githooks" "$(git -C "$P" config core.hooksPath)"
orig=$(cksum < "$P/.githooks/pre-push"); before=$(snap "$P"); hl=$(ls -A "$P/.git/hooks")
inst "$P"; eq "install refuses a tracked hooksPath (exit 3)" 3 "$IRC"
inst "$P" --check; eq "--check reports a tracked hooksPath (exit 3)" 3 "$IRC"
eq "the tracked .githooks/pre-push is byte-identical" "$orig" "$(cksum < "$P/.githooks/pre-push")"
eq "tracked hook content is not modified" "#!/bin/sh" "$(head -n 1 "$P/.githooks/pre-push")"
tf "no pandacorp marker landed in the tracked hook" grep -qF "$MARKER" "$P/.githooks/pre-push"
tf "no chained file next to the tracked hook" [ -e "$P/.githooks/pre-push.pandacorp-chained" ]
tf "nothing written to .git/hooks/pre-push" [ -e "$P/.git/hooks/pre-push" ]
eq "hooks directory listing unchanged" "$hl" "$(ls -A "$P/.git/hooks")"
eq "work tree fully untouched (no tracked, untracked or ignored change)" "$before" "$(snap "$P")"
t "git still reports the tracked file as unmodified" git -C "$P" diff --quiet -- .githooks
git -C "$P" config core.hooksPath "$P/.githooks"
inst "$P"; eq "absolute hooksPath inside the work tree also refused (exit 3)" 3 "$IRC"
eq "tracked hook still unmodified after the absolute-path attempt" "$orig" "$(cksum < "$P/.githooks/pre-push")"
inst "$P" --check; eq "--check with the absolute in-tree hooksPath exits 3" 3 "$IRC"

# ---------------------------------------------------------------------------------------------------
section "7. the installer never writes a tracked file (all paths)"
for opts in '{"preset":"launched"}' '{"preset":"basic"}' '{"preset":"tracked-decisions"}' '{"preset":"card"}'; do
  mkfx "$opts"
  tracked_before=$(git -C "$P" ls-files -s | cksum); status_before=$(snap "$P"); head_before=$(git -C "$P" rev-parse HEAD)
  inst "$P"; inst "$P"; inst "$P" --check
  eq "[$opts] tracked index unchanged" "$tracked_before" "$(git -C "$P" ls-files -s | cksum)"
  eq "[$opts] work tree unchanged" "$status_before" "$(snap "$P")"
  eq "[$opts] no commit made" "$head_before" "$(git -C "$P" rev-parse HEAD)"
  t "[$opts] git diff clean" git -C "$P" diff --quiet HEAD
done

echo
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
