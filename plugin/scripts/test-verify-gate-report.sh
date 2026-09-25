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

# ---- BL-0179 ----
# The close-out reuse check (pandacorp-build.js) can only treat a `scope:"since"` report as
# equivalent to a full one when it can PROVE the `--since` base matches the current last_green_sha —
# which requires the report to carry that base at all. Before this fix, `write_gate_report` never
# read $SINCE, so a `since`-scoped report had no way to say what it was scoped FROM.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
out=$(run_verify "$FX" --since deadbeefcafe --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ]; then
  since=$(json_get "$rf" "d.get('since', '')")
  if [ "$since" = "deadbeefcafe" ]; then
    ok "(BL-0179) --since base is stamped into the report as 'since'"
  else
    bad "(BL-0179) expected since=deadbeefcafe, got since=$since" "$out"
  fi
else
  bad "(BL-0179) --since: expected exit 0 + a written report (rc=$rc)" "$out"
fi
rm -rf "$FX"

echo "Case (BL-0179 control) -- a full (unscoped) run stamps no 'since' field at all"
FX=$(new_fixture)
add_playwright_fixtures "$FX"
out=$(run_verify "$FX" --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 0 ] && [ -f "$rf" ]; then
  has_since=$(json_get "$rf" "'since' in d")
  if [ "$has_since" = "False" ]; then
    ok "(BL-0179) a full run carries no 'since' field (nothing to anchor)"
  else
    bad "(BL-0179) a full run should not carry 'since', got: $(json_get "$rf" "d.get('since')")" "$out"
  fi
else
  bad "(BL-0179 control) full run: expected exit 0 + a written report (rc=$rc)" "$out"
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
# REV-* — ADVERSARIAL REVIEW SCENARIOS (speed sprint A/B, DR-015 independent reviewer).
# Written by the reviewer, not by WP-05's implementers.
# ═══════════════════════════════════════════════════════════════════════════════════════════════

# --- REV-A: the LAST of the 9 cheap gates (madge) is the ONLY red one, everything before it green.
# The aggregate abort at the bottom of the cheap block must still exit non-zero (LESSON-0078: the
# PIPESTATUS capture, not `$?` after the tee pipe) and must NOT let vitest/playwright run.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
out=$(WP05_FAIL_MADGE=1 run_verify "$FX" --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -ne 0 ] && [ -f "$rf" ]; then
  green=$(json_get "$rf" "d['green']")
  count=$(json_get "$rf" "len(d['subgates'])")
  failed_names=$(json_get "$rf" "sorted(s['name'] for s in d['subgates'] if s['exit'] != 0)")
  ran_expensive=$(json_get "$rf" "any(s['name'] in ('vitest','playwright') for s in d['subgates'])")
  if [ "$green" = "False" ] && [ "$count" = "9" ] && [ "$failed_names" = "['madge']" ] && [ "$ran_expensive" = "False" ]; then
    ok "(REV-A) --report-all with only the 9th cheap gate red: exit=$rc, green:false, all 9 cheap gates reported, madge the only failure, no expensive layer run"
  else
    bad "(REV-A) expected green=False count=9 failed=['madge'] expensive=False — got green=$green count=$count failed=$failed_names expensive=$ran_expensive" "$out"
  fi
else
  bad "(REV-A) a red 9th cheap gate must still exit non-zero with a written report (rc=$rc, report exists=$([ -f "$rf" ] && echo yes || echo no))" "$out"
fi
rm -rf "$FX"

# --- REV-B: a cheap gate that fails with NO output at all must never record an EMPTY failures[]
# (DR-078 fail-loud: "source is empty" and "could not interpret it" must not collapse into silence).
FX=$(new_fixture)
add_playwright_fixtures "$FX"
cat > "$FX/bin/pnpm" <<'SILENT'
#!/bin/bash
case "$1" in
  knip) exit 1 ;;   # red, and deliberately prints NOTHING
  *) exit 0 ;;
esac
SILENT
chmod +x "$FX/bin/pnpm"
out=$(run_verify "$FX" --report-all); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -ne 0 ] && [ -f "$rf" ]; then
  nonempty=$(json_get "$rf" "all(len(s['failures']) > 0 for s in d['subgates'] if s['exit'] != 0)")
  if [ "$nonempty" = "True" ]; then
    ok "(REV-B) a silent red gate still records a non-empty failures[] (never a quiet empty array)"
  else
    bad "(REV-B) a red gate recorded an EMPTY failures[] — a reader cannot tell 'no findings' from 'unparsed'" "$out"
  fi
else
  bad "(REV-B) expected a non-zero exit + a written report (rc=$rc)" "$out"
fi
rm -rf "$FX"

# --- REV-C: LESSON-0155 across the `--canary` branch. verify.sh deletes the stale report at :63,
# but the `--canary` early `exec`/exit at :44-47 runs BEFORE that, so a report left by a PREVIOUS
# verify run survives a canary run and a machine reader takes it as the current verdict.
# Minimal fix: move the REPORT_DIR/REPORT_FILE/`mkdir -p`/`rm -f` block (:60-63) ABOVE the --canary branch.
FX=$(new_fixture)
mkdir -p "$FX/.pandacorp/run"
echo '{"at":"1999-01-01T00:00:00Z","scope":"full","green":true,"subgates":[{"name":"stale-marker","exit":0,"duration_ms":1,"failures":[]}]}' > "$(report_path "$FX")"
out=$(run_verify "$FX" --canary); rc=$?
rf=$(report_path "$FX")
if [ ! -f "$rf" ]; then
  ok "(REV-C) a --canary run does not leave a stale prior-run gate-report.json behind"
else
  stale_at=$(json_get "$rf" "d['at']")
  bad "(REV-C) a stale prior-run gate-report.json SURVIVED a --canary run (at=$stale_at) — LESSON-0155 says it must never be readable as this run's verdict" "$out"
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

# ═══════════════════════════════════════════════════════════════════════════════════════════
# REV2 — INDEPENDENT REVIEW (DR-015) of WP-08's scoped-run surface.
# ═══════════════════════════════════════════════════════════════════════════════════════════

# REV2-F · an unknown --only name must exit non-zero BEFORE any sub-gate runs (fail-closed, never a
# silent degrade to "run everything"). Proven by the argv log being empty: no tool was invoked at all.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
ARGV="$FX/argv.log"; : > "$ARGV"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=tsk 2>&1); rc=$?
rf=$(report_path "$FX")
if [ "$rc" -eq 2 ] && [ ! -s "$ARGV" ] && [ -f "$rf" ] && [ "$(json_get "$rf" "d['green']")" = "False" ]; then
  ok "(REV2-F) unknown --only name: exit 2, ZERO tools invoked, report green:false"
else
  bad "(REV2-F) unknown --only name: expected rc=2 with an empty argv log and a red report — got rc=$rc argv=[$(cat "$ARGV" 2>/dev/null)]" "$out"
fi
rm -rf "$FX"

# REV2-G · --files is NOT validated the way --only is. A value that looks like a FLAG is forwarded
# verbatim into the biome command line, so a gate-report `failures[].file` value the engine copies
# out of a model's verdict can turn the read-only check into a project-wide autofix
# (`biome check --write`). The scoped path is fail-closed on gate NAMES and wide open on gate INPUTS.
FX=$(new_fixture)
add_playwright_fixtures "$FX"
ARGV="$FX/argv.log"; : > "$ARGV"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=biome --files=--write 2>&1); rc=$?
if grep -q -- '--write' "$ARGV" 2>/dev/null; then
  bad "(REV2-G) --files forwards a flag-shaped value straight into biome: [$(grep biome "$ARGV" | head -1)] — --only validates its names, --files validates nothing" "$out"
else
  ok "(REV2-G) --files rejects or neutralises a flag-shaped path"
fi
rm -rf "$FX"

# REV2-H · the `partial` label must survive EVERY combination — including the one where a caller
# spells --since AFTER a scope flag. (--since is parsed positionally from $1/$2 only, so this
# invocation silently loses the since-ref; the report must still be honest about being partial.)
FX=$(new_fixture)
add_playwright_fixtures "$FX"
ARGV="$FX/argv.log"; : > "$ARGV"
out=$(WP08_ARGV_LOG="$ARGV" run_verify "$FX" --only=biome --since deadbeef 2>&1); rc=$?
rf=$(report_path "$FX")
if [ -f "$rf" ] && [ "$(json_get "$rf" "d['scope']")" = "partial" ]; then
  ok "(REV2-H) scope stays partial when --since trails a scope flag (--since itself is silently dropped by the positional parse)"
else
  bad "(REV2-H) expected scope=partial, got $(json_get "$rf" "d['scope']" 2>/dev/null)" "$out"
fi
rm -rf "$FX"

echo ""
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
