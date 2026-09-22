#!/bin/bash
# Self-test for verify-before-stop.sh's BL-0044 fast-path: proves the Stop gate SKIPS the
# whole-program `.pandacorp/verify.sh` run when (a) the tree is clean, (b) HEAD matches the last
# GREEN commit recorded in last-green.json, AND (c) this session's own .touched marker (DR-099)
# is absent or empty — and that ANY of those three failing still runs the gate exactly as before
# (fail-closed). Also proves last-green.json is written ONLY after a GREEN run, at the commit that
# run verified, and that the pre-existing active-build guards still short-circuit first (constitution
# §24: a check that cannot fail proves nothing). Run from the factory repo root:
#   bash plugin/scripts/test-verify-before-stop.sh

set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
HOOK="$HERE/plugin/scripts/verify-before-stop.sh"
pass=0; fail=0

make_fixture() { # git repo with a stub .pandacorp/verify.sh that records whether it ran
  local d
  d=$(mktemp -d)
  mkdir -p "$d/.pandacorp/run/sessions"
  cat > "$d/.pandacorp/verify.sh" <<'EOF'
#!/bin/bash
run_dir="$(cd "$(dirname "$0")" && pwd)/run"
mkdir -p "$run_dir"
echo invoked >> "$run_dir/verify-invocations"
code_file="$run_dir/verify-exit-code"
[ -f "$code_file" ] && exit "$(cat "$code_file")"
exit 0
EOF
  chmod +x "$d/.pandacorp/verify.sh"
  # .pandacorp/ (run/ + verify.sh) must be gitignored, exactly like the real projects (see
  # mission-control/.gitignore, root .gitignore), so touched markers and the invocation log
  # never register as "dirty" to condition (a) — only a REAL working-tree change should.
  printf '.pandacorp/\n' > "$d/.gitignore"
  ( cd "$d" && git init -q \
      && git add .gitignore \
      && git -c user.email=test@pandacorp.local -c user.name="Pandacorp Test" commit -q -m "fixture baseline" )
  echo "$d"
}

run_hook() { # $1 fixture dir, $2 session_id -> sets $rc and $out
  local payload
  payload=$(printf '{"cwd":%s,"session_id":%s}' "$(jq -Rs . <<< "$1")" "$(jq -Rs . <<< "$2")")
  out=$(printf '%s' "$payload" | bash "$HOOK" 2>&1)
  rc=$?
}

check() { # $1 label, $2 expected rc, $3 expect_verify_invoked(0/1), $4 fixture dir, $5 session_id
  rm -f "$4/.pandacorp/run/verify-invocations"
  run_hook "$4" "$5"
  local invoked=0
  [ -s "$4/.pandacorp/run/verify-invocations" ] && invoked=1
  local ok=1
  [ "$rc" = "$2" ] || ok=0
  [ "$invoked" = "$3" ] || ok=0
  if [ "$ok" = "1" ]; then
    echo "  ✓ $1"; pass=$((pass+1))
  else
    echo "  ✗ $1 (expected rc=$2 invoked=$3, got rc=$rc invoked=$invoked): $out"; fail=$((fail+1))
  fi
}

echo "== verify-before-stop.sh BL-0044 fast-path self-test =="

fx=$(make_fixture)
head_sha=$(git -C "$fx" rev-parse HEAD)

# 1. No last-green.json yet -> doubt -> gate runs (GREEN, so it also writes last-green.json)
check "no last-green.json yet -> gate runs" 0 1 "$fx" "sid-a"

if [ -f "$fx/.pandacorp/run/last-green.json" ] && [ "$(jq -r .sha "$fx/.pandacorp/run/last-green.json")" = "$head_sha" ]; then
  echo "  ✓ GREEN run wrote last-green.json with HEAD"; pass=$((pass+1))
else
  echo "  ✗ GREEN run did not write last-green.json correctly"; fail=$((fail+1))
fi

# 2. Clean tree + HEAD==last-green + no touched marker at all -> FAST-PATH, verify.sh NOT invoked
check "clean + HEAD==last-green + no touched marker -> fast-path" 0 0 "$fx" "sid-b"

# 3. Dirty tree -> gate runs even though HEAD==last-green
echo "dirty" > "$fx/dirty.md"
check "dirty tree -> gate runs" 0 1 "$fx" "sid-c"
rm -f "$fx/dirty.md"

# 4. Non-empty touched marker -> gate runs even on an otherwise clean, HEAD-matching tree
printf '%s/some/file.ts\n' "$fx" > "$fx/.pandacorp/run/sessions/sid-d.touched"
check "non-empty touched marker -> gate runs" 0 1 "$fx" "sid-d"

# 5. touched marker EXISTS but is EMPTY -> still eligible for fast-path
: > "$fx/.pandacorp/run/sessions/sid-e.touched"
check "empty touched marker -> fast-path" 0 0 "$fx" "sid-e"

# 6. A new commit moves HEAD away from the recorded green sha -> doubt -> gate runs
git -C "$fx" commit -q --allow-empty -m "advance HEAD"
new_sha=$(git -C "$fx" rev-parse HEAD)
check "HEAD != last-green -> gate runs" 0 1 "$fx" "sid-f"
if [ "$(jq -r .sha "$fx/.pandacorp/run/last-green.json")" = "$new_sha" ]; then
  echo "  ✓ last-green.json advanced to the new HEAD after the fresh GREEN run"; pass=$((pass+1))
else
  echo "  ✗ last-green.json did not advance to the new HEAD"; fail=$((fail+1))
fi

# 7. Fast-path re-engages once clean + HEAD == the newly recorded green sha again
check "fast-path re-engages after HEAD/last-green realign" 0 0 "$fx" "sid-g"

rm -rf "$fx"

# 8. RED verify.sh: last-green.json must NOT be written; exit code stays 2 (unchanged contract)
fy=$(make_fixture)
mkdir -p "$fy/.pandacorp/run"
echo 2 > "$fy/.pandacorp/run/verify-exit-code"
check "RED verify.sh -> gate blocks (rc=2), no last-green.json written" 2 1 "$fy" "sid-h"
if [ ! -f "$fy/.pandacorp/run/last-green.json" ]; then
  echo "  ✓ RED run did not write last-green.json"; pass=$((pass+1))
else
  echo "  ✗ RED run incorrectly wrote last-green.json"; fail=$((fail+1))
fi
rm -rf "$fy"

# 9. Regression: the pre-existing active-build guard (build.lock, DR-063) still short-circuits
# BEFORE the fast-path logic is even evaluated — a fresh lock skips verify.sh regardless of a
# dirty tree, exactly as before this change (guards intact).
fz=$(make_fixture)
mkdir -p "$fz/.pandacorp/run"
: > "$fz/.pandacorp/run/build.lock"
echo "dirty-during-build" > "$fz/dirty.md"
check "active build.lock still skips verify.sh (guard intact)" 0 0 "$fz" "sid-i"
rm -rf "$fz"

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
