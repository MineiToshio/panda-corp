#!/bin/bash
# Self-test for WP-05: verify.sh's `--report-all` flag + the ALWAYS-written
# .pandacorp/run/gate-report.json (plugin/templates/stack-a-nextjs/verify.sh).
#
# RED (before WP-05): a red cheap sub-gate aborted the whole script at the FIRST failure (no way to
# see two broken gates in one pass) and nothing ever wrote a machine-readable verdict — only human
# stdout, which Mission Control (or any other reader) would have to scrape.
# GREEN (proven here): `--report-all` makes the 9 cheap sub-gates accumulate every failure before
# aborting once; without the flag, behavior stays fail-fast (only the first offender runs); every
# run — green or red, flagged or not — writes gate-report.json; a stale report from a prior run
# never survives into the next one's verdict (LESSON-0155).
#
# Runs entirely against SYNTHETIC fixtures: a throwaway project directory with a stubbed `pnpm` on
# PATH (so no real biome/tsc/vitest/playwright toolchain is needed) plus real files for the
# gates that don't go through pnpm (the structure guard). Run from the factory repo root:
#   bash plugin/scripts/test-verify-gate-report.sh

set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd)
VERIFY="$HERE/plugin/templates/stack-a-nextjs/verify.sh"
pass=0; fail=0

ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=$((fail+1)); if [ -n "${2:-}" ]; then echo "$2" | sed 's/^/      /'; fi }

# --- Fixture project scaffolding ---------------------------------------------------------------
# One throwaway project per scenario (fresh, never reused — a stray report or stray fixture file
# from a previous scenario must never leak into the next one's verdict).
new_fixture() {
  local dir
  dir=$(mktemp -d)
  mkdir -p "$dir/.pandacorp" "$dir/src/_tests" "$dir/bin"
  echo '{"name":"wp05-fixture"}' > "$dir/package.json"

  # Stubbed `pnpm` — responds to the exact subcommands verify.sh invokes. Each tool's pass/fail is
  # controlled by an env var the calling test sets before invoking verify.sh, so one binary covers
  # every scenario without per-scenario PATH juggling.
  cat > "$dir/bin/pnpm" <<'STUB'
#!/bin/bash
# WP-08: when WP08_ARGV_LOG is set, record the FULL argv of every invocation (one line each) so a
# scenario can assert HOW a tool was called (biome scoped to files, vitest switched to `related`),
# not just whether it ran. Unset in every pre-WP-08 scenario -> byte-identical behavior there.
if [ -n "${WP08_ARGV_LOG:-}" ]; then printf 'pnpm %s\n' "$*" >> "$WP08_ARGV_LOG"; fi
case "$1" in
  biome)
    if [ "${WP05_FAIL_BIOME:-0}" = "1" ]; then
      echo "src/broken.ts:3:5 lint/suspicious/noExplicitAny ── FIXTURE forced biome failure"
      exit 1
    fi
    exit 0
    ;;
  tsc)
    if [ "${WP05_FAIL_TSC:-0}" = "1" ]; then
      echo "src/broken.ts(3,5): error TS2322: FIXTURE forced tsc failure"
      exit 1
    fi
    exit 0
    ;;
  knip)
    if [ "${WP05_FAIL_KNIP:-0}" = "1" ]; then
      echo "Unused files (1)"
      echo "src/orphan.ts"
      exit 1
    fi
    exit 0
    ;;
  madge)
    if [ "${WP05_FAIL_MADGE:-0}" = "1" ]; then
      echo "✖ Found 1 circular dependency!"
      echo ""
      echo "1) src/a.ts > src/b.ts > src/a.ts"
      exit 1
    fi
    exit 0
    ;;
  vitest)
    if [ "${WP05_FAIL_VITEST:-0}" = "1" ]; then
      echo " FAIL  src/foo/_tests/bar.test.ts > suite > FIXTURE forced vitest failure"
      exit 1
    fi
    exit 0
    ;;
  exec)
    if [ "$2" = "playwright" ]; then
      if [ "${WP05_FAIL_PLAYWRIGHT:-0}" = "1" ]; then
        echo "1) e2e/smoke.spec.ts:10:5 › smoke › FIXTURE forced playwright failure"
        exit 1
      fi
      exit 0
    fi
    exit 0
    ;;
  *) exit 0 ;;
esac
STUB
  chmod +x "$dir/bin/pnpm"
  printf '%s\n' "$dir"
}

# Makes the playwright presence-check pass (so a "green" scenario doesn't red on a missing spec
# file — verify.sh's own gate, not what this test is proving).
add_playwright_fixtures() {
  local dir="$1"
  mkdir -p "$dir/e2e"
  : > "$dir/playwright.config.ts"
  for f in smoke visual responsive shell headers; do : > "$dir/e2e/$f.spec.ts"; done
}

# Runs verify.sh inside the fixture dir with the stub `pnpm` first on PATH. Captures combined
# output + exit code; the JSON report (if any) is read by the caller from "$dir/.pandacorp/run/gate-report.json".
run_verify() {
  local dir="$1"; shift
  ( cd "$dir" && PATH="$dir/bin:$PATH" bash "$VERIFY" "$@" )
}

report_path() { echo "$1/.pandacorp/run/gate-report.json"; }

json_get() { # $1 report file, $2 python expression on `d`
  python3 -c "
import json, sys
with open(sys.argv[1]) as fh:
    d = json.load(fh)
print($2)
" "$1"
}

echo "== verify.sh WP-05: --report-all + gate-report.json self-test =="

# --- Scenario (a): --report-all accumulates TWO red cheap sub-gates, both appear, script exits red
FX=$(new_fixture)
echo 'export const stray = 1;' > "$FX/src/stray.test.ts"   # breaks structure-guard (outside _tests/)
add_playwright_fixtures "$FX"
out=$(WP05_FAIL_BIOME=1 run_verify "$FX" --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -ne 0 ] && [ -f "$rf" ]; then
  names=$(json_get "$rf" "[s['name'] for s in d['subgates'] if s['exit'] != 0]")
  green=$(json_get "$rf" "d['green']")
  if echo "$names" | grep -q "structure-guard" && echo "$names" | grep -q "biome" && [ "$green" = "False" ]; then
    ok "(a) --report-all: both structure-guard AND biome appear failed, green:false, script exit=$rc"
  else
    bad "(a) --report-all: expected BOTH structure-guard+biome failed (got: $names, green=$green)" "$out"
  fi
else
  bad "(a) --report-all: expected non-zero exit + a written report (rc=$rc, report exists=$([ -f "$rf" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# --- Scenario (b): WITHOUT the flag, only the FIRST offender (structure-guard) runs — fail-fast,
# unchanged from pre-WP-05 behavior — even though a LATER gate (biome) is ALSO broken.
FX=$(new_fixture)
echo 'export const stray = 1;' > "$FX/src/stray.test.ts"
add_playwright_fixtures "$FX"
out=$(WP05_FAIL_BIOME=1 run_verify "$FX"); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -ne 0 ] && [ -f "$rf" ]; then
  count=$(json_get "$rf" "len(d['subgates'])")
  names=$(json_get "$rf" "[s['name'] for s in d['subgates']]")
  green=$(json_get "$rf" "d['green']")
  if [ "$count" = "1" ] && echo "$names" | grep -q "structure-guard" && [ "$green" = "False" ]; then
    ok "(b) no flag: only structure-guard ran (fail-fast unchanged), green:false, script exit=$rc"
  else
    bad "(b) no flag: expected exactly 1 subgate (structure-guard) — got count=$count names=$names green=$green" "$out"
  fi
else
  bad "(b) no flag: expected non-zero exit + a written report (rc=$rc, report exists=$([ -f "$rf" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# --- Scenario (c): everything green -> green:true, duration_ms numeric on every subgate.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
out=$(run_verify "$FX" --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ]; then
  green=$(json_get "$rf" "d['green']")
  count=$(json_get "$rf" "len(d['subgates'])")
  numeric=$(json_get "$rf" "all(isinstance(s['duration_ms'], int) and s['duration_ms'] >= 0 for s in d['subgates'])")
  scope=$(json_get "$rf" "d['scope']")
  if [ "$green" = "True" ] && [ "$numeric" = "True" ] && [ "$count" = "11" ] && [ "$scope" = "full" ]; then
    ok "(c) all-green: green:true, $count subgates, every duration_ms numeric, scope=full"
  else
    bad "(c) all-green: expected green=True numeric=True count=11 scope=full — got green=$green numeric=$numeric count=$count scope=$scope" "$out"
  fi
else
  bad "(c) all-green: expected exit 0 + a written report (rc=$rc, report exists=$([ -f "$rf" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# --- Scenario (d): a stale report from a PRIOR run must never survive into this run's verdict.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
mkdir -p "$FX/.pandacorp/run"
echo '{"at":"1999-01-01T00:00:00Z","scope":"full","green":true,"subgates":[{"name":"stale-marker","exit":0,"duration_ms":1,"failures":[]}]}' > "$(report_path "$FX")"
out=$(run_verify "$FX" --report-all); rc=$?
rf=$(report_path "$FX")
if [ -f "$rf" ]; then
  has_stale=$(json_get "$rf" "any(s['name'] == 'stale-marker' for s in d['subgates'])")
  at=$(json_get "$rf" "d['at']")
  if [ "$has_stale" = "False" ] && [ "$at" != "1999-01-01T00:00:00Z" ]; then
    ok "(d) stale prior-run report is gone; this run's own verdict is written (at=$at)"
  else
    bad "(d) stale prior-run report leaked into this run's verdict (has_stale=$has_stale at=$at)" "$out"
  fi
else
  bad "(d) expected a report to exist after the run (rc=$rc)" "$out"
fi
rm -rf "$FX"

# --- Bonus: `--since <sha>` still composes with `--report-all` (scope reflects it; both flags honored)
FX=$(new_fixture)
add_playwright_fixtures "$FX"
out=$(run_verify "$FX" --since deadbeef --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ]; then
  scope=$(json_get "$rf" "d['scope']")
  if [ "$scope" = "since" ]; then
    ok "(bonus) --since + --report-all compose: scope=since, still green"
  else
    bad "(bonus) --since + --report-all: expected scope=since, got scope=$scope" "$out"
  fi
else
  bad "(bonus) --since + --report-all: expected exit 0 + a written report (rc=$rc)" "$out"
fi
rm -rf "$FX"

# --- Bonus: `--canary` is untouched — with no .pandacorp/canary.sh installed it stays the DR-079
# vacuous pass, and (because it execs away / returns before the report scaffolding) it must NOT
# write a gate-report.json of its own.
FX=$(new_fixture)
out=$(run_verify "$FX" --canary); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && echo "$out" | grep -q "vacuous pass" && [ ! -f "$rf" ]; then
  ok "(bonus) --canary: still a vacuous pass, and writes no gate-report.json of its own"
else
  bad "(bonus) --canary: expected rc=0 + vacuous-pass message + no report file (rc=$rc, report exists=$([ -f "$rf" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# ═══════════════════════════════════════════════════════════════════════════════════════════════
# WP-08 — `--only=<subgate,...>` and `--files=<file,...>` (the SCOPED repair gate)
#
# RED (before WP-08): there was no way to re-run a single sub-gate. The build engine's in-place patch
# loop re-ran knip + `biome .` + tsc WHOLE-PROJECT on every one of its internal self-repair cycles,
# and a caller that wanted "just tsc, just these two files" had to run the entire 11-gate suite.
# GREEN (proven here): `--only` runs exactly the named sub-gates; `--files` scopes biome to those
# files and switches vitest to `vitest related <files>`; EITHER flag stamps the gate report
# `scope:"partial"` so no later reader can mistake a scoped run for a full green; an unknown `--only`
# name is a fail-closed non-zero exit BEFORE any gate runs (never a silent full-suite fallback).
# ═══════════════════════════════════════════════════════════════════════════════════════════════

# --- Scenario (e): --only=tsc,biome runs ONLY those two sub-gates and marks the report partial.
FX=$(new_fixture)
echo 'export const stray = 1;' > "$FX/src/stray.test.ts"   # structure-guard WOULD fail — it must not even run
add_playwright_fixtures "$FX"
out=$(run_verify "$FX" --only=tsc,biome); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ]; then
  names=$(json_get "$rf" "sorted(s['name'] for s in d['subgates'])")
  scope=$(json_get "$rf" "d['scope']")
  green=$(json_get "$rf" "d['green']")
  if [ "$names" = "['biome', 'tsc']" ] && [ "$scope" = "partial" ] && [ "$green" = "True" ]; then
    ok "(e) --only=tsc,biome: exactly those two sub-gates ran (structure-guard/vitest/playwright skipped), scope=partial"
  else
    bad "(e) --only=tsc,biome: expected names=['biome', 'tsc'] scope=partial green=True — got names=$names scope=$scope green=$green" "$out"
  fi
else
  bad "(e) --only=tsc,biome: expected exit 0 + a written report (rc=$rc, report exists=$([ -f "$rf" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# --- Scenario (f): --files scopes biome to exactly those files and vitest to `vitest related <files>`;
# tsc/knip/madge stay GLOBAL (unscoped, by design); the report is partial.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
: > "$FX/src/a.ts"; : > "$FX/src/b.ts"
ARGV="$FX/argv.log"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" --files=src/a.ts,src/b.ts); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ] && [ -f "$ARGV" ]; then
  scope=$(json_get "$rf" "d['scope']")
  biome_line=$(grep '^pnpm biome' "$ARGV" || true)
  vitest_line=$(grep '^pnpm vitest' "$ARGV" || true)
  tsc_line=$(grep '^pnpm tsc' "$ARGV" || true)
  okf=1
  echo "$biome_line" | grep -q 'src/a.ts src/b.ts' || okf=0
  echo "$biome_line" | grep -q 'biome check \.' && okf=0
  echo "$vitest_line" | grep -q 'vitest related src/a.ts src/b.ts' || okf=0
  echo "$tsc_line" | grep -q 'tsc --noEmit' || okf=0          # tsc stays global (no file list)
  echo "$tsc_line" | grep -q 'src/a.ts' && okf=0
  if [ "$okf" = "1" ] && [ "$scope" = "partial" ]; then
    ok "(f) --files: biome scoped to the files, vitest switched to \`related\`, tsc still global, scope=partial"
  else
    bad "(f) --files: expected scoped biome + \`vitest related\` + global tsc + scope=partial (scope=$scope) — biome:[$biome_line] vitest:[$vitest_line] tsc:[$tsc_line]" "$out"
  fi
else
  bad "(f) --files: expected exit 0 + a report + an argv log (rc=$rc)" "$out"
fi
rm -rf "$FX"

# --- Scenario (g): an UNKNOWN --only name is fail-closed — non-zero exit, and NO sub-gate runs
# (never a silent degrade to the full suite, which would read as a full green).
FX=$(new_fixture)
add_playwright_fixtures "$FX"
ARGV="$FX/argv.log"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=tsc,typecheck); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -ne 0 ] && [ ! -f "$ARGV" ]; then
  if [ -f "$rf" ]; then
    green=$(json_get "$rf" "d['green']")
    scope=$(json_get "$rf" "d['scope']")
  else
    green="(no report)"; scope="(no report)"
  fi
  if echo "$out" | grep -q "typecheck" && [ "$green" != "True" ]; then
    ok "(g) --only with an unknown sub-gate: fail-closed exit=$rc, no gate ran, verdict never green (scope=$scope)"
  else
    bad "(g) --only unknown: expected the offending name in the message and a non-green verdict (green=$green)" "$out"
  fi
else
  bad "(g) --only unknown: expected a non-zero exit BEFORE any gate ran (rc=$rc, any tool invoked=$([ -f "$ARGV" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# --- Scenario (h): WITHOUT the new flags nothing changes — all 11 sub-gates, scope=full, and the
# biome/vitest command lines are byte-for-byte the pre-WP-08 ones.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
ARGV="$FX/argv.log"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX"); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ] && [ -f "$ARGV" ]; then
  count=$(json_get "$rf" "len(d['subgates'])")
  scope=$(json_get "$rf" "d['scope']")
  biome_line=$(grep '^pnpm biome' "$ARGV" || true)
  vitest_line=$(grep '^pnpm vitest' "$ARGV" || true)
  if [ "$count" = "11" ] && [ "$scope" = "full" ] \
     && [ "$biome_line" = "pnpm biome check . --error-on-warnings" ] \
     && [ "$vitest_line" = "pnpm vitest run --reporter=dot" ]; then
    ok "(h) no new flags: 11 sub-gates, scope=full, biome/vitest invoked exactly as before WP-08"
  else
    bad "(h) no new flags: expected count=11 scope=full and the legacy command lines — got count=$count scope=$scope biome:[$biome_line] vitest:[$vitest_line]" "$out"
  fi
else
  bad "(h) no new flags: expected exit 0 + a report + an argv log (rc=$rc)" "$out"
fi
rm -rf "$FX"

# --- Scenario (i): a scoped run that REDs still reds, and its report is partial — a partial report is
# never confusable with a full verdict in either direction.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
out=$(WP05_FAIL_TSC=1 run_verify "$FX" --only=tsc --files=src/broken.ts); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -ne 0 ] && [ -f "$rf" ]; then
  scope=$(json_get "$rf" "d['scope']")
  green=$(json_get "$rf" "d['green']")
  files=$(json_get "$rf" "[f.get('file') for s in d['subgates'] for f in s['failures']]")
  if [ "$scope" = "partial" ] && [ "$green" = "False" ] && echo "$files" | grep -q "src/broken.ts"; then
    ok "(i) scoped red: green:false, scope=partial, the tsc parser still anchors the failure to its file"
  else
    bad "(i) scoped red: expected scope=partial green=False with a parsed file — got scope=$scope green=$green files=$files" "$out"
  fi
else
  bad "(i) scoped red: expected a non-zero exit + a written report (rc=$rc)" "$out"
fi
rm -rf "$FX"

echo ""
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
