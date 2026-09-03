#!/bin/bash
# Self-test for warn-worktree-remove.sh (BL-0105): the WorktreeRemove hook must emit a VISIBLE
# soft warning (never a block — WorktreeRemove hooks have no decision control at all, so the only
# visible channel is a side effect: stderr + a desktop notification when osascript is available,
# same precedent as pending-work.sh --notify / merge-queue.sh's loud hand-back, DR-099) when the
# worktree being removed still holds unmerged work (unpushed/unmerged commits ahead of the default
# branch, or a dirty tree) — and stay SILENT for a fully-merged, clean worktree. Never a hard block
# (registry.yaml precedent, rejected explicitly). Run from the repo root:
#   bash plugin/scripts/test-warn-worktree-remove.sh

set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
HOOK="$HERE/plugin/scripts/warn-worktree-remove.sh"
pass=0; fail=0

expect_warn() { # $1 label, $2 out, $3 err, $4 rc
  if [ "$4" != "0" ]; then echo "  ✗ $1 (exit $4, must never be non-zero — no decision control)"; fail=$((fail+1)); return; fi
  if printf '%s' "$3" | grep -qi "unmerged\|sin mergear\|pending"; then
    echo "  ✓ $1"; pass=$((pass+1))
  else
    echo "  ✗ $1 (no visible warning on stderr)"; fail=$((fail+1))
  fi
}

expect_silent() { # $1 label, $2 out, $3 err, $4 rc
  if [ "$4" != "0" ]; then echo "  ✗ $1 (exit $4, must never be non-zero)"; fail=$((fail+1)); return; fi
  if [ -z "$3" ]; then echo "  ✓ $1"; pass=$((pass+1)); else echo "  ✗ $1 (unexpected warning: $3)"; fail=$((fail+1)); fi
}

run_hook() { # $1 worktree_path (real JSON shape emitted by Claude Code)
  printf '{"session_id":"t","transcript_path":"/tmp/t.jsonl","cwd":"%s","hook_event_name":"WorktreeRemove","worktree_path":"%s"}' "$1" "$1" | bash "$HOOK"
}

echo "== warn-worktree-remove.sh self-test =="

# --- Fixture repo with a default branch + a linked worktree ---
base=$(mktemp -d)
( cd "$base" && git init -q -b main && git config user.email t@t.com && git config user.name t \
  && echo one > f.txt && git add f.txt && git commit -qm one )

# Case 1: unmerged branch (ahead of main) + committed → visible warning, exit 0
wt1="$base-wt1"
git -C "$base" worktree add -q "$wt1" -b feature/unmerged >/dev/null 2>&1
( cd "$wt1" && echo two > g.txt && git add g.txt && git commit -qm two )
err=$(run_hook "$wt1" 2>&1 1>/dev/null); out=$(run_hook "$wt1" 2>/dev/null); rc=$?
expect_warn "unmerged committed branch -> warns" "$out" "$err" "$rc"

# Case 2: dirty tree (uncommitted changes), branch otherwise merged → visible warning
wt2="$base-wt2"
git -C "$base" worktree add -q "$wt2" -b feature/dirty >/dev/null 2>&1
( cd "$wt2" && echo three > h.txt )  # uncommitted, untracked
err2=$(run_hook "$wt2" 2>&1 1>/dev/null); rc2=$?
expect_warn "dirty uncommitted tree -> warns" "" "$err2" "$rc2"

# Case 3: fully merged + clean worktree → silent, no warning
wt3="$base-wt3"
git -C "$base" worktree add -q "$wt3" -b feature/clean >/dev/null 2>&1
err3=$(run_hook "$wt3" 2>&1 1>/dev/null); rc3=$?
expect_silent "fully merged clean worktree -> silent" "" "$err3" "$rc3"

# Case 4: malformed input (no worktree_path) must never crash / never hard-fail
err4=$(printf '{"session_id":"t"}' | bash "$HOOK" 2>&1 1>/dev/null); rc4=$?
if [ "$rc4" = "0" ]; then echo "  ✓ malformed input (missing worktree_path) -> exit 0, no crash"; pass=$((pass+1)); else echo "  ✗ malformed input crashed (exit $rc4)"; fail=$((fail+1)); fi

# Case 5: worktree_path pointing at a non-worktree / already-gone directory must never crash
err5=$(run_hook "/nonexistent/path/does-not-exist-$$"); rc5=$?
if [ "$rc5" = "0" ]; then echo "  ✓ gone worktree path -> exit 0, no crash"; pass=$((pass+1)); else echo "  ✗ gone worktree path crashed (exit $rc5)"; fail=$((fail+1)); fi

# Cleanup (best-effort; worktrees may already be gone if the hook removed anything, which it must not)
for wt in "$wt1" "$wt2" "$wt3"; do
  git -C "$base" worktree remove --force "$wt" >/dev/null 2>&1
  rm -rf "$wt"
done
rm -rf "$base"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
