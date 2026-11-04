#!/bin/bash
# DR-144: exercise the shipped gate, including advisory output and its report.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
FX=$(mktemp -d)
trap 'rm -rf "$FX"' EXIT
mkdir -p "$FX/src/_tests" "$FX/.pandacorp"
printf '{"name":"behavior-fixture"}\n' > "$FX/package.json"
cat > "$FX/src/_tests/catalog.test.ts" <<'TEST'
import catalog from '../../docs/catalog.json';
expect(catalog.length).toBe(1335);
expect(catalog).toHaveLength(
  2399
);
expect(catalog.length).toBe(1335); // live-data-ok: deliberate scanner exemption fixture
expect(new Set(catalog.map(x => x.id)).size).toBe(catalog.length);
TEST
OUT=$(cd "$FX" && bash "$ROOT/plugin/templates/stack-a-nextjs/verify.sh" --only=live-data-asserts)
COUNT=$(printf '%s\n' "$OUT" | grep -c 'WARNING live-data-asserts' || true)
[ "$COUNT" = 2 ] || { echo "Expected two warnings, got $COUNT: $OUT"; exit 1; }
python3 - "$FX/.pandacorp/run/gate-report.json" <<'PY'
import json, sys
r=json.load(open(sys.argv[1]))
assert r['green'] and r['scope']=='partial'
assert [g['name'] for g in r['subgates']]==['live-data-asserts']
PY
cat > "$FX/src/_tests/catalog.test.ts" <<'TEST'
import fixture from '../../src/test/catalog.json';
expect(fixture.length).toBe(12);
TEST
OUT=$(cd "$FX" && bash "$ROOT/plugin/templates/stack-a-nextjs/verify.sh" --only=live-data-asserts)
! printf '%s' "$OUT" | grep -q 'WARNING live-data-asserts'
cat > "$FX/src/_tests/catalog.test.ts" <<'TEST'
const catalog = readFileSync('assets/curated.json');
expect(catalog.length).toEqual(42);
TEST
OUT=$(cd "$FX" && PANDACORP_CURATED_DATA_GLOBS='assets/**' bash "$ROOT/plugin/templates/stack-a-nextjs/verify.sh" --only=live-data-asserts)
printf '%s' "$OUT" | grep -q 'WARNING live-data-asserts'
cat > "$FX/src/_tests/catalog.test.ts" <<'TEST'
import catalog from '../../docs/catalog.json';
expect(catalog.length).toBe(1335); // live-data-ok:
TEST
OUT=$(cd "$FX" && bash "$ROOT/plugin/templates/stack-a-nextjs/verify.sh" --only=live-data-asserts)
printf '%s' "$OUT" | grep -q 'WARNING live-data-asserts'
echo 'OK: live-data-asserts positive, multiline, structural, fixture, escape, empty-reason and custom-glob cases; advisory report green'

assert_green_report() {
  python3 - "$FX/.pandacorp/run/gate-report.json" <<'PY'
import json, sys
r=json.load(open(sys.argv[1]))
assert r['green'] and r['scope']=='partial'
assert [g['name'] for g in r['subgates']]==['live-data-asserts']
assert all(g['exit']==0 for g in r['subgates'])
PY
}
# Real filesystem failures, each independently proven advisory in both runner modes.
for failure in unreadable non-utf8 broken-symlink; do
  file="$FX/src/_tests/$failure.test.ts"
  case "$failure" in
    unreadable) printf 'fixture\n' > "$file"; chmod 000 "$file" ;;
    non-utf8) printf '\377\376\377' > "$file" ;;
    broken-symlink) ln -s missing-target "$file" ;;
  esac
  for mode in normal report-all; do
    args=(--only=live-data-asserts)
    if [ "$mode" = report-all ]; then args+=(--report-all); fi
    OUT=$(cd "$FX" && bash "$ROOT/plugin/templates/stack-a-nextjs/verify.sh" "${args[@]}")
    printf '%s' "$OUT" | grep -q 'WARNING live-data-asserts: analysis incomplete'
    printf '%s' "$OUT" | grep -q "$failure.test.ts"
    assert_green_report
  done
  # File-by-file cleanup only; ensure the permission fixture can be removed.
  if [ "$failure" = unreadable ]; then chmod 600 "$file"; fi
  rm "$file"
done
# Force an internal parser failure with Python's integer-conversion safety limit.
# This exercises the real scanner and its shell fallback, not a replacement runner.
python3 - "$FX/src/_tests/catalog.test.ts" <<'PY'
from pathlib import Path
import sys
Path(sys.argv[1]).write_text("import catalog from '../../docs/catalog.json';\nexpect(catalog.length).toBe(" + '9' * 5000 + ');\n')
PY
for mode in normal report-all; do
  args=(--only=live-data-asserts)
  if [ "$mode" = report-all ]; then args+=(--report-all); fi
  OUT=$(cd "$FX" && PYTHONINTMAXSTRDIGITS=4300 bash "$ROOT/plugin/templates/stack-a-nextjs/verify.sh" "${args[@]}" 2>&1)
  printf '%s' "$OUT" | grep -q 'analysis incomplete: internal scanner failure'
  assert_green_report
done
echo 'OK: unreadable, non-UTF-8, broken symlink and internal scanner failure stay advisory in normal and --report-all modes (8 green reports)'
