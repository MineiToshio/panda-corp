#!/bin/bash
# Self-test for backup-pandacorp-state.sh (BL-0045 F13/F14 fixes) + check-unbacked-precious.sh
# (BL-0035 line). Builds throwaway git fixtures under a temp dir, runs the scripts with a temp HOME
# so it never touches the real ~/.pandacorp-backups, and asserts. Run: bash test-backup-and-precious.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
BACKUP="$HERE/backup-pandacorp-state.sh"
CHECK="$HERE/check-unbacked-precious.sh"
pass=0; fail=0
ok()   { pass=$((pass+1)); echo "  ✓ $1"; }
bad()  { fail=$((fail+1)); echo "  ✗ $1"; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ── Fixture: a repo with gitignored disposable / backed-up / precious files + a nested project ──
REPO="$TMP/canonrepo"
mkdir -p "$REPO"
git -C "$REPO" init -q
git -C "$REPO" config user.email t@t.t; git -C "$REPO" config user.name t
cat > "$REPO/.gitignore" <<'EOF'
node_modules/
*.log
.env
factory/profile.md
factory/ideas/
.pandacorp/
packages/app/.pandacorp/
mission-control/.pandacorp/run/
precious.txt
EOF
mkdir -p "$REPO/node_modules" "$REPO/factory/ideas" "$REPO/factory/memory" \
         "$REPO/packages/app/.pandacorp" "$REPO/mission-control/.pandacorp/run"
echo x > "$REPO/node_modules/x.js"            # disposable
echo x > "$REPO/app.log"                        # disposable
echo x > "$REPO/.env"                           # secrets → SOPS (disposable to this backstop)
echo x > "$REPO/factory/profile.md"             # backed up
echo x > "$REPO/factory/ideas/one.md"           # backed up
echo x > "$REPO/precious.txt"                    # PRECIOUS, unbacked → must flag
echo x > "$REPO/packages/app/.pandacorp/status.yaml"   # nested project (F13)
echo x > "$REPO/mission-control/.pandacorp/run/serve.sh"  # machine machinery (step 2) — BACKED (run/*.sh)
echo x > "$REPO/mission-control/.pandacorp/run/build.lock" # disposable (*.lock) — must NOT flag
echo x > "$REPO/mission-control/.pandacorp/run/notes.md"  # BK2: PRECIOUS non-.sh in run/ → MUST flag
git -C "$REPO" add .gitignore && git -C "$REPO" commit -qm init

# ── Test A: check flags ONLY the precious-unbacked file(s) ──
out="$(bash "$CHECK" "$REPO" 2>&1)"
echo "$out" | grep -q "precious.txt" && ok "check flags precious.txt" || bad "check missed precious.txt"
echo "$out" | grep -q "node_modules\|app.log\|\.env\b" && bad "check false-positived a disposable" || ok "check skips disposables"
echo "$out" | grep -q "profile.md\|ideas/one.md" && bad "check false-positived a backed-up file" || ok "check skips backed-up files"

# ── Test A2 (BK2/BK3): the whole run/ dir is NOT blessed wholesale. A precious non-.sh file dropped
#    in run/ (the BL-0045 failure mode) MUST be flagged; the backed run/*.sh + run/status.yaml and the
#    disposable *.lock must NOT be. Also guards BK3: --directory removed, so nested overlay files are
#    listed individually instead of collapsing to one masked run/ entry. ──
echo "$out" | grep -q "run/notes.md" && ok "BK2: precious non-.sh in run/ flagged" || bad "BK2: precious non-.sh in run/ NOT flagged (run/ blessed wholesale?)"
echo "$out" | grep -q "run/serve.sh" && bad "BK2: false-positived backed run/*.sh" || ok "BK2: run/*.sh stays backed"
echo "$out" | grep -q "run/build.lock" && bad "BK2: false-positived disposable run/*.lock" || ok "BK2: run/*.lock stays disposable"
echo "$out" | grep -q "packages/app/.pandacorp/status.yaml" && bad "BK3: false-positived backed status.yaml" || ok "BK3: overlay status.yaml stays backed"

# ── Test B (F14): run from a git WORKTREE → backup keys to the canonical repo, not the worktree ──
git -C "$REPO" worktree add -q "$TMP/wt" -b wtbranch 2>/dev/null
HOME="$TMP/home1" bash "$BACKUP" "$TMP/wt" >/dev/null 2>&1
if [ -d "$TMP/home1/.pandacorp-backups/canonrepo" ]; then ok "F14: worktree run keyed to canonrepo"; else bad "F14: not keyed to canonrepo (got: $(ls "$TMP/home1/.pandacorp-backups" 2>/dev/null))"; fi

# ── Test C (F13): nested project's status.yaml is captured ──
HOME="$TMP/home2" bash "$BACKUP" "$REPO" >/dev/null 2>&1
DAY="$(date +%F)"
if [ -f "$TMP/home2/.pandacorp-backups/canonrepo/$DAY/packages/app/.pandacorp/status.yaml" ]; then
  ok "F13: nested packages/app/.pandacorp captured"
else bad "F13: nested project NOT captured"; fi

# ── Test D (step 2): run/*.sh machinery is backed up ──
if [ -f "$TMP/home2/.pandacorp-backups/canonrepo/$DAY/mission-control/.pandacorp/run/serve.sh" ]; then
  ok "step2: run/serve.sh machinery backed up"
else bad "step2: run/*.sh NOT backed up"; fi

# ── Test E: a pandacorp-vault sibling is auto-detected → backup writes THERE, not HOME ──
mkdir -p "$TMP/pandacorp-vault"                       # sibling of canonrepo
HOME="$TMP/home3" bash "$BACKUP" "$REPO" >/dev/null 2>&1
if [ -f "$TMP/pandacorp-vault/backups/canonrepo/$DAY/factory/profile.md" ]; then
  ok "vault: backup auto-detected the sibling vault"
else bad "vault: backup did NOT write to the sibling vault"; fi
if [ ! -d "$TMP/home3/.pandacorp-backups" ]; then ok "vault: HOME fallback NOT used when vault present"; else bad "vault: wrote to HOME even though vault exists"; fi

echo "── $pass passed, $fail failed ──"
[ "$fail" -eq 0 ]
