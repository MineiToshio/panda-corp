#!/bin/bash
# BL-0003 proof — back-port detector (version-compare) unit test.
#
# Reproduces the personal-page-v2 class: a project whose biome.json is NEWER than the stale template.
# The old flow (blind overwrite) would silently DOWNGRADE it and red-lock the baseline. The detector
# must instead classify it "project-newer" and exit 1 (caller back-ports before overwriting). The
# reverse case (project OLDER than template) must classify "template-current" and exit 0 (overwrite is
# correct). Equal schemas → template-current. Run: bash plugin/scripts/test-detect-gate-config-newer.sh

set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DETECT="$HERE/detect-gate-config-newer.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0; fail=0
ok()   { echo "  ✓ $1"; pass=$((pass+1)); }
bad()  { echo "  ✗ $1"; fail=$((fail+1)); }

mk_biome() { # <dir> <schema-version>
  mkdir -p "$1"
  printf '{\n  "$schema": "https://biomejs.dev/schemas/%s/schema.json",\n  "linter": {}\n}\n' "$2" > "$1/biome.json"
}
mk_pkg() { # <dir> <installed-biome-version>
  printf '{\n  "devDependencies": { "@biomejs/biome": "^%s" }\n}\n' "$2" > "$1/package.json"
}

# --- Case A: project NEWER than template (the personal-page-v2 red-lock class) ---
echo "Case A — project biome 2.5.1, template 2.5.0, installed biome 2.5.1 → project-newer, exit 1"
PROJ="$TMP/a/proj"; TMPL="$TMP/a/tmpl"
mk_biome "$PROJ" "2.5.1"; mk_pkg "$PROJ" "2.5.1"
mk_biome "$TMPL" "2.5.0"
out=$(bash "$DETECT" "$PROJ" "$TMPL"); rc=$?
echo "$out" | grep -q $'biome.json\tproject-newer' && ok "verdict project-newer" || bad "expected project-newer, got: $out"
[ "$rc" -eq 1 ] && ok "exit 1 (back-port required)" || bad "expected exit 1, got $rc"

# --- Case B: project OLDER than template (the normal stale-project case) ---
echo "Case B — project biome 2.5.0, template 2.5.1 → template-current, exit 0 (overwrite is correct)"
PROJ="$TMP/b/proj"; TMPL="$TMP/b/tmpl"
mk_biome "$PROJ" "2.5.0"; mk_pkg "$PROJ" "2.5.0"
mk_biome "$TMPL" "2.5.1"
out=$(bash "$DETECT" "$PROJ" "$TMPL"); rc=$?
echo "$out" | grep -q $'biome.json\ttemplate-current' && ok "verdict template-current" || bad "expected template-current, got: $out"
[ "$rc" -eq 0 ] && ok "exit 0 (safe to overwrite)" || bad "expected exit 0, got $rc"

# --- Case C: equal schemas → template-current, exit 0 ---
echo "Case C — project biome 2.5.1, template 2.5.1 → template-current, exit 0"
PROJ="$TMP/c/proj"; TMPL="$TMP/c/tmpl"
mk_biome "$PROJ" "2.5.1"; mk_pkg "$PROJ" "2.5.1"
mk_biome "$TMPL" "2.5.1"
out=$(bash "$DETECT" "$PROJ" "$TMPL"); rc=$?
echo "$out" | grep -q $'biome.json\ttemplate-current' && ok "verdict template-current (equal)" || bad "expected template-current, got: $out"
[ "$rc" -eq 0 ] && ok "exit 0" || bad "expected exit 0, got $rc"

# --- Case D: real repo template vs a stale-project fixture (exercises the shipped template file) ---
echo "Case D — real plugin template (>= project) → not project-newer for a matching project"
REALTMPL="$(cd "$HERE/../templates/stack-a-nextjs" && pwd)"
if [ -f "$REALTMPL/biome.json" ]; then
  realv=$(grep -oE '/schemas/[0-9]+\.[0-9]+\.[0-9]+/' "$REALTMPL/biome.json" | head -1 | tr -d '/' | sed 's|schemas||')
  PROJ="$TMP/d/proj"; mk_biome "$PROJ" "$realv"; mk_pkg "$PROJ" "$realv"
  out=$(bash "$DETECT" "$PROJ" "$REALTMPL"); rc=$?
  echo "$out" | grep -q $'biome.json\ttemplate-current' && ok "matching project → template-current" || bad "got: $out"
  [ "$rc" -eq 0 ] && ok "exit 0 against real template" || bad "expected exit 0, got $rc"
else
  echo "  (skipped — no real template biome.json found)"
fi

echo
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
