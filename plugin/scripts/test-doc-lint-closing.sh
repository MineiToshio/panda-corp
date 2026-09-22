#!/bin/bash
# Self-test for doc-lint.sh's stale-`closing`-card guard (F3 close-out mode, proposal 37 §A.6).
#
# Contract under test: a change-queue card (`.pandacorp/inbox/changes/<slug>.md`) whose frontmatter
# reads `status: closing` and a `closing_at` older than 48h must red the gate -- UNCONDITIONALLY,
# unlike every other finding in this script (which stay advisory on a brownfield/no-provenance
# project). A fresh `closing` card, a non-`closing` card, and a project with no queue at all must
# all stay green. Run from anywhere:
#   bash plugin/scripts/test-doc-lint-closing.sh

set -u
HERE=$(cd "$(dirname "$0")" && pwd)
LINT="$HERE/../templates/shared/.pandacorp/doc-lint.sh"
pass=0; fail=0

ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=$((fail+1)); if [ -n "${2:-}" ]; then echo "$2" | sed 's/^/      /'; fi }

[ -f "$LINT" ] || { echo "FATAL: doc-lint.sh not found at $LINT"; exit 1; }

new_fixture() { mktemp -d; }

write_card() { # $1 dir, $2 filename, $3 status, $4 closing_at (may be empty)
  local dir="$1" name="$2" status="$3" closing_at="$4"
  mkdir -p "$dir/.pandacorp/inbox/changes"
  {
    echo "---"
    echo "type: change"
    echo "class: standard"
    echo "status: $status"
    echo "date: 2026-09-22"
    [ -n "$closing_at" ] && echo "closing_at: $closing_at"
    echo "implemented_sha: 0000000"
    echo "---"
    echo "# fixture card"
  } > "$dir/.pandacorp/inbox/changes/$name"
}

hours_ago_iso() { # $1 hours -> ISO 8601 UTC timestamp that many hours in the past, either OS
  date -u -v-"$1"H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "-$1 hours" +"%Y-%m-%dT%H:%M:%SZ"
}

run_lint() { # $1 dir -> sets $rc
  ( cd "$1" && bash "$LINT" -v ) > /tmp/doc-lint-closing-test.out 2>&1
  rc=$?
}

# --- Case 1: a `closing` card 72h old -> RED (exit 1), whatever the surrounding project shape ----
D1=$(new_fixture)
write_card "$D1" stale.md closing "$(hours_ago_iso 72)"
run_lint "$D1"
if [ "$rc" = 1 ]; then ok "72h-old closing card reds the gate"; else bad "72h-old closing card should red (rc=1), got rc=$rc" "$(cat /tmp/doc-lint-closing-test.out)"; fi
grep -q "stale.md" /tmp/doc-lint-closing-test.out && grep -q "72h" /tmp/doc-lint-closing-test.out \
  && ok "finding names the card and its age" \
  || bad "finding should name the stale card and its age" "$(cat /tmp/doc-lint-closing-test.out)"

# --- Case 2: a `closing` card 1h old -> GREEN --------------------------------------------------
D2=$(new_fixture)
write_card "$D2" fresh.md closing "$(hours_ago_iso 1)"
run_lint "$D2"
if [ "$rc" = 0 ]; then ok "1h-old closing card stays green"; else bad "1h-old closing card should stay green (rc=0), got rc=$rc" "$(cat /tmp/doc-lint-closing-test.out)"; fi

# --- Case 3: exactly at the 48h boundary minus a minute -> GREEN; plus a minute -> RED ----------
D3=$(new_fixture)
write_card "$D3" boundary-under.md closing "$(hours_ago_iso 47)"
run_lint "$D3"
if [ "$rc" = 0 ]; then ok "47h-old closing card (under the 48h floor) stays green"; else bad "47h-old closing card should stay green, got rc=$rc" "$(cat /tmp/doc-lint-closing-test.out)"; fi

D3b=$(new_fixture)
write_card "$D3b" boundary-over.md closing "$(hours_ago_iso 49)"
run_lint "$D3b"
if [ "$rc" = 1 ]; then ok "49h-old closing card (over the 48h floor) reds"; else bad "49h-old closing card should red, got rc=$rc" "$(cat /tmp/doc-lint-closing-test.out)"; fi

# --- Case 4: a `closing` card with NO closing_at at all -> treated as stale, RED ----------------
D4=$(new_fixture)
write_card "$D4" no-timestamp.md closing ""
run_lint "$D4"
if [ "$rc" = 1 ]; then ok "closing card with no closing_at is treated as stale (fail loud on missing evidence)"; else bad "missing closing_at should red, got rc=$rc" "$(cat /tmp/doc-lint-closing-test.out)"; fi

# --- Case 5: a `ready` card (not closing) sitting next to a fresh timestamp field -> GREEN ------
D5=$(new_fixture)
write_card "$D5" ready.md ready "$(hours_ago_iso 200)"
run_lint "$D5"
if [ "$rc" = 0 ]; then ok "a non-closing card is ignored by this check regardless of any stray closing_at"; else bad "non-closing card should never trip this check, got rc=$rc" "$(cat /tmp/doc-lint-closing-test.out)"; fi

# --- Case 6: no .pandacorp/inbox/changes/ directory at all -> GREEN, vacuous -------------------
D6=$(new_fixture)
run_lint "$D6"
if [ "$rc" = 0 ]; then ok "a project with no change queue at all stays green (vacuous pass)"; else bad "no queue directory should be a vacuous green, got rc=$rc" "$(cat /tmp/doc-lint-closing-test.out)"; fi

# --- Case 7: FAIL-LOUD REGARDLESS OF PROVENANCE -- the load-bearing difference from every other
# finding in this script. A brownfield project (no created_via, or created_via: adopt) still reds
# on a stale closing card, even though every OTHER finding stays advisory-only there.
D7=$(new_fixture)
mkdir -p "$D7/.pandacorp"
{
  echo 'project: "fixture"'
  echo 'created_via: "adopt"'
} > "$D7/.pandacorp/status.yaml"
write_card "$D7" brownfield-stale.md closing "$(hours_ago_iso 72)"
run_lint "$D7"
if [ "$rc" = 1 ]; then ok "reds even on a brownfield (created_via: adopt) project -- not advisory-only like other findings"; else bad "brownfield project should still red on a stale closing card, got rc=$rc" "$(cat /tmp/doc-lint-closing-test.out)"; fi

# --- Case 8: an UNPARSEABLE closing_at value -> treated as stale, RED ---------------------------
D8=$(new_fixture)
write_card "$D8" bad-timestamp.md closing "not-a-real-timestamp"
run_lint "$D8"
if [ "$rc" = 1 ]; then ok "an unparseable closing_at is treated as stale"; else bad "unparseable closing_at should red, got rc=$rc" "$(cat /tmp/doc-lint-closing-test.out)"; fi

rm -f /tmp/doc-lint-closing-test.out

echo ""
echo "test-doc-lint-closing: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
