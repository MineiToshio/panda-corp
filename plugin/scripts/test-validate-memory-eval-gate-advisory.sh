#!/bin/bash
# Self-test for validate-memory.sh's BL-0090 eval-gate advisory (owner-stated/ci-verified
# candidate stuck past the eval-gate's OR-clause bar). Proves:
#   - RED (pre-fix behavior, reproduced against a fixture): an owner-stated candidate lesson
#     older than the threshold gets NO advisory and the store still counts it as `candidate`
#     forever — nothing in validate-memory.sh's original output flags the miss.
#   - GREEN (post-fix): the same fixture now trips the advisory line, non-fail (exit 0).
#   - A fresh owner-stated candidate (under threshold) does NOT trip the advisory (no false
#     positive on ordinary pending review).
#   - An agent-inferred candidate past the threshold does NOT trip the advisory (it is not
#     eligible for the eval-gate's OR-clause exception — single-trajectory lessons never
#     self-activate, so flagging it would be wrong).
#   - A malformed lesson (missing a required frontmatter key) still fails the gate LOUD
#     (exit 1, itemized error) — this reader never returns a silent pass on a shape it
#     cannot parse (DR-078).
# Run from the factory repo root:
#   bash plugin/scripts/test-validate-memory-eval-gate-advisory.sh

set -u
HERE=$(cd "$(dirname "$0")/.." && pwd)   # plugin/
REPO=$(cd "$HERE/.." && pwd)
GATE="$HERE/scripts/validate-memory.sh"
pass=0; fail=0

OLD_DATE=$(date -v-20d +%F 2>/dev/null || date -d '-20 days' +%F)
RECENT_DATE=$(date -v-2d +%F 2>/dev/null || date -d '-2 days' +%F)

lesson() { # $1 id, $2 status, $3 provenance, $4 created
  cat <<EOF
---
id: $1
type: gotcha
domain: factory-engineering
tags: [test-fixture]
context: a synthetic fixture used only by test-validate-memory-eval-gate-advisory.sh
trigger: use this when running the BL-0090 advisory self-test
source: "test-validate-memory-eval-gate-advisory.sh fixture, BL-0090, $4"
provenance: $3
created: $4
status: $2
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

Synthetic fixture body — not a real lesson.
EOF
}

make_fixture_dir() {
  local d
  d=$(mktemp -d)
  echo "$d"
}

check_contains() { # $1 label, $2 dir, $3 expected_rc, $4 needle (grep -F), $5 mode (has|absent)
  local output rc
  output=$(bash "$GATE" "$2" 2>&1)
  rc=$?
  local grep_ok=1
  if echo "$output" | grep -qF "$4"; then grep_ok=0; fi
  local ok=0
  if [ "$5" = "has" ]; then
    [ "$rc" = "$3" ] && [ "$grep_ok" = 0 ] && ok=1
  else
    [ "$rc" = "$3" ] && [ "$grep_ok" != 0 ] && ok=1
  fi
  if [ "$ok" = 1 ]; then
    echo "  \xe2\x9c\x93 $1"; pass=$((pass+1))
  else
    echo "  \xe2\x9c\x97 $1 (rc=$rc, expected rc=$3, needle='$4' mode=$5)"
    echo "$output" | sed 's/^/      /'
    fail=$((fail+1))
  fi
}

echo "== Fixture 1: owner-stated candidate, $OLD_DATE (stale) -> advisory, non-fail =="
d1=$(make_fixture_dir)
lesson "LESSON-9001" "candidate" "owner-stated" "$OLD_DATE" > "$d1/LESSON-9001-stale-owner-stated.md"
check_contains "advisory fires for stale owner-stated candidate" "$d1" 0 "LESSON-9001" "has"
check_contains "advisory names the eval-gate wiring miss" "$d1" 0 "ADVISORY - 1 eval-gate wiring miss" "has"
rm -rf "$d1"

echo "== Fixture 2: owner-stated candidate, $RECENT_DATE (fresh) -> no advisory =="
d2=$(make_fixture_dir)
lesson "LESSON-9002" "candidate" "owner-stated" "$RECENT_DATE" > "$d2/LESSON-9002-fresh-owner-stated.md"
check_contains "no advisory for a fresh owner-stated candidate" "$d2" 0 "LESSON-9002" "absent"
rm -rf "$d2"

echo "== Fixture 3: agent-inferred candidate, $OLD_DATE (stale) -> no advisory (not eligible) =="
d3=$(make_fixture_dir)
lesson "LESSON-9003" "candidate" "agent-inferred" "$OLD_DATE" > "$d3/LESSON-9003-stale-agent-inferred.md"
check_contains "no advisory for a stale agent-inferred candidate" "$d3" 0 "LESSON-9003" "absent"
rm -rf "$d3"

echo "== Fixture 4: owner-stated ALREADY active, $OLD_DATE -> no advisory (fixed) =="
d4=$(make_fixture_dir)
lesson "LESSON-9004" "active" "owner-stated" "$OLD_DATE" > "$d4/LESSON-9004-active-owner-stated.md"
check_contains "no advisory once status is already active" "$d4" 0 "LESSON-9004" "absent"
rm -rf "$d4"

echo "== Fixture 5: malformed lesson (missing 'trigger') -> fails LOUD, never a silent pass (DR-078) =="
d5=$(make_fixture_dir)
cat > "$d5/LESSON-9005-malformed.md" <<EOF
---
id: LESSON-9005
type: gotcha
domain: factory-engineering
tags: [test-fixture]
context: a synthetic malformed fixture
source: "test-validate-memory-eval-gate-advisory.sh fixture, BL-0090, $OLD_DATE"
provenance: owner-stated
created: $OLD_DATE
status: candidate
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

Synthetic fixture body — missing the required 'trigger' key.
EOF
check_contains "malformed fixture fails loud (missing trigger)" "$d5" 1 "missing key 'trigger'" "has"
rm -rf "$d5"

echo
echo "== Real store sanity: the 10 BL-0090 backfilled lessons are active (never a hardcoded store-wide count) =="
BACKFILLED_IDS="LESSON-0042 LESSON-0043 LESSON-0049 LESSON-0102 LESSON-0119 LESSON-0123 LESSON-0129 LESSON-0144 LESSON-0155 LESSON-0167"
all_active=1
for id in $BACKFILLED_IDS; do
  f=$(ls "$REPO"/factory/memory/"$id"-*.md 2>/dev/null | head -1)
  if [ -z "$f" ] || ! grep -qE '^status: active\s*$' "$f"; then
    all_active=0
    echo "      missing or not active: $id ($f)"
  fi
done
if [ "$all_active" = 1 ]; then
  echo "  \xe2\x9c\x93 all 10 backfilled lessons are status: active"; pass=$((pass+1))
else
  echo "  \xe2\x9c\x97 one or more of the 10 backfilled lessons is not status: active"; fail=$((fail+1))
fi

real_output=$(bash "$GATE" "$REPO/factory/memory" 2>&1)
real_rc=$?
# Invariant, not a hardcoded absolute (BL-0090 post-rebase note in the card's Tests section):
# the store-wide `status:active` count from validate-memory.sh must equal the number of lines
# in INDEX.md (one line per active lesson, per its own header) — whatever that number is at
# merge time. A drift between the two means either an activation with no INDEX.md line, or an
# INDEX.md line for a lesson that isn't (or is no longer) active.
active_count=$(echo "$real_output" | grep -oE 'status:active=[0-9]+' | grep -oE '[0-9]+')
index_count=$(grep -cE '^- LESSON-[0-9]+' "$REPO/factory/memory/INDEX.md")
if [ "$real_rc" = 0 ] && [ -n "$active_count" ] && [ "$active_count" = "$index_count" ] && ! echo "$real_output" | grep -q "^ADVISORY"; then
  echo "  \xe2\x9c\x93 real store: status:active ($active_count) == INDEX.md entries ($index_count), exit 0, no residual advisory"; pass=$((pass+1))
else
  echo "  \xe2\x9c\x97 real store check failed (rc=$real_rc, status:active=$active_count, INDEX.md entries=$index_count)"
  echo "$real_output" | sed 's/^/      /'
  fail=$((fail+1))
fi

echo
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
