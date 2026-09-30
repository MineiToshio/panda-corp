#!/bin/bash
# Self-test for scan-portfolio.sh — proves the "Última sync" column check goes quiet on a clean
# portfolio and reports MALFORMED for prose, an empty cell and a wrong date shape, without
# hiding the normal per-project line (constitution §24: a check that cannot fail proves nothing).
#   bash plugin/scripts/test-scan-portfolio.sh

set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
SCAN="$HERE/plugin/scripts/scan-portfolio.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0
n_fixture=0

ok() { echo "  ✓ $1"; pass=$((pass+1)); }
ko() { echo "  ✗ $1: $2"; fail=$((fail+1)); }

make_factory() { # $1 = last-column cell content -> prints the fixture factory root
  local root
  n_fixture=$((n_fixture+1))
  root="$TMP/f$n_fixture"
  mkdir -p "$root/factory" "$root/plugin/templates" "$root/proj/.pandacorp"
  echo "1.0.0" > "$root/plugin/templates/OVERLAY_VERSION"
  printf 'phase: release\noverlay_version: "1.0.0"\nwork_orders_total: 2\nwork_orders_done: 2\nrunning: false\n' > "$root/proj/.pandacorp/status.yaml"
  {
    echo '| Proyecto | Ruta | Repo | Idea origen | Fase | Usuarios | Retorno | Veredicto | Última sync |'
    echo '|---|---|---|---|---|---|---|---|---|'
    echo "| Demo | \`proj/\` | — | demo | release | 1 | personal | hold — note | $1 |"
  } > "$root/factory/portfolio.md"
  echo "$root"
}

expect() { # $1 label, $2 cell, $3 expected MALFORMED count (0 or 1)
  local root out n
  root=$(make_factory "$2")
  out=$(bash "$SCAN" "$root" 2>&1)
  n=$(printf '%s\n' "$out" | grep -c '^MALFORMED · Demo')
  if [ "$n" = "$3" ] && printf '%s\n' "$out" | grep -q '^proj/ · phase=release'; then
    ok "$1"
  else
    ko "$1" "expected $3 MALFORMED line(s) plus the normal project line, got: $out"
  fi
}

expect "a plain YYYY-MM-DD date is accepted" "2026-09-21" 0
expect "prose in the last column is reported" "**Re-check 2026-09-21 (rutina programada):** SIN VEREDICTO NUEVO" 1
expect "an empty last column is reported" "" 1
expect "a date with a trailing note is reported" "2026-09-21 (auto)" 1
expect "a wrong date shape is reported" "21/09/2026" 1

root=$(make_factory "prose here")
summary=$(bash "$SCAN" "$root" 2>&1 | tail -1)
if [ "$summary" = "Scanned 1 project row(s), 0 broken, 1 malformed." ]; then
  ok "the closing summary counts malformed rows"
else
  ko "summary" "$summary"
fi

echo "scan-portfolio: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
