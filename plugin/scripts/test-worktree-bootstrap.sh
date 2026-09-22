#!/bin/bash
# Self-test for worktree-bootstrap.sh step 1's dependency install (BL-0155): canary B2 found that a
# fresh GATE_WORKTREE for a NESTED project (Mission Control, which shares the factory's .git and lives
# at <worktree>/mission-control/package.json — the real production topology) installed NOTHING,
# because step 1 only ever checked bare `package.json` (CWD-relative, so effectively "at the worktree
# root only"). The evidence collector correctly refused to fabricate a report against a worktree with
# no node_modules (`gate-worktree-not-bootstrapped`), and the gate had to bootstrap by hand — exactly
# the cost `gateEvidence: digested` exists to avoid. See canary-b2-report.md §1/§6 and
# plugin/docs/decision-log.md (BL-0155).
#
# Exercises the REAL script (not a reimplementation) against a REAL git worktree, with a fake `pnpm`
# on PATH (no network, sub-second) that records each invocation's cwd so the assertions can tell
# WHERE (or whether) an install happened. Covers:
#   (a) nested project (mission-control/package.json) -> installs in the nested subdir, from EITHER
#       invocation CWD (the worktree root or the nested dir itself) — proving the fix is CWD-independent,
#       not just a lucky cd order in the caller.
#   (b) non-nested project (package.json AT the worktree root, a normal product project's own repo) ->
#       unchanged behavior, no regression.
#   (c) a second bootstrap of the SAME worktree with an unchanged lockfile -> the idempotency guard
#       (BL-0149's lockfile-sha marker) still skips reinstalling, now keyed under the resolved project
#       dir instead of the worktree root.
#
# Run from the repo root: bash plugin/scripts/test-worktree-bootstrap.sh
set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT_SRC="$HERE/plugin/templates/shared/.pandacorp/worktree-bootstrap.sh"
pass=0; fail=0

ok() { if [ "$1" = "1" ]; then echo "  ✓ $2"; pass=$((pass+1)); else echo "  ✗ $2"; fail=$((fail+1)); fi; }

TMPROOT=$(mktemp -d)
TMPROOT=$(cd "$TMPROOT" && pwd -P)   # resolve /tmp -> /private/tmp on macOS so path comparisons match
trap 'rm -rf "$TMPROOT"' EXIT

# ── fake pnpm — no network, records every "install" invocation's cwd + a run counter ───────────────
FAKE_BIN="$TMPROOT/bin"
mkdir -p "$FAKE_BIN"
PNPM_LOG="$TMPROOT/pnpm-calls.log"
: > "$PNPM_LOG"
cat > "$FAKE_BIN/pnpm" <<EOF
#!/bin/bash
echo "\$(pwd)" >> "$PNPM_LOG"
mkdir -p node_modules/.bin
exit 0
EOF
chmod +x "$FAKE_BIN/pnpm"
export PATH="$FAKE_BIN:$PATH"

pnpm_call_count() { [ -f "$PNPM_LOG" ] && wc -l < "$PNPM_LOG" | tr -d ' ' || echo 0; }
pnpm_last_cwd() { tail -1 "$PNPM_LOG" 2>/dev/null; }

git_q() { git -c user.email=t@t.com -c user.name=t "$@" >/dev/null 2>&1; }

# ═══════════════════════════════════════════════════════════════════════════════════════════════
# (a) NESTED topology — the real Mission Control shape: the toplevel repo has NO package.json of its
# own, a sibling `factory/` dir (the guard step 3 uses), and the actual project nested one level down.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
NEST_MAIN="$TMPROOT/nested-main"
mkdir -p "$NEST_MAIN"
( cd "$NEST_MAIN" && git init -q -b main \
  && mkdir -p factory mission-control/.pandacorp \
  && echo '{"name":"mission-control","version":"0.0.0"}' > mission-control/package.json \
  && echo 'lockfileVersion: 9' > mission-control/pnpm-lock.yaml \
  && cp "$SCRIPT_SRC" mission-control/.pandacorp/worktree-bootstrap.sh \
  && chmod +x mission-control/.pandacorp/worktree-bootstrap.sh \
  && echo seed > factory/seed.txt \
  && git add -A && git_q commit -qm seed )

NEST_WT="$TMPROOT/nested-gate-worktree"
git_q -C "$NEST_MAIN" worktree add --detach "$NEST_WT" main

# (a1) invoked from the WORKTREE ROOT (mirrors the engine's literal "cd into it, run
# .pandacorp/worktree-bootstrap.sh" instruction against the toplevel) via the nested script's real path.
( cd "$NEST_WT" && bash mission-control/.pandacorp/worktree-bootstrap.sh >/tmp/wtb-a1.log 2>&1 )
rc_a1=$?
ok "$([ "$rc_a1" = 0 ] && echo 1 || echo 0)" "(a1) bootstrap exits 0 when invoked from the worktree root"
ok "$([ -d "$NEST_WT/mission-control/node_modules" ] && echo 1 || echo 0)" "(a1) node_modules lands in the NESTED project dir, not the worktree root"
ok "$([ ! -d "$NEST_WT/node_modules" ] && echo 1 || echo 0)" "(a1) no stray node_modules at the worktree root"
ok "$([ "$(pnpm_call_count)" = "1" ] && echo 1 || echo 0)" "(a1) pnpm installed exactly once"
ok "$([ "$(pnpm_last_cwd)" = "$NEST_WT/mission-control" ] && echo 1 || echo 0)" "(a1) pnpm ran WITH cwd = the nested project dir (got: $(pnpm_last_cwd))"
ok "$([ -f "$NEST_WT/mission-control/.env.local" ] && grep -q PANDACORP_FACTORY_ROOT "$NEST_WT/mission-control/.env.local" && echo 1 || echo 0)" "(a1) step 3's PANDACORP_FACTORY_ROOT still lands in the nested dir (reused \$APP_DIR, no regression)"

# reset for the (a2) CWD-independence check on a FRESH worktree of the same fixture
git_q -C "$NEST_MAIN" worktree remove --force "$NEST_WT"
: > "$PNPM_LOG"
git_q -C "$NEST_MAIN" worktree add --detach "$NEST_WT" main

# (a2) invoked from WITHIN the nested dir itself — must resolve the identical $APP_DIR via
# `git rev-parse --show-toplevel`, not by CWD, so this is behaviorally identical to (a1).
( cd "$NEST_WT/mission-control" && bash .pandacorp/worktree-bootstrap.sh >/tmp/wtb-a2.log 2>&1 )
rc_a2=$?
ok "$([ "$rc_a2" = 0 ] && echo 1 || echo 0)" "(a2) bootstrap exits 0 when invoked from inside the nested dir"
ok "$([ -d "$NEST_WT/mission-control/node_modules" ] && echo 1 || echo 0)" "(a2) same result (node_modules in the nested dir) regardless of invocation CWD"
ok "$([ "$(pnpm_call_count)" = "1" ] && echo 1 || echo 0)" "(a2) pnpm installed exactly once"

# ═══════════════════════════════════════════════════════════════════════════════════════════════
# (c) IDEMPOTENCY — a second bootstrap of the SAME worktree with an unchanged lockfile must skip the
# reinstall (BL-0149's guard), now correctly keyed under $APP_DIR/node_modules instead of the
# worktree root's (nonexistent, for a nested project) node_modules.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
( cd "$NEST_WT/mission-control" && bash .pandacorp/worktree-bootstrap.sh >/tmp/wtb-c.log 2>&1 )
rc_c=$?
ok "$([ "$rc_c" = 0 ] && echo 1 || echo 0)" "(c) re-bootstrap exits 0"
ok "$([ "$(pnpm_call_count)" = "1" ] && echo 1 || echo 0)" "(c) unchanged lockfile -> pnpm NOT invoked again (still 1 total call)"
ok "$(grep -q "skipped" /tmp/wtb-c.log && echo 1 || echo 0)" "(c) the skip is logged, not silent"

# (c2) touching the lockfile must force a real reinstall — the guard isn't a permanent no-op
echo 'lockfileVersion: 10 # changed' > "$NEST_WT/mission-control/pnpm-lock.yaml"
( cd "$NEST_WT/mission-control" && bash .pandacorp/worktree-bootstrap.sh >/tmp/wtb-c2.log 2>&1 )
ok "$([ "$(pnpm_call_count)" = "2" ] && echo 1 || echo 0)" "(c2) a changed lockfile DOES trigger a real reinstall (2 total calls)"

git_q -C "$NEST_MAIN" worktree remove --force "$NEST_WT"

# ═══════════════════════════════════════════════════════════════════════════════════════════════
# (b) NON-NESTED topology — a normal product project IS its own repo root (no factory/ sibling, no
# mission-control/ subdir): package.json lives directly at the worktree root. Must be unaffected.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
: > "$PNPM_LOG"
FLAT_MAIN="$TMPROOT/flat-main"
mkdir -p "$FLAT_MAIN/.pandacorp"
( cd "$FLAT_MAIN" && git init -q -b main \
  && echo '{"name":"some-product","version":"0.0.0"}' > package.json \
  && echo 'lockfileVersion: 9' > pnpm-lock.yaml \
  && cp "$SCRIPT_SRC" .pandacorp/worktree-bootstrap.sh && chmod +x .pandacorp/worktree-bootstrap.sh \
  && git add -A && git_q commit -qm seed )

FLAT_WT="$TMPROOT/flat-gate-worktree"
git_q -C "$FLAT_MAIN" worktree add --detach "$FLAT_WT" main
( cd "$FLAT_WT" && bash .pandacorp/worktree-bootstrap.sh >/tmp/wtb-b.log 2>&1 )
rc_b=$?
ok "$([ "$rc_b" = 0 ] && echo 1 || echo 0)" "(b) non-nested bootstrap exits 0"
ok "$([ -d "$FLAT_WT/node_modules" ] && echo 1 || echo 0)" "(b) node_modules lands at the worktree root (project IS the root — no regression)"
ok "$([ "$(pnpm_call_count)" = "1" ] && echo 1 || echo 0)" "(b) pnpm installed exactly once"
ok "$([ "$(pnpm_last_cwd)" = "$FLAT_WT" ] && echo 1 || echo 0)" "(b) pnpm ran WITH cwd = the worktree root itself (got: $(pnpm_last_cwd))"

# (b) idempotency too, same guard path as (c) above
( cd "$FLAT_WT" && bash .pandacorp/worktree-bootstrap.sh >/tmp/wtb-b2.log 2>&1 )
ok "$([ "$(pnpm_call_count)" = "1" ] && echo 1 || echo 0)" "(b) re-bootstrap with unchanged lockfile still skips (1 total call)"

git_q -C "$FLAT_MAIN" worktree remove --force "$FLAT_WT"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
